import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { Link } from 'react-router-dom';
import './PortalPackages.css';

const PortalPackages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/client-portal/packages')
      .then((res) => setPackages(res.data || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="portal-loading">Cargando paquetes...</div>;
  }

  return (
    <div className="portal-packages">
      <h2>Paquetes disponibles</h2>
      <p className="portal-packages-intro">
        Estos son los planes y velocidades que ofrecemos. Puedes solicitar un cambio de paquete en la sección de Soporte.
      </p>
      {packages.length === 0 ? (
        <div className="portal-empty">No hay paquetes disponibles en este momento.</div>
      ) : (
        <div className="packages-grid">
          {packages.map((pkg) => (
            <div key={pkg.id} className="package-card">
              <div className="package-header">
                <h3>{pkg.name}</h3>
                {pkg.speed && <span className="package-speed">{pkg.speed}</span>}
              </div>
              <div className="package-price">
                ${parseFloat(pkg.price || 0).toFixed(2)}
                <span className="package-period">/mes</span>
              </div>
              {pkg.description && (
                <p className="package-description">{pkg.description}</p>
              )}
              <Link to="/portal/tickets" className="package-request-btn">
                Solicitar este paquete
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalPackages;
