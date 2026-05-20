import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './PromotionalCredits.css';

const getLocalDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PromotionalCredits = () => {
  const [clients, setClients] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [flash, setFlash] = useState(null);

  const loadClients = () => {
    api.get('/clients')
      .then((res) => setClients(res.data || []))
      .catch(() => setClients([]));
  };

  const loadPromos = () => {
    api.get('/promotional-credits')
      .then((res) => setPromos(res.data || []))
      .catch(() => setPromos([]));
  };

  useEffect(() => {
    setLoading(true);
    loadClients();
    loadPromos();
    setLoading(false);
  }, []);

  const resetForm = () => {
    setClientId('');
    setDiscountValue('');
    setDescription('');
    setValidFrom('');
    setValidUntil('');
    setDiscountType('percent');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFlash(null);
    if (!clientId) {
      setFlash({ type: 'error', message: 'Selecciona un cliente' });
      return;
    }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val < 0) {
      setFlash({ type: 'error', message: 'Indica un valor válido para el descuento' });
      return;
    }
    if (discountType === 'percent' && val > 100) {
      setFlash({ type: 'error', message: 'El porcentaje no puede ser mayor a 100' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/promotional-credits', {
        client_id: clientId,
        discount_type: discountType,
        discount_value: val,
        description: description.trim() || null,
        valid_from: validFrom || null,
        valid_until: validUntil || null
      });
      setFlash({ type: 'success', message: 'Descuento promocional aplicado. Se reflejará en el portal del cliente.' });
      resetForm();
      loadPromos();
    } catch (err) {
      setFlash({ type: 'error', message: err.response?.data?.error || 'Error al aplicar descuento' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Quitar este descuento promocional?')) return;
    try {
      await api.delete(`/promotional-credits/${id}`);
      setFlash({ type: 'success', message: 'Descuento eliminado' });
      loadPromos();
    } catch (err) {
      setFlash({ type: 'error', message: err.response?.data?.error || 'Error al eliminar' });
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="promotional-credits-page"><div className="loading-msg">Cargando...</div></div>;
  }

  return (
    <div className="promotional-credits-page">
      <h1>Créditos promocionales</h1>
      <p className="page-desc">
        Aplica un descuento por porcentaje o monto fijo a un cliente. El cliente verá en su portal el mensaje &quot;Tienes un descuento disponible&quot; y un botón <strong>Aplicar descuento</strong>; al pulsarlo se aplica una sola vez y se refleja en su mensualidad.
      </p>

      {flash && (
        <div className={`promo-flash promo-flash-${flash.type}`}>
          <span>{flash.message}</span>
          <button type="button" className="promo-flash-dismiss" onClick={() => setFlash(null)}>×</button>
        </div>
      )}

      <section className="promo-form-section">
        <h2>Aplicar descuento</h2>
        <form onSubmit={handleSubmit} className="promo-form">
          <div className="form-row">
            <label>Cliente *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">-- Seleccionar cliente --</option>
              {(clients || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_number ? `${c.client_number} - ` : ''}{c.name || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Tipo de descuento *</label>
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="percent">Porcentaje (%)</option>
              <option value="amount">Monto fijo ($)</option>
            </select>
          </div>
          <div className="form-row">
            <label>{discountType === 'percent' ? 'Porcentaje (0-100) *' : 'Monto ($) *'}</label>
            <input
              type="number"
              step={discountType === 'percent' ? 0.01 : 0.01}
              min="0"
              max={discountType === 'percent' ? 100 : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? 'Ej: 10' : 'Ej: 50'}
              required
            />
          </div>
          <div className="form-row">
            <label>Descripción (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Promo verano 2025"
            />
          </div>
          <div className="form-row form-row-dates">
            <div>
              <label>Válido desde (opcional)</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <label>Válido hasta (opcional)</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Aplicando...' : 'Aplicar descuento'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="promo-list-section">
        <h2>Descuentos aplicados</h2>
        {promos.length === 0 ? (
          <p className="no-items">No hay descuentos promocionales aplicados.</p>
        ) : (
          <div className="promo-table-wrap">
            <table className="promo-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Descripción</th>
                  <th>Vigencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="client-name">{p.client_name || '-'}</span>
                      {p.client_number && <span className="client-number">#{p.client_number}</span>}
                    </td>
                    <td>{p.discount_type === 'percent' ? 'Porcentaje' : 'Monto fijo'}</td>
                    <td>
                      {p.discount_type === 'percent'
                        ? `${parseFloat(p.discount_value).toFixed(1)}%`
                        : `$${parseFloat(p.discount_value).toFixed(2)}`}
                    </td>
                    <td>{p.description || '-'}</td>
                    <td>
                      {p.valid_from || p.valid_until
                        ? `${formatDate(p.valid_from) || '…'} – ${formatDate(p.valid_until) || '…'}`
                        : 'Permanente'}
                    </td>
                    <td>
                      <button type="button" className="btn-delete-small" onClick={() => handleDelete(p.id)} title="Quitar descuento">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default PromotionalCredits;
