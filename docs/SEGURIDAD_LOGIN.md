# Seguridad del login en el sistema

Resumen de cómo se protegen las credenciales y las sesiones en todo el sistema (panel del personal, portal de clientes, app del cliente, app inversionista).

---

## 1. Contraseñas en el servidor (almacenamiento)

- **Panel del personal** (usuarios admin, técnicos, inversionistas): las contraseñas se guardan en la base de datos **hasheadas con bcrypt** (no se almacenan en texto plano). El servidor solo compara el hash con `bcrypt.compare`; no puede “ver” la contraseña.
- **Portal de clientes** (número de cliente + contraseña): igual, la contraseña del portal (`portal_password`) se guarda **hasheada con bcrypt**. El login y el cambio de contraseña usan `bcrypt.compare` y `bcrypt.hash(..., 10)`.

En resumen: **el login está cifrado/protegido en almacenamiento**: las contraseñas no se guardan en claro, solo su hash.

---

## 2. Sesión después del login

- Tras un login correcto, el servidor devuelve un **token JWT** (firmado con un secreto en el servidor).
- El cliente (web o app) envía ese token en la cabecera `Authorization: Bearer ...` en cada petición. El servidor verifica la firma y no vuelve a pedir la contraseña en cada acción.

---

## 3. Protección contra abusos

- **Límite de intentos de login** (rate limiting):
  - Panel del personal: `loginLimiter` (p. ej. 10 intentos por 15 minutos).
  - Portal de clientes: `portalLoginLimiter` y bloqueo por IP tras varios fallos (código de desbloqueo).

---

## 4. Cifrado en tránsito (entre cliente y servidor)

- Si accedes al sistema por **HTTP** (ej. `http://52.14.80.92:5000`), la contraseña viaja en el cuerpo del POST **sin cifrar** por la red. Cualquier interceptor podría verla.
- Si pones el servidor detrás de **HTTPS** (certificado SSL/TLS, p. ej. con Nginx o un proxy en la nube), **toda** la comunicación (incluido el login) va cifrada. Entonces el login queda cifrado también en tránsito.

Recomendación: en producción usar **HTTPS** para que el login (y todo el tráfico) esté cifrado de extremo a extremo.

---

## Resumen para documentación o Play Store

Puedes describir la seguridad del login así:

- **Contraseñas:** se almacenan de forma segura (hash con bcrypt, no reversible). No se guardan en texto plano.
- **Sesión:** se usa un token (JWT) firmado por el servidor.
- **Protección del login:** límite de intentos y, en el portal cliente, bloqueo por IP con código de desbloqueo.
- **En tránsito:** si el sistema se usa con HTTPS, el login (y todo el tráfico) va cifrado; con HTTP solo está protegido en almacenamiento.

Si quieres, en la política de privacidad o en la ficha de la app puedes añadir una frase tipo: *“Las contraseñas se almacenan de forma segura (hash) y el acceso al sistema puede realizarse por conexión cifrada (HTTPS).”*
