from django.core.management.base import BaseCommand
from django.db import transaction
from store.models import Store, User, Product


class Command(BaseCommand):
    help = 'Carga datos ficticios sin modificar los registros existentes.'

    @transaction.atomic
    def handle(self, *args, **options):
        centro, _ = Store.objects.get_or_create(name='TechStore Centro', defaults={'address': 'Av. Garcilaso de la Vega 1200, Lima'})
        norte, _ = Store.objects.get_or_create(name='TechStore Norte', defaults={'address': 'Av. Alfredo Mendiola 1400, Lima'})
        accounts = [('admin', 'Alex Rivera', 'admin', None), ('gerente', 'Valeria Torres', 'manager', centro),
            ('empleado', 'Diego Salas', 'employee', centro), ('auditor', 'Camila Rojas', 'auditor', None),
            ('gerente.norte', 'Lucía Vega', 'manager', norte), ('empleado.norte', 'Mateo León', 'employee', norte)]
        for alias, name, role, store in accounts:
            if not User.objects.filter(email=f'{alias}@techstore.local').exists():
                User.objects.create_user(email=f'{alias}@techstore.local', password='DemoTech#2026',
                                         full_name=name, role=role, store=store)
        products = [
            ('LAP-001', 'Laptop Lenovo IdeaPad 15', 'Laptops', '2499.00', 12, 5),
            ('MON-001', 'Monitor LG UltraWide 29', 'Monitores', '999.90', 3, 4),
            ('TEC-001', 'Teclado mecánico HyperX', 'Periféricos', '329.00', 5, 5),
            ('MOU-001', 'Mouse Logitech MX Master', 'Periféricos', '399.00', 18, 6),
            ('AUD-001', 'Audífonos Sony WH-CH720N', 'Audio', '499.90', 0, 3),
            ('SSD-001', 'SSD Kingston NV2 1 TB', 'Almacenamiento', '279.00', 24, 8),
        ]
        for store in (centro, norte):
            for sku, name, category, price, stock, minimum in products:
                Product.objects.get_or_create(store=store, sku=sku, defaults={'name': name, 'category': category,
                    'description': 'Producto de demostración TechStore.', 'price': price,
                    'stock': stock if store == centro else stock + 2, 'minimum_stock': minimum})
        self.stdout.write(self.style.SUCCESS('Datos demo disponibles. No se modificaron cuentas ni productos existentes.'))
