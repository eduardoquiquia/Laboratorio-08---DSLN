from django.db import IntegrityError
from django.db.models.deletion import ProtectedError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler


def exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return Response({'detail': 'Esta tienda tiene usuarios o productos asociados y no puede eliminarse.'}, status=400)
    if isinstance(exc, IntegrityError):
        return Response({'detail': 'Los datos duplicados o relacionados no son válidos. Revisa los campos.'}, status=400)
    return drf_handler(exc, context)
