import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './MaintenancePage.css';

const MaintenancePage = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/public/maintenance-status')
      .then((res) => setMessage(res.data?.message || ''))
      .catch(() => setMessage(''));
  }, []);

  return (
    <div className="maintenance-page">
      <div className="maintenance-card">
        <div className="maintenance-icon">🔧</div>
        <h1>En mantenimiento</h1>
        <p className="maintenance-text">
          Estamos realizando tareas de mejora. Volveremos pronto.
        </p>
        {message && (
          <p className="maintenance-message">{message}</p>
        )}
        <p className="maintenance-note">
          Si es urgente, contáctanos por teléfono o WhatsApp.
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
