import base64
import io
import re
import time
import uuid
from datetime import timedelta
import jwt
import pyotp
import qrcode
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .authentication import enforce_csrf
from .models import User, LoginChallenge, AuthSession
from .serializers import UserSerializer
from .security import audit, locked, block, start_challenge, cipher

DUMMY_HASH = make_password(uuid.uuid4().hex)


def blocked_response(user):
    return Response({'detail': 'Acceso bloqueado temporalmente.',
                     'locked_until': user.locked_until.isoformat()}, status=429)


def partial_user(request):
    challenge_id = request.session.get('challenge')
    if not challenge_id:
        return None, None
    challenge = LoginChallenge.objects.filter(pk=challenge_id, used=False,
                                               expires_at__gt=timezone.now()).first()
    if not challenge:
        return None, None
    user = User.objects.select_for_update().select_related('store').get(pk=challenge.user_id)
    if not user.is_active:
        return None, None
    return challenge, user


def stage(user, challenge):
    return {'stage': 'email' if not user.email_verified else ('totp' if user.mfa_enabled else 'enroll'),
            'expires_at': challenge.expires_at.isoformat(), 'email': user.email}


class PublicView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class CSRFView(PublicView):
    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class LoginView(PublicView):
    @transaction.atomic
    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password', '')
        if not isinstance(email, str) or not isinstance(password, str) or len(password) > 128:
            return Response({'detail': 'Credenciales inválidas.'}, status=400)
        user = User.objects.select_for_update().filter(email=email.strip().lower()).first()
        if not user or not user.is_active:
            check_password(password, DUMMY_HASH)
            audit('login_failed', user, detail='Credenciales inválidas o cuenta no disponible.')
            return Response({'detail': 'Correo o contraseña incorrectos, o cuenta no disponible.'}, status=400)
        if locked(user):
            audit('login_failed', user, detail='Intento durante bloqueo.')
            return blocked_response(user)
        if not user.check_password(password):
            user.password_failures += 1
            user.save(update_fields=['password_failures'])
            audit('login_failed', user, detail='Contraseña incorrecta.')
            if user.password_failures >= 5:
                block(user)
                return blocked_response(user)
            return Response({'detail': 'Correo o contraseña incorrectos, o cuenta no disponible.'}, status=400)
        user.password_failures = 0
        user.save(update_fields=['password_failures'])
        challenge = start_challenge(request, user)
        return Response(stage(user, challenge))


class PartialView(PublicView):
    @transaction.atomic
    def get(self, request):
        challenge, user = partial_user(request)
        if not user:
            return Response({'stage': 'login'})
        if locked(user):
            return blocked_response(user)
        return Response(stage(user, challenge))


class SendVerificationView(PublicView):
    @transaction.atomic
    def post(self, request):
        challenge, user = partial_user(request)
        if not user:
            return Response({'detail': 'Vuelve a iniciar sesión.', 'restart': True}, status=400)
        if locked(user):
            return blocked_response(user)
        if user.email_verified:
            return Response(stage(user, challenge))
        now = timezone.now()
        if user.verification_sent_at and (now - user.verification_sent_at).total_seconds() < 60:
            return Response({'detail': 'Espera un minuto antes de reenviar el enlace.'}, status=429)
        user.verification_nonce = uuid.uuid4()
        user.verification_sent_at = now
        user.save(update_fields=['verification_nonce', 'verification_sent_at'])
        token = signing.dumps({'user': user.pk, 'email': user.email, 'nonce': str(user.verification_nonce)}, salt='verify-email')
        url = f'{settings.FRONTEND_URL}/?verify={token}'
        send_mail('Verifica tu correo · TechStore',
                  f'Abre este enlace en 30 minutos para verificar tu correo:\n{url}\n'
                  'Luego inicia sesión y completa TOTP. Demostración local: entrega simulada por consola.',
                  settings.DEFAULT_FROM_EMAIL, [user.email])
        return Response({'detail': 'Enlace generado. Revisa la terminal de Django (entrega simulada).', 'resend_after': 60})


class VerifyEmailView(PublicView):
    @transaction.atomic
    def post(self, request):
        try:
            data = signing.loads(request.data.get('token', ''), salt='verify-email', max_age=1800)
            user = User.objects.select_for_update().get(pk=data['user'], email=data['email'],
                verification_nonce=data['nonce'], email_verified=False, is_active=True)
        except (signing.BadSignature, User.DoesNotExist, KeyError, ValueError, TypeError):
            return Response({'detail': 'Enlace inválido, utilizado o vencido. Solicita uno nuevo.'}, status=400)
        user.email_verified = True
        user.verification_nonce = uuid.uuid4()
        user.save(update_fields=['email_verified', 'verification_nonce'])
        LoginChallenge.objects.filter(user=user).update(used=True)
        return Response({'detail': 'Correo verificado. Inicia sesión y completa TOTP para continuar.'})


class EnrollmentView(PublicView):
    @transaction.atomic
    def post(self, request):
        challenge, user = partial_user(request)
        if not user:
            return Response({'detail': 'El proceso venció. Inicia sesión.', 'restart': True}, status=400)
        if locked(user):
            return blocked_response(user)
        if not user.email_verified or user.mfa_enabled:
            return Response({'detail': 'Enrolamiento no disponible.'}, status=403)
        if not user.mfa_secret:
            user.mfa_secret = cipher().encrypt(pyotp.random_base32().encode()).decode()
            user.save(update_fields=['mfa_secret'])
        secret = cipher().decrypt(user.mfa_secret.encode()).decode()
        uri = pyotp.TOTP(secret).provisioning_uri(user.email, issuer_name='TechStore')
        buffer = io.BytesIO()
        qrcode.make(uri).save(buffer, format='PNG')
        return Response({'secret': secret, 'qr': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()})


class TOTPView(PublicView):
    @transaction.atomic
    def post(self, request):
        challenge, user = partial_user(request)
        if not user:
            return Response({'detail': 'El proceso venció. Inicia sesión.', 'restart': True}, status=400)
        if locked(user):
            return blocked_response(user)
        if not user.email_verified or not user.mfa_secret:
            return Response({'detail': 'Verifica el correo y configura el autenticador primero.'}, status=403)
        code = request.data.get('code', '')
        totp = pyotp.TOTP(cipher().decrypt(user.mfa_secret.encode()).decode())
        step = int(time.time()) // 30
        valid = isinstance(code, str) and re.fullmatch(r'\d{6}', code) and totp.verify(code) and step > user.mfa_last_step
        if not valid:
            user.mfa_failures += 1
            user.save(update_fields=['mfa_failures'])
            audit('mfa_failed', user, detail='Código inválido, vencido o reutilizado.')
            if user.mfa_failures >= 3:
                block(user)
                return blocked_response(user)
            return Response({'detail': f'Código inválido o ya utilizado. Quedan {3 - user.mfa_failures} intentos.'}, status=400)
        user.mfa_enabled = True
        user.mfa_last_step = step
        user.mfa_failures = 0
        user.last_login = timezone.now()
        user.save(update_fields=['mfa_enabled', 'mfa_last_step', 'mfa_failures', 'last_login'])
        LoginChallenge.objects.filter(user=user).update(used=True)
        request.session.flush()
        now = timezone.now()
        session = AuthSession.objects.create(user=user, expires_at=now + timedelta(hours=8))
        token = jwt.encode({'sub': str(user.pk), 'jti': str(session.pk), 'iat': now, 'exp': session.expires_at,
                            'iss': 'techstore-local', 'aud': 'techstore'}, settings.SECRET_KEY, algorithm='HS256')
        audit('login_success', user, detail='Autenticación completa con MFA.')
        rotate_token(request)
        response = Response({'user': {**UserSerializer(user).data, 'session_expires_at': session.expires_at.isoformat()},
                             'csrfToken': get_token(request)})
        response.set_cookie('techstore_access', token, httponly=True, secure=False, samesite='Lax', path='/')
        return response


class MeView(APIView):
    def get(self, request):
        response = Response({**UserSerializer(request.user).data, 'session_expires_at': request.auth.expires_at.isoformat()})
        response['Cache-Control'] = 'no-store'
        return response


class LogoutView(PublicView):
    def post(self, request):
        token = request.COOKIES.get('techstore_access')
        if token:
            try:
                data = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'], audience='techstore', issuer='techstore-local')
                AuthSession.objects.filter(pk=data['jti']).update(revoked=True)
            except (jwt.PyJWTError, KeyError, ValueError):
                pass
        challenge = request.session.get('challenge')
        if challenge:
            LoginChallenge.objects.filter(pk=challenge).update(used=True)
        request.session.flush()
        response = Response({'detail': 'Sesión cerrada.'})
        response.delete_cookie('techstore_access', path='/', samesite='Lax')
        return response
