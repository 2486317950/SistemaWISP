import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { useToast } from '../../context/ToastContext';
import './PortalTickets.css';

const PortalTickets = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const loadTickets = () => {
    portalApi.get('/client-portal/tickets')
      .then((res) => setTickets(res.data || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    portalApi.get(`/client-portal/tickets/${ticket.id}`)
      .then((res) => setSelectedTicket(res.data))
      .catch(() => setSelectedTicket(null));
  };

  const refreshSelectedTicket = () => {
    if (selectedTicket?.id) {
      portalApi.get(`/client-portal/tickets/${selectedTicket.id}`)
        .then((res) => setSelectedTicket(res.data))
        .catch(() => setSelectedTicket(null));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    portalApi.post('/client-portal/tickets', { title, description })
      .then(() => {
        setTitle('');
        setDescription('');
        setShowForm(false);
        loadTickets();
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al crear ticket'))
      .finally(() => setSubmitting(false));
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTicket) return;
    setSendingComment(true);
    portalApi.post(`/client-portal/tickets/${selectedTicket.id}/comments`, { comment: newComment })
      .then(() => {
        setNewComment('');
        refreshSelectedTicket();
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Error al enviar'))
      .finally(() => setSendingComment(false));
  };

  const statusLabel = (s) => {
    const map = { abierto: 'Abierto', en_proceso: 'En proceso', resuelto: 'Resuelto', rechazado: 'Rechazado', cerrado: 'Cerrado' };
    return map[s] || s;
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const str = String(d);
    if (str.includes('T')) return str.split('T')[0].split('-').reverse().join('/') + ' ' + (str.split('T')[1]?.slice(0, 5) || '');
    return str.split('-').reverse().join('/');
  };

  if (loading) {
    return <div className="portal-loading">Cargando tickets...</div>;
  }

  if (selectedTicket) {
    return (
      <div className="portal-tickets">
        <button type="button" className="back-tickets-btn" onClick={() => setSelectedTicket(null)}>← Volver a tickets</button>
        <div className="ticket-detail">
          <div className="ticket-detail-header">
            <h2>{selectedTicket.title}</h2>
            <span className={`ticket-status status-${selectedTicket.status}`}>{statusLabel(selectedTicket.status)}</span>
          </div>
          <p className="ticket-num">#{selectedTicket.ticket_number}</p>
          {selectedTicket.description && <p className="ticket-desc">{selectedTicket.description}</p>}
          <div className="ticket-comments">
            <h4>Conversación</h4>
            {(selectedTicket.comments || []).map((c) => (
              <div key={c.id} className={`comment-item ${c.is_client ? 'from-client' : 'from-staff'}`}>
                <span className="comment-author">{c.is_client ? 'Tú' : 'Soporte'}</span>
                <span className="comment-date">{formatDate(c.created_at)}</span>
                <p className="comment-text">{c.comment}</p>
              </div>
            ))}
          </div>
          {selectedTicket.status !== 'cerrado' && selectedTicket.status !== 'resuelto' && (
            <form onSubmit={handleAddComment} className="comment-form">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={3}
                required
              />
              <button type="submit" className="portal-submit-btn" disabled={sendingComment}>
                {sendingComment ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-tickets">
      <div className="portal-tickets-header">
        <h2>Soporte técnico</h2>
        <button
          className="portal-new-ticket-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Nuevo ticket'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="portal-ticket-form">
          <div className="portal-form-group">
            <label>Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Describe brevemente el problema"
              required
            />
          </div>
          <div className="portal-form-group">
            <label>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={4}
            />
          </div>
          <button type="submit" className="portal-submit-btn" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Crear ticket'}
          </button>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="portal-empty">No tienes tickets. Crea uno si necesitas soporte.</div>
      ) : (
        <div className="portal-ticket-list">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="portal-ticket-item"
              onClick={() => loadTicketDetail(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && loadTicketDetail(t)}
            >
              <div className="portal-ticket-main">
                <span className="ticket-num">{t.ticket_number}</span>
                <span className="ticket-title">{t.title}</span>
                <span className={`ticket-status status-${t.status}`}>{statusLabel(t.status)}</span>
              </div>
              <div className="portal-ticket-meta">{formatDate(t.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalTickets;
