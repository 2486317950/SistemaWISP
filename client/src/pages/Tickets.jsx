import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './Tickets.css';

const Tickets = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState({ status: '', priority: '', assigned_to: '' });
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    description: '',
    priority: 'media',
    assigned_to: ''
  });
  const [comment, setComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchTickets();
    fetchClients();
    fetchUsers();
    fetchStats();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      if (filter.assigned_to) params.assigned_to = filter.assigned_to;

      const response = await api.get('/tickets', { params });
      const data = response.data;
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar tickets:', error);
      setLoadError(error.response?.data?.error || 'Error al cargar tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/tickets/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const fetchTicketDetails = async (id) => {
    try {
      const response = await api.get(`/tickets/${id}`);
      setSelectedTicket(response.data);
    } catch (error) {
      console.error('Error al cargar detalles del ticket:', error);
      toast.error('Error al cargar detalles del ticket');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tickets', formData);
      toast.success('Ticket creado exitosamente');
      setShowForm(false);
      setFormData({
        client_id: '',
        title: '',
        description: '',
        priority: 'media',
        assigned_to: ''
      });
      fetchTickets();
      fetchStats();
    } catch (error) {
      console.error('Error al crear ticket:', error);
      toast.error(error.response?.data?.error || 'Error al crear ticket');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/tickets/${id}`, { status });
      fetchTickets();
      if (selectedTicket && selectedTicket.id === id) {
        fetchTicketDetails(id);
      }
      fetchStats();
    } catch (error) {
      console.error('Error al actualizar ticket:', error);
      toast.error('Error al actualizar ticket');
    }
  };

  const handleAddComment = async (ticketId) => {
    if (!comment.trim()) return;
    try {
      await api.post(`/tickets/${ticketId}/comments`, { comment });
      setComment('');
      fetchTicketDetails(ticketId);
    } catch (error) {
      console.error('Error al agregar comentario:', error);
      toast.error('Error al agregar comentario');
    }
  };

  const handleReject = async (ticketId) => {
    if (!rejectReason.trim()) {
      toast.warning('Indica el motivo del rechazo');
      return;
    }
    setRejecting(true);
    try {
      await api.post(`/tickets/${ticketId}/reject`, { reason: rejectReason.trim() });
      setShowRejectModal(false);
      setRejectReason('');
      fetchTicketDetails(ticketId);
      fetchTickets();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al rechazar');
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este ticket?')) return;
    try {
      await api.delete(`/tickets/${id}`);
      toast.success('Ticket eliminado exitosamente');
      setSelectedTicket(null);
      fetchTickets();
      fetchStats();
    } catch (error) {
      console.error('Error al eliminar ticket:', error);
      toast.error('Error al eliminar ticket');
    }
  };

  const ticketList = Array.isArray(tickets) ? tickets : [];

  return (
    <div className="tickets-page">
      <div className="page-header">
        <h1>🎫 Tickets de Soporte</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Crear Ticket
        </button>
      </div>

      {loading && (
        <div className="tickets-loading">
          <LoadingSpinner message="Cargando tickets..." />
        </div>
      )}

      {loadError && !loading && (
        <div className="tickets-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn-primary" onClick={() => fetchTickets()}>
            Reintentar
          </button>
        </div>
      )}

      {stats && !loading && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total</h3>
            <p>{stats.total || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Abiertos</h3>
            <p>{stats.abiertos || 0}</p>
          </div>
          <div className="stat-card">
            <h3>En Proceso</h3>
            <p>{stats.en_proceso || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Resueltos</h3>
            <p>{stats.resueltos || 0}</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Ticket</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Cliente (opcional)</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                >
                  <option value="">Sin cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.client_number || 'Sin número'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="5"
                />
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className="form-group">
                <label>Asignar a (opcional)</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                >
                  <option value="">Sin asignar</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && (
        <div className="filters">
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="abierto">Abierto</option>
            <option value="en_proceso">En Proceso</option>
            <option value="resuelto">Resuelto</option>
            <option value="rechazado">Rechazado</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
            <option value="">Todas las prioridades</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      )}

      {!loading && !loadError && (
      <div className="tickets-container">
        <div className="tickets-list">
          {ticketList.length === 0 ? (
            <p className="no-data">No hay tickets registrados. Crea uno con el botón «Crear Ticket».</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Asignado a</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ticketList.map(ticket => (
                  <tr key={ticket.id} onClick={() => fetchTicketDetails(ticket.id)} style={{ cursor: 'pointer' }}>
                    <td><strong>{ticket.ticket_number}</strong></td>
                    <td>{ticket.title}</td>
                    <td>{ticket.client_name || '-'}</td>
                    <td>
                      <span className={`badge priority-${ticket.priority}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge status-${ticket.status}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>{ticket.assigned_to_username || '-'}</td>
                    <td>{formatLocalDate(ticket.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-small" onClick={() => fetchTicketDetails(ticket.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedTicket && (
          <div className="ticket-details">
            <div className="ticket-details-header">
              <h2>{selectedTicket.ticket_number}</h2>
              <button className="btn-small" onClick={() => setSelectedTicket(null)}>
                Cerrar
              </button>
            </div>
            <div className="ticket-info">
              <p><strong>Título:</strong> {selectedTicket.title}</p>
              <p><strong>Cliente:</strong> {selectedTicket.client_name || '-'}</p>
              <p><strong>Estado:</strong> {selectedTicket.status}</p>
              <p><strong>Prioridad:</strong> {selectedTicket.priority}</p>
              <p><strong>Asignado a:</strong> {selectedTicket.assigned_to_username || '-'}</p>
              <p><strong>Descripción:</strong></p>
              <p>{selectedTicket.description || '-'}</p>
            </div>
            <div className="ticket-actions">
              <select
                value={selectedTicket.status}
                onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
              >
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
                <option value="rechazado">Rechazado</option>
                <option value="cerrado">Cerrado</option>
              </select>
              {(selectedTicket.status === 'abierto' || selectedTicket.status === 'en_proceso') && (
                <button
                  className="btn-reject"
                  onClick={() => setShowRejectModal(true)}
                  title="Rechazar (ej: cambio de paquete no disponible en zona)"
                >
                  Rechazar
                </button>
              )}
              <button className="btn-danger" onClick={() => handleDelete(selectedTicket.id)}>
                Eliminar
              </button>
            </div>
            {showRejectModal && (
              <div className="modal-overlay" onClick={() => !rejecting && setShowRejectModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3>Rechazar solicitud</h3>
                  <p>Indica el motivo del rechazo. El cliente verá este mensaje en los comentarios del ticket.</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ej: Este paquete no está disponible en tu zona de cobertura..."
                    rows="4"
                    disabled={rejecting}
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                      disabled={rejecting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleReject(selectedTicket.id)}
                      disabled={rejecting || !rejectReason.trim()}
                    >
                      {rejecting ? 'Rechazando...' : 'Rechazar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="comments-section">
              <h3>Comentarios</h3>
              {selectedTicket.comments && selectedTicket.comments.map(comment => (
                <div key={comment.id} className="comment">
                  <p><strong>{comment.user_username}:</strong> {comment.comment}</p>
                  <small>{formatLocalDate(comment.created_at)}</small>
                </div>
              ))}
              <div className="add-comment">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Agregar comentario..."
                  rows="3"
                />
                <button className="btn-primary" onClick={() => handleAddComment(selectedTicket.id)}>
                  Agregar Comentario
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default Tickets;











