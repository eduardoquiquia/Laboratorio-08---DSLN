"""Correo de consola legible para la demostración local, sin entrega SMTP."""
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend


class ReadableConsoleEmailBackend(ConsoleEmailBackend):
    def write_message(self, message):
        # La consola estándar imprime el MIME serializado. Quoted-printable
        # transforma '=' en '=3D' y corta los enlaces con saltos de línea.
        # Mostrar el cuerpo original evita copiar un token distinto del firmado.
        self.stream.write('Correo de demostración local (entrega simulada)\n')
        self.stream.write(f'Para: {", ".join(message.to)}\n')
        self.stream.write(f'Asunto: {message.subject}\n\n')
        self.stream.write(message.body)
        self.stream.write('\n' + '-' * 79 + '\n')
