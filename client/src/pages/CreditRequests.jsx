import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './CreditRequests.css';

const CreditRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalType, setApprovalType] = useState('total');
  const [approvedAmount, setApprovedAmount] = useState('');

  const loadRequests = () => {
    setLoading(true);
    const params = filter ? { status: filter } : {};
    api.get('/credit-requests', { params })
      .then((res) => setRequests(res.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [filter]);

  useEffect(() => {
    if (selected) {
      setApprovalType(selected.request_type === 'parcial' ? 'parcial' : 'total');
      setApprovedAmount(
        selected.request_type === 'parcial'
          ? String(selected.requested_amount || '')
          : String(selected.monthly_fee || '')
      );
    }
  }, [selected]);

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.put(`/credit-requests/${selected.id}/reject`, { reviewed_notes: reviewNotes });
      setSelected(null);
      setReviewNotes('');
      loadRequests();
      toast.success('Solicitud rechazada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (approvalType === 'parcial' && (!approvedAmount || parseFloat(approvedAmount) <= 0)) {
      toast.warning('Indica el monto del crédito parcial');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.put(`/credit-requests/${selected.id}/approve`, {
        approval_type: approvalType,
        approved_amount: approvalType === 'parcial' ? parseFloat(approvedAmount) : null
      });
      setSelected(null);
      setReviewNotes('');
      setApprovalType('total');
      setApprovedAmount('');
      loadRequests();
      toast.success(res.data?.message || 'Solicitud aprobada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel = (s) => ({ pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }[s] || s);

  const groupByNetwork = (items) => {
    const groups = {};
    (items || []).forEach((r) => {
      const net = r.network || 'General';
      if (!groups[net]) groups[net] = [];
      groups[net].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') + ' ' + (s.split('T')[1]?.slice(0, 5) || '') : s;
  };

  return (
    <div className="credit-requests-page">
      <div className="page-header">
        <h1>Solicitudes de crédito (portal)</h1>
        <p className="page-desc">Revisa las solicitudes de crédito de mensualidad enviadas por clientes desde el portal</p>
      </div>

      <div className="filter-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobados</option>
          <option value="rechazado">Rechazados</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">No hay solicitudes</div>
      ) : (
        <div className="credit-requests-layout">
          <div className="requests-list">
            {groupByNetwork(requests).map(([network, items]) => (
              <div key={network} className="requests-network-group">
                <div className="requests-network-header">📡 {network}</div>
                {items.map((r) => (
                  <div
                    key={r.id}
                    className={`request-card ${selected?.id === r.id ? 'selected' : ''} status-${r.status}`}
                    onClick={() => setSelected(r)}
                  >
                    <div className="request-card-header">
                      <span className="client-name">{r.client_name}</span>
                      <span className={`status-badge status-${r.status}`}>{statusLabel(r.status)}</span>
                    </div>
                    <div className="request-card-body">
                      {r.request_type === 'total' ? (
                        <span>Mensualidad total (${parseFloat(r.monthly_fee || 0).toFixed(2)})</span>
                      ) : (
                        <span>Parcial: ${parseFloat(r.requested_amount || 0).toFixed(2)}</span>
                      )}
                    </div>
                    <div className="request-card-date">{formatDate(r.created_at)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="request-detail">
            {selected ? (
              <>
                <h3>Detalle de solicitud</h3>
                <div className="detail-info">
                  <p><strong>Cliente:</strong> {selected.client_name} ({selected.client_number})</p>
                  <p><strong>Tipo solicitado:</strong> {selected.request_type === 'total' ? 'Mensualidad total' : 'Parcial'}</p>
                  {selected.request_type === 'parcial' && (
                    <p><strong>Monto solicitado:</strong> ${parseFloat(selected.requested_amount || 0).toFixed(2)}</p>
                  )}
                  <p><strong>Cuota mensual:</strong> ${parseFloat(selected.monthly_fee || 0).toFixed(2)}</p>
                  <p><strong>Fecha:</strong> {formatDate(selected.created_at)}</p>
                </div>

                {selected.status === 'pendiente' && (
                  <>
                    <div className="approval-options">
                      <h4>Aprobar como</h4>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="approvalType"
                          value="total"
                          checked={approvalType === 'total'}
                          onChange={() => setApprovalType('total')}
                        />
                        Total (${parseFloat(selected.monthly_fee || 0).toFixed(2)})
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="approvalType"
                          value="parcial"
                          checked={approvalType === 'parcial'}
                          onChange={() => setApprovalType('parcial')}
                        />
                        Parcial
                      </label>
                      {approvalType === 'parcial' && (
                        <div className="amount-input">
                          <label>Monto del crédito ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={approvedAmount}
                            onChange={(e) => setApprovedAmount(e.target.value)}
                            placeholder="Ej: 250.00"
                          />
                        </div>
                      )}
                    </div>
                    <div className="review-actions">
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Notas (opcional, útil al rechazar)"
                        rows={3}
                      />
                      <div className="action-buttons">
                        <button
                          className="btn-approve"
                          onClick={handleApprove}
                          disabled={actionLoading}
                        >
                          {actionLoading ? 'Procesando...' : 'Aprobar'}
                        </button>
                        <button
                          className="btn-reject"
                          onClick={handleReject}
                          disabled={actionLoading}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {selected.status !== 'pendiente' && (
                  <div className="detail-result">
                    {selected.status === 'aprobado' && (
                      <p className="result-approved">
                        Aprobado: {selected.approved_type === 'total' ? 'Total' : `Parcial $${parseFloat(selected.approved_amount || 0).toFixed(2)}`}
                      </p>
                    )}
                    {selected.status === 'rechazado' && selected.reviewed_notes && (
                      <p className="result-notes">{selected.reviewed_notes}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="select-hint">Selecciona una solicitud</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditRequests;
