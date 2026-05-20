import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const ResetAppModal = ({ onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [countdownInterval, setCountdownInterval] = useState(null);
  const COUNTDOWN_SECONDS = 10;

  useEffect(() => {
    // Limpiar el intervalo cuando el componente se desmonte
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [countdownInterval]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Por favor ingresa tu contraseña');
      return;
    }

    // Iniciar conteo regresivo
    try {
      let seconds = COUNTDOWN_SECONDS;
      setCountdown(seconds);

      const interval = setInterval(() => {
        seconds--;
        setCountdown(seconds);

        if (seconds <= 0) {
          clearInterval(interval);
          setCountdownInterval(null);
          setCountdown(null);
          // Proceder con el restablecimiento
          performReset();
        }
      }, 1000);
      
      setCountdownInterval(interval);
    } catch (error) {
      setError('Error al iniciar el proceso de restablecimiento');
    }
  };

  const performReset = async () => {
    setIsResetting(true);
    setError('');

    try {
      await api.post('/backup/reset', { password });
      onSuccess('Aplicación restablecida completamente. La página se recargará en unos segundos.');
      
      // Recargar la página después de 3 segundos
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      setIsResetting(false);
      setCountdown(null);
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }
      setError(error.response?.data?.error || 'Error al restablecer la aplicación');
    }
  };

  const handleCancel = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
      setCountdown(null);
      setPassword('');
      setError('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>⚠️ Restablecer Aplicación Completamente</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ 
            background: '#fff3cd', 
            border: '2px solid #ffc107', 
            borderRadius: '8px', 
            padding: '15px', 
            marginBottom: '20px' 
          }}>
            <strong style={{ color: '#856404' }}>⚠️ ADVERTENCIA CRÍTICA:</strong>
            <ul style={{ margin: '10px 0 0 20px', color: '#856404' }}>
              <li>Esto eliminará <strong>TODOS</strong> los datos de la aplicación</li>
              <li>Se eliminarán: clientes, pagos, instalaciones, folios, paquetes, redes, recibos, gastos, etc.</li>
              <li>Se recrearán las tablas vacías</li>
              <li>Esta acción <strong>NO se puede deshacer</strong></li>
            </ul>
          </div>

          {countdown === null && !isResetting ? (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Contraseña de Administrador *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña para confirmar"
                  required
                  autoFocus
                />
                <small style={{ color: '#666' }}>
                  Debes ingresar tu contraseña de administrador para confirmar esta acción
                </small>
              </div>

              {error && <div className="error-message" style={{ marginTop: '10px' }}>{error}</div>}

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-cancel" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit" style={{ background: '#dc3545' }}>
                  Restablecer Aplicación
                </button>
              </div>
            </form>
          ) : countdown !== null ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ 
                fontSize: '48px', 
                fontWeight: 'bold', 
                color: '#dc3545',
                marginBottom: '20px'
              }}>
                {countdown}
              </div>
              <p style={{ fontSize: '18px', marginBottom: '20px' }}>
                El restablecimiento comenzará en {countdown} segundo{countdown !== 1 ? 's' : ''}
              </p>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Puedes cancelar ahora si cambias de opinión
              </p>
              <button 
                className="btn-cancel" 
                onClick={handleCancel}
                style={{ fontSize: '16px', padding: '10px 30px' }}
              >
                Cancelar Restablecimiento
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '20px' }}>
                🔄 Restableciendo aplicación...
              </div>
              <p>Por favor espera, esto puede tomar unos momentos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetAppModal;

