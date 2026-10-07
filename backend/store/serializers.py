import uuid
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import User, Store, Product, AuditEvent, AuthSession, LoginChallenge


class StrictSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        allowed = {name for name, field in self.fields.items() if not field.read_only}
        unknown = set(data) - allowed
        if unknown:
            raise serializers.ValidationError({'detail': f'Campos no autorizados: {", ".join(sorted(unknown))}.'})
        return super().to_internal_value(data)


class StoreSerializer(StrictSerializer):
    class Meta:
        model = Store
        fields = ['id', 'name', 'address']
        read_only_fields = ['id']


class UserSerializer(StrictSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False, max_length=128)
    store_name = serializers.CharField(source='store.name', read_only=True, default='Alcance global')

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active', 'store', 'store_name',
                  'email_verified', 'mfa_enabled', 'password']
        read_only_fields = ['id', 'email_verified', 'mfa_enabled']

    def validate_email(self, value):
        value = value.strip().lower()
        existing = User.objects.filter(email__iexact=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('Ya existe una cuenta con este correo.')
        return value

    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', None))
        store = attrs.get('store', getattr(self.instance, 'store', None))
        if role in ('manager', 'employee') and not store:
            raise serializers.ValidationError({'store': 'Este perfil requiere una tienda.'})
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria.'})
        if 'password' in attrs:
            candidate = User(email=attrs.get('email', getattr(self.instance, 'email', '')),
                             full_name=attrs.get('full_name', getattr(self.instance, 'full_name', '')))
            try:
                validate_password(attrs['password'], candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages})
        if self.instance and self.instance.pk == self.context['request'].user.pk:
            if attrs.get('is_active') is False or role != 'admin':
                raise serializers.ValidationError('No puedes desactivar tu propia cuenta ni quitarte el rol administrador.')
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        changed_email = validated_data.get('email', instance.email) != instance.email
        revoke = password is not None or changed_email or any(
            key in validated_data and validated_data[key] != getattr(instance, key)
            for key in ('role', 'store', 'is_active'))
        if changed_email:
            instance.email_verified = False
            instance.verification_nonce = uuid.uuid4()
            instance.verification_sent_at = None
        if password:
            instance.set_password(password)
        instance = super().update(instance, validated_data)
        if revoke:
            AuthSession.objects.filter(user=instance).update(revoked=True)
            LoginChallenge.objects.filter(user=instance).update(used=True)
        return instance


class ProductSerializer(StrictSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    low_stock = serializers.SerializerMethodField()
    store = serializers.PrimaryKeyRelatedField(queryset=Store.objects.all(), required=False)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    stock = serializers.IntegerField(min_value=0, max_value=2147483647)
    minimum_stock = serializers.IntegerField(min_value=0, max_value=2147483647)

    class Meta:
        model = Product
        fields = ['id', 'store', 'store_name', 'name', 'sku', 'description', 'category',
                  'price', 'image_url', 'stock', 'minimum_stock', 'low_stock']
        read_only_fields = ['id']
        validators = []

    def get_low_stock(self, obj):
        return obj.stock <= obj.minimum_stock

    def validate(self, attrs):
        user = self.context['request'].user
        if user.role == 'manager':
            if 'store' in attrs:
                raise serializers.ValidationError({'store': 'La tienda se asigna automáticamente.'})
            attrs['store'] = user.store
        store = attrs.get('store', getattr(self.instance, 'store', None))
        if not store:
            raise serializers.ValidationError({'store': 'Selecciona una tienda.'})
        sku = attrs.get('sku', getattr(self.instance, 'sku', ''))
        duplicates = Product.objects.filter(store=store, sku=sku)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError({'sku': 'Este SKU ya existe en la tienda.'})
        return attrs

    def validate_image_url(self, value):
        if value and not value.lower().startswith(('http://', 'https://')):
            raise serializers.ValidationError('Usa una URL HTTP o HTTPS.')
        return value


class AuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = ['id', 'created_at', 'event', 'actor', 'store_name', 'product_name',
                  'sku', 'detail', 'old_stock', 'new_stock']
