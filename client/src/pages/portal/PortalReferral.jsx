import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalReferral.css';

const PortalReferral = () => {
  const [data, setData] = useState({ referral_code: '', referidos: [] });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    portalApi.get('/client-portal/referral')
      .then((res) => setData(res.data || { referral_code: '', referidos: [] }))
      .catch(() => setData({ referral_code: '', referidos: [] }))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (data.referral_code) {
      navigator.clipboard.writeText(data.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  const benefitLabel = (s) => ({ aplicado: 'Aplicado', pendiente: 'Pendiente' }[s] || s || '-');

  if (loading) {
    return <div className="portal-loading">Cargando...</div>;
  }

  return (
    <div className="portal-referral">
      <h2>Referir clientes</h2>
      <p className="portal-referral-desc">Comparte tu código con amigos y familiares. Cuando se instalen, ambos pueden recibir beneficios.</p>
      <div className="referral-code-card">
        <h3>Tu código de referido</h3>
        <div className="code-display">
          <span className="code-value">{data.referral_code || '-'}</span>
          <button type="button" className="copy-btn" onClick={handleCopy} disabled={!data.referral_code}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="code-hint">Comparte este código cuando alguien quiera contratar el servicio. El personal lo registrará al hacer la instalación.</p>
      </div>
      {data.referidos?.length > 0 && (
        <div className="referrals-list">
          <h3>Personas que referiste</h3>
          {data.referidos.map((r) => (
            <div key={r.id} className="referral-item">
              <span className="ref-name">{r.referred_name || 'Cliente'}</span>
              <span className="ref-date">{formatDate(r.created_at)}</span>
              <span className={`ref-status status-${r.benefit_status}`}>{benefitLabel(r.benefit_status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalReferral;
