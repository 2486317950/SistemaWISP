const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getBusinessYear, getBusinessMonth } = require('../utils/businessTime');
const { effMonthly } = require('../utils/clientPackageSql');

const AB_MONTHLY = effMonthly('c', 'p');

// Generar facturas automáticas para el mes
router.post('/generate', authenticateToken, requireRole(['admin']), (req, res) => {
  const { month, year } = req.body;
  const now = new Date();
  const targetMonth = month || getBusinessMonth(now);
  const targetYear = year || getBusinessYear(now);

  const database = db.getDb();

  // Obtener clientes activos
  database.all(`
    SELECT c.*, ${AB_MONTHLY} as package_price
    FROM clients c
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE c.status = 'activo'
  `, [], (err, clients) => {
    if (err) {
      console.error('Error al obtener clientes:', err);
      return res.status(500).json({ error: 'Error al generar facturas' });
    }

    let generated = 0;
    let errors = 0;
    let completed = 0;
    const totalClients = clients.length;

    if (totalClients === 0) {
      return res.json({
        message: 'Facturación automática completada',
        generated: 0,
        errors: 0,
        total_clients: 0
      });
    }

    clients.forEach(client => {
      // Verificar si ya existe recibo para este mes
      const receiptDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      
      database.get(`
        SELECT * FROM receipts 
        WHERE client_id = ? AND strftime('%Y-%m', receipt_date) = ?
      `, [client.id, monthStr], (err, existing) => {
        if (err) {
          console.error('Error al verificar recibo existente:', err);
          errors++;
          completed++;
          if (completed === totalClients) {
            res.json({
              message: 'Facturación automática completada',
              generated,
              errors,
              total_clients: totalClients
            });
          }
          return;
        }

        if (!existing && client.package_price) {
          // Generar recibo automático
          database.run(`
            INSERT INTO receipts (client_id, receipt_number, receipt_type, amount, receipt_date, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            client.id,
            `REC-${targetYear}${String(targetMonth).padStart(2, '0')}-${client.id}`,
            'mensualidad',
            client.package_price,
            receiptDate,
            'Generado automáticamente'
          ], (err) => {
            completed++;
            if (err) {
              errors++;
              console.error('Error al generar recibo:', err);
            } else {
              generated++;
            }
            
            if (completed === totalClients) {
              res.json({
                message: 'Facturación automática completada',
                generated,
                errors,
                total_clients: totalClients
              });
            }
          });
        } else {
          completed++;
          if (completed === totalClients) {
            res.json({
              message: 'Facturación automática completada',
              generated,
              errors,
              total_clients: totalClients
            });
          }
        }
      });
    });
  });
});

// Obtener configuración de facturación automática
router.get('/settings', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM auto_billing_settings WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Error al obtener configuración:', err);
      return res.status(500).json({ error: 'Error al obtener configuración' });
    }
    res.json(row || { is_enabled: 0, day_of_month: 1 });
  });
});

// Actualizar configuración
router.put('/settings', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { is_enabled, day_of_month } = req.body;

  database.run(`
    INSERT INTO auto_billing_settings (id, is_enabled, day_of_month)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      is_enabled = excluded.is_enabled,
      day_of_month = excluded.day_of_month
  `, [is_enabled ? 1 : 0, day_of_month || 1], function(err) {
    if (err) {
      console.error('Error al actualizar configuración:', err);
      return res.status(500).json({ error: 'Error al actualizar configuración' });
    }
    res.json({ message: 'Configuración actualizada exitosamente' });
  });
});

module.exports = router;

