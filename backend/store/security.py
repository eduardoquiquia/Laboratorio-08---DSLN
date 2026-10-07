from datetime import timedelta
from cryptography.fernet import Fernet
from django.conf import settings
from django.utils import timezone
from .models import AuditEvent, LoginChallenge, AuthSession


def cipher():
    return Fernet(settings.MFA_ENCRYPTION_KEY.encode())


def audit(event, user=None, product=None, detail='', old_stock=None, new_stock=None):
    return AuditEvent.objects.create(event=event, user=user, actor=user.email if user else '',
        store_name=product.store.name if product else (user.store.name if user and user.store_id else ''),
        product_name=product.name if product else '', sku=product.sku if product else '',
        detail=detail, old_stock=old_stock, new_stock=new_stock)


def locked(user):
    now = timezone.now()
    if user.locked_until and user.locked_until > now:
        return True
    if user.locked_until:
        user.locked_until = None
        user.password_failures = 0
        user.mfa_failures = 0
        user.save(update_fields=['locked_until', 'password_failures', 'mfa_failures'])
    return False


def block(user):
    user.locked_until = timezone.now() + timedelta(minutes=15)
    user.save()
    LoginChallenge.objects.filter(user=user).update(used=True)
    AuthSession.objects.filter(user=user).update(revoked=True)
    audit('account_locked', user, detail='Acceso bloqueado durante 15 minutos.')


def start_challenge(request, user):
    LoginChallenge.objects.filter(user=user, used=False).update(used=True)
    challenge = LoginChallenge.objects.create(user=user, expires_at=timezone.now() + timedelta(minutes=5))
    request.session.cycle_key()
    request.session['challenge'] = str(challenge.pk)
    request.session.set_expiry(300)
    return challenge
