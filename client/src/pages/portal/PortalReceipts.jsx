import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { downloadReceiptPDF } from '../../utils/pdfGenerator';
import { useToast } from '../../context/ToastContext';
import './PortalReceipts.css';

const PortalReceipts = () => {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadReceipts = () => {
    setLoadError(null);
    setLoading(true);
    portalApi.get('/client-portal/receipts')
      .then((res) => setReceipts(res.data || []))
      .catch(() => { setReceipts([]); setLoadError('Error al cargar recibos'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const handleDownload = (id) => {
    portalApi.get(`/client-portal/receipts/${id}`)
      .then((res) => {
        downloadReceiptPDF(res.data);
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al descargar'));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const parts = String(d).split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  };

  if (loading && receipts.length === 0 && !loadError) {
    return <div className="portal-loading">Cargando recibos...</div>;
  }

  return (
    <div className="portal-receipts">
      <h2>Mis recibos</h2>
      {loadError && (
        <div className="portal-error-box" style={{ marginBottom: '1rem' }}>
          {loadError}
          <button type="button" className="portal-retry-btn" onClick={loadReceipts}>Reintentar</button>
        </div>
      )}
      {receipts.length === 0 && !loading ? (
        <div className="portal-empty">No hay recibos</div>
      ) : (
        <div className="portal-receipt-list">
          {receipts.map((r) => (
            <div key={r.id} className="portal-receipt-item">
              <div className="portal-receipt-info">
                <span className="receipt-num">{r.receipt_number}</span>
                <span className="receipt-date">{formatDate(r.receipt_date)}</span>
                <span className="receipt-amount">${parseFloat(r.amount || 0).toFixed(2)}</span>
              </div>
              <button
                className="portal-download-btn"
                onClick={() => handleDownload(r.id)}
              >
                📥 Descargar PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalReceipts;
