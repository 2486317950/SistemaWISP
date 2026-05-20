import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalInvoices.css';

const PortalInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/client-portal/invoices')
      .then((res) => setInvoices(res.data || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="portal-loading">Cargando facturas...</div>;
  }

  return (
    <div className="portal-invoices">
      <h2>Facturas electrónicas (CFDI)</h2>
      <p className="portal-invoices-desc">Facturas fiscales generadas a tu nombre.</p>
      {invoices.length === 0 ? (
        <div className="portal-empty">No hay facturas electrónicas registradas.</div>
      ) : (
        <div className="invoice-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="invoice-item">
              <div className="invoice-main">
                <span className="invoice-folio">{inv.folio_fiscal ? `UUID: ${inv.folio_fiscal.slice(0, 8)}...` : `Folio ${inv.folio || inv.id}`}</span>
                <span className="invoice-amount">${parseFloat(inv.total || 0).toFixed(2)}</span>
              </div>
              <div className="invoice-meta">
                <span>{formatDate(inv.fecha_emision)}</span>
                {inv.estado_sat && <span className={`invoice-status status-${inv.estado_sat}`}>{inv.estado_sat}</span>}
              </div>
              {inv.pdf_url && (
                <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="invoice-download">Descargar PDF</a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalInvoices;
