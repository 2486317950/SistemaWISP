import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Map.css';

const Map = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [antennas, setAntennas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAntennaForm, setShowAntennaForm] = useState(false);
  const [editingAntenna, setEditingAntenna] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAntenna, setSelectedAntenna] = useState(null);
  const [showClients, setShowClients] = useState(true);
  const [showAntennas, setShowAntennas] = useState(true);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [networks, setNetworks] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchAntennas();
    fetchNetworks();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAntennas = async () => {
    try {
      const response = await api.get('/antennas');
      setAntennas(response.data);
    } catch (error) {
      console.error('Error al cargar antenas:', error);
    }
  };

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const handleAddAntenna = () => {
    setEditingAntenna(null);
    setShowAntennaForm(true);
  };

  const handleEditAntenna = (antenna) => {
    setEditingAntenna(antenna);
    setShowAntennaForm(true);
  };

  const handleDeleteAntenna = async (id) => {
    if (!window.confirm('¿Eliminar esta antena?')) return;
    try {
      await api.delete(`/antennas/${id}`);
      fetchAntennas();
    } catch (error) {
      toast.error('Error al eliminar la antena');
    }
  };

  const handleFormSuccess = () => {
    setShowAntennaForm(false);
    setEditingAntenna(null);
    fetchAntennas();
  };

  const handleClientClick = (client) => {
    setSelectedClient(client);
    setSelectedAntenna(null);
  };

  const handleAntennaClick = (antenna) => {
    setSelectedAntenna(antenna);
    setSelectedClient(null);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (filterNetwork === 'all') return true;
      return client.network_type === filterNetwork;
    });
  }, [clients, filterNetwork]);

  const clientsWithLocation = useMemo(() => {
    return filteredClients.filter(c => c.latitude && c.longitude);
  }, [filteredClients]);

  if (loading) {
    return <div className="loading">Cargando mapa...</div>;
  }

  return (
    <div className="map-page">
      <div className="map-sidebar">
        <div className="sidebar-header">
          <h1>🗺️ Mapa de Clientes y Cobertura</h1>
        </div>

        <div className="map-controls">
          <h3>Controles</h3>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={showClients}
                onChange={(e) => setShowClients(e.target.checked)}
              />
              Mostrar Clientes
            </label>
          </div>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={showAntennas}
                onChange={(e) => setShowAntennas(e.target.checked)}
              />
              Mostrar Antenas
            </label>
          </div>
          <div className="control-group">
            <label>Filtrar por Red:</label>
            <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)}>
              <option value="all">Todas las redes</option>
              {networks.map(network => (
                <option key={network.id} value={network.name}>{network.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="antenas-section">
          <div className="section-header">
            <h3>Antenas Proveedoras</h3>
            <button onClick={handleAddAntenna} className="btn-add-antenna">
              ➕ Agregar Antena
            </button>
          </div>
          <div className="antennas-list">
            {antennas.length === 0 ? (
              <p className="no-data">No hay antenas registradas</p>
            ) : (
              antennas.map(antenna => (
                <div
                  key={antenna.id}
                  className={`antenna-item ${selectedAntenna?.id === antenna.id ? 'selected' : ''}`}
                  onClick={() => handleAntennaClick(antenna)}
                >
                  <div className="antenna-info">
                    <strong>{antenna.name}</strong>
                    <div className="antenna-details">
                      <span>Red: {antenna.network_type}</span>
                      {antenna.azimuth !== null && <span>Azimut: {antenna.azimuth}°</span>}
                      {antenna.aperture && <span>Apertura: {antenna.aperture}°</span>}
                      {antenna.range && <span>Alcance: {antenna.range} km</span>}
                    </div>
                  </div>
                  <div className="antenna-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleEditAntenna(antenna); }} className="btn-edit-small">
                      ✏️
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteAntenna(antenna.id); }} className="btn-delete-small">
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="clients-section">
          <h3>Clientes ({clientsWithLocation.length} con ubicación / {filteredClients.length} total)</h3>
          <div className="clients-list">
            {filteredClients.length === 0 ? (
              <p className="no-data">No hay clientes para mostrar</p>
            ) : (
              filteredClients.slice(0, 50).map(client => (
                <div
                  key={client.id}
                  className={`client-item ${selectedClient?.id === client.id ? 'selected' : ''}`}
                  onClick={() => handleClientClick(client)}
                >
                  <div className="client-info">
                    <strong>{client.name}</strong>
                    <div className="client-details">
                      <span>#{client.client_number}</span>
                      {client.network_type && <span className="network-badge">{client.network_type}</span>}
                      {!client.latitude || !client.longitude ? (
                        <span className="no-location" title="Sin ubicación">📍❌</span>
                      ) : (
                        <span className="has-location" title="Con ubicación">📍✓</span>
                      )}
                    </div>
                    <div className="client-address">{client.address}</div>
                  </div>
                </div>
              ))
            )}
            {filteredClients.length > 50 && (
              <p className="info-text">Mostrando primeros 50 clientes. Usa los filtros para ver más.</p>
            )}
          </div>
        </div>
      </div>

      <div className="map-container-wrapper">
        <div className="map-placeholder-instruction">
          <div className="map-info">
            <h2>🗺️ Mapa Interactivo</h2>
            <div className="installation-steps">
              <h3>📋 Pasos para activar el mapa:</h3>
              <ol>
                <li>
                  <strong>Instalar Leaflet:</strong>
                  <p>Ejecuta en el directorio <code>client</code>:</p>
                  <code className="command-box">npm install leaflet react-leaflet</code>
                </li>
                <li>
                  <strong>Reinicia el servidor de desarrollo</strong>
                  <p>El mapa se cargará automáticamente</p>
                </li>
              </ol>
            </div>
            
            <div className="map-stats">
              <h3>📊 Estadísticas Actuales:</h3>
              <div className="stat">
                <strong>Clientes totales:</strong> {clients.length}
              </div>
              <div className="stat">
                <strong>Clientes con ubicación:</strong> {clientsWithLocation.length}
              </div>
              <div className="stat">
                <strong>Clientes sin ubicación:</strong> {clients.length - clientsWithLocation.length}
              </div>
              <div className="stat">
                <strong>Antenas registradas:</strong> {antennas.length}
              </div>
            </div>

            <div className="features-info">
              <h3>✨ Funcionalidades del Mapa:</h3>
              <ul>
                <li>📍 Pines para clientes y antenas</li>
                <li>📡 Visualización de sectores de cobertura con ángulo de apertura</li>
                <li>🎯 Dirección (azimut) y alcance de cada antena</li>
                <li>🎨 Colores diferentes por red</li>
                <li>🔍 Zoom y navegación interactiva</li>
                <li>💬 Popups con información detallada</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showAntennaForm && (
        <AntennaForm
          antenna={editingAntenna}
          networks={networks}
          onClose={() => {
            setShowAntennaForm(false);
            setEditingAntenna(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

// Componente de formulario de antena
const AntennaForm = ({ antenna, networks, onClose, onSuccess }) => {
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    network_type: '',
    address: '',
    latitude: '',
    longitude: '',
    azimuth: '0',
    aperture: '60',
    range: '2',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (antenna) {
      setFormData({
        name: antenna.name || '',
        network_type: antenna.network_type || '',
        address: antenna.address || '',
        latitude: antenna.latitude || '',
        longitude: antenna.longitude || '',
        azimuth: antenna.azimuth || '0',
        aperture: antenna.aperture || '60',
        range: antenna.range || '2',
        notes: antenna.notes || ''
      });
    }
  }, [antenna]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (antenna) {
        await api.put(`/antennas/${antenna.id}`, formData);
      } else {
        await api.post('/antennas', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la antena');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{antenna ? 'Editar Antena' : 'Registrar Antena'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre de la Antena *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Antena Principal, Torre Norte, etc."
            />
          </div>
          <div className="form-group">
            <label>Red *</label>
            <select
              name="network_type"
              value={formData.network_type}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar red</option>
              {networks.map((network) => (
                <option key={network.id} value={network.name}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Dirección *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="Dirección de la antena"
            />
            <small>Puedes buscar en Google Maps y copiar las coordenadas</small>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Latitud *</label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                step="0.000001"
                required
                placeholder="19.432608"
              />
            </div>
            <div className="form-group">
              <label>Longitud *</label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                step="0.000001"
                required
                placeholder="-99.133209"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Azimut (Dirección) *</label>
              <input
                type="number"
                name="azimuth"
                value={formData.azimuth}
                onChange={handleChange}
                min="0"
                max="360"
                step="1"
                required
                placeholder="0-360°"
              />
              <small>0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste</small>
            </div>
            <div className="form-group">
              <label>Apertura (Ángulo) *</label>
              <input
                type="number"
                name="aperture"
                value={formData.aperture}
                onChange={handleChange}
                min="1"
                max="360"
                step="1"
                required
                placeholder="30-120°"
              />
              <small>Ángulo de cobertura de la antena</small>
            </div>
          </div>
          <div className="form-group">
            <label>Alcance (km) *</label>
            <input
              type="number"
              name="range"
              value={formData.range}
              onChange={handleChange}
              min="0.1"
              step="0.1"
              required
              placeholder="2.5"
            />
            <small>Radio de cobertura en kilómetros</small>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Map;





