# TechStore · Laboratorio 08

Aplicación local de inventario por tienda. Django REST Framework + SQLite y React/Vite + Tailwind CSS, en español. No requiere hosting, SMTP, Docker ni servicios de tareas. Se conservaron los proyectos y las versiones instaladas.

## Iniciar en Windows / PowerShell

Primera terminal, desde `backend/`:

```powershell
# Solo si todavía no existe el entorno virtual:
python -m venv .venv

.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe setup_local.py
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver localhost:8000
```

Segunda terminal, desde `frontend/`:

```powershell
npm install
npm run dev
```

Abre **http://localhost:5173**. La API está en **http://localhost:8000/api/**. Usa siempre `localhost`, sin alternar con `127.0.0.1`. Vite usa puerto fijo 5173; si está ocupado, cierra el proceso anterior. Node debe ser compatible con Vite 8 (20.19+ o 22.12+); el entorno Python existente usa 3.14 y Django 6.1.2.

En esta entrega ya se instalaron las dependencias de backend, se aplicó la migración inicial y se cargaron los datos demo. En siguientes arranques basta ejecutar ambos servidores. `seed_demo` es repetible: no cambia contraseñas, enrolamientos ni productos existentes. Nunca borres `db.sqlite3` para reiniciar el servidor.

## Configuración y persistencia

`backend/.env` conserva `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Los intercambios OAuth se hacen solo en Django. No copies estas variables a React ni uses prefijos `VITE_` para secretos.

`setup_local.py` agrega las claves ausentes `DJANGO_SECRET_KEY` (firma de JWT/enlaces) y `MFA_ENCRYPTION_KEY` (Fernet, independiente, para cifrar TOTP), sin mostrar valores ni reemplazar credenciales existentes. En otra computadora puedes copiar `.env.example` a `.env` **solo si no hay ya un `.env`**, completar OAuth y ejecutar el script. Los marcadores de ejemplo de las dos claves locales se sustituyen por valores nuevos. Conserva ambas claves y la base entre reinicios: perder la clave de cifrado impide descifrar los autenticadores existentes.

`frontend/.env.example` documenta `VITE_API_URL=http://localhost:8000/api`; es el valor predeterminado y no hace falta crear otro archivo. Orígenes CORS/CSRF explícitos en `config/settings.py`, `credentials: include` en React, cookie JWT `HttpOnly`, `SameSite=Lax`, sin persistencia y `Secure=False` únicamente por ejecución HTTP local. Django usa `MAILERS` de consola en esta configuración de desarrollo.

Los `.gitignore` excluyen `.env`, SQLite, entornos virtuales, caches y logs. La configuración local **no está preparada para publicar en internet**.

## Cuentas de demostración

Todas se crean con contraseña **`DemoTech#2026`**, exclusiva de la demostración. El seed solo establece esa contraseña al crear una cuenta; nunca restablece una existente.

| Correo | Perfil | Alcance |
|---|---|---|
| admin@techstore.local | Administrador | Todas las tiendas |
| gerente@techstore.local | Gerente | Centro |
| empleado@techstore.local | Empleado | Centro |
| auditor@techstore.local | Auditor | Todas las tiendas, solo lectura |
| gerente.norte@techstore.local | Gerente | Norte |
| empleado.norte@techstore.local | Empleado | Norte |

Hay dos tiendas y seis productos por tienda, con SKU compartidos, cantidades independientes, stock normal, stock cero y stock igual al mínimo.

### Primer acceso por contraseña

1. Inicia sesión con una cuenta demo. La contraseña correcta solo abre un proceso parcial de cinco minutos.
2. Pulsa **Generar enlace de verificación**. Abre el enlace mostrado en la terminal de Django y pulsa **Confirmar correo electrónico**. El enlace firmado dura 30 minutos, se consume una sola vez y solo se puede reenviar cada minuto. Un nuevo envío invalida el enlace anterior.
3. Inicia sesión de nuevo. Mostrar el QR requiere haber verificado el correo y estar en un proceso parcial válido.
4. En Google Authenticator agrega la cuenta con el QR o la clave manual, usando TOTP basado en tiempo. Introduce el código actual de seis dígitos y pulsa **Activar MFA y entrar**.
5. En accesos posteriores solo se pide el código, sin revelar otra vez el secreto. No hay opción de omitir MFA, tampoco para Admin. Sincroniza el reloj del teléfono y la computadora; los periodos duran 30 segundos y un código aceptado no puede reutilizarse en el mismo periodo.

**El correo de consola simula la entrega del enlace y no prueba control real de un buzón.** La verificación real del correo en este laboratorio está disponible mediante el proveedor OAuth. TOTP no envía correo y no verifica direcciones.

La consola usa una subclase del backend de Django que imprime el cuerpo original, sin codificación MIME quoted-printable. Así el enlace se puede copiar completo sin introducir `=3D` ni cortes de línea en el token. Si generaste un enlace antes de este ajuste, solicita uno nuevo después de reiniciar Django; no copies el enlace antiguo codificado.

El quinto fallo consecutivo de contraseña bloquea la cuenta 15 minutos. Tres fallos TOTP, incluso repartidos entre procesos de login, bloquean 15 minutos e invalidan los procesos parciales. OAuth tampoco evita un bloqueo. Un nuevo proceso parcial invalida los anteriores de esa cuenta.

## Google y GitHub

Desde **Usuarios**, el administrador debe crear primero una cuenta activa con el correo real verificado que devuelve el proveedor y asignarle su rol y tienda. Las cuentas ficticias `.local` no sirven para OAuth. Nunca se registran usuarios automáticamente ni se obtienen roles del perfil social.

Registra exactamente estos callbacks (incluida la barra final):

| Proveedor | Callback |
|---|---|
| Google, cliente web | `http://localhost:8000/api/auth/oauth/google/callback/` |
| GitHub, OAuth App | `http://localhost:8000/api/auth/oauth/github/callback/` |

Para Google configura también el origen local `http://localhost:5173` si lo solicita la consola, la pantalla de consentimiento y las cuentas de prueba si la aplicación está en modo de pruebas. En GitHub usa `http://localhost:5173` como Homepage URL. Los valores de cliente/secreto deben corresponder a esas aplicaciones registradas.

Google usa OIDC con Authlib, validación de firma, emisor, audiencia, expiración, `state` y `nonce`. GitHub solicita `user:email`, consulta también correos privados verificados y exige una coincidencia única con una cuenta local activa; varias coincidencias se rechazan. Ambos flujos continúan hacia TOTP. Los tokens del proveedor y el JWT no se incluyen en URLs de regreso a React.

**Pendiente de revisión manual externa:** no se inició sesión real con Google/GitHub ni se tuvo acceso a sus consolas para confirmar los callbacks registrados. Las credenciales existentes se conservaron; su presencia no demuestra que sean válidas ni que la configuración del proveedor coincida. OAuth requiere internet aunque la aplicación se ejecute localmente.

## Funcionalidad y reglas

- Inicio muestra productos, unidades, tiendas y alertas obtenidos de la API.
- Admin administra cuentas, roles, tiendas e inventario. No hay registro público ni ruta de Django Admin.
- Gerente crea, edita y elimina productos de su tienda. La tienda se asigna en el backend; enviar el campo tienda se rechaza.
- Empleado consulta su inventario y establece stock mediante una operación que solo acepta `stock`; enviar precio u otro campo se rechaza.
- Auditor consulta usuarios sin secretos, tiendas, inventario, reportes y auditoría, sin modificar datos.
- Búsqueda por nombre/SKU, filtro de categoría exacta, tienda para perfiles globales y stock bajo (`stock <= minimum_stock`). Cada SKU es único dentro de su tienda.
- **Stock por Tienda** y **Productos con Stock Bajo**, con vistas previas y descarga PDF/Excel. Descarga y vista usan el mismo alcance y filtros. Los reportes incluyen fecha de generación en Lima, tablas, encabezados y estados vacíos. Excel trata los textos como texto, no como fórmulas.
- Auditoría de accesos, fallos MFA, bloqueos, creación/edición/eliminación de productos y cambios de stock; los cambios y sus eventos se guardan en una misma transacción SQLite. Guarda nombres, SKU, autor y cantidades para conservar el contexto histórico. Consulta paginada con filtros de evento/fechas.
- La sesión JWT tiene un máximo absoluto de 8 horas, sin refresh token. Logout revoca la sesión en SQLite. Desactivar una cuenta o cambiar correo, contraseña, rol o tienda revoca sus sesiones y procesos parciales. Cambiar el correo obliga a verificar la nueva dirección. Recargar consulta `/auth/me/`; el frontend también cierra su estado al vencer las 8 horas. Cada petición protegida comprueba sesión, usuario activo, correo y MFA.
- Una cookie sin persistencia suele desaparecer al cerrar el navegador, pero algunos navegadores restauran sesiones. El vencimiento de ocho horas siempre se exige en el servidor; no depende de cerrar la ventana.

## Organización y rutas principales

`store/models.py`: datos; `serializers.py`: campos y validaciones; `permissions.py`: roles y alcance; `authentication.py`, `auth_views.py`, `oauth_views.py`, `security.py`: autenticación; `views.py`: negocio; `reports.py`: exportaciones; `management/commands/seed_demo.py`: datos iniciales.

`frontend/src/pages/`: pantallas; `components/`: piezas reutilizables; `context/`: sesión; `lib/`: API, carga de datos y roles. Los formularios tienen validaciones y Django vuelve a validarlas de manera autoritativa.

API bajo `/api/`: `auth/csrf/`, `auth/login/`, `auth/partial/`, `auth/email/send/`, `auth/email/verify/`, `auth/mfa/enroll/`, `auth/mfa/verify/`, `auth/me/`, `auth/logout/`, `products/`, `products/<id>/stock/`, `users/`, `stores/`, `dashboard/`, `reports/`, `audit/`. Los cambios requieren cookie y encabezado `X-CSRFToken` obtenido de `auth/csrf/`.

## Comprobaciones básicas

Desde `backend/`: `.\.venv\Scripts\python.exe manage.py check`. Desde `frontend/`: `npm run build` y `npm run lint`.

Se ejecutaron migraciones, carga demo, comprobación de Django y compilación/análisis estático del frontend. No se generaron pruebas automáticas, colecciones, capturas ni reportes de testing. La revisión de endpoints, interfaz, exportaciones y los accesos OAuth queda para la práctica manual indicada en el encargo.

Referencias: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [correos verificados en GitHub](https://docs.github.com/en/rest/users/emails), [correo de consola Django](https://docs.djangoproject.com/en/6.1/topics/email/).
