const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');
const { effMonthly } = require('../utils/clientPackageSql');

const EINV_PKG = effMonthly('c', 'p');

const router = express.Router();

router.use(authenticateToken);
router.use(blockTechnicians);

// Obtener configuración de facturación electrónica
router.get('/config', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT id, proveedor, rfc, regimen_fiscal, serie, is_active FROM electronic_invoice_config WHERE is_active = 1 LIMIT 1',
    [],
    (err, config) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener configuración' });
      }
      if (!config) {
        return res.json({ configured: false, message: 'Facturación electrónica no configurada' });
      }
      res.json({
        configured: true,
        proveedor: config.proveedor,
        rfc: config.rfc,
        regimen_fiscal: config.regimen_fiscal,
        serie: config.serie
      });
    }
  );
});

// Guardar/actualizar configuración (solo admin)
router.post('/config', (req, res) => {
  const { proveedor, rfc, regimen_fiscal, usuario_api, password_api, url_api, serie } = req.body;

  if (!proveedor || !rfc) {
    return res.status(400).json({ error: 'Proveedor y RFC son requeridos' });
  }

  const database = db.getDb();
  database.get('SELECT id FROM electronic_invoice_config WHERE is_active = 1 LIMIT 1', [], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar configuración' });
    }

    const configData = {
      proveedor: proveedor.trim(),
      rfc: rfc.trim().toUpperCase(),
      regimen_fiscal: regimen_fiscal || null,
      usuario_api: usuario_api || null,
      password_api: password_api || null,
      url_api: url_api || null,
      serie: serie || 'A'
    };

    if (existing) {
      database.run(
        `UPDATE electronic_invoice_config SET
          proveedor = ?, rfc = ?, regimen_fiscal = ?,
          usuario_api = ?, password_api = ?, url_api = ?, serie = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [configData.proveedor, configData.rfc, configData.regimen_fiscal,
         configData.usuario_api, configData.password_api, configData.url_api, configData.serie,
         existing.id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error al actualizar configuración' });
          res.json({ message: 'Configuración actualizada', id: existing.id });
        }
      );
    } else {
      database.run(
        `INSERT INTO electronic_invoice_config (proveedor, rfc, regimen_fiscal, usuario_api, password_api, url_api, serie)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [configData.proveedor, configData.rfc, configData.regimen_fiscal,
         configData.usuario_api, configData.password_api, configData.url_api, configData.serie],
        function(err) {
          if (err) return res.status(500).json({ error: 'Error al guardar configuración' });
          res.status(201).json({ message: 'Configuración guardada', id: this.lastID });
        }
      );
    }
  });
});

// Listar facturas electrónicas
router.get('/', (req, res) => {
  const database = db.getDb();
  const { client_id, limit = 50 } = req.query;

  let query = `
    SELECT ei.*, c.name as client_name, c.client_number
    FROM electronic_invoices ei
    LEFT JOIN clients c ON ei.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (client_id) {
    query += ' AND ei.client_id = ?';
    params.push(client_id);
  }

  query += ' ORDER BY ei.created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 50);

  database.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener facturas' });
    }
    res.json(rows || []);
  });
});

// Generar factura electrónica desde recibo
router.post('/generate', (req, res) => {
  const { receipt_id, client_id } = req.body;

  if (!receipt_id && !client_id) {
    return res.status(400).json({ error: 'Se requiere receipt_id o client_id' });
  }

  const database = db.getDb();

  database.get('SELECT * FROM electronic_invoice_config WHERE is_active = 1 LIMIT 1', [], (err, config) => {
    if (err || !config) {
      return res.status(400).json({
        error: 'Facturación electrónica no configurada',
        message: 'Configura los datos del proveedor (Facturama, SW Sapien, etc.) en Configuración > Facturación Electrónica'
      });
    }

    const getReceiptAndClient = (callback) => {
      if (receipt_id) {
        database.get(
          `SELECT r.*, c.name as client_name, c.client_number, c.address, c.email, c.phone
           FROM receipts r
           LEFT JOIN clients c ON r.client_id = c.id
           WHERE r.id = ?`,
          [receipt_id],
          (err, receipt) => {
            if (err || !receipt) return callback(err || new Error('Recibo no encontrado'));
            callback(null, receipt, receipt.client_id);
          }
        );
      } else if (client_id) {
        database.get(
          `SELECT c.*, ${EINV_PKG} as package_price FROM clients c
           LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
          [client_id],
          (err, client) => {
            if (err || !client) return callback(err || new Error('Cliente no encontrado'));
            const receipt = {
              client_name: client.name,
              client_number: client.client_number,
              amount: client.package_price || 0,
              receipt_type: 'mensualidad',
              concept: 'Servicio de internet mensual'
            };
            callback(null, receipt, client.id);
          }
        );
      }
    };

    getReceiptAndClient((err, receipt, clientId) => {
      if (err) {
        return res.status(404).json({ error: err.message });
      }

      const amount = parseFloat(receipt.amount) || 0;
      const subtotal = Math.round(amount / 1.16 * 100) / 100;
      const iva = Math.round((amount - subtotal) * 100) / 100;

      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      const folio = String(Date.now()).slice(-8);

      database.run(
        `INSERT INTO electronic_invoices (receipt_id, client_id, uuid, folio_fiscal, serie, folio, rfc_emisor, total, subtotal, iva, estado_sat, proveedor, fecha_emision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generado', ?, datetime('now'))`,
        [
          receipt_id || null,
          clientId,
          uuid,
          uuid,
          config.serie || 'A',
          folio,
          config.rfc,
          amount,
          subtotal,
          iva,
          config.proveedor
        ],
        function(insertErr) {
          if (insertErr) {
            console.error('Error al crear factura:', insertErr);
            return res.status(500).json({ error: 'Error al generar factura' });
          }

          res.status(201).json({
            id: this.lastID,
            uuid,
            folio,
            message: 'Factura electrónica generada (modo simulado). Conecta un proveedor real (Facturama, SW Sapien) para timbrado SAT.',
            note: 'Configura url_api, usuario_api y password_api del proveedor para integración real con el SAT.'
          });
        }
      );
    });
  });
});

// Obtener factura por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT ei.*, c.name as client_name, c.client_number, c.address, c.email
     FROM electronic_invoices ei
     LEFT JOIN clients c ON ei.client_id = c.id
     WHERE ei.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al obtener factura' });
      if (!row) return res.status(404).json({ error: 'Factura no encontrada' });
      res.json(row);
    }
  );
});

module.exports = router;
