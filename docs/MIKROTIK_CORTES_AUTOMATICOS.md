# Conectar MikroTik con SistemaWISP para cortes automáticos

Este documento explica cómo integrar tu **MikroTik** con el sistema para:

1. **Enviar consumo de tráfico** (MikroTik → Sistema) – ya soportado.
2. **Realizar cortes automáticos por mora** (Sistema → MikroTik) – usando un agente/script que consulta al sistema y aplica el corte en el MikroTik.

---

## 1. Lo que ya tiene el sistema

### 1.1 Reporte de consumo (MikroTik → Sistema)

El sistema acepta reportes de consumo desde tu red mediante:

- **Endpoint:** `POST /api/traffic/report`
- **Autenticación:** Header `X-Agent-Key: TU_TRAFFIC_AGENT_SECRET` (configura `TRAFFIC_AGENT_SECRET` en el servidor).
- **Body (ejemplo):**
  ```json
  {
    "reports": [
      { "client_id": 1, "bandwidth_usage_bytes": 12345678 },
      { "ip_address": "192.168.1.10", "bandwidth_usage_bytes": 5000000 }
    ]
  }
  ```

Puedes enviar por **client_id** o por **ip_address**; si envías IP, el sistema busca el cliente en `ip_credentials` o en `clients.ip_address`. El consumo se acumula y se muestra en el panel de Tráfico y en el portal del cliente.

**Cómo obtener datos del MikroTik:** En tu LAN, un script puede leer estadísticas del MikroTik (por IP o por usuario Hotspot/PPP) vía **API de RouterOS** o **SSH**, y cada X minutos hacer `POST` a `https://tu-dominio.com/api/traffic/report` con el header y el JSON anterior.

---

## 2. Cortes automáticos (Sistema → MikroTik)

El sistema **no se conecta directamente** al MikroTik. La forma recomendada es:

- Un **script o agente** que corre en un equipo de tu red (o en un servidor que tenga acceso al sistema y al MikroTik).
- Ese agente **cada X minutos**:
  1. Llama al sistema para obtener la **lista de clientes a cortar** (IPs).
  2. Se conecta al MikroTik (API o SSH) y **bloquea** esas IPs (o deshabilita usuarios Hotspot/PPP).

Así el “origen de la verdad” es el SistemaWISP (mora, estado suspendido) y el MikroTik solo ejecuta el corte.

### 2.1 Endpoint: lista de clientes a cortar

- **URL:** `GET /api/traffic/clients-to-cut`
- **Autenticación:** Header `X-Agent-Key: TU_TRAFFIC_AGENT_SECRET` (el mismo que para `/traffic/report`).
- **Parámetro opcional:** `days_min` (número). Solo incluye clientes en mora con al menos N días de atraso. Ejemplo: `?days_min=7` para cortar solo a quienes llevan 7 o más días sin pagar.
- **Respuesta (ejemplo):**
  ```json
  {
    "ips": ["192.168.1.10", "192.168.1.20"],
    "clients": [
      {
        "client_id": 1,
        "client_number": "1001",
        "client_name": "Juan Pérez",
        "ip_address": "192.168.1.10",
        "reason": "mora",
        "days_overdue": 12
      },
      {
        "client_id": 2,
        "client_number": "1002",
        "client_name": "María López",
        "ip_address": "192.168.1.20",
        "reason": "suspendido",
        "days_overdue": null
      }
    ]
  }
  ```

**Quién entra en la lista:**

- Clientes con **status = suspendido** en el sistema (cualquier motivo por el que tú los marques como suspendidos).
- Clientes **activos** que **no tienen pago de mensualidad** del mes actual (mora). Si usas `days_min=7`, solo se incluyen los que llevan 7 o más días de atraso en el mes.

**Requisito:** Que el cliente tenga al menos una **IP** en el sistema (en **IPs y Contraseñas** o en la ficha del cliente como `ip_address`). Esa IP es la que debes bloquear o deshabilitar en el MikroTik.

### 2.2 Cómo aplicar el corte en el MikroTik

Depende de cómo tengas armada la red:

#### Opción A: Bloqueo por IP (firewall / address-list)

Si cada cliente tiene una IP fija (o rango) y quieres cortar por IP:

- En el MikroTik creas una **address-list** (por ejemplo `clientes-cortados`).
- El script que corre periódicamente:
  1. Obtiene `ips` de `GET /api/traffic/clients-to-cut`.
  2. Añade esas IPs a la address-list `clientes-cortados`.
  3. En el firewall ya tienes una regla que **drop** (o limitar) el tráfico desde esa lista.

Al pagar o quitar la mora/suspensión en el sistema, el cliente **deja de aparecer** en `/clients-to-cut`. En la siguiente ejecución el script puede **quitar** su IP de la address-list en el MikroTik para reactivarlo (o puedes tener un segundo endpoint/lista “solo activos” y sincronizar).

#### Opción B: Hotspot (usuarios)

Si usas **Hotspot** y cada cliente es un usuario:

- Necesitas que en el sistema guardes el **nombre de usuario Hotspot** (por ejemplo en `ip_credentials` o en un campo del cliente). Hoy el sistema devuelve **IP**; si identificas al cliente en el MikroTik por usuario en lugar de por IP, tendrías que:
  - O bien guardar en el sistema la IP y hacer la relación IP ↔ usuario Hotspot en el script (consultando al MikroTik),
  - O bien ampliar el sistema para guardar “usuario Hotspot” y exponerlo en `/clients-to-cut`.
- En el MikroTik puedes **deshabilitar** el usuario Hotspot con:
  ```text
  /ip hotspot user disable [find name="usuario"]
  ```
- Para reactivar:
  ```text
  /ip hotspot user enable [find name="usuario"]
  ```

#### Opción C: PPPoE (secretos)

Si usas **PPPoE**:

- Similar a Hotspot: o trabajas por IP (si el PPP asigna IP fija y la tienes en el sistema) o por nombre de usuario. Para cortar podrías deshabilitar el secreto PPP o poner un profile que no permita tráfico.

En todos los casos, el **mismo agente** que llama a `GET /api/traffic/clients-to-cut` es el que debe ejecutar en el MikroTik los comandos (vía API o SSH) para bloquear/desbloquear.

---

## 3. Pasos prácticos para cortes automáticos

1. **Configurar en el servidor** la variable de entorno `TRAFFIC_AGENT_SECRET` (mín. 16 caracteres en producción). Así el endpoint `/api/traffic/clients-to-cut` acepta las peticiones del agente.

2. **Tener las IPs de los clientes** cargadas en el sistema (IPs y Contraseñas o campo IP del cliente). Esas son las que devuelve `clients-to-cut`.

3. **Decidir la regla de corte:**  
   - Cortar a todos los que estén en mora: llamar a `GET /api/traffic/clients-to-cut` sin parámetros.  
   - Cortar solo a los que lleven varios días: usar `?days_min=7` (o el número que quieras).

4. **Crear el script/agente** en un equipo de tu red (Linux/Windows) que:
   - Cada X minutos (por ejemplo 5–15) haga:
     - `GET https://tu-dominio.com/api/traffic/clients-to-cut?days_min=7`  
       con header `X-Agent-Key: TU_TRAFFIC_AGENT_SECRET`
   - Con la lista `ips` (y si quieres `clients` para logs):
     - Se conecte al MikroTik por **API RouterOS** o **SSH**
     - Añada esas IPs a la address-list de “cortados” (o deshabilite usuarios Hotspot/PPP).
   - Opcional: que también consulte “quién ya no debe estar cortado” (por ejemplo volver a obtener la lista y quitar de la address-list las IPs que ya no vienen) para **reactivar** automáticamente al pagar.

5. **MikroTik:** Tener creada la address-list y la regla de firewall (o los usuarios Hotspot/PPP) que realmente corten el tráfico según esa lista o ese usuario.

---

## 4. Ejemplo de uso del endpoint (curl)

```bash
# Lista de todos los que deben estar cortados (mora o suspendidos)
curl -s -H "X-Agent-Key: TU_TRAFFIC_AGENT_SECRET" \
  "https://tu-dominio.com/api/traffic/clients-to-cut"

# Solo morosos con al menos 7 días de atraso
curl -s -H "X-Agent-Key: TU_TRAFFIC_AGENT_SECRET" \
  "https://tu-dominio.com/api/traffic/clients-to-cut?days_min=7"
```

Con la respuesta puedes construir en tu script la lista de IPs a bloquear en el MikroTik.

---

## 5. Resumen

| Objetivo | Dirección | Cómo |
|----------|-----------|------|
| Enviar consumo al sistema | MikroTik → Sistema | Script en LAN que lee datos del MikroTik y hace `POST /api/traffic/report` con `X-Agent-Key`. |
| Cortes automáticos por mora/suspensión | Sistema → MikroTik | Script en LAN que hace `GET /api/traffic/clients-to-cut` (con `X-Agent-Key`) y aplica en el MikroTik el bloqueo por IP (address-list) o deshabilita usuarios Hotspot/PPP. |

**Variable de entorno necesaria en el servidor:** `TRAFFIC_AGENT_SECRET` (mismo valor para reporte de tráfico y para `clients-to-cut`).

---

## 6. Ejemplo de script (Node.js) para cortes por address-list

Este script corre cada X minutos, obtiene la lista del sistema y actualiza en el MikroTik la address-list `clientes-cortados`. Necesitas instalar `node-fetch` (o usar `fetch` nativo en Node 18+) y, para hablar con el MikroTik, `routeros-client` o ejecutar SSH desde Node.

```javascript
// Ejemplo: obtener IPs a cortar y (opcional) sincronizar con MikroTik
const AGENT_KEY = process.env.TRAFFIC_AGENT_SECRET;
const API_BASE = 'https://tu-dominio.com/api';

async function getClientsToCut(daysMin = 0) {
  const url = daysMin > 0
    ? `${API_BASE}/traffic/clients-to-cut?days_min=${daysMin}`
    : `${API_BASE}/traffic/clients-to-cut`;
  const res = await fetch(url, {
    headers: { 'X-Agent-Key': AGENT_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function main() {
  const { ips, clients } = await getClientsToCut(7); // solo 7+ días mora
  console.log('IPs a cortar:', ips.length, ips);

  // Aquí: conectar al MikroTik por API o SSH y:
  // 1) Añadir cada IP a /ip firewall address-list list=clientes-cortados
  // 2) Opcional: quitar de la lista las IPs que ya no vienen en `ips` (reactivar)
  // Ejemplo con routeros-client:
  // const { RouterOSAPI } = require('routeros-client');
  // const api = new RouterOSAPI({ host, user, password });
  // await api.connect();
  // for (const ip of ips) {
  //   await api.menu('/ip/firewall/address-list').add({ address: ip, list: 'clientes-cortados' });
  // }
}

main().catch(console.error);
```

Puedes ejecutarlo con **cron** o **node-cron** cada 5–15 minutos. La variable `TRAFFIC_AGENT_SECRET` debe coincidir con la del servidor.
