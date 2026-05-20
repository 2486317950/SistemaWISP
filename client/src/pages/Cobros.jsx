import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Cobros.css';

const Cobros = () => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [charges, setCharges] = useState([]);
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chargeEditing, setChargeEditing] = useState(null);
  const [chargeRowSaving, setChargeRowSaving] = useState(false);
  const [chargeDeletingId, setChargeDeletingId] = useState(null);

  useEffect(() => {
    api.get('/clients?page=1&limit=500')
      .then((res) => {
        const data = res.data;
        const list = data?.clients ?? (Array.isArray(data) ? data : []);
        setClients(list);
        if (list.length > 0 && !selectedClientId) setSelectedClientId(String(list[0].id));
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setChargeEditing(null);
    setChargeDeletingId(null);
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setCharges([]);
      return;
    }
    api.get(`/clients/${selectedClientId}/charges`)
      .then((res) => setCharges(res.data || []))
      .catch(() => setCharges([]));
  }, [selectedClientId]);

  const reloadCharges = () =>
    api
      .get(`/clients/${selectedClientId}/charges`)
      .then((res) => setCharges(res.data || []))
      .catch(() => setCharges([]));

  const selectedClient = clients.find((c) => String(c.id) === selectedClientId);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!selectedClientId || !Number.isFinite(num) || num <= 0) {
      setError('Selecciona un cliente y un monto mayor a 0.');
      return;
    }
    setError('');
    setSubmitting(true);
    api.post(`/clients/${selectedClientId}/charges`, { amount: num, concept: concept.trim() || '' })
      .then(() => {
        setAmount('');
        setConcept('');
        return reloadCharges();
      })
      .catch((err) => setError(err.response?.data?.error || 'Error al agregar cobro'))
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return <div className="cobros-page"><div className="loading">Cargando...</div></div>;
  }

  return (
    <div className="cobros-page">
      <div className="page-header">
        <h1>💰 Cobros</h1>
        <p className="page-desc">Envía cobros adicionales a un cliente. Se suman a su mensualidad y el cliente los ve y puede pagarlos desde el portal.</p>
      </div>

      <div className="cobros-section card">
        <h2>Agregar cobro</h2>
        <form onSubmit={handleSubmit} className="cobros-form">
          <div className="form-row">
            <label>Cliente</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_number ? `#${c.client_number} - ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Monto ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej. 50.00"
              required
            />
          </div>
          <div className="form-row">
            <label>Concepto (opcional)</label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Equipo, recargo, etc."
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Agregando...' : 'Agregar cobro'}
          </button>
        </form>
      </div>

      <div className="cobros-list-section card">
        <h2>Cobros del cliente {selectedClient ? `(${selectedClient.client_number ? `#${selectedClient.client_number} - ` : ''}${selectedClient.name})` : ''}</h2>
        {selectedClientId ? (
          charges.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th>Pendiente</th>
                    <th>Fecha</th>
                    <th className="cobros-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id}>
                      {chargeEditing != null && Number(chargeEditing.id) === Number(c.id) ? (
                        <>
                          <td>
                            <input
                              className="cobros-inline-input cobros-inline-wide"
                              type="text"
                              value={chargeEditing.concept}
                              onChange={(e) => setChargeEditing({ ...chargeEditing, concept: e.target.value })}
                              placeholder="Concepto"
                            />
                          </td>
                          <td>
                            <input
                              className="cobros-inline-input"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={chargeEditing.amount}
                              onChange={(e) => setChargeEditing({ ...chargeEditing, amount: e.target.value })}
                            />
                          </td>
                          <td>${parseFloat(c.amount_remaining).toFixed(2)}</td>
                          <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                          <td className="cobros-actions-col">
                            <div className="cobros-actions">
                              <button
                                type="button"
                                className="btn-cobro-save"
                                disabled={
                                  chargeRowSaving || !chargeEditing.amount || parseFloat(chargeEditing.amount) <= 0
                                }
                                onClick={async () => {
                                  setChargeRowSaving(true);
                                  try {
                                    await api.put(`/clients/${encodeURIComponent(selectedClientId)}/charges/${encodeURIComponent(c.id)}`, {
                                      amount: parseFloat(String(chargeEditing.amount).replace(',', '.')),
                                      concept: chargeEditing.concept.trim() || ''
                                    });
                                    setChargeEditing(null);
                                    await reloadCharges();
                                  } catch (err) {
                                    setError(err.response?.data?.error || 'Error al guardar');
                                  } finally {
                                    setChargeRowSaving(false);
                                  }
                                }}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="btn-cobro-cancel"
                                disabled={chargeRowSaving}
                                onClick={() => setChargeEditing(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{c.concept || '—'}</td>
                          <td>${parseFloat(c.amount).toFixed(2)}</td>
                          <td>${parseFloat(c.amount_remaining).toFixed(2)}</td>
                          <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                          <td className="cobros-actions-col">
                            <div className="cobros-actions">
                              <button
                                type="button"
                                className="btn-cobro-edit"
                                disabled={chargeDeletingId != null || chargeEditing != null}
                                onClick={() =>
                                  setChargeEditing({
                                    id: c.id,
                                    amount: String(parseFloat(c.amount).toFixed(2)),
                                    concept: c.concept || ''
                                  })
                                }
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn-cobro-delete"
                                disabled={chargeDeletingId === c.id || chargeEditing != null}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      '¿Eliminar este cobro?\nLos pagos registrados del cliente no se revierten; solo se quita esta línea de adeudo.'
                                    )
                                  )
                                    return;
                                  setChargeDeletingId(c.id);
                                  setError('');
                                  try {
                                    await api.delete(`/clients/${encodeURIComponent(selectedClientId)}/charges/${encodeURIComponent(c.id)}`);
                                    await reloadCharges();
                                  } catch (err) {
                                    setError(err.response?.data?.error || 'Error al eliminar');
                                  } finally {
                                    setChargeDeletingId(null);
                                  }
                                }}
                              >
                                {chargeDeletingId === c.id ? '…' : 'Eliminar'}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">No hay cobros para este cliente. Agrega uno arriba.</p>
          )
        ) : (
          <p className="empty-message">Selecciona un cliente para ver sus cobros.</p>
        )}
      </div>
    </div>
  );
};

export default Cobros;
