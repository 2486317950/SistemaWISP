import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import './WhatsApp.css';

const WhatsApp = () => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  const handleOpenChat = () => {
    if (phoneNumber.trim()) {
      setShowChat(true);
    } else {
      toast.warning('Por favor ingresa un número de teléfono');
    }
  };

  const handleSendMessage = (phone, msg) => {
    const cleanPhone = phone.replace(/\D/g, ''); // Remover caracteres no numéricos
    const encodedMessage = encodeURIComponent(msg || '');
    const whatsappUrl = `https://wa.me/${cleanPhone}${msg ? `?text=${encodedMessage}` : ''}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleQuickMessage = (phone, template) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(template);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-header">
        <h1>💬 WhatsApp</h1>
        <p>Envía mensajes rápidos a tus clientes</p>
      </div>

      <div className="whatsapp-container">
        <div className="whatsapp-sidebar">
          <div className="whatsapp-form">
            <h3>Enviar Mensaje Rápido</h3>
            
            <div className="form-group">
              <label>Número de Teléfono *</label>
              <input
                type="tel"
                placeholder="Ej: 1234567890 o +52 1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <small>Incluye código de país (ej: +52 para México)</small>
            </div>

            <div className="form-group">
              <label>Mensaje (opcional)</label>
              <textarea
                placeholder="Escribe tu mensaje aquí..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows="4"
              />
            </div>

            <button 
              className="btn-send-whatsapp"
              onClick={() => handleSendMessage(phoneNumber, message)}
            >
              📱 Abrir WhatsApp
            </button>

            <div className="templates-section">
              <h4>Plantillas Rápidas</h4>
              <div className="templates-grid">
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Hola, ¿cómo puedo ayudarte?')}
                >
                  Saludo
                </button>
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Tu pago ha sido registrado exitosamente. Gracias por tu preferencia.')}
                >
                  Confirmación de Pago
                </button>
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Tu instalación ha sido programada. Nos pondremos en contacto contigo pronto.')}
                >
                  Instalación Programada
                </button>
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Tu folio de reparación ha sido creado. Un técnico se pondrá en contacto contigo.')}
                >
                  Folio Creado
                </button>
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Recordatorio: Tu pago vence pronto. Por favor contáctanos para más información.')}
                >
                  Recordatorio de Pago
                </button>
                <button
                  className="template-btn"
                  onClick={() => handleQuickMessage(phoneNumber, 'Gracias por contactarnos. ¿En qué puedo ayudarte?')}
                >
                  Respuesta Rápida
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="whatsapp-content">
          <div className="whatsapp-info">
            <h2>💡 Cómo usar</h2>
            <div className="info-steps">
              <div className="step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <h4>Ingresa el número de teléfono</h4>
                  <p>Incluye el código de país (ej: +52 para México, +1 para USA)</p>
                </div>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <h4>Escribe tu mensaje (opcional)</h4>
                  <p>O usa una de las plantillas rápidas disponibles</p>
                </div>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <div className="step-content">
                  <h4>Haz clic en "Abrir WhatsApp"</h4>
                  <p>Se abrirá WhatsApp Web o la app de WhatsApp con el mensaje listo</p>
                </div>
              </div>
            </div>

            <div className="whatsapp-tips">
              <h3>💡 Consejos</h3>
              <ul>
                <li>El número debe incluir código de país sin espacios ni guiones</li>
                <li>Ejemplo: +521234567890 (México) o +11234567890 (USA)</li>
                <li>Puedes usar las plantillas rápidas para mensajes comunes</li>
                <li>Los mensajes se abrirán en una nueva pestaña de WhatsApp</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsApp;



