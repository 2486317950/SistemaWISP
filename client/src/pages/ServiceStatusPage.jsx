import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './ServiceStatusPage.css';

const STATUS_LABELS = {
  normal: 'Operativo',
  mantenimiento: 'Mantenimiento',
  problemas: 'Incidencia'
};

const ServiceStatusPage = () => {
  const [data, setData] = useState({ status: 'normal', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/public/service-status')
      .then((res) => setData(res.data || { status: 'normal', message: '' }))
      .catch(() => setData({ status: 'normal', message: '' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="service-status-page">
        <div className="service-status-card">Cargando estado del servicio...</div>
      </div>
    );
  }

  const status = data.status || 'normal';
  const label = STATUS_LABELS[status] || status;
  const isOk = status === 'normal';

  return (
    <div className="service-status-page">
      <div className={`service-status-card service-status-${status}`}>
        <div className="service-status-icon">
          {isOk ? '✅' : status === 'mantenimiento' ? '🔧' : '⚠️'}
        </div>
        <h1>Estado del servicio</h1>
        <p className="service-status-label">{label}</p>
        {data.message && (
          <p className="service-status-message">{data.message}</p>
        )}
        <p className="service-status-updated">
          Última actualización: {new Date().toLocaleDateString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
        <Link to="/portal" className="service-status-link">Ir al portal del cliente</Link>
      </div>
    </div>
  );
};

export default ServiceStatusPage;
