import React, { useState } from 'react';
import portalApi from '../../services/portalApi';
import './PortalChangeAddress.css';

const PortalChangeAddress = () => {
  const [newAddress, setNewAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newAddress.trim()) {
      setMessage('La nueva dirección es requerida');
      setSuccess(false);
      return;
    }
    setSubmitting(true);
    setMessage('');
    portalApi.post('/client-portal/change-address-request', {
      new_address: newAddress.trim(),
      notes: notes.trim() || undefined
    })
      .then((res) => {
        setSuccess(true);
        setMessage(res.data?.message || 'Solicitud enviada correctamente.');
        setNewAddress('');
        setNotes('');
      })
      .catch((err) => {
        setSuccess(false);
        setMessage(err.response?.data?.error || 'Error al enviar la solicitud.');
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="portal-change-address">
      <h2>Solicitud de cambio de domicilio</h2>
      <p className="portal-change-address-intro">
        Si necesitas cambiar la dirección de tu servicio, completa el formulario. Te contactaremos para coordinar la visita y el costo del traslado.
      </p>
      <form onSubmit={handleSubmit} className="change-address-form">
        <div className="form-group">
          <label htmlFor="new_address">Nueva dirección *</label>
          <textarea
            id="new_address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Calle, número, colonia, ciudad, CP..."
            rows={5}
            required
            disabled={submitting}
          />
        </div>
        <div className="form-group">
          <label htmlFor="notes">Notas adicionales</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Indica horarios preferidos, referencias, etc."
            rows={3}
            disabled={submitting}
          />
        </div>
        {message && (
          <div className={`form-message ${success ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );
};

export default PortalChangeAddress;
