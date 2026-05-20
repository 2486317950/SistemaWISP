const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads/app-versions');

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

ensureUploadDir();

const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const versionCode = req.body.version_code || Date.now();
    const ext = path.extname(file.originalname) || '.apk';
    cb(null, `portal-v${versionCode}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.apk$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo archivos APK'), ok);
  }
});

/**
 * GET /api/app-versions/latest - Público (la app del cliente lo usa)
 * Devuelve la última versión disponible
 */
router.get('/latest', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT id, version_name, version_code, release_notes FROM app_versions WHERE published = 1 ORDER BY version_code DESC LIMIT 1',
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al obtener versión' });
      if (!row) return res.json({ hasUpdate: false });
      res.json({
        hasUpdate: true,
        id: row.id,
        version_name: row.version_name,
        version_code: row.version_code,
        release_notes: row.release_notes
      });
    }
  );
});

/**
 * GET /api/app-versions/download/:id - Público (la app descarga el APK)
 */
router.get('/download/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT file_path, file_name FROM app_versions WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Versión no encontrada' });
      const filePath = path.isAbsolute(row.file_path) ? row.file_path : path.join(__dirname, '..', row.file_path);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.file_name || 'app.apk')}"`);
      res.sendFile(path.resolve(filePath));
    }
  );
});

/**
 * Rutas que requieren autenticación de personal
 */
router.use(authenticateToken);
router.use(blockTechnicians);

/**
 * GET /api/app-versions - Listar versiones (staff)
 */
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT id, version_name, version_code, file_name, release_notes, published, created_at FROM app_versions ORDER BY version_code DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener versiones' });
      res.json(rows || []);
    }
  );
});

/**
 * POST /api/app-versions - Subir nueva versión (staff)
 */
router.post('/', upload.single('apk'), (req, res) => {
  const { version_name, version_code, release_notes } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Archivo APK requerido' });
  if (!version_name || !version_code) return res.status(400).json({ error: 'version_name y version_code son requeridos' });
  const vc = parseInt(version_code, 10);
  if (isNaN(vc) || vc < 1) return res.status(400).json({ error: 'version_code debe ser un número mayor a 0' });

  const database = db.getDb();
  const filePath = req.file.path;
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  database.run(
    'INSERT INTO app_versions (version_name, version_code, file_name, file_path, release_notes, published) VALUES (?, ?, ?, ?, ?, 0)',
    [version_name.trim(), vc, req.file.originalname || req.file.filename, relativePath, release_notes?.trim() || null],
    function(err) {
      if (err) {
        fs.unlink(filePath, () => {});
        return res.status(500).json({ error: 'Error al guardar: ' + err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: 'Versión subida correctamente',
        version_name,
        version_code: vc
      });
    }
  );
});

/**
 * PATCH /api/app-versions/:id/publish - Publicar versión (staff)
 */
router.patch('/:id/publish', (req, res) => {
  const database = db.getDb();
  database.run(
    'UPDATE app_versions SET published = 1 WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al publicar' });
      if (this.changes === 0) return res.status(404).json({ error: 'Versión no encontrada' });
      res.json({ message: 'Versión publicada. Los clientes verán la actualización.' });
    }
  );
});

/**
 * DELETE /api/app-versions/:id - Eliminar versión (staff)
 */
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  database.get('SELECT file_path FROM app_versions WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Versión no encontrada' });
    const filePath = path.isAbsolute(row.file_path) ? row.file_path : path.join(__dirname, '..', row.file_path);
    database.run('DELETE FROM app_versions WHERE id = ?', [req.params.id], function(delErr) {
      if (delErr) return res.status(500).json({ error: 'Error al eliminar' });
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      res.json({ message: 'Versión eliminada' });
    });
  });
});

module.exports = router;
