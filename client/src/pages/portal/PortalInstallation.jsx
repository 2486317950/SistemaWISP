import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalInstallation.css';

const PortalInstallation = () => {
  const [installation, setInstallation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/client-portal/installation')
      .then((res) => setInstallation(res.data))
      .catch(() => setInstallation(null))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  const statusLabel = (s) => {
    const map = { completada: 'Completada', pendiente: 'Pendiente', cancelada: 'Cancelada' };
    return map[s] || s || '-';
  };

  if (loading) {
    return <div className="portal-loading">Cargando instalación...</div>;
  }

  if (!installation) {
    return (
      <div className="portal-installation">
        <h2>Mi instalación</h2>
        <div className="portal-empty">No hay datos de instalación registrados para tu cuenta.</div>
      </div>
    );
  }

  return (
    <div className="portal-installation">
      <h2>Mi instalación</h2>
      <div className="installation-card">
        <h3>📡 Datos de la instalación</h3>
        <div className="installation-details">
          <div className="installation-row">
            <span className="label">Folio:</span>
            <span>{installation.installation_folio || '-'}</span>
          </div>
          <div className="installation-row">
            <span className="label">Dirección:</span>
            <span>{installation.address || '-'}</span>
          </div>
          <div className="installation-row">
            <span className="label">Estado:</span>
            <span className={`status-badge status-${installation.status || 'completada'}`}>
              {statusLabel(installation.status)}
            </span>
          </div>
          <div className="installation-row">
            <span className="label">Fecha de instalación:</span>
            <span>{formatDate(installation.installation_date)}</span>
          </div>
          {installation.completion_date && (
            <div className="installation-row">
              <span className="label">Fecha de conclusión:</span>
              <span>{formatDate(installation.completion_date)}</span>
            </div>
          )}
          <div className="installation-row">
            <span className="label">Paquete:</span>
            <span>{installation.package_name || '-'} {installation.speed ? `(${installation.speed})` : ''}</span>
          </div>
          {installation.equipment_used && (
            <div className="installation-row">
              <span className="label">Equipo instalado:</span>
              <span>{installation.equipment_used}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalInstallation;
