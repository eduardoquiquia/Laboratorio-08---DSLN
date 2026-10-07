from rest_framework.permissions import BasePermission, SAFE_METHODS

GLOBAL_ROLES = ('admin', 'auditor')
REPORT_ROLES = ('admin', 'manager', 'auditor')


def scoped_products(queryset, user):
    return queryset if user.role in GLOBAL_ROLES else queryset.filter(store_id=user.store_id)


class BusinessPermission(BasePermission):
    def has_permission(self, request, view):
        role = request.user.role
        if view.basename in ('users', 'stores'):
            return role == 'admin' or (role == 'auditor' and request.method in SAFE_METHODS) or (
                view.basename == 'stores' and request.method in SAFE_METHODS)
        if view.basename == 'products':
            if request.method in SAFE_METHODS:
                return True
            if view.action == 'stock':
                return role in ('admin', 'manager', 'employee')
            return role in ('admin', 'manager')
        return False

    def has_object_permission(self, request, view, obj):
        return view.basename != 'products' or request.user.role in GLOBAL_ROLES or obj.store_id == request.user.store_id
