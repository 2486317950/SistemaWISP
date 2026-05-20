import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const STATUS_LABELS = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  cerrado: 'Cerrado',
};

const ContactEntries = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/contact-entries', { params });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error al cargar entradas de contacto:', err);
      setError(err.response?.data?.error || 'Error al cargar las entradas de contacto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await api.put(`/contact-entries/${id}/status`, { status: newStatus });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
      );
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      toast.error(err.response?.data?.error || 'Error al actualizar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Entradas de formulario de la web</h1>
        <p className="page-subtitle">
          Mensajes que llegan desde el formulario de contacto de www.sistemacdcom.com
        </p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Total:</strong> {entries.length} entradas
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label htmlFor="statusFilter">Estado:</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="nuevo">Nuevos</option>
              <option value="en_proceso">En proceso</option>
              <option value="cerrado">Cerrados</option>
            </select>
            <button type="button" className="btn-secondary" onClick={loadEntries} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}

        {loading && entries.length === 0 ? (
          <p>Cargando entradas...</p>
        ) : entries.length === 0 ? (
          <p>No hay entradas de contacto registradas.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Mensaje</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.name}</td>
                    <td>
                      {entry.phone && <div>📞 {entry.phone}</div>}
                      {entry.email && <div>✉️ {entry.email}</div>}
                    </td>
                    <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{entry.message}</td>
                    <td>{STATUS_LABELS[entry.status] || entry.status}</td>
                    <td>
                      <select
                        value={entry.status}
                        onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                        disabled={updatingId === entry.id}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactEntries;

