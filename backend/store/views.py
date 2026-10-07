from datetime import date
from django.db import transaction
from django.db.models import Q, F, Sum
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Store, User, Product, AuditEvent
from .permissions import BusinessPermission, scoped_products, REPORT_ROLES, GLOBAL_ROLES
from .serializers import StoreSerializer, UserSerializer, ProductSerializer, AuditSerializer
from .security import audit
from .reports import export_report


def filtered_products(request):
    products = scoped_products(Product.objects.select_related('store'), request.user)
    params = request.query_params
    if params.get('search'):
        products = products.filter(Q(name__icontains=params['search']) | Q(sku__icontains=params['search']))
    if params.get('category'):
        products = products.filter(category=params['category'])
    if params.get('store'):
        try:
            store_id = int(params['store'])
        except ValueError:
            raise ValidationError('Tienda inválida.')
        products = products.filter(store_id=store_id)
    if params.get('low_stock') == 'true':
        products = products.filter(stock__lte=F('minimum_stock'))
    return products


class StoreViewSet(viewsets.ModelViewSet):
    serializer_class = StoreSerializer
    permission_classes = [IsAuthenticated, BusinessPermission]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        stores = Store.objects.order_by('name')
        return stores if self.request.user.role in GLOBAL_ROLES else stores.filter(pk=self.request.user.store_id)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('store').order_by('full_name')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, BusinessPermission]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    @transaction.atomic
    def perform_update(self, serializer):
        serializer.save()


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, BusinessPermission]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return filtered_products(self.request)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        product = serializer.save()
        audit('product_created', self.request.user, product, 'Producto creado.', new_stock=product.stock)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        previous = serializer.instance.stock
        product = serializer.save()
        audit('stock_updated' if previous != product.stock else 'product_updated',
              self.request.user, product, 'Producto actualizado.', old_stock=previous, new_stock=product.stock)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        audit('product_deleted', self.request.user, instance, 'Producto eliminado.', old_stock=instance.stock)
        instance.delete()

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def stock(self, request, pk=None):
        product = self.get_object()
        if set(request.data) != {'stock'}:
            raise ValidationError('Esta operación acepta únicamente el campo stock.')
        field = serializers.IntegerField(min_value=0, max_value=2147483647)
        stock = field.run_validation(request.data['stock'])
        previous = product.stock
        product.stock = stock
        product.save(update_fields=['stock'])
        audit('stock_updated', request.user, product, 'Cantidad de stock establecida.', old_stock=previous, new_stock=stock)
        return Response(ProductSerializer(product).data)


class DashboardView(APIView):
    def get(self, request):
        products = scoped_products(Product.objects.select_related('store'), request.user)
        low = products.filter(stock__lte=F('minimum_stock'))
        return Response({'products': products.count(), 'units': products.aggregate(total=Sum('stock'))['total'] or 0,
                         'low_stock': low.count(), 'stores': Store.objects.count() if request.user.role in GLOBAL_ROLES else 1,
                         'alerts': ProductSerializer(low[:8], many=True).data})


class ReportView(APIView):
    def get(self, request):
        if request.user.role not in REPORT_ROLES:
            raise PermissionDenied('Tu perfil no tiene acceso a reportes.')
        kind = request.query_params.get('kind', 'stock')
        if kind not in ('stock', 'low'):
            raise ValidationError('Reporte no válido.')
        products = filtered_products(request)
        if kind == 'low':
            products = products.filter(stock__lte=F('minimum_stock'))
        output = request.query_params.get('format', 'json')
        if output not in ('json', 'pdf', 'xlsx'):
            raise ValidationError('Formato no válido.')
        if output == 'json':
            return Response(ProductSerializer(products, many=True).data)
        return export_report(products, kind, output, request)


class AuditView(APIView):
    def get(self, request):
        if request.user.role not in GLOBAL_ROLES:
            raise PermissionDenied('No tienes acceso a la auditoría.')
        events = AuditEvent.objects.all()
        if request.query_params.get('event'):
            events = events.filter(event=request.query_params['event'])
        for param, lookup in [('from', 'created_at__date__gte'), ('to', 'created_at__date__lte')]:
            if request.query_params.get(param):
                try:
                    value = date.fromisoformat(request.query_params[param])
                except ValueError:
                    raise ValidationError('Fecha inválida.')
                events = events.filter(**{lookup: value})
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            raise ValidationError('Página inválida.')
        return Response({'count': events.count(), 'results': AuditSerializer(events[(page-1)*50:page*50], many=True).data})
