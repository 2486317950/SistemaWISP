import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalUsage.css';

const PortalUsage = () => {
  const [data, setData] = useState({ records: [], total_gb: '0' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/client-portal/usage')
      .then((res) => setData(res.data || { records: [], total_gb: '0' }))
      .catch(() => setData({ records: [], total_gb: '0' }))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') + ' ' + (s.split('T')[1]?.slice(0, 5) || '') : s;
  };

  const statusLabel = (s) => ({ conectado: 'Conectado', desconectado: 'Desconectado' }[s] || s || '-');

  if (loading) {
    return <div className="portal-loading">Cargando consumo...</div>;
  }

  return (
    <div className="portal-usage">
      <h2>Consumo de datos</h2>
      <div className="usage-summary">
        <div className="usage-total">
          <span className="usage-label">Uso total registrado</span>
          <span className="usage-value">{data.total_gb} GB</span>
        </div>
        <p className="usage-note">El consumo se estima a partir del monitoreo de tu conexión (velocidad y tiempo en línea). Los datos se actualizan cada vez que el sistema revisa el estado de la red.</p>
      </div>
      {data.records?.length > 0 ? (
        <div className="usage-list">
          <h3>Historial reciente</h3>
          {data.records.slice(0, 15).map((r) => (
            <div key={r.id} className="usage-item">
              <span className={`usage-status status-${r.connection_status}`}>{statusLabel(r.connection_status)}</span>
              <span className="usage-date">{formatDate(r.last_seen || r.created_at)}</span>
              {r.bandwidth_usage != null && (
                <span className="usage-gb">{(r.bandwidth_usage / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
              )}
              {r.download_speed != null && <span>{r.download_speed} Mbps ↓</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="portal-empty">No hay registros de consumo disponibles.</div>
      )}
    </div>
  );
};

export default PortalUsage;
