const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Verificar si multer está disponible
let multer;
let upload;
try {
  multer = require('multer');
  if (!fs.existsSync('uploads/reconciliation/')) {
    fs.mkdirSync('uploads/reconciliation/', { recursive: true });
  }
  upload = multer({ dest: 'uploads/reconciliation/' });
} catch (err) {
  console.warn('Multer no está instalado. La funcionalidad de importación CSV estará limitada.');
}

// Obtener movimientos bancarios
router.get('/movements', authenticateToken, (req, res) => {
  const { start_date, end_date, account_id } = req.query;
  
  let query = 'SELECT * FROM bank_movements WHERE 1=1';
  const params = [];

  if (start_date) {
    query += ' AND DATE(movement_date) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND DATE(movement_date) <= ?';
    params.push(end_date);
  }
  if (account_id) {
    query += ' AND account_id = ?';
    params.push(account_id);
  }

  query += ' ORDER BY movement_date DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }
    res.json(rows || []);
  });
});

// Importar movimientos desde CSV
router.post('/import', authenticateToken, requireRole(['admin', 'editor']), (req, res, next) => {
  if (!upload) {
    return res.status(500).json({ error: 'Funcionalidad de importación no disponible. Instale multer: npm install multer' });
  }
  upload.single('file')(req, res, next);
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó archivo' });
  }

  // Leer y procesar CSV (método simple sin csv-parser)
  const results = [];
  const csvContent = fs.readFileSync(req.file.path, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, idx) => {
        row[header.toLowerCase()] = values[idx] || '';
      });
      results.push(row);
    }
  }
  
  // Procesar resultados
  (async () => {
      // Procesar resultados e insertar en base de datos
      const movements = results.map(row => ({
        account_id: req.body.account_id || null,
        movement_date: row.fecha || row.date,
        description: row.descripcion || row.description || '',
        amount: parseFloat(row.monto || row.amount || 0),
        reference: row.referencia || row.reference || '',
        is_reconciled: 0
      }));

      let inserted = 0;
      let errors = 0;

      movements.forEach(movement => {
        database.run(`
          INSERT INTO bank_movements (account_id, movement_date, description, amount, reference, is_reconciled)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          movement.account_id,
          movement.movement_date,
          movement.description,
          movement.amount,
          movement.reference,
          movement.is_reconciled
        ], (err) => {
          if (err) {
            errors++;
            console.error('Error al insertar movimiento:', err);
          } else {
            inserted++;
          }
        });
      });

      // Eliminar archivo temporal
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error al eliminar archivo temporal:', e);
      }

      res.json({
        message: 'Importación completada',
        inserted,
        errors,
        total: movements.length
      });
    })();
});

// Conciliar movimiento con pago
router.post('/reconcile', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const database = db.getDb();
  const { movement_id, payment_id } = req.body;

  if (!movement_id || !payment_id) {
    return res.status(400).json({ error: 'Faltan movement_id o payment_id' });
  }

  database.run(`
    UPDATE bank_movements 
    SET is_reconciled = 1, reconciled_with_payment_id = ?, reconciled_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [payment_id, movement_id], function(err) {
    if (err) {
      console.error('Error al conciliar:', err);
      return res.status(500).json({ error: 'Error al conciliar movimiento' });
    }
    res.json({ message: 'Movimiento conciliado exitosamente' });
  });
});

// Obtener movimientos no conciliados
router.get('/unreconciled', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT * FROM bank_movements 
    WHERE is_reconciled = 0
    ORDER BY movement_date DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener movimientos no conciliados:', err);
      return res.status(500).json({ error: 'Error al obtener movimientos' });
    }
    res.json(rows || []);
  });
});

module.exports = router;

