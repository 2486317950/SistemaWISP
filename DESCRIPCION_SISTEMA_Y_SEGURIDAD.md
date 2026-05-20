# SistemaWISP – Documentación del sistema y seguridad

Documento de referencia del sistema de gestión para WISP: funcionalidades, roles y niveles de seguridad.

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Funcionalidades del sistema](#2-funcionalidades-del-sistema)
3. [Portal del cliente](#3-portal-del-cliente)
4. [Páginas y rutas públicas](#4-páginas-y-rutas-públicas)
5. [Área de inversionistas](#5-área-de-inversionistas)
6. [Usuarios y roles del personal](#6-usuarios-y-roles-del-personal)
7. [Seguridad](#7-seguridad)
8. [Referencia rápida](#8-referencia-rápida)

---

## 1. Descripción general

**SistemaWISP** es un sistema de gestión para **proveedores de internet inalámbrico (WISP)**. Permite:

- Administrar **clientes**, **paquetes**, **cobros**, **instalaciones**, **finanzas**, **red** e **inventario** desde un panel web.
- Ofrecer un **portal del cliente** para que los usuarios consulten pagos, recibos, consumo y soporte.
- Gestionar un **área de inversionistas** para consultar pagos, gastos, clientes y redes asociados.
- Publicar el **estado del servicio** (operativo / mantenimiento / incidencia) en una página accesible sin login.
- Activar un **modo mantenimiento** que restringe el acceso al panel (solo administradores pueden entrar).

**Tecnologías:** Backend Node.js (Express), base de datos SQLite, frontend React (Vite). Autenticación JWT; 2FA opcional (TOTP y WebAuthn).

---

## 2. Funcionalidades del sistema

El **panel del personal** (`/sistema`) se organiza en las siguientes secciones.

### 2.1 Principal

| Módulo      | Descripción |
|------------|-------------|
| **Dashboard** | Resumen del mes: clientes activos/inactivos, pagos, instalaciones, folios, créditos activos, tickets abiertos, stock. Tarjetas de ingresos y finanzas (percepciones, pagos, instalaciones, gastos, meses gratis, ganancia) con detalle al hacer clic. Desglose por red. **Tendencias:** gráficas de ingresos y clientes (últimos 6 meses). Lista de créditos activos. Crecimiento mensual con resumen y navegación por mes. **Registro de auditoría** (solo administradores): últimas acciones críticas con fecha, usuario, IP y detalles. |

### 2.2 Clientes

| Módulo              | Descripción |
|---------------------|-------------|
| **Clientes**        | Alta, edición y baja de clientes; historial; segmentación; último acceso al portal. |
| **Contrato Cliente**| Generación de contrato para un cliente. |
| **Contratos Guardados** | Listado de contratos guardados. |
| **Paquetes**        | Definición de paquetes y precios por red. |

### 2.3 Finanzas

| Módulo                  | Descripción |
|-------------------------|-------------|
| **Inversionistas**      | Gestión de inversionistas (solo lectura/consulta según permisos). |
| **Cobros**              | Registro y seguimiento de cobros. |
| **Morosidad**           | Panel de clientes en mora: activos sin pago de mensualidad del mes actual; filtros por días de atraso; total adeudado; enlace a ficha del cliente y a Cobros. |
| **Pagos**               | Registro y listado de pagos (mensualidad e instalación). |
| **Créditos**            | Créditos a clientes (instalación o mensualidad); estado pendiente/parcial/liquidado. |
| **Créditos promocionales** | Gestión de créditos promocionales. |
| **Pago Proveedores**    | Pagos a proveedores por red. |
| **Facturas de Insumos** | Facturas de insumos. |
| **Recibos**             | Emisión y listado de recibos. |
| **Comprobantes Clientes** | Comprobantes de pago subidos por clientes. |
| **Comprobantes Crédito**  | Comprobantes asociados a créditos. |
| **Solicitudes de Crédito**| Solicitudes de crédito desde el portal. |
| **Gastos**              | Registro de gastos por categoría. |
| **Transferencias**     | Transferencias entre cuentas. |
| **Stripe** (solo admin) | Saldo, transacciones, historial de payouts, reembolsos, enlaces de pago, conciliación, eventos, sincronización. Transferencia de saldo Stripe a banco. |

### 2.4 Operaciones

| Módulo           | Descripción |
|------------------|-------------|
| **Cotizaciones** | Creación y seguimiento de cotizaciones. |
| **Instalaciones**| Registro de instalaciones (fecha, cliente, monto, estado de pago). |
| **Folios**       | Folios de reparación o visita. |
| **Tickets**      | Tickets de soporte (abiertos, en proceso, prioridad). |

### 2.5 Inventario

| Módulo          | Descripción |
|-----------------|-------------|
| **Stock/Insumos** | Control de inventario; alertas de stock bajo o agotado. |

### 2.6 Recursos humanos

| Módulo       | Descripción |
|--------------|-------------|
| **Empleados**| Gestión de empleados. |

### 2.7 Red

| Módulo               | Descripción |
|----------------------|-------------|
| **IPs y Contraseñas**| Credenciales de red (IPs, contraseñas). |
| **Redes**            | Configuración de redes. |
| **Mapa**             | Mapa de clientes/instalaciones. |
| **Tráfico**          | Consumo de tráfico por cliente (si está configurado el agente). |

### 2.8 Reportes

| Módulo                    | Descripción |
|---------------------------|-------------|
| **Reportes Mensuales**    | Reportes mensuales y anuales; exportación PDF; meses gratis y ganancia neta; desglose por red. |
| **Crecimiento Mensual**   | Datos de crecimiento por mes (ingresos, clientes, instalaciones, folios) con detalle por mes. |
| **Proyecciones Financieras** | Proyecciones de ingresos y gastos. |

### 2.9 Facturación

| Módulo                    | Descripción |
|---------------------------|-------------|
| **Facturación Electrónica** | Generación y gestión de facturas electrónicas (CFDI). |

### 2.10 Comunicación

| Módulo                  | Descripción |
|-------------------------|-------------|
| **WhatsApp**            | Integración y plantillas para contacto por WhatsApp. |
| **Chats del Portal**    | Conversaciones del chat del portal con clientes. |
| **Notificaciones Clientes** | Envío de notificaciones a clientes (portal, recordatorios, etc.). |
| **Formularios web**     | Entradas de formularios de contacto públicos. |
| **Desbloquear Portal**  | Desbloqueo del portal del cliente (tras intentos fallidos de login) mediante código. |

### 2.11 Sistema

| Módulo           | Descripción |
|------------------|-------------|
| **Configuración**| Cambio de contraseña y usuario; **2FA** (código de app y/o llave de acceso; se pueden usar varios métodos); configuración del portal (contacto, métodos de pago, estado del servicio, FAQ, avisos); **modo mantenimiento** (solo admin); respaldo de datos; configuración del servidor (uso, reinicio). |
| **Usuarios** (solo admin) | Creación, edición y eliminación de usuarios del personal; asignación de rol. |

### 2.12 Otras funciones

- **Recordatorios de pago:** Automatizados (job diario) y manuales; configuración de tipos de recordatorio.
- **Backup y restauración** de la base de datos (solo admin).
- **Reinicio del servidor** desde el panel (solo admin).
- **Notificaciones push** para el personal (app Android) y para clientes (portal).

---

## 3. Portal del cliente

Ruta base: **`/portal`**. Los clientes acceden con **número de cliente** y **contraseña**. Tras varios intentos fallidos, el portal puede bloquearse; el personal desbloquea desde **Desbloquear portal** con un código.

### 3.1 Secciones del portal

| Sección           | Descripción |
|-------------------|-------------|
| **Inicio**        | Dashboard: balance, avisos, datos de contacto, último recibo, recordatorio de pago si aplica. |
| **Pagos**         | Historial de pagos; pago en línea con Stripe (tarjeta/OXXO) si está configurado. |
| **Recibos**       | Consulta de recibos. |
| **Comprobantes**  | Subida y consulta de comprobantes de pago. |
| **Créditos**      | Estado de créditos; solicitud de nuevo crédito. |
| **Consumo**       | Uso del servicio (si hay datos de tráfico). |
| **Facturas**      | Facturas electrónicas. |
| **Mi instalación**| Datos de la instalación. |
| **Paquetes**      | Paquetes disponibles. |
| **Cambio de domicilio** | Solicitud de cambio de dirección. |
| **Contrato**      | Consulta del contrato. |
| **Perfil**        | Datos del cliente; cambio de contraseña. |
| **Soporte**       | Apertura y seguimiento de tickets. |
| **FAQ**           | Preguntas frecuentes. |
| **Estado del servicio** | Enlace a la página pública `/estado`. |
| **Referir**       | Programa de referidos. |

---

## 4. Páginas y rutas públicas

Sin necesidad de iniciar sesión:

| Ruta / recurso | Descripción |
|----------------|-------------|
| **`/estado`**  | Página de **estado del servicio**: operativo, mantenimiento o incidencia, con mensaje opcional. Configurable en Configuración → Portal del cliente. En el portal del cliente hay un enlace “Estado del servicio” que lleva aquí. |
| **`GET /api/health`** | Estado del servidor (salud); útil para monitoreo. |
| **`GET /api/public/service-status`** | Devuelve el estado del servicio y mensaje (consumido por `/estado`). |
| **`GET /api/public/maintenance-status`** | Indica si el modo mantenimiento está activo (consumido por el panel para mostrar la pantalla de mantenimiento al personal no admin). |

### 4.1 Modo mantenimiento

En **Configuración → Portal del cliente** (solo administradores) se puede **activar el modo mantenimiento**. Cuando está activo:

- Todo el personal **excepto administradores** ve una pantalla de “En mantenimiento” y no puede usar el panel.
- Los administradores pueden seguir entrando con normalidad.
- El mensaje mostrado es configurable.

---

## 5. Área de inversionistas

Ruta base: **`/investor`**. Login independiente con rol **investor**. Los usuarios con este rol no pueden acceder al panel del personal (`/sistema`).

- **Dashboard** del inversionista.
- **Pagos**, **gastos**, **clientes** y **redes** asociados al inversionista.

---

## 6. Usuarios y roles del personal

El panel del personal (`/sistema`) utiliza **cuatro roles**:

| Rol            | Permisos | Observaciones |
|----------------|----------|----------------|
| **admin**      | Acceso total. | Usuarios, Stripe, configuración completa, modo mantenimiento, backup, reinicio del servidor, registro de auditoría en el Dashboard. |
| **editor**     | Crear, leer y actualizar; **no eliminar**. | Puede editar configuración del portal (FAQ, avisos, estado del servicio, contacto). No ve Usuarios ni Stripe. |
| **viewer**     | Crear y leer; **no actualizar ni eliminar**. | Acceso de solo lectura a datos editables. |
| **technician** | Acceso limitado. | **Solo** Instalaciones, Folios y Desbloquear portal. No ve Clientes, Finanzas, Reportes, Configuración, etc. |

En el backend, las rutas aplican `authenticateToken` y, según el módulo, `requireAdmin`, `requireRole(['admin','editor'])` o `blockTechnicians`, de modo que los técnicos solo pueden usar las APIs correspondientes a instalaciones, folios y desbloqueo del portal.

---

## 7. Seguridad

### 7.1 Autenticación

- **Personal:** Usuario y contraseña. Contraseñas con política (longitud, etc.) y almacenadas hasheadas (bcrypt). Tras el login se emite un **JWT** con expiración configurable (`JWT_EXPIRES_IN`, por defecto 24 h).
- **Portal del cliente:** Número de cliente y contraseña. Token del portal con expiración de 7 días.
- **Inversionistas:** Login propio; no pueden acceder al panel del personal.

En **producción**, el servidor **no arranca** si `JWT_SECRET` no está definido o tiene menos de 16 caracteres (validación en `envValidation.js`).

### 7.2 Verificación en dos pasos (2FA)

- **2FA para el personal:** Opcional. Se puede usar **código de app** (TOTP, p. ej. Google Authenticator) y/o **llave de acceso** (WebAuthn: PIN, huella, llave de seguridad). **Se pueden tener varios métodos a la vez** (p. ej. app + llave). En el login, si el usuario tiene 2FA, debe introducir el código o usar la llave.
- En **Configuración** se muestra un **aviso a los administradores** que no tienen 2FA, recomendando activarlo.

### 7.3 Control de acceso por rol

- Casi todas las rutas de la API del personal exigen **token válido** (`authenticateToken`).
- Rutas sensibles exigen **admin** (usuarios, Stripe, backup, reinicio, auditoría, modo mantenimiento) o **admin/editor** (configuración del portal).
- Los **técnicos** están limitados por `blockTechnicians` en la mayoría de los módulos.
- **Portal del cliente:** Las rutas del portal exigen token de cliente válido; cada cliente solo ve sus propios datos.
- **Inversionistas:** Solo las rutas de su área; no acceden a datos de otros inversionistas ni al panel del personal.

### 7.4 Rutas públicas (sin autenticación)

- `GET /api/health` – Estado del servidor.
- `GET /api/public/service-status` – Estado del servicio (para `/estado`).
- `GET /api/public/maintenance-status` – Estado del modo mantenimiento.

El resto de la API del personal y del portal requiere autenticación (y en su caso el rol adecuado).

### 7.5 Auditoría

Las acciones críticas se registran en la tabla **`audit_log`** (usuario, IP, detalles cuando aplica):

- Inicios de sesión (éxito y fallo, incluidos fallos 2FA).
- Cambios de contraseña (éxito y fallo).
- Activación y desactivación de 2FA.
- Creación, edición y eliminación de **usuarios**.
- **Payouts** y **reembolsos** de Stripe.
- **Reinicio del servidor**.
- Eliminación de **clientes**.

Los **administradores** pueden ver el registro de auditoría en el **Dashboard**. Opcionalmente, un job de retención elimina registros antiguos según `AUDIT_RETENTION_MONTHS`.

### 7.6 Protección adicional

- **Rate limiting** en la API.
- **Sanitización de entradas** en el servidor.
- **Helmet** para cabeceras HTTP más seguras.
- **CORS** configurable (`ALLOWED_ORIGINS` en producción).
- Archivo **`.env`** en `.gitignore`; no se suben secretos al repositorio.
- **Modo mantenimiento** para restringir el uso del sistema durante actualizaciones.

### 7.7 Recomendaciones de despliegue

- Usar **HTTPS** en producción (proxy inverso).
- Definir **JWT_SECRET** fuerte (mín. 16 caracteres) y no usar el valor por defecto.
- Configurar **ALLOWED_ORIGINS** para los dominios del sistema, portal e inversionistas.
- Revisar periódicamente el **audit_log** y ejecutar `npm audit` para mantener dependencias actualizadas.

---

## 8. Referencia rápida

### 8.1 Resumen de seguridad por nivel

| Nivel            | Medida |
|------------------|--------|
| **Acceso**       | Login obligatorio (personal, cliente, inversionista); JWT con expiración. |
| **Identidad**    | 2FA opcional (TOTP + WebAuthn, varios métodos); recomendado para admins. |
| **Autorización** | Roles (admin, editor, viewer, technician) y bloqueo de técnicos por ruta. |
| **Trazabilidad** | Auditoría de logins, 2FA, usuarios, Stripe, reinicio y borrado de clientes. |
| **Configuración**| JWT_SECRET obligatorio en producción; secretos en `.env`; CORS y HTTPS recomendados. |
| **Operación**    | Modo mantenimiento para restringir acceso durante actualizaciones. |

### 8.2 Variables de entorno principales

| Variable | Obligatorio (producción) | Descripción |
|----------|---------------------------|-------------|
| `JWT_SECRET` | **Sí** (mín. 16 caracteres) | Clave para firmar tokens JWT. |
| `JWT_EXPIRES_IN` | No | Caducidad del token del personal (ej. `24h`). |
| `ALLOWED_ORIGINS` | Recomendado | Orígenes CORS permitidos, separados por coma. |
| `NODE_ENV` | No | `development` o `production`. |
| `PORT` | No | Puerto del servidor (default 5000). |

Más variables en `server/.env.example` y en el README del proyecto.

### 8.3 Documentos relacionados

- **README.md** – Instalación, desarrollo, producción y estructura del proyecto.
- **SEGURIDAD.md** – Resumen breve de seguridad (entorno, JWT, 2FA, auditoría, recomendaciones).
- **docs/API.md** – Endpoints principales para integraciones (auth, backup, tráfico, portal).
- **server/PAGOS_STRIPE_LIVE.md** – Configuración de pagos Stripe en vivo.
- **docs/** – Despliegue, HTTPS, Oracle Cloud, etc.

---

*Última actualización: documentación alineada con el sistema actual (estado del servicio, morosidad, tendencias en Dashboard, modo mantenimiento, 2FA múltiple, auditoría en Dashboard).*
 desde pueeno pe