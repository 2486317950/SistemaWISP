import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import ClientForm from '../components/ClientForm';
import './Clients.css';

const PAGE_SIZE = 50;

const Clients = () => {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const { canUpdate, canDelete } = useAuth();
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [page, setPage] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [usePagination, setUsePagination] = useState(true);

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchPackages();
    fetchNetworks();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchClients();
  }, [page, searchTerm, statusFilter]);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribe = subscribe('clients', (event, data) => {
      console.log('Evento de cliente recibido:', event, data);
      // Recargar clientes cuando hay cambios
      fetchClients();
    });

    return unsubscribe;
  }, [subscribe]);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const fetchClients = async () => {
    setLoadError(null);
    try {
      const params = {};
      if (usePagination) {
        params.page = page;
        params.limit = PAGE_SIZE;
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (statusFilter && ['baja', 'activo', 'suspendido'].includes(statusFilter)) params.status = statusFilter;
      }
      const response = await api.get('/clients', { params });
      const data = response.data;
      if (data && typeof data === 'object' && Array.isArray(data.clients)) {
        setClients(data.clients);
        setTotalClients(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setClients(Array.isArray(data) ? data : []);
        setTotalClients(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      setLoadError(error.response?.data?.error || 'Error al cargar la lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await api.get('/packages?active_only=true');
      setPackages(response.data);
    } catch (error) {
      console.error('Error al cargar paquetes:', error);
    }
  };

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (!window.confirm('¿Eliminar este cliente y todos sus datos relacionados (pagos, instalaciones, etc.)?')) return;
    setDeletingId(id);
    try {
      const response = await api.delete(`/clients/${id}`);
      setLoadError(null);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al eliminar el cliente';
      setLoadError(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingClient(null);
    fetchClients();
  };

  const filteredClients = clients.filter(client => {
    const matchesNetwork = selectedNetwork === null || client.network_type === selectedNetwork;
    return matchesNetwork;
  });

  if (loading && clients.length === 0) {
    return <div className="loading">Cargando clientes...</div>;
  }

  return (
    <div className="clients-page">
      <div className="page-header">
        <div className="page-header-title-block">
          <h1>
            {statusFilter === 'baja'
              ? 'Clientes dados de baja'
              : statusFilter === 'suspendido'
                ? 'Clientes suspendidos'
                : 'Clientes'}
          </h1>
          {!statusFilter && (
            <p className="clients-page-subtitle">En servicio (activos, suspendidos y sin estado). Los dados de baja están en su propia pestaña.</p>
          )}
          {statusFilter === 'suspendido' && (
            <p className="clients-page-subtitle">Filtra solo estado suspendido (la vista «En servicio» muestra también activos).</p>
          )}
          {statusFilter === 'baja' && (
            <p className="clients-page-subtitle">Historial conservado; no aparecen en la lista principal de clientes en servicio.</p>
          )}
        </div>
        <div className="page-header-actions">
          <Link to="/sistema/clients/portal-last-access" className="btn-secondary">
            Último acceso (Portal)
          </Link>
          {statusFilter !== 'baja' && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Agregar Cliente
            </button>
          )}
        </div>
      </div>

      <nav className="clients-view-tabs" aria-label="Vistas de clientes">
        <Link
          to="/sistema/clients"
          className={`clients-view-tab ${!statusFilter ? 'active' : ''}`}
        >
          En servicio
        </Link>
        <Link
          to="/sistema/clients?status=suspendido"
          className={`clients-view-tab ${statusFilter === 'suspendido' ? 'active' : ''}`}
        >
          Solo suspendidos
        </Link>
        <Link
          to="/sistema/clients?status=baja"
          className={`clients-view-tab clients-view-tab-baja ${statusFilter === 'baja' ? 'active' : ''}`}
        >
          Dados de baja
        </Link>
      </nav>

      {loadError && (
        <div className="error-message-banner">
          {loadError}
          <button type="button" className="btn-dismiss-error" onClick={() => setLoadError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {showForm && (
        <ClientForm
          client={editingClient}
          packages={packages}
          onClose={() => {
            setShowForm(false);
            setEditingClient(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar por nombre, domicilio o número..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <div className="network-filters">
          <button
            className={`network-filter-btn ${selectedNetwork === null ? 'active' : ''}`}
            onClick={() => setSelectedNetwork(null)}
          >
            📡 Todas las Redes
          </button>
          {networks.map((network) => (
            <button
              key={network.id}
              className={`network-filter-btn ${selectedNetwork === network.name ? 'active' : ''}`}
              onClick={() => setSelectedNetwork(network.name)}
            >
              {network.name}
            </button>
          ))}
        </div>
      </div>

      <div className="clients-grid">
        {filteredClients.map((client) => (
          <div key={client.id} className="client-card">
            <div className="client-header">
              <div className="client-title-section">
                <h3>{client.name}</h3>
                {(client.client_number || client.network_type) && (
                  <div className="client-badges">
                    {client.client_number && (
                      <span className="client-number-badge">#{client.client_number}</span>
                    )}
                    {client.network_type && (
                      <span className="network-type-badge">{client.network_type}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="client-actions">
                {canUpdate && (
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setEditingClient(client);
                      setShowForm(true);
                    }}
                    title="Editar"
                  >
                    ✏️
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn-icon"
                    onClick={() => handleDelete(client.id)}
                    title="Eliminar"
                    aria-label="Eliminar cliente"
                    disabled={deletingId === client.id}
                  >
                    {deletingId === client.id ? '⏳' : '🗑️'}
                  </button>
                )}
              </div>
            </div>
            <div className="client-info">
              {client.client_number && (
                <p><strong>🔢 Número de Cliente:</strong> {client.client_number}</p>
              )}
              <p><strong>📍 Domicilio:</strong> {client.address}</p>
              {client.phone && (
                <p>
                  <strong>📞 Teléfono:</strong> {client.phone}
                  <a
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link"
                    title="Abrir WhatsApp"
                  >
                    💬 WhatsApp
                  </a>
                </p>
              )}
              {client.email && <p><strong>📧 Email:</strong> {client.email}</p>}
              {client.network_type && (
                <p><strong>📡 Tipo de Red:</strong> {client.network_type}</p>
              )}
              {client.package_name && (
                <p><strong>📦 Paquete:</strong> {client.package_name} ({client.speed})</p>
              )}
              {(client.app_version_name || client.app_version_code) && (
                <p><strong>📱 App:</strong> v{client.app_version_name || client.app_version_code}</p>
              )}
              {client.notes && (
                <p><strong>📝 Notas:</strong> {client.notes}</p>
              )}
            </div>
            <Link to={`/sistema/clients/${client.id}`} className="btn-view">
              Ver Detalles →
            </Link>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && !loading && (
        <div className="empty-state">
          <p>No se encontraron clientes</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span className="pagination-info">
            Página {page} de {totalPages} ({(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalClients)} de {totalClients})
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
};

export default Clients;

