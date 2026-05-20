import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { useToast } from '../../context/ToastContext';
import './PortalCreditRequest.css';

const PortalCreditRequest = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState('total');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(null);

  const loadRequests = () => {
    portalApi.get('/client-portal/credit-requests')
      .then((res) => setRequests(res.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
    portalApi.get('/client-portal/balance')
      .then((res) => setMonthlyFee(parseFloat(res.data?.monthly_fee) || 0))
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requestType === 'parcial' && (!requestedAmount || parseFloat(requestedAmount) <= 0)) {
      toast.warning('Indica el monto del crédito parcial');
      return;
    }
    setSubmitting(true);
    portalApi.post('/client-portal/credit-requests', {
      request_type: requestType,
      requested_amount: requestType === 'parcial' ? parseFloat(requestedAmount) : null
    })
      .then(() => {
        setShowForm(false);
        setRequestType('total');
        setRequestedAmount('');
        loadRequests();
        toast.success('Solicitud enviada. El personal la revisará pronto.');
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al enviar'))
      .finally(() => setSubmitting(false));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') + ' ' + (s.split('T')[1]?.slice(0, 5) || '') : s.split('-').reverse().join('/');
  };

  const statusLabel = (s) => ({ pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }[s] || s);

  if (loading) {
    return <div className="portal-loading">Cargando...</div>;
  }

  return (
    <div className="portal-credit-request">
      <div className="credit-request-header">
        <h2>Solicitar crédito de mensualidad</h2>
        <button
          className="portal-new-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nueva solicitud'}
        </button>
      </div>

      <p className="credit-request-desc">
        Puedes solicitar crédito por la mensualidad total o por un monto parcial. El personal revisará tu solicitud.
      </p>

      {monthlyFee > 0 && (
        <p className="credit-monthly-fee">Tu cuota mensual: ${monthlyFee.toFixed(2)}</p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="credit-request-form">
          <div className="portal-form-group">
            <label>Tipo de crédito</label>
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
              <option value="total">Mensualidad total (${(monthlyFee || 0).toFixed(2)})</option>
              <option value="parcial">Parcial de mensualidad</option>
            </select>
          </div>
          {requestType === 'parcial' && (
            <div className="portal-form-group">
              <label>Monto del crédito ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={monthlyFee || 99999}
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="Ej: 250.00"
                required={requestType === 'parcial'}
              />
            </div>
          )}
          <button type="submit" className="portal-submit-btn" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      )}

      <h3>Mis solicitudes</h3>
      {requests.length === 0 ? (
        <div className="portal-empty">No tienes solicitudes. Crea una si necesitas crédito.</div>
      ) : (
        <div className="credit-request-list">
          {requests.map((r) => (
            <div key={r.id} className={`credit-request-item status-${r.status}`}>
              <div className="request-main">
                <span className="request-type">
                  {r.request_type === 'total' ? 'Mensualidad total' : `Parcial: $${parseFloat(r.requested_amount || 0).toFixed(2)}`}
                </span>
                <span className={`request-status status-${r.status}`}>{statusLabel(r.status)}</span>
              </div>
              {r.status === 'aprobado' && (
                <div className="request-approved">
                  Aprobado: {r.approved_type === 'total' ? 'Total' : `Parcial $${parseFloat(r.approved_amount || 0).toFixed(2)}`}
                </div>
              )}
              {r.status === 'rechazado' && r.reviewed_notes && (
                <div className="request-notes">{r.reviewed_notes}</div>
              )}
              <div className="request-date">{formatDate(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalCreditRequest;
