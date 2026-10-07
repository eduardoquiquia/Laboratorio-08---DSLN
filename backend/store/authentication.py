import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from .models import AuthSession


def enforce_csrf(request):
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    if check.process_view(request, None, (), {}):
        raise PermissionDenied('La verificación CSRF falló. Recarga la página.')


class CookieJWTAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Session'

    def authenticate(self, request):
        token = request.COOKIES.get('techstore_access')
        if not token:
            return None
        try:
            claims = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'],
                                audience='techstore', issuer='techstore-local',
                                options={'require': ['exp', 'iat', 'sub', 'jti']})
            session = AuthSession.objects.select_related('user', 'user__store').get(
                pk=claims['jti'], user_id=claims['sub'], revoked=False,
                expires_at__gt=timezone.now())
        except (jwt.PyJWTError, AuthSession.DoesNotExist, ValueError, TypeError):
            raise AuthenticationFailed('La sesión venció. Inicia sesión de nuevo.')
        if not session.user.is_active or not session.user.email_verified or not session.user.mfa_enabled:
            raise AuthenticationFailed('La cuenta ya no tiene una sesión válida.')
        enforce_csrf(request)
        return session.user, session
