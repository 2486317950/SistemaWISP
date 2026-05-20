import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { useToast } from '../../context/ToastContext';
import './PortalPaymentProofs.css';

const PortalPaymentProofs = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [proofType, setProofType] = useState('mensualidad');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [installationDebt, setInstallationDebt] = useState(0);

  const loadProofs = () => {
    portalApi.get('/client-portal/payment-proofs', {
      params: { _t: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    })
      .then((res) => setProofs(res.data || []))
      .catch(() => setProofs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProofs();
  }, []);

  useEffect(() => {
    portalApi.get('/client-portal/balance', {
      params: { _t: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    })
      .then((res) => setInstallationDebt(parseFloat(res.data?.installation_debt || 0) || 0))
      .catch(() => setInstallationDebt(0));
  }, []);

  useEffect(() => {
    if (proofType === 'instalacion' && installationDebt > 0) {
      setAmount(installationDebt.toFixed(2));
    } else if (proofType === 'mensualidad') {
      setAmount('');
    }
  }, [proofType, installationDebt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      toast.warning('Selecciona un archivo (captura de transferencia o comprobante de depósito)');
      return;
    }
    if (proofType === 'instalacion') {
      if (installationDebt <= 0) {
        toast.warning('No tienes deuda de instalación pendiente.');
        return;
      }
      const payAmount = parseFloat(amount);
      if (isNaN(payAmount) || payAmount <= 0) {
        toast.warning('Indica el monto a pagar.');
        return;
      }
      if (payAmount > installationDebt) {
        toast.warning(`No puedes pagar más de lo que debes. Deuda de instalación: $${installationDebt.toFixed(2)}`);
        return;
      }
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('proof_type', proofType);
    if (amount) formData.append('amount', amount);
    if (notes) formData.append('notes', notes);

    portalApi.post('/client-portal/payment-proofs', formData)
      .then(() => {
        setFile(null);
        setAmount(proofType === 'instalacion' && installationDebt > 0 ? installationDebt.toFixed(2) : '');
        setNotes('');
        loadProofs();
        if (proofType === 'instalacion') {
          portalApi.get('/client-portal/balance', {
            params: { _t: Date.now() },
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
          }).then((r) => setInstallationDebt(parseFloat(r.data?.installation_debt || 0) || 0));
        }
        toast.success('Comprobante subido correctamente. Será revisado por el personal.');
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al subir'))
      .finally(() => setUploading(false));
  };

  const statusLabel = (s) => {
    const map = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
    return map[s] || s;
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s;
  };

  if (loading) {
    return <div className="portal-loading">Cargando...</div>;
  }

  return (
    <div className="portal-payment-proofs">
      <h2>Comprobantes de pago</h2>
      <p className="portal-proof-desc">
        Sube capturas de transferencia o comprobantes de depósito para que validemos tu pago.
      </p>

      <form onSubmit={handleSubmit} className="portal-proof-form">
        <div className="portal-form-group">
          <label>Tipo de comprobante *</label>
          <div className="portal-proof-type-options">
            <label className="portal-radio-option">
              <input
                type="radio"
                name="proofType"
                checked={proofType === 'mensualidad'}
                onChange={() => setProofType('mensualidad')}
              />
              <span>Mensualidad</span>
            </label>
            <label className="portal-radio-option">
              <input
                type="radio"
                name="proofType"
                checked={proofType === 'instalacion'}
                onChange={() => setProofType('instalacion')}
                disabled={installationDebt <= 0}
              />
              <span>Instalación</span>
              {installationDebt > 0 && (
                <span className="portal-debt-badge">Debes: ${installationDebt.toFixed(2)}</span>
              )}
            </label>
          </div>
          {proofType === 'instalacion' && installationDebt <= 0 && (
            <p className="portal-instalacion-hint">No tienes deuda de instalación pendiente.</p>
          )}
        </div>
        <div className="portal-form-group">
          <label>
            {proofType === 'instalacion' ? 'Monto a pagar *' : 'Monto (opcional)'}
          </label>
          <input
            type="number"
            step="0.01"
            min={proofType === 'instalacion' ? 0.01 : undefined}
            max={proofType === 'instalacion' ? installationDebt : undefined}
            placeholder={proofType === 'mensualidad' ? 'Ej: 350.00' : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            readOnly={proofType === 'instalacion' && installationDebt > 0}
          />
          {proofType === 'instalacion' && installationDebt > 0 && (
            <p className="portal-instalacion-hint">No puedes pagar más de ${installationDebt.toFixed(2)}.</p>
          )}
        </div>
        <div className="portal-form-group">
          <label>Archivo * (imagen o PDF)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>
        <div className="portal-form-group">
          <label>Notas (opcional)</label>
          <input
            type="text"
            placeholder={proofType === 'instalacion' ? 'Ej: Pago de instalación' : 'Ej: Pago de mensualidad marzo'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="portal-upload-btn" disabled={uploading || !file || (proofType === 'instalacion' && (installationDebt <= 0 || !amount))}>
          {uploading ? 'Subiendo...' : '📤 Subir comprobante'}
        </button>
      </form>

      <h3>Mis comprobantes</h3>
      {proofs.length === 0 ? (
        <div className="portal-empty">No has subido comprobantes aún</div>
      ) : (
        <div className="portal-proof-list">
          {proofs.map((p) => (
            <div key={p.id} className={`portal-proof-item status-${p.status}`}>
              <div className="proof-info">
                <span className="proof-name">{p.file_name}</span>
                <span className="proof-date">{formatDate(p.created_at)}</span>
                <span className="proof-type-badge">{p.proof_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}</span>
                {p.amount && <span className="proof-amount">${parseFloat(p.amount).toFixed(2)}</span>}
                <span className={`proof-status status-${p.status}`}>{statusLabel(p.status)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalPaymentProofs;
