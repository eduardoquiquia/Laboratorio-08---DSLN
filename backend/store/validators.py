import re
from django.core.exceptions import ValidationError


class PasswordRules:
    def validate(self, password, user=None):
        if (len(password) < 8 or not re.search(r'[A-Z]', password)
                or not re.search(r'[0-9]', password) or not re.search(r'[^\w\s]', password)):
            raise ValidationError(self.get_help_text())

    def get_help_text(self):
        return 'Usa al menos 8 caracteres, una mayúscula, un número y un carácter especial.'
