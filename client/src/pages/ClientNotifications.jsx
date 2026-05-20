import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientNotifications.css';

const ClientNotifications = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [clientId, setClientId] = useState('');
  const [link, setLink] = useState('/portal');
  const [templateName, setTemplateName] = useState('');
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const loadClients = () => {
    setLoading(true);
    api.get('/broadcast-notifications/clients')
      .then((res) => setClients(res.data || []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  };

  const loadTemplates = () => {
    api.get('/broadcast-notifications/templates')
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]));
  };

  useEffect(() => {
    loadClients();
    loadTemplates();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setLastResult({ error: 'El título es requerido' });
      return;
    }
    if (!message.trim()) {
      setLastResult({ error: 'El mensaje es requerido' });
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const res = await api.post('/broadcast-notifications/send', {
        title: title.trim(),
        message: message.trim(),
        clientId: clientId || null,
        link: link?.trim() || '/portal'
      });
      setLastResult({ success: true, message: res.data?.message });
      setTitle('');
      setMessage('');
      setClientId('');
    } catch (err) {
      setLastResult({ error: err.response?.data?.error || 'Error al enviar' });
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setLastResult({ error: 'Título y mensaje son requeridos para guardar' });
      return;
    }
    const name = templateName.trim() || title.trim().slice(0, 50);
    setSavingTemplate(true);
    setLastResult(null);
    try {
      await api.post('/broadcast-notifications/templates', {
        name,
        title: title.trim(),
        message: message.trim(),
        link: link?.trim() || '/portal'
      });
      setLastResult({ success: true, message: 'Plantilla guardada correctamente' });
      setTemplateName('');
      loadTemplates();
    } catch (err) {
      setLastResult({ error: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (t) => {
    setTitle(t.title);
    setMessage(t.message);
    setLink(t.link || '/portal');
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla de notificación?')) return;
    try {
      await api.delete(`/broadcast-notifications/templates/${id}`);
      loadTemplates();
    } catch (err) {
      setLastResult({ error: err.response?.data?.error || 'Error al eliminar' });
    }
  };

  return (
    <div className="client-notifications-page">
      <div className="client-notifications-header">
        <h1>🔔 Notificaciones a Clientes</h1>
        <p>Envía mensajes personalizados por notificación push a los clientes del portal</p>
      </div>

      <div className="client-notifications-container">
        <div className="client-notifications-form-card">
          <h2>Nueva notificación</h2>
          <form onSubmit={handleSubmit} className="notif-form">
            {lastResult?.error && (
              <div className="notif-error">{lastResult.error}</div>
            )}
            {lastResult?.success && (
              <div className="notif-success">{lastResult.message}</div>
            )}

            <div className="form-group">
              <label>Título *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Recordatorio importante"
                maxLength={100}
                disabled={sending}
              />
            </div>

            <div className="form-group">
              <label>Mensaje *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe el mensaje que verá el cliente..."
                rows={4}
                disabled={sending}
              />
            </div>

            <div className="form-group">
              <label>Enviar a</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={sending || loading}
              >
                <option value="">Todos los clientes (con portal habilitado)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_number || c.id} - {c.name}
                  </option>
                ))}
              </select>
              {loading && <small>Cargando clientes...</small>}
            </div>

            <div className="form-group">
              <label>Nombre al guardar (opcional)</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ej: Recordatorio de pago - para identificar la plantilla"
                disabled={sending}
              />
            </div>

            <div className="form-group">
              <label>Enlace al abrir (opcional)</label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/portal o /portal/payments"
                disabled={sending}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-send-notif" disabled={sending}>
                {sending ? 'Enviando...' : '📤 Enviar notificación'}
              </button>
              <button
                type="button"
                className="btn-save-template"
                onClick={handleSaveTemplate}
                disabled={sending || savingTemplate || !title.trim() || !message.trim()}
              >
                {savingTemplate ? 'Guardando...' : '💾 Guardar como plantilla'}
              </button>
            </div>

            {templates.length > 0 && (
              <div className="templates-section">
                <h3>Plantillas guardadas</h3>
                <div className="templates-list">
                  {templates.map((t) => (
                    <div key={t.id} className="template-card">
                      <div className="template-info" onClick={() => handleLoadTemplate(t)}>
                        <strong>{t.name}</strong>
                        <span className="template-preview">{t.title}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-delete-template"
                        onClick={() => handleDeleteTemplate(t.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="client-notifications-info">
          <h3>ℹ️ Información</h3>
          <ul>
            <li>Las notificaciones llegan a la app del portal y al navegador si el cliente tiene sesión abierta.</li>
            <li><strong>Todos los clientes</strong>: envía a quienes tengan el portal habilitado.</li>
            <li><strong>Cliente específico</strong>: envía solo al cliente seleccionado.</li>
            <li>El enlace indica a qué sección del portal irá el cliente al tocar la notificación.</li>
            <li><strong>Plantillas</strong>: guarda mensajes frecuentes y haz clic en uno para cargarlo de nuevo.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ClientNotifications;
