import os
import uuid
from urllib.parse import urlencode
from authlib.integrations.django_client import OAuth
from django.conf import settings
from django.db import transaction
from django.http import HttpResponseRedirect
from django.views.decorators.http import require_GET
from .models import User
from .security import audit, locked, start_challenge

oauth = OAuth()
oauth.register('google', client_id=os.getenv('GOOGLE_CLIENT_ID'), client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile', 'timeout': 15})
oauth.register('github', client_id=os.getenv('GITHUB_CLIENT_ID'), client_secret=os.getenv('GITHUB_CLIENT_SECRET'),
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize', api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'read:user user:email', 'timeout': 15})


def redirect_error(message):
    return HttpResponseRedirect(settings.FRONTEND_URL + '/?' + urlencode({'oauth_error': message}))


@require_GET
def oauth_start(request, provider):
    if provider not in ('google', 'github'):
        return redirect_error('Proveedor no disponible.')
    if not os.getenv(provider.upper() + '_CLIENT_ID') or not os.getenv(provider.upper() + '_CLIENT_SECRET'):
        return redirect_error('Falta configurar el proveedor en el backend.')
    request.session.cycle_key()
    request.session.set_expiry(300)
    try:
        return oauth.create_client(provider).authorize_redirect(request,
            settings.BACKEND_URL + f'/api/auth/oauth/{provider}/callback/')
    except Exception:
        return redirect_error('No se pudo conectar con el proveedor. Revisa la configuración y la conexión.')


@require_GET
def oauth_callback(request, provider):
    if provider not in ('google', 'github'):
        return redirect_error('Proveedor no disponible.')
    try:
        client = oauth.create_client(provider)
        # Authlib consume state; en OIDC valida firma, iss, aud, exp y nonce.
        token = client.authorize_access_token(request)
        if provider == 'google':
            identity = token.get('userinfo', {})
            if identity.get('email_verified') is not True or not identity.get('email'):
                raise ValueError('Unverified identity')
            emails = [identity['email'].strip().lower()]
        else:
            emails = []
            for page in range(1, 11):
                response = client.get(f'user/emails?per_page=100&page={page}', token=token)
                response.raise_for_status()
                rows = response.json()
                emails.extend(row['email'].strip().lower() for row in rows if row.get('verified') is True)
                if len(rows) < 100:
                    break
            else:
                raise ValueError('Ambiguous email list')
    except Exception:
        audit('login_failed', detail=f'OAuth {provider}: respuesta inválida, cancelada o no verificable.')
        return redirect_error('No se pudo validar el acceso social. Intenta de nuevo y revisa el callback registrado.')
    with transaction.atomic():
        matches = list(User.objects.select_for_update().filter(email__in=emails, is_active=True))
        if len(matches) != 1:
            audit('login_failed', detail=f'OAuth {provider}: sin coincidencia única autorizada.')
            return redirect_error('Se requiere exactamente una cuenta activa preautorizada con correo verificado. Consulta al administrador.')
        user = matches[0]
        if locked(user):
            audit('login_failed', user, detail=f'OAuth {provider}: intento durante bloqueo.')
            return redirect_error('Cuenta bloqueada hasta ' + user.locked_until.isoformat() + '. Espera antes de intentar otra vez.')
        user.email_verified = True
        user.verification_nonce = uuid.uuid4()
        user.save(update_fields=['email_verified', 'verification_nonce'])
        start_challenge(request, user)
    return HttpResponseRedirect(settings.FRONTEND_URL + '/')
