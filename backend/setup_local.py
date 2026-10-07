"""Agrega solo claves locales faltantes; conserva las credenciales existentes."""
import secrets
from pathlib import Path
from cryptography.fernet import Fernet
from dotenv import dotenv_values

path = Path(__file__).resolve().parent / '.env'
existing = dotenv_values(path)
values = {'DJANGO_SECRET_KEY': lambda: secrets.token_urlsafe(64),
          'MFA_ENCRYPTION_KEY': lambda: Fernet.generate_key().decode()}
with path.open('a', encoding='utf-8') as file:
    for key, generate in values.items():
        if key not in existing or existing[key] in ('generar-localmente', 'generar-fernet-localmente'):
            file.write(f'\n{key}={generate()}\n')
print('Configuración local preparada. Se conservaron todos los valores existentes.')
