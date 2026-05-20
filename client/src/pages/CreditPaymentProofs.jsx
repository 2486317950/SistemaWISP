import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './PaymentProofs.css';

const CreditPaymentProofs = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!selected) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    api.get(`/credit-payment-proofs/file/${selected.id}`, { responseType: 'blob' })
      .then((res) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(res.data));
      })
      .catch(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      });
    return () => {};
  }, [selected?.id]);

  const loadProofs = () => {
    setLoading(true);
    const params = filter ? { status: filter } : {};
    api.get('/credit-payment-proofs', { params })
      .then((res) => setProofs(res.data || []))
      .catch(() => setProofs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProofs();
  }, [filter]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await api.put(`/credit-payment-proofs/${selected.id}/approve`, { reviewed_notes: reviewNotes });
      setSelected(null);
      setReviewNotes('');
      loadProofs();
      toast.success(res.data?.message || 'Comprobante aprobado. Pago registrado y crédito actualizado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.put(`/credit-payment-proofs/${selected.id}/reject`, { reviewed_notes: reviewNotes });
      setSelected(null);
      setReviewNotes('');
      loadProofs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel = (s) => {
    const map = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
    return map[s] || s;
  };

  const groupByNetwork = (items) => {
    const groups = {};
    (items || []).forEach((p) => {
      const net = p.network || 'General';
      if (!groups[net]) groups[net] = [];
      groups[net].push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') + ' ' + s.split('T')[1]?.slice(0, 5) : s;
  };

  return (
    <div className="payment-proofs-page">
      <div className="page-header">
        <h1>Comprobantes de pago de crédito</h1>
        <p className="page-desc">Revisa los comprobantes de pagos parciales subidos por clientes para sus créditos</p>
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
      ) : proofs.length === 0 ? (
        <div className="empty-state">No hay comprobantes de pago de crédito</div>
      ) : (
        <div className="proofs-grid">
          <div className="proofs-list">
            {groupByNetwork(proofs).map(([network, items]) => (
              <div key={network} className="proofs-network-group">
                <div className="proofs-network-header">📡 {network}</div>
                {items.map((p) => (
                  <div
                    key={p.id}
                    className={`proof-card ${selected?.id === p.id ? 'selected' : ''} status-${p.status}`}
                    onClick={() => setSelected(p)}
                  >
                    <div className="proof-card-header">
                      <span className="proof-client">{p.client_name} ({p.client_number})</span>
                      <span className={`proof-status status-${p.status}`}>{statusLabel(p.status)}</span>
                    </div>
                    <div className="proof-card-meta">
                      Crédito #{p.credit_id} · ${parseFloat(p.amount || 0).toFixed(2)} · {formatDate(p.created_at)}
                    </div>
                    <div className="proof-amount">${parseFloat(p.amount || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="proof-detail">
            {selected ? (
              <>
                <div className="detail-header">
                  <h3>{selected.client_name}</h3>
                  <span className={`status-badge status-${selected.status}`}>{statusLabel(selected.status)}</span>
                </div>
                <div className="preview-area">
                  {previewUrl && (
                    selected.file_type?.startsWith('image/') ? (
                      <img src={previewUrl} alt="Comprobante" />
                    ) : (
                      <iframe title="Comprobante" src={previewUrl} className="pdf-preview" />
                    )
                  )}
                  {selected && (
                    <a
                      href={previewUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="open-new-btn"
                      onClick={(e) => !previewUrl && e.preventDefault()}
                    >
                      Abrir en nueva pestaña
                    </a>
                  )}
                </div>
                <div className="detail-info">
                  <p><strong>Crédito #:</strong> {selected.credit_id}</p>
                  <p><strong>Monto:</strong> ${parseFloat(selected.amount || 0).toFixed(2)}</p>
                  <p><strong>Saldo pendiente del crédito:</strong> ${parseFloat(selected.remaining_amount || 0).toFixed(2)}</p>
                  {selected.notes && <p><strong>Notas del cliente:</strong> {selected.notes}</p>}
                  <p><strong>Fecha:</strong> {formatDate(selected.created_at)}</p>
                  {selected.reviewed_notes && (
                    <p><strong>Notas de revisión:</strong> {selected.reviewed_notes}</p>
                  )}
                </div>
                {selected.status === 'pendiente' && (
                  <div className="review-actions">
                    <textarea
                      placeholder="Notas de revisión (opcional)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={2}
                    />
                    <div className="action-buttons">
                      <button className="btn-approve" onClick={handleApprove} disabled={actionLoading}>
                        ✓ Aprobar
                      </button>
                      <button className="btn-reject" onClick={handleReject} disabled={actionLoading}>
                        ✗ Rechazar
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="no-selection">Selecciona un comprobante</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditPaymentProofs;
