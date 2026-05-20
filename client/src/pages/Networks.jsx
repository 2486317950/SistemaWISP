import React, { useState, useEffect } from 'react';
import api from '../services/api';
import NetworkForm from '../components/NetworkForm';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './Networks.css';

const Networks = () => {
  const { canUpdate, canDelete } = useAuth();
  const { toast } = useToast();
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState(null);
  const [filterActive, setFilterActive] = useState(null);

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta red?')) return;
    try {
      await api.delete(`/networks/${id}`);
      fetchNetworks();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al eliminar la red';
      toast.error(errorMessage);
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingNetwork(null);
    fetchNetworks();
  };

  const filteredNetworks = networks.filter(network => {
    if (filterActive === null) return true;
    return filterActive ? network.is_active === 1 : network.is_active === 0;
  });

  if (loading) {
    return <div className="loading">Cargando redes...</div>;
  }

  return (
    <div className="networks-page">
      <div className="page-header">
        <h1>📡 Redes</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar Red
        </button>
      </div>

      {showForm && (
        <NetworkForm
          networkData={editingNetwork}
          onClose={() => {
            setShowForm(false);
            setEditingNetwork(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="filters-section">
        <div className="network-filters">
          <button
            className={`network-filter-btn ${filterActive === null ? 'active' : ''}`}
            onClick={() => setFilterActive(null)}
          >
            Todas
          </button>
          <button
            className={`network-filter-btn ${filterActive === true ? 'active' : ''}`}
            onClick={() => setFilterActive(true)}
          >
            Activas
          </button>
          <button
            className={`network-filter-btn ${filterActive === false ? 'active' : ''}`}
            onClick={() => setFilterActive(false)}
          >
            Inactivas
          </button>
        </div>
      </div>

      <div className="networks-grid">
        {filteredNetworks.map((network) => (
          <div key={network.id} className={`network-card ${network.is_active === 0 ? 'inactive' : ''}`}>
            <div className="network-header">
              <div className="network-title-section">
                <h3>{network.name}</h3>
                {network.is_active === 0 && (
                  <span className="inactive-badge">Inactiva</span>
                )}
              </div>
              <div className="network-actions">
                {canUpdate && (
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setEditingNetwork(network);
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
                    onClick={() => handleDelete(network.id)}
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
            <div className="network-info">
              {network.description && (
                <div className="network-description">
                  <p>{network.description}</p>
                </div>
              )}
              <div className="network-meta">
                {network.is_active === 1 && (
                  <span className="network-active-clients" style={{ fontWeight: 'bold', color: 'var(--primary, #667eea)' }}>
                    👥 Clientes activos: {network.active_clients ?? 0}
                  </span>
                )}
                <span className="network-status">
                  Estado: {network.is_active === 1 ? '✅ Activa' : '❌ Inactiva'}
                </span>
                {network.created_at && (
                  <span className="network-date">
                    Creada: {new Date(network.created_at).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredNetworks.length === 0 && (
        <div className="empty-state">
          <p>No hay redes registradas</p>
        </div>
      )}
    </div>
  );
};

export default Networks;



