import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import './PortalCredits.css';

const PortalCredits = () => {
  const { toast } = useToast();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proofs, setProofs] = useState([]);

  const loadCredits = () => {
    portalApi.get('/client-portal/credits')
      .then((res) => setCredits(res.data || []))
      .catch(() => setCredits([]))
      .finally(() => setLoading(false));
  };

  const loadProofs = () => {
    portalApi.get('/client-portal/credit-payment-proofs')
      .then((res) => setProofs(res.data || []))
      .catch(() => setProofs([]));
  };

  useEffect(() => {
    loadCredits();
    loadProofs();
  }, []);

  useEffect(() => {
    if (selectedCredit?.id) {
      portalApi.get(`/client-portal/credits/${selectedCredit.id}`)
        .then((res) => setSelectedCredit(res.data))
        .catch(() => setSelectedCredit(null));
    }
  }, [selectedCredit?.id]);

  const handleUploadProof = (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.warning('Indica un monto válido');
      return;
    }
    if (amount > (parseFloat(selectedCredit?.remaining_amount) || 0)) {
      toast.warning('El monto excede el saldo pendiente');
      return;
    }
    if (!proofFile) {
      toast.warning('Debes seleccionar un archivo (imagen o PDF)');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', proofFile);
    formData.append('credit_id', selectedCredit.id);
    formData.append('amount', amount);
    if (notes) formData.append('notes', notes);

    portalApi.post('/client-portal/credit-payment-proofs', formData)
      .then((res) => {
        setPaymentAmount('');
        setProofFile(null);
        setNotes('');
        loadCredits();
        loadProofs();
        portalApi.get(`/client-portal/credits/${selectedCredit.id}`)
          .then((r) => setSelectedCredit(r.data))
          .catch(() => {});
        toast.success(res.data.message || 'Comprobante subido. Será revisado por el personal.');
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al subir comprobante'))
      .finally(() => setSubmitting(false));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  const statusLabel = (s) => ({ pendiente: 'Pendiente', parcial: 'Parcial', liquidado: 'Liquidado' }[s] || s);
  const proofStatusLabel = (s) => ({ pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }[s] || s);

  const proofsForCredit = selectedCredit ? proofs.filter((p) => p.credit_id === selectedCredit.id) : [];

  if (loading) {
    return <div className="portal-loading">Cargando créditos...</div>;
  }

  return (
    <div className="portal-credits">
      <h2>Mis créditos</h2>
      <p className="portal-credits-desc">
        Aquí puedes ver tus créditos y las parcelas de pago (cada pago parcial que realizas). Sube comprobantes para registrar parcelas; el personal los revisará y aprobará.
      </p>
      <Link to="/portal/credit-request" className="link-request-credit">+ Solicitar crédito de mensualidad</Link>

      {credits.length === 0 ? (
        <div className="portal-empty">
          No tienes créditos. <Link to="/portal/credit-request">Solicita uno</Link> si necesitas financiamiento.
        </div>
      ) : (
        <div className="credits-layout">
          <div className="credits-list">
            {credits.map((c) => (
              <div
                key={c.id}
                className={`credit-card ${selectedCredit?.id === c.id ? 'selected' : ''} status-${c.status}`}
                onClick={() => setSelectedCredit(c)}
              >
                <div className="credit-card-header">
                  <span className="credit-type">{c.credit_type === 'mensualidad' ? 'Mensualidad' : c.credit_type}</span>
                  <span className={`status-badge status-${c.status}`}>{statusLabel(c.status)}</span>
                </div>
                <div className="credit-card-amounts">
                  <span>Total: ${parseFloat(c.total_amount || 0).toFixed(2)}</span>
                  <span>Pendiente: ${parseFloat(c.remaining_amount || 0).toFixed(2)}</span>
                </div>
                <div className="credit-card-date">{formatDate(c.created_at)}</div>
              </div>
            ))}
          </div>

          <div className="credit-detail">
            {selectedCredit ? (
              <>
                <h3>Crédito #{selectedCredit.id}</h3>
                <div className="detail-summary">
                  <div className="summary-row">
                    <span>Total:</span>
                    <strong>${parseFloat(selectedCredit.total_amount || 0).toFixed(2)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Pagado:</span>
                    <span>${parseFloat(selectedCredit.paid_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="summary-row highlight">
                    <span>Saldo pendiente:</span>
                    <strong>${parseFloat(selectedCredit.remaining_amount || 0).toFixed(2)}</strong>
                  </div>
                </div>

                {selectedCredit.status !== 'liquidado' && (
                  <form onSubmit={handleUploadProof} className="payment-form">
                    <h4>Subir comprobante de pago parcial</h4>
                    <p className="form-hint">Sube una imagen o PDF de tu comprobante. El personal lo revisará y aprobará o rechazará.</p>
                    <div className="portal-form-group">
                      <label>Monto ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedCredit.remaining_amount}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={`Máx: $${parseFloat(selectedCredit.remaining_amount || 0).toFixed(2)}`}
                        required
                      />
                    </div>
                    <div className="portal-form-group">
                      <label>Archivo (imagen o PDF) *</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        required
                      />
                    </div>
                    <div className="portal-form-group">
                      <label>Notas (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Pago parcial vía transferencia"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="portal-submit-btn" disabled={submitting}>
                      {submitting ? 'Subiendo...' : '📤 Subir comprobante'}
                    </button>
                  </form>
                )}

                {selectedCredit.status === 'liquidado' && (
                  <p className="credit-liquidated">✓ Crédito liquidado</p>
                )}

                {proofsForCredit.length > 0 && (
                  <div className="payments-history">
                    <h4>Comprobantes de parcelas (pendientes de revisión)</h4>
                    {proofsForCredit.map((p) => (
                      <div key={p.id} className={`payment-item proof-item status-${p.status}`}>
                        <span>${parseFloat(p.amount).toFixed(2)}</span>
                        <span>{formatDate(p.created_at)}</span>
                        <span className={`proof-status status-${p.status}`}>{proofStatusLabel(p.status)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(selectedCredit.payments || []).length > 0 && (
                  <div className="payments-history">
                    <h4>Parcelas de pago ({selectedCredit.payments.length} pagos aprobados)</h4>
                    <p className="parcelas-hint">Cada parcela es un pago parcial que reduces el saldo del crédito.</p>
                    {selectedCredit.payments.map((p, idx) => (
                      <div key={p.id} className="payment-item parcela-item">
                        <span className="parcela-num">Parcela {idx + 1}</span>
                        <span>${parseFloat(p.amount).toFixed(2)}</span>
                        <span>{formatDate(p.payment_date)}</span>
                        <span>{p.payment_method || '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="select-hint">Selecciona un crédito</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalCredits;
