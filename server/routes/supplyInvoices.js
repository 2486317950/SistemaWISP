const express = require('express');
const multer = require('multer');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Configurar multer para guardar archivos en memoria (luego los guardaremos en la BD)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = /\.(jpeg|jpg|png|pdf)$/i.test(file.originalname);
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, JPG, JPEG o PNG'));
    }
  }
});

// Ruta para servir archivos desde la base de datos
router.get('/files/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Verificar token si está presente
  if (token) {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    jwt.verify(token, JWT_SECRET, (err) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
      }
      // Token válido, servir archivo desde la BD
      serveFileFromDB(req, res);
    });
  } else {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
});

// Función auxiliar para servir archivos desde la base de datos
function serveFileFromDB(req, res) {
  const invoiceId = req.params.id;
  const database = db.getDb();
  
  database.get(
    'SELECT file_data, file_type, file_name FROM supply_invoices WHERE id = ?',
    [invoiceId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el archivo' });
      }
      
      if (!row || !row.file_data) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      
      // Determinar el tipo de contenido
      let contentType = 'application/octet-stream';
      if (row.file_type) {
        contentType = row.file_type;
      } else if (row.file_name) {
        const ext = row.file_name.toLowerCase().split('.').pop();
        if (ext === 'pdf') {
          contentType = 'application/pdf';
        } else if (ext === 'jpg' || ext === 'jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === 'png') {
          contentType = 'image/png';
        }
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${row.file_name || 'archivo'}"`);
      res.send(row.file_data);
    }
  );
}

// Todas las demás rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a facturas de insumos
router.use(blockTechnicians);

// Obtener todas las facturas de insumos (sin incluir los datos del archivo para no sobrecargar)
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT id, invoice_number, company, amount, invoice_date, 
           CASE WHEN file_data IS NOT NULL THEN 1 ELSE 0 END as has_file,
           file_name, file_type, created_at
    FROM supply_invoices
    ORDER BY invoice_date DESC, created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener facturas de insumos' });
    }
    res.json(rows);
  });
});

// Obtener una factura específica (sin incluir los datos del archivo)
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT id, invoice_number, company, amount, invoice_date, 
            CASE WHEN file_data IS NOT NULL THEN 1 ELSE 0 END as has_file,
            file_name, file_type, created_at
     FROM supply_invoices WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la factura' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      res.json(row);
    }
  );
});

// Crear una nueva factura de insumos
router.post('/', checkPermission('create'), upload.single('file'), (req, res) => {
  const { invoice_number, company, amount, invoice_date } = req.body;

  if (!invoice_number || !company || !amount || !invoice_date) {
    return res.status(400).json({ error: 'Número de factura, empresa, monto y fecha son requeridos' });
  }

  const database = db.getDb();
  
  // Preparar datos del archivo si existe
  let fileData = null;
  let fileName = null;
  let fileType = null;
  
  if (req.file) {
    fileData = req.file.buffer; // Buffer del archivo en memoria
    fileName = req.file.originalname;
    fileType = req.file.mimetype;
  }
  
  database.run(
    'INSERT INTO supply_invoices (invoice_number, company, amount, invoice_date, file_data, file_name, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [invoice_number, company, parseFloat(amount), invoice_date, fileData, fileName, fileType],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al crear la factura' });
      }
      res.status(201).json({ id: this.lastID, message: 'Factura registrada exitosamente' });
    }
  );
});

// Actualizar una factura de insumos
router.put('/:id', checkPermission('update'), upload.single('file'), (req, res) => {
  const { invoice_number, company, amount, invoice_date } = req.body;
  const invoiceId = req.params.id;

  if (!invoice_number || !company || !amount || !invoice_date) {
    return res.status(400).json({ error: 'Número de factura, empresa, monto y fecha son requeridos' });
  }

  const database = db.getDb();
  
  // Si se subió un nuevo archivo, actualizar los datos del archivo
  if (req.file) {
    const fileData = req.file.buffer;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    
    database.run(
      'UPDATE supply_invoices SET invoice_number = ?, company = ?, amount = ?, invoice_date = ?, file_data = ?, file_name = ?, file_type = ? WHERE id = ?',
      [invoice_number, company, parseFloat(amount), invoice_date, fileData, fileName, fileType, invoiceId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar la factura' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Factura no encontrada' });
        }
        res.json({ message: 'Factura actualizada exitosamente' });
      }
    );
  } else {
    // Si no se subió archivo nuevo, mantener el archivo existente
    database.run(
      'UPDATE supply_invoices SET invoice_number = ?, company = ?, amount = ?, invoice_date = ? WHERE id = ?',
      [invoice_number, company, parseFloat(amount), invoice_date, invoiceId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar la factura' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Factura no encontrada' });
        }
        res.json({ message: 'Factura actualizada exitosamente' });
      }
    );
  }
});

// Eliminar una factura de insumos
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const invoiceId = req.params.id;

  // Primero, verificar si hay gastos vinculados a esta factura
  database.get('SELECT COUNT(*) as count FROM expenses WHERE supply_invoice_id = ?', [invoiceId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar gastos vinculados' });
    }

    // Si hay gastos vinculados, actualizar su supply_invoice_id a NULL antes de eliminar
    if (row && row.count > 0) {
      database.run('UPDATE expenses SET supply_invoice_id = NULL WHERE supply_invoice_id = ?', [invoiceId], (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Error al actualizar gastos vinculados' });
        }

        // Ahora eliminar la factura
        database.run('DELETE FROM supply_invoices WHERE id = ?', [invoiceId], function(deleteErr) {
          if (deleteErr) {
            return res.status(500).json({ error: 'Error al eliminar la factura' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
          }
          res.json({ 
            message: 'Factura eliminada exitosamente',
            warning: `Se desvinculó ${row.count} ${row.count === 1 ? 'gasto' : 'gastos'} que estaba${row.count === 1 ? '' : 'n'} vinculado${row.count === 1 ? '' : 's'} a esta factura`
          });
        });
      });
    } else {
      // No hay gastos vinculados, eliminar directamente
      database.run('DELETE FROM supply_invoices WHERE id = ?', [invoiceId], function(deleteErr) {
        if (deleteErr) {
          return res.status(500).json({ error: 'Error al eliminar la factura' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Factura no encontrada' });
        }
        res.json({ message: 'Factura eliminada exitosamente' });
      });
    }
  });
});

module.exports = router;
