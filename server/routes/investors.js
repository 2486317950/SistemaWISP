const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { getBusinessYearMonth } = require('../utils/businessTime');

router.use(authenticateToken);

// Obtener el inversionista asociado al usuario actual (solo rol investor)
router.get('/me', (req, res) => {
  if (req.user.role !== 'investor') {
    return res.status(403).json({ error: 'Solo para inversionistas' });
  }
  const database = db.getDb();
  database.get(
    'SELECT id, name, percentage FROM investors WHERE user_id = ? AND COALESCE(is_active, 1) = 1',
    [req.user.id],
    (err, row) => {
      if (err) {
        console.error('Error al obtener inversionista:', err);
        return res.status(500).json({ error: 'Error al obtener datos' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Inversionista no encontrado' });
      }
      res.json({ id: row.id, name: row.name, percentage: parseFloat(row.percentage || 0) });
    }
  );
});

// Listar inversionistas (siempre devuelve todos; el frontend filtra activos/inactivos)
router.get('/', (req, res) => {
  const database = db.getDb();
  const sql = 'SELECT i.*, u.username FROM investors i LEFT JOIN users u ON i.user_id = u.id ORDER BY i.name';
  database.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al listar inversionistas:', err);
      return res.status(500).json({ error: 'Error al listar inversionistas' });
    }
    res.json(rows || []);
  });
});

// Crear inversionista
router.post('/', async (req, res) => {
  const database = db.getDb();
  const { name, percentage, email, phone, notes, username, password } = req.body;
  if (!name || percentage == null) {
    return res.status(400).json({ error: 'Nombre y porcentaje son requeridos' });
  }
  const pct = parseFloat(percentage);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'Porcentaje debe ser entre 0 y 100' });
  }
  const hasCredentials = username && String(username).trim() && password && String(password).trim();
  if (hasCredentials && String(password).trim().length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  database.get('SELECT COALESCE(SUM(percentage), 0) as total FROM investors WHERE COALESCE(is_active, 1) = 1', [], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al validar porcentajes' });
    }
    const currentTotal = parseFloat(row?.total || 0);
    if (currentTotal + pct > 100) {
      return res.status(400).json({ error: `La suma de porcentajes no puede superar 100%. Actual: ${currentTotal}%, nuevo: ${pct}%` });
    }

    let userId = null;
    if (hasCredentials) {
      const un = String(username).trim();
      const existing = await new Promise((resolve) => {
        database.get('SELECT id, role FROM users WHERE username = ?', [un], (e, r) => resolve(r));
      });
      if (existing) {
        const msg = existing.role === 'investor'
          ? 'Ese usuario ya está vinculado a otro inversionista. Usa otro usuario o deja usuario y contraseña en blanco para crear sin acceso a la app.'
          : 'Ese nombre de usuario ya existe en el sistema (otro rol). Usa otro usuario o deja usuario y contraseña en blanco para no dar acceso a la app.';
        return res.status(400).json({ error: msg });
      }
      const hashedPassword = await bcrypt.hash(String(password).trim(), 10);
      await new Promise((resolve, reject) => {
        database.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [un, hashedPassword, 'investor'], function (err) {
          if (err) reject(err);
          else { userId = this.lastID; resolve(); }
        });
      });
    }

    database.run(
      'INSERT INTO investors (name, percentage, email, phone, notes, user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [name.trim(), pct, email?.trim() || null, phone?.trim() || null, notes?.trim() || null, userId],
      function (err) {
        if (err) {
          if (userId) database.run('DELETE FROM users WHERE id = ?', [userId], () => {});
          console.error('Error al crear inversionista:', err);
          return res.status(500).json({ error: 'Error al crear inversionista' });
        }
        res.status(201).json({ id: this.lastID, name, percentage: pct, username: hasCredentials ? String(username).trim() : null });
      }
    );
  });
});

// Actualizar inversionista
router.put('/:id', async (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  const { name, percentage, email, phone, notes, is_active, username, password } = req.body;
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (!name || percentage == null) {
    return res.status(400).json({ error: 'Nombre y porcentaje son requeridos' });
  }
  const pct = parseFloat(percentage);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'Porcentaje debe ser entre 0 y 100' });
  }
  const hasNewPassword = password && String(password).trim().length >= 4;
  const hasUsername = username && String(username).trim();

  database.get('SELECT user_id FROM investors WHERE id = ?', [id], async (err, inv) => {
    if (err || !inv) {
      return res.status(404).json({ error: 'Inversionista no encontrado' });
    }
    database.get('SELECT COALESCE(SUM(percentage), 0) as total FROM investors WHERE COALESCE(is_active, 1) = 1 AND id != ?', [id], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al validar porcentajes' });
      }
      const currentTotal = parseFloat(row?.total || 0);
      const newActive = is_active !== 0 && is_active !== false;
      const pctToAdd = newActive ? pct : 0;
      if (currentTotal + pctToAdd > 100) {
        return res.status(400).json({ error: `La suma de porcentajes no puede superar 100%. Actual (sin este): ${currentTotal}%, nuevo: ${pct}%` });
      }

      let userId = inv.user_id;
      if (hasUsername) {
        const un = String(username).trim();
        const existing = await new Promise((resolve) => {
          database.get('SELECT id FROM users WHERE username = ? AND id != COALESCE(?, -1)', [un, userId], (e, r) => resolve(r));
        });
        if (existing) {
          return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
        }
        if (userId) {
          if (hasNewPassword) {
            const hashedPassword = await bcrypt.hash(String(password).trim(), 10);
            database.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [un, hashedPassword, userId], () => {});
          } else {
            database.run('UPDATE users SET username = ? WHERE id = ?', [un, userId], () => {});
          }
        } else {
          const pwd = hasNewPassword ? String(password).trim() : 'inv' + Date.now();
          const hashedPassword = await bcrypt.hash(pwd, 10);
          await new Promise((resolve, reject) => {
            database.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [un, hashedPassword, 'investor'], function (err) {
              if (err) reject(err);
              else { userId = this.lastID; resolve(); }
            });
          });
        }
      } else if (userId && !hasUsername) {
        database.run('DELETE FROM users WHERE id = ?', [userId], () => {});
        userId = null;
      } else if (userId && hasNewPassword) {
        const hashedPassword = await bcrypt.hash(String(password).trim(), 10);
        database.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], () => {});
      }

      database.run(
        'UPDATE investors SET name = ?, percentage = ?, email = ?, phone = ?, notes = ?, is_active = ?, user_id = ? WHERE id = ?',
        [name.trim(), pct, email?.trim() || null, phone?.trim() || null, notes?.trim() || null, newActive ? 1 : 0, userId, id],
        function (err) {
          if (err) {
            console.error('Error al actualizar inversionista:', err);
            return res.status(500).json({ error: 'Error al actualizar inversionista' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Inversionista no encontrado' });
          }
          res.json({ id, name, percentage: pct });
        }
      );
    });
  });
});

// Eliminar (desactivar) inversionista
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  database.run('UPDATE investors SET is_active = 0 WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Error al desactivar inversionista:', err);
      return res.status(500).json({ error: 'Error al desactivar inversionista' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Inversionista no encontrado' });
    }
    res.json({ message: 'Inversionista desactivado' });
  });
});

// Distribución por mes: total_profit = ganancia neta final = mensualidad neta − gastos − transferencias − pagos a proveedor
router.get('/distribution', (req, res) => {
  const database = db.getDb();
  const month = req.query.month || getBusinessYearMonth();

  database.get(`
    SELECT 
      COALESCE(SUM(p.amount), 0) as total_payments,
      COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
      COUNT(CASE WHEN p.is_free_month = 1 THEN 1 END) as free_months_count
    FROM payments p
    WHERE strftime('%Y-%m', DATE(p.payment_date)) = ?
      AND p.payment_type = 'mensualidad'
  `, [month], (err, paymentsSummary) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener pagos' });
    }
    database.get(`
      SELECT COALESCE(SUM(i.installation_fee), 0) as total_installations
      FROM installations i
      WHERE i.installation_fee > 0 AND i.is_paid = 1
        AND strftime('%Y-%m', COALESCE(i.payment_date, i.installation_date)) = ?
    `, [month], (err, instSummary) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener instalaciones' });
      }
      database.get(`
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses
        WHERE strftime('%Y-%m', DATE(expense_date)) = ? AND (provider_payment_id IS NULL OR provider_payment_id = '')
      `, [month], (err, expSummary) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener gastos' });
        }
        database.get(`
          SELECT COALESCE(SUM(amount), 0) as total_expenses_all
          FROM expenses
          WHERE strftime('%Y-%m', DATE(expense_date)) = ?
        `, [month], (err, expAllSummary) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener total de gastos' });
          }
        database.get(`
          SELECT COALESCE(SUM(amount), 0) as total_transfers
          FROM transfers
          WHERE strftime('%Y-%m', DATE(transfer_date)) = ?
        `, [month], (err, transSummary) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener transferencias' });
          }
          database.get(`
            SELECT COALESCE(SUM(paid_amount), 0) as total_paid_to_providers
            FROM provider_payments
            WHERE strftime('%Y-%m', DATE(payment_date)) = ?
          `, [month], (err, provSummary) => {
            if (err) {
              return res.status(500).json({ error: 'Error al obtener pagos a proveedores' });
            }
            const totalPayments = parseFloat(paymentsSummary?.total_payments || 0);
            const freeMonths = parseFloat(paymentsSummary?.free_months_amount || 0);
            const totalPaymentsNet = totalPayments - freeMonths;
            // Para inversionistas, "Percepciones" = mensualidad neta (no incluye instalaciones ni abonos de instalación)
            const totalPerceptions = parseFloat(totalPaymentsNet.toFixed(2));
            const totalExpenses = parseFloat(expSummary?.total_expenses || 0);
            const totalExpensesDisplay = parseFloat(expAllSummary?.total_expenses_all ?? expSummary?.total_expenses ?? 0);
            const totalTransfers = parseFloat(transSummary?.total_transfers || 0);
            const totalPaidToProviders = parseFloat(provSummary?.total_paid_to_providers || 0);
            // Ganancia neta final: Mensualidad neta − Gastos (sin los ligados a proveedor) − Pagos a proveedor − Transferencias
            const totalProfit = parseFloat((totalPaymentsNet - totalExpenses - totalPaidToProviders - totalTransfers).toFixed(2));

          database.all('SELECT id, name, percentage FROM investors WHERE COALESCE(is_active, 1) = 1 ORDER BY name', [], (err, investors) => {
            if (err) {
              return res.status(500).json({ error: 'Error al obtener inversionistas' });
            }
            const totalPct = investors.reduce((s, i) => s + parseFloat(i.percentage || 0), 0);
            // El porcentaje de cada inversionista se aplica sobre la ganancia neta final (después de todos los gastos)
            const distribution = investors.map((inv) => {
              const pct = parseFloat(inv.percentage || 0);
              const profit = parseFloat((totalProfit * (pct / 100)).toFixed(2));
              return {
                id: inv.id,
                name: inv.name,
                percentage: pct,
                profit,
              };
            });
            res.json({
              month,
              total_perceptions: totalPerceptions,
              total_expenses: totalExpenses,
              total_expenses_display: totalExpensesDisplay,
              total_transfers: totalTransfers,
              total_paid_to_providers: totalPaidToProviders,
              total_profit: totalProfit,
              free_months_amount: parseFloat(freeMonths.toFixed(2)),
              free_months_count: paymentsSummary?.free_months_count || 0,
              total_percentage: parseFloat(totalPct.toFixed(2)),
              distribution,
            });
          });
          });
        });
        });
      });
    });
  });
});

// Estado de pago de dividendos del inversionista actual (solo rol investor, para la web del inversionista)
router.get('/my-dividend-status', (req, res) => {
  if (req.user.role !== 'investor') {
    return res.status(403).json({ error: 'Solo para inversionistas' });
  }
  const month = req.query.month || getBusinessYearMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Mes inválido (use YYYY-MM)' });
  }
  const database = db.getDb();
  database.get(
    `SELECT dp.amount, dp.paid_at
     FROM investor_dividend_payments dp
     JOIN investors i ON dp.investor_id = i.id
     WHERE i.user_id = ? AND dp.month = ?`,
    [req.user.id, month],
    (err, row) => {
      if (err) {
        console.error('Error al obtener estado de dividendos:', err);
        return res.status(500).json({ error: 'Error al obtener estado' });
      }
      const paid = !!row;
      res.json({
        month,
        paid,
        paid_at: row?.paid_at || null,
        amount: paid ? parseFloat(row.amount || 0) : 0
      });
    }
  );
});

// Estado de pago de dividendos de un mes (panel admin)
router.get('/dividends/status', (req, res) => {
  const month = req.query.month || getBusinessYearMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Mes inválido (use YYYY-MM)' });
  }
  const database = db.getDb();
  database.all(
    `SELECT dp.id, dp.investor_id, dp.month, dp.amount, dp.paid_at, dp.notes, i.name as investor_name
     FROM investor_dividend_payments dp
     JOIN investors i ON dp.investor_id = i.id
     WHERE dp.month = ?
     ORDER BY i.name`,
    [month],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener estado de dividendos:', err);
        return res.status(500).json({ error: 'Error al obtener estado de dividendos' });
      }
      const paid = Array.isArray(rows) && rows.length > 0;
      const paidAt = paid && rows[0].paid_at ? rows[0].paid_at : null;
      res.json({
        month,
        paid,
        paid_at: paidAt,
        payments: (rows || []).map((r) => ({
          investor_id: r.investor_id,
          investor_name: r.investor_name,
          amount: parseFloat(r.amount || 0),
          paid_at: r.paid_at
        }))
      });
    }
  );
});

// Marcar dividendos del mes como pagados (registra el monto por inversionista según la distribución actual)
router.post('/dividends/mark-paid', (req, res) => {
  const { month, distribution } = req.body || {};
  const monthNorm = (month && /^\d{4}-\d{2}$/.test(month)) ? month : getBusinessYearMonth();
  if (!Array.isArray(distribution) || distribution.length === 0) {
    return res.status(400).json({ error: 'Se requiere la distribución del mes (array con id y profit de cada inversionista)' });
  }
  const database = db.getDb();
  database.get('SELECT 1 FROM investor_dividend_payments WHERE month = ? LIMIT 1', [monthNorm], (err, existing) => {
    if (err) {
      console.error('Error al verificar dividendos:', err);
      return res.status(500).json({ error: 'Error al verificar estado' });
    }
    if (existing) {
      return res.status(400).json({ error: 'Los dividendos de este mes ya fueron marcados como pagados.' });
    }
    let done = 0;
    const total = distribution.length;
    if (total === 0) {
      return res.json({ message: 'No hay distribución que registrar.', month: monthNorm });
    }
    const onInsert = (err) => {
      if (err) console.error('Error al registrar pago:', err);
      done++;
      if (done === total) {
        res.json({ message: 'Dividendos marcados como pagados.', month: monthNorm });
      }
    };
    for (const d of distribution) {
      const investorId = d.id;
      const amount = parseFloat(d.profit) || 0;
      database.run(
        'INSERT INTO investor_dividend_payments (investor_id, month, amount, paid_at) VALUES (?, ?, ?, datetime("now"))',
        [investorId, monthNorm, amount],
        onInsert
      );
    }
  });
});

module.exports = router;
