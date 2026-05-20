const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{40,64}$/i.test(token)) {
    return res.status(400).json({ error: 'Enlace no válido' });
  }
  const database = db.getDb();
  database.get('SELECT * FROM cotizador_quotes WHERE public_token = ?', [token], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar la cotización' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Cotización no encontrada o el enlace ya no está disponible' });
    }
    let items = [];
    try {
      items = JSON.parse(row.items_json || '[]');
    } catch (_) {
      items = [];
    }
    const { items_json, public_token, ...safe } = row;
    res.json({
      ...safe,
      items,
      public_token,
      can_respond: row.client_status === 'pendiente',
    });
  });
});

function setClientResponse(token, status, res) {
  if (!['aceptada', 'rechazada'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const database = db.getDb();
  database.get(
    'SELECT id, client_status FROM cotizador_quotes WHERE public_token = ?',
    [token],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al procesar' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Cotización no encontrada' });
      }
      if (row.client_status !== 'pendiente') {
        return res.status(409).json({
          error: 'Esta cotización ya fue respondida',
          client_status: row.client_status,
        });
      }
      database.run(
        `UPDATE cotizador_quotes SET client_status = ?, client_responded_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND client_status = 'pendiente'`,
        [status, row.id],
        function (e2) {
          if (e2) {
            console.error(e2);
            return res.status(500).json({ error: 'Error al guardar la respuesta' });
          }
          if (this.changes === 0) {
            return res.status(409).json({ error: 'La cotización ya no está pendiente' });
          }
          res.json({ success: true, client_status: status, message: status === 'aceptada' ? 'Has aceptado la cotización.' : 'Has rechazado la cotización.' });
        }
      );
    }
  );
}

router.post('/:token/accept', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{40,64}$/i.test(token)) {
    return res.status(400).json({ error: 'Enlace no válido' });
  }
  setClientResponse(token, 'aceptada', res);
});

router.post('/:token/reject', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[a-f0-9]{40,64}$/i.test(token)) {
    return res.status(400).json({ error: 'Enlace no válido' });
  }
  setClientResponse(token, 'rechazada', res);
});

module.exports = router;
