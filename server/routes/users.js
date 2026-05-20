const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');
const { validatePassword } = require('../lib/passwordPolicy');
const { logAudit } = require('../lib/audit');
const { getClientIp } = require('../utils/requestUtils');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener todos los usuarios (solo admin)
router.get('/', requireAdmin, (req, res) => {
  const database = db.getDb();
  database.all('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener usuarios' });
    }
    res.json(rows);
  });
});

// Obtener un usuario por ID (solo admin)
router.get('/:id', requireAdmin, (req, res) => {
  const database = db.getDb();
  database.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el usuario' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo usuario (solo admin)
router.post('/', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  const policy = validatePassword(password);
  if (!policy.valid) {
    return res.status(400).json({ error: policy.error });
  }

  const validRoles = ['admin', 'editor', 'viewer', 'technician'];
  const userRole = role && validRoles.includes(role) ? role : 'viewer';

  const database = db.getDb();
  
  // Verificar que el username no esté en uso
  database.get('SELECT * FROM users WHERE username = ?', [username], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      database.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, userRole],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al crear el usuario' });
          }
          logAudit('user_create', {
            userId: req.user?.id,
            username: req.user?.username,
            entityType: 'user',
            entityId: String(this.lastID),
            details: { created_username: username, role: userRole },
            ipAddress: getClientIp(req)
          });
          res.status(201).json({
            id: this.lastID,
            message: 'Usuario creado exitosamente',
            username,
            role: userRole
          });
        }
      );
    } catch (error) {
      return res.status(500).json({ error: 'Error al crear el usuario' });
    }
  });
});

// Actualizar un usuario (solo admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const userId = req.params.id;

  const database = db.getDb();
  
  // Verificar que el usuario existe
  database.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que el nuevo username no esté en uso (si se está cambiando)
    if (username && username !== user.username) {
      database.get('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId], async (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Error del servidor' });
        }

        if (existingUser) {
          return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
        }

        updateUser();
      });
    } else {
      updateUser();
    }

    async function updateUser() {
      const updates = [];
      const values = [];

      if (username && username !== user.username) {
        updates.push('username = ?');
        values.push(username);
      }

      if (password) {
        const policy = validatePassword(password);
        if (!policy.valid) {
          return res.status(400).json({ error: policy.error });
        }
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          updates.push('password = ?');
          values.push(hashedPassword);
        } catch (error) {
          return res.status(500).json({ error: 'Error al hashear la contraseña' });
        }
      }

      if (role) {
        const validRoles = ['admin', 'editor', 'viewer', 'technician'];
        if (validRoles.includes(role)) {
          updates.push('role = ?');
          values.push(role);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay cambios para actualizar' });
      }

      values.push(userId);
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

      database.run(query, values, function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar el usuario' });
        }
        logAudit('user_update', {
          userId: req.user?.id,
          username: req.user?.username,
          entityType: 'user',
          entityId: String(userId),
          details: { target_username: user.username, updates: updates.join(', ') },
          ipAddress: getClientIp(req)
        });
        res.json({ message: 'Usuario actualizado exitosamente' });
      });
    }
  });
});

// Eliminar un usuario (solo admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const database = db.getDb();
  const userId = req.params.id;

  // No permitir eliminar el propio usuario
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }

  database.get('SELECT username FROM users WHERE id = ?', [userId], (err, targetUser) => {
    if (err) return res.status(500).json({ error: 'Error del servidor' });
    database.run('DELETE FROM users WHERE id = ?', [userId], function(runErr) {
      if (runErr) return res.status(500).json({ error: 'Error al eliminar el usuario' });
      if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
      logAudit('user_delete', {
        userId: req.user?.id,
        username: req.user?.username,
        entityType: 'user',
        entityId: String(userId),
        details: { deleted_username: targetUser?.username },
        ipAddress: getClientIp(req)
      });
      res.json({ message: 'Usuario eliminado exitosamente' });
    });
  });
});

module.exports = router;



