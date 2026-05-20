const express = require('express');
const { getBusinessYearMonth, getBusinessDaysSinceMonthStart } = require('../utils/businessTime');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const { effPkgName } = require('../utils/clientPackageSql');

const TRAF_PKG_NAME = effPkgName('c', 'p');
/** Lista tráfico: paquete efectivo cuando el registro viene de cliente c o de instalación (ci). */
const TRAF_PKG_NAME_LIST = `(CASE WHEN c.custom_package_price IS NOT NULL THEN COALESCE(NULLIF(TRIM(c.custom_package_name), ''), 'Personalizado') WHEN ci.custom_package_price IS NOT NULL THEN COALESCE(NULLIF(TRIM(ci.custom_package_name), ''), 'Personalizado') ELSE p.name END)`;

const router = express.Router();

const TRAFFIC_AGENT_SECRET = process.env.TRAFFIC_AGENT_SECRET || '';

// Reporte de consumo desde agente (LAN/MikroTik): no usa JWT, usa secreto en header
// POST /api/traffic/report  Header: X-Agent-Key: <TRAFFIC_AGENT_SECRET>
// Body: { reports: [ { client_id?, ip_address?, bandwidth_usage_bytes, download_speed?, upload_speed?, connection_status? } ] }
router.post('/report', (req, res) => {
  if (!TRAFFIC_AGENT_SECRET) {
    return res.status(503).json({ error: 'Servicio no configurado: falta TRAFFIC_AGENT_SECRET' });
  }
  const key = req.headers['x-agent-key'] || (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '').trim());
  if (key !== TRAFFIC_AGENT_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const { reports } = req.body || {};
  if (!Array.isArray(reports) || reports.length === 0) {
    return res.status(400).json({ error: 'Se requiere body.reports (array de objetos con client_id o ip_address y bandwidth_usage_bytes)' });
  }
  const database = db.getDb();
  const now = new Date().toISOString();
  let processed = 0;
  let errors = [];
  const processOne = (r, cb) => {
    const clientId = r.client_id;
    const ipAddress = r.ip_address;
    const bandwidthBytes = typeof r.bandwidth_usage_bytes === 'number' ? r.bandwidth_usage_bytes : parseFloat(r.bandwidth_usage_bytes) || 0;
    if (!clientId && !ipAddress) {
      errors.push('report sin client_id ni ip_address');
      return cb();
    }
    const resolveClient = (done) => {
      if (clientId) return done(clientId);
      database.get('SELECT client_id FROM ip_credentials WHERE ip_address = ? LIMIT 1', [ipAddress], (e, row) => {
        if (e || !row) {
          database.get('SELECT id FROM clients WHERE ip_address = ? LIMIT 1', [ipAddress], (e2, row2) => {
            done(row2 ? row2.id : null);
          });
        } else done(row.client_id);
      });
    };
    resolveClient((cid) => {
      if (!cid) {
        errors.push(`cliente no encontrado para ip ${ipAddress}`);
        return cb();
      }
      database.get('SELECT id, bandwidth_usage FROM client_traffic WHERE client_id = ?', [cid], (err, existing) => {
        if (err) {
          errors.push(err.message);
          return cb();
        }
        const newUsage = (parseFloat(existing?.bandwidth_usage) || 0) + bandwidthBytes;
        const connStatus = r.connection_status || 'conectado';
        const downloadSpeed = r.download_speed != null ? r.download_speed : existing?.download_speed;
        const uploadSpeed = r.upload_speed != null ? r.upload_speed : existing?.upload_speed;
        if (existing) {
          database.run(
            `UPDATE client_traffic SET bandwidth_usage = ?, connection_status = ?, download_speed = ?, upload_speed = ?, last_seen = ?, updated_at = ?, ip_address = COALESCE(?, ip_address) WHERE client_id = ?`,
            [newUsage, connStatus, downloadSpeed, uploadSpeed, now, now, ipAddress || existing.ip_address, cid],
            (e) => {
              if (!e) processed++;
              else errors.push(e.message);
              cb();
            }
          );
        } else {
          database.run(
            `INSERT INTO client_traffic (client_id, bandwidth_usage, connection_status, download_speed, upload_speed, last_seen, ip_address, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cid, newUsage, connStatus, downloadSpeed, uploadSpeed, now, ipAddress || null, now],
            (e) => {
              if (!e) processed++;
              else errors.push(e.message);
              cb();
            }
          );
        }
      });
    });
  };
  let i = 0;
  const next = () => {
    if (i >= reports.length) {
      return res.json({ ok: true, processed, errors: errors.length ? errors : undefined });
    }
    processOne(reports[i], () => {
      i++;
      next();
    });
  };
  next();
});

// Lista de clientes a cortar (para agente MikroTik/script): IPs de clientes en mora o con status suspendido
// GET /api/traffic/clients-to-cut  Header: X-Agent-Key: <TRAFFIC_AGENT_SECRET>
// Query: ?days_min=7 (opcional) solo clientes con al menos N días de atraso (default 0 = todos en mora)
// Devuelve: { ips: string[], clients: { client_id, client_number, ip_address, reason }[] }
router.get('/clients-to-cut', (req, res) => {
  if (!TRAFFIC_AGENT_SECRET) {
    return res.status(503).json({ error: 'Servicio no configurado: falta TRAFFIC_AGENT_SECRET' });
  }
  const key = req.headers['x-agent-key'] || (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, '').trim());
  if (key !== TRAFFIC_AGENT_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const daysMin = Math.max(0, parseInt(req.query.days_min, 10) || 0);
  const database = db.getDb();
  const now = new Date();
  const currentMonth = getBusinessYearMonth(now);
  const daysSinceFirst = getBusinessDaysSinceMonthStart(now);

  // 1) Clientes con status = 'suspendido' 2) Clientes en mora (sin pago del mes actual)
  database.all(
    `SELECT c.id as client_id, c.client_number, c.name, c.status,
        COALESCE(ip.ip_address, c.ip_address) as ip_address
     FROM clients c
     LEFT JOIN ip_credentials ip ON ip.client_id = c.id AND ip.ip_address IS NOT NULL AND ip.ip_address != '' AND ip.ip_address != '0.0.0.0'
     WHERE (c.status = 'suspendido')
        OR (
          (c.status = 'activo' OR c.status IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.client_id = c.id AND (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
              AND strftime('%Y-%m', DATE(p.payment_date)) = ?
          )
        )
     ORDER BY c.id`,
    [currentMonth],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener clientes a cortar:', err);
        return res.status(500).json({ error: 'Error al obtener lista' });
      }
      const list = (rows || [])
        .filter((r) => r.ip_address)
        .map((r) => ({
          client_id: r.client_id,
          client_number: r.client_number,
          client_name: r.name,
          ip_address: r.ip_address,
          reason: r.status === 'suspendido' ? 'suspendido' : 'mora',
          days_overdue: r.status === 'suspendido' ? null : daysSinceFirst
        }))
        .filter((r) => r.reason === 'suspendido' || r.days_overdue >= daysMin);
      const ips = [...new Set(list.map((r) => r.ip_address))];
      res.json({ ips, clients: list });
    }
  );
});

// Todas las rutas siguientes requieren autenticación
router.use(authenticateToken);

// Obtener todo el tráfico de clientes
router.get('/', (req, res) => {
  const database = db.getDb();
  const { client_id, installation_id, status } = req.query;
  
  let query = `
    SELECT t.*, 
           COALESCE(c.name, ci.name) as client_name, 
           COALESCE(c.client_number, ci.client_number) as client_number,
           COALESCE(c.address, ci.address) as client_address,
           i.installation_folio,
           i.status as installation_status,
           ${TRAF_PKG_NAME_LIST} as package_name,
           p.speed as package_speed
    FROM client_traffic t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN installations i ON t.installation_id = i.id
    LEFT JOIN clients ci ON i.client_id = ci.id
    LEFT JOIN packages p ON COALESCE(c.package_id, ci.package_id) = p.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (client_id) {
    query += ' AND t.client_id = ?';
    params.push(client_id);
  }
  
  if (installation_id) {
    query += ' AND t.installation_id = ?';
    params.push(installation_id);
  }
  
  if (status) {
    query += ' AND t.connection_status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY t.updated_at DESC, t.last_seen DESC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener tráfico:', err);
      return res.status(500).json({ error: 'Error al obtener tráfico de clientes' });
    }
    res.json(rows);
  });
});

// Obtener tráfico de un cliente específico
router.get('/client/:clientId', (req, res) => {
  const database = db.getDb();
  const clientId = req.params.clientId;
  
  database.all(`
    SELECT t.*, 
           i.installation_folio,
           i.status as installation_status,
           ${TRAF_PKG_NAME} as package_name,
           p.speed as package_speed
    FROM client_traffic t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN installations i ON t.installation_id = i.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE t.client_id = ?
    ORDER BY t.updated_at DESC
  `, [clientId], (err, rows) => {
    if (err) {
      console.error('Error al obtener tráfico del cliente:', err);
      return res.status(500).json({ error: 'Error al obtener tráfico del cliente' });
    }
    res.json(rows);
  });
});

// Obtener un registro de tráfico por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const trafficId = req.params.id;
  
  database.get(`
    SELECT t.*, 
           c.name as client_name, 
           c.client_number,
           c.address as client_address,
           i.installation_folio,
           i.status as installation_status,
           ${TRAF_PKG_NAME} as package_name,
           p.speed as package_speed
    FROM client_traffic t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN installations i ON t.installation_id = i.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE t.id = ?
  `, [trafficId], (err, row) => {
    if (err) {
      console.error('Error al obtener tráfico:', err);
      return res.status(500).json({ error: 'Error al obtener tráfico' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Registro de tráfico no encontrado' });
    }
    res.json(row);
  });
});

// Crear o actualizar registro de tráfico
router.post('/', (req, res) => {
  const {
    client_id,
    installation_id,
    connection_status,
    download_speed,
    upload_speed,
    latency,
    packet_loss,
    bandwidth_usage,
    ip_address,
    mac_address,
    device_type,
    signal_strength,
    notes
  } = req.body;
  
  const database = db.getDb();
  const now = new Date().toISOString();
  
  // Si no se proporciona client_id ni installation_id, es un error
  if (!client_id && !installation_id) {
    return res.status(400).json({ error: 'Se requiere client_id o installation_id' });
  }
  
  // Verificar si ya existe un registro para este cliente/instalación
  const checkQuery = client_id 
    ? 'SELECT id FROM client_traffic WHERE client_id = ?'
    : 'SELECT id FROM client_traffic WHERE installation_id = ?';
  const checkParams = client_id ? [client_id] : [installation_id];
  
  database.get(checkQuery, checkParams, (err, existing) => {
    if (err) {
      console.error('Error al verificar tráfico existente:', err);
      return res.status(500).json({ error: 'Error al verificar tráfico existente' });
    }
    
    if (existing) {
      // Actualizar registro existente
      database.run(`
        UPDATE client_traffic 
        SET connection_status = ?,
            download_speed = ?,
            upload_speed = ?,
            latency = ?,
            packet_loss = ?,
            bandwidth_usage = ?,
            packets_sent = ?,
            packets_received = ?,
            packets_total = ?,
            last_seen = ?,
            ip_address = ?,
            mac_address = ?,
            device_type = ?,
            signal_strength = ?,
            notes = ?,
            updated_at = ?
        WHERE id = ?
      `, [
        connection_status || 'desconectado',
        download_speed || null,
        upload_speed || null,
        latency || null,
        packet_loss || null,
        bandwidth_usage || null,
        packets_sent || 0,
        packets_received || 0,
        packets_total || 0,
        now,
        ip_address || null,
        mac_address || null,
        device_type || null,
        signal_strength || null,
        notes || null,
        now,
        existing.id
      ], function(err) {
        if (err) {
          console.error('Error al actualizar tráfico:', err);
          return res.status(500).json({ error: 'Error al actualizar tráfico: ' + err.message });
        }
        
        // Emitir evento de actualización en tiempo real
        emitEntityUpdate('traffic', 'updated', { id: existing.id });
        
        res.json({ 
          id: existing.id, 
          message: 'Tráfico actualizado exitosamente',
          updated: true
        });
      });
    } else {
      // Crear nuevo registro
      database.run(`
        INSERT INTO client_traffic (
          client_id, installation_id, connection_status, download_speed, 
          upload_speed, latency, packet_loss, bandwidth_usage, 
          packets_sent, packets_received, packets_total,
          last_seen, ip_address, mac_address, device_type, signal_strength, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        client_id || null,
        installation_id || null,
        connection_status || 'desconectado',
        download_speed || null,
        upload_speed || null,
        latency || null,
        packet_loss || null,
        bandwidth_usage || null,
        packets_sent || 0,
        packets_received || 0,
        packets_total || 0,
        now,
        ip_address || null,
        mac_address || null,
        device_type || null,
        signal_strength || null,
        notes || null,
        now
      ], function(err) {
        if (err) {
          console.error('Error al crear tráfico:', err);
          return res.status(500).json({ error: 'Error al crear tráfico: ' + err.message });
        }
        
        // Emitir evento de creación en tiempo real
        emitEntityUpdate('traffic', 'created', { id: this.lastID });
        
        res.status(201).json({ 
          id: this.lastID, 
          message: 'Tráfico registrado exitosamente',
          updated: false
        });
      });
    }
  });
});

// Actualizar registro de tráfico
router.put('/:id', checkPermission('update'), (req, res) => {
  const {
    connection_status,
    download_speed,
    upload_speed,
    latency,
    packet_loss,
    bandwidth_usage,
    packets_sent,
    packets_received,
    packets_total,
    ip_address,
    mac_address,
    device_type,
    signal_strength,
    notes
  } = req.body;
  
  const trafficId = req.params.id;
  const database = db.getDb();
  const now = new Date().toISOString();
  
  database.run(`
    UPDATE client_traffic 
    SET connection_status = ?,
        download_speed = ?,
        upload_speed = ?,
        latency = ?,
        packet_loss = ?,
        bandwidth_usage = ?,
        packets_sent = ?,
        packets_received = ?,
        packets_total = ?,
        last_seen = ?,
        ip_address = ?,
        mac_address = ?,
        device_type = ?,
        signal_strength = ?,
        notes = ?,
        updated_at = ?
    WHERE id = ?
  `, [
    connection_status || 'desconectado',
    download_speed || null,
    upload_speed || null,
    latency || null,
    packet_loss || null,
    bandwidth_usage || null,
    packets_sent || 0,
    packets_received || 0,
    packets_total || 0,
    now,
    ip_address || null,
    mac_address || null,
    device_type || null,
    signal_strength || null,
    notes || null,
    now,
    trafficId
  ], function(err) {
    if (err) {
      console.error('Error al actualizar tráfico:', err);
      return res.status(500).json({ error: 'Error al actualizar tráfico: ' + err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Registro de tráfico no encontrado' });
    }
    
    // Emitir evento de actualización en tiempo real
    emitEntityUpdate('traffic', 'updated', { id: trafficId });
    
    res.json({ message: 'Tráfico actualizado exitosamente' });
  });
});

// Eliminar registro de tráfico (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const trafficId = req.params.id;
  
  database.run('DELETE FROM client_traffic WHERE id = ?', [trafficId], function(err) {
    if (err) {
      console.error('Error al eliminar tráfico:', err);
      return res.status(500).json({ error: 'Error al eliminar tráfico' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Registro de tráfico no encontrado' });
    }
    
    // Emitir evento de eliminación en tiempo real
    emitEntityUpdate('traffic', 'deleted', { id: trafficId });
    
    res.json({ message: 'Registro de tráfico eliminado exitosamente' });
  });
});

// Obtener estadísticas de tráfico
router.get('/stats/summary', (req, res) => {
  const database = db.getDb();
  
  database.all(`
    SELECT 
      COUNT(*) as total_clients,
      SUM(CASE WHEN connection_status = 'conectado' THEN 1 ELSE 0 END) as connected,
      SUM(CASE WHEN connection_status = 'desconectado' THEN 1 ELSE 0 END) as disconnected,
      SUM(CASE WHEN connection_status = 'problema' THEN 1 ELSE 0 END) as problems,
      AVG(download_speed) as avg_download,
      AVG(upload_speed) as avg_upload,
      AVG(latency) as avg_latency
    FROM client_traffic
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener estadísticas:', err);
      return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
    res.json(rows[0] || {});
  });
});

// Obtener estado del monitor de tráfico
router.get('/monitor/status', (req, res) => {
  try {
    const trafficMonitor = require('../services/trafficMonitor');
    const stats = trafficMonitor.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado del monitor: ' + error.message });
  }
});

// Controlar el monitor de tráfico (iniciar/detener)
router.post('/monitor/control', (req, res) => {
  try {
    const trafficMonitor = require('../services/trafficMonitor');
    const { action, interval } = req.body;
    
    if (action === 'start') {
      const monitorInterval = interval || 60;
      trafficMonitor.start(monitorInterval);
      res.json({ message: `Monitor iniciado con intervalo de ${monitorInterval} segundos` });
    } else if (action === 'stop') {
      trafficMonitor.stop();
      res.json({ message: 'Monitor detenido' });
    } else if (action === 'reload') {
      trafficMonitor.loadClientsWithIPs();
      res.json({ message: 'Lista de clientes recargada' });
    } else {
      res.status(400).json({ error: 'Acción no válida. Use: start, stop o reload' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al controlar el monitor: ' + error.message });
  }
});

module.exports = router;

