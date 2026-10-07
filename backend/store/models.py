import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower


class Store(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=250, blank=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.full_clean(exclude=['password'])
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(role='admin', is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        MANAGER = 'manager', 'Gerente'
        EMPLOYEE = 'employee', 'Empleado'
        AUDITOR = 'auditor', 'Auditor'

    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=15, choices=Role.choices)
    store = models.ForeignKey(Store, null=True, blank=True, on_delete=models.PROTECT)
    email_verified = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.TextField(blank=True)
    mfa_last_step = models.BigIntegerField(default=-1)
    password_failures = models.PositiveIntegerField(default=0)
    mfa_failures = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    verification_nonce = models.UUIDField(default=uuid.uuid4)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name', 'role']
    objects = UserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower('email'), name='unique_email_case_insensitive'),
            models.CheckConstraint(condition=~models.Q(role__in=['manager', 'employee']) | models.Q(store__isnull=False), name='staff_needs_store'),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class Product(models.Model):
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='products')
    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=60)
    description = models.TextField(blank=True, max_length=2000)
    category = models.CharField(max_length=80)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    image_url = models.URLField(blank=True, max_length=1000)
    stock = models.PositiveIntegerField(default=0)
    minimum_stock = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ['store__name', 'name']
        constraints = [
            models.UniqueConstraint(fields=['store', 'sku'], name='unique_store_sku'),
            models.CheckConstraint(condition=models.Q(price__gte=0), name='positive_price'),
        ]


class AuthSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)


class LoginChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)


class AuditEvent(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    event = models.CharField(max_length=50)
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    actor = models.CharField(max_length=254, blank=True)
    store_name = models.CharField(max_length=100, blank=True)
    product_name = models.CharField(max_length=150, blank=True)
    sku = models.CharField(max_length=60, blank=True)
    detail = models.TextField()
    old_stock = models.IntegerField(null=True)
    new_stock = models.IntegerField(null=True)

    class Meta:
        ordering = ['-created_at', '-id']
