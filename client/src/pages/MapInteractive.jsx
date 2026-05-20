import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Map.css';

const Map = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [antennas, setAntennas] = useState([]);
  const [cableRoutes, setCableRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAntennaForm, setShowAntennaForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingAntenna, setEditingAntenna] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAntenna, setSelectedAntenna] = useState(null);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [networks, setNetworks] = useState([]);
  const [mapCenter, setMapCenter] = useState({ lat: 19.4698, lng: -104.6492 }); // La Huerta, Jalisco
  
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const [isPlacingMarker, setIsPlacingMarker] = useState(false);
  const isPlacingMarkerRef = useRef(false);
  const tempMarkerRef = useRef(null);

  useEffect(() => {
    fetchClients();
    fetchAntennas();
    fetchNetworks();
    fetchCableRoutes();
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (googleMapRef.current && antennas.length > 0) {
      updateMarkers();
    }
  }, [antennas, clients]);

  const loadGoogleMapsScript = () => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDG5OxyMhEfGxn7qd4BIAGzVaU0bIrbGjw`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);
  };

  const initMap = () => {
    if (!mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 13,
      mapTypeId: 'roadmap'
    });

    // Agregar listener para clic en el mapa
    map.addListener('click', (event) => {
      if (isPlacingMarkerRef.current) {
        handleMapClick(event.latLng);
      }
    });

    googleMapRef.current = map;
    updateMarkers();
  };

  const handleMapClick = (latLng) => {
    const lat = latLng.lat();
    const lng = latLng.lng();

    // Limpiar marcador temporal anterior si existe
    if (tempMarkerRef.current) {
      tempMarkerRef.current.setMap(null);
    }

    // Crear marcador temporal
    const tempMarker = new window.google.maps.Marker({
      position: { lat, lng },
      map: googleMapRef.current,
      title: 'Nueva ubicación',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#f39c12',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      animation: window.google.maps.Animation.BOUNCE
    });

    tempMarkerRef.current = tempMarker;

    // Mostrar formulario con las coordenadas pre-llenadas
    setEditingAntenna({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    setShowAntennaForm(true);
    setIsPlacingMarker(false);
  };

  const updateMarkers = () => {
    if (!googleMapRef.current) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Agregar marcadores de antenas
    antennas.forEach(antenna => {
      if (!antenna.latitude || !antenna.longitude) return;

      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(antenna.latitude), lng: parseFloat(antenna.longitude) },
        map: googleMapRef.current,
        title: antenna.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#e74c3c',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 10px 0;">📡 ${antenna.name}</h3>
            <p><strong>Red:</strong> ${antenna.network_type}</p>
            <p><strong>Dirección:</strong> ${antenna.address}</p>
            <p><strong>Azimut:</strong> ${antenna.azimuth}°</p>
            <p><strong>Apertura:</strong> ${antenna.aperture}°</p>
            <p><strong>Alcance:</strong> ${antenna.range} km</p>
            ${antenna.notes ? `<p><strong>Notas:</strong> ${antenna.notes}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);

      // Dibujar sector de cobertura
      if (antenna.azimuth !== null && antenna.aperture && antenna.range) {
        drawCoverageSector(antenna);
      }
    });

    // Agregar marcadores de clientes
    clientsWithLocation.forEach(client => {
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(client.latitude), lng: parseFloat(client.longitude) },
        map: googleMapRef.current,
        title: client.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3498db',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px;">
            <h3 style="margin: 0 0 10px 0;">👤 ${client.name}</h3>
            <p><strong>Número:</strong> #${client.client_number}</p>
            <p><strong>Red:</strong> ${client.network_type || 'Sin red'}</p>
            <p><strong>Dirección:</strong> ${client.address}</p>
            ${client.phone ? `<p><strong>Teléfono:</strong> ${client.phone}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  };

  const drawCoverageSector = (antenna) => {
    if (!googleMapRef.current) return;

    const center = { lat: parseFloat(antenna.latitude), lng: parseFloat(antenna.longitude) };
    const radius = antenna.range * 1000; // Convertir km a metros
    const azimuth = parseFloat(antenna.azimuth);
    const aperture = parseFloat(antenna.aperture);

    // Calcular puntos del sector
    const startAngle = azimuth - aperture / 2;
    const endAngle = azimuth + aperture / 2;
    const points = [center];

    for (let angle = startAngle; angle <= endAngle; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const lat = center.lat + (radius / 111320) * Math.cos(rad);
      const lng = center.lng + (radius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(rad);
      points.push({ lat, lng });
    }
    points.push(center);

    const polygon = new window.google.maps.Polygon({
      paths: points,
      strokeColor: '#e74c3c',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#e74c3c',
      fillOpacity: 0.2,
      map: googleMapRef.current
    });

    markersRef.current.push(polygon);
  };

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

  const fetchCableRoutes = async () => {
    try {
      const response = await api.get('/cable-routes');
      setCableRoutes(response.data);
    } catch (error) {
      console.error('Error al cargar rutas de cable:', error);
    }
  };

  const handleAddAntenna = () => {
    setEditingAntenna(null);
    setShowAntennaForm(true);
  };

  const handleAddAntennaOnMap = () => {
    setIsPlacingMarker(true);
    isPlacingMarkerRef.current = true;
    setEditingAntenna(null);
    // Cambiar cursor del mapa
    if (googleMapRef.current) {
      googleMapRef.current.setOptions({ draggableCursor: 'crosshair' });
    }
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

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('¿Eliminar esta ruta de cable?')) return;
    try {
      await api.delete(`/cable-routes/${id}`);
      fetchCableRoutes();
    } catch (error) {
      toast.error('Error al eliminar la ruta de cable');
    }
  };

  const handleFormSuccess = () => {
    setShowAntennaForm(false);
    setEditingAntenna(null);
    setIsPlacingMarker(false);
    isPlacingMarkerRef.current = false;
    
    // Limpiar marcador temporal
    if (tempMarkerRef.current) {
      tempMarkerRef.current.setMap(null);
      tempMarkerRef.current = null;
    }
    
    // Restaurar cursor del mapa
    if (googleMapRef.current) {
      googleMapRef.current.setOptions({ draggableCursor: null });
    }
    
    fetchAntennas();
  };
  
  const handleFormClose = () => {
    setShowAntennaForm(false);
    setEditingAntenna(null);
    setIsPlacingMarker(false);
    isPlacingMarkerRef.current = false;
    
    // Limpiar marcador temporal
    if (tempMarkerRef.current) {
      tempMarkerRef.current.setMap(null);
      tempMarkerRef.current = null;
    }
    
    // Restaurar cursor del mapa
    if (googleMapRef.current) {
      googleMapRef.current.setOptions({ draggableCursor: null });
    }
  };

  const handleRouteFormSuccess = () => {
    setShowRouteForm(false);
    fetchCableRoutes();
  };

  const handleClientClick = (client) => {
    setSelectedClient(client);
    setSelectedAntenna(null);
    if (client.latitude && client.longitude && googleMapRef.current) {
      const pos = { lat: parseFloat(client.latitude), lng: parseFloat(client.longitude) };
      googleMapRef.current.panTo(pos);
      googleMapRef.current.setZoom(16);
    }
  };

  const handleAntennaClick = (antenna) => {
    setSelectedAntenna(antenna);
    setSelectedClient(null);
    if (antenna.latitude && antenna.longitude && googleMapRef.current) {
      const pos = { lat: parseFloat(antenna.latitude), lng: parseFloat(antenna.longitude) };
      googleMapRef.current.panTo(pos);
      googleMapRef.current.setZoom(16);
    }
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
            <label>Filtrar por Red:</label>
            <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)}>
              <option value="all">Todas las redes</option>
              {networks.map(network => (
                <option key={network.id} value={network.name}>{network.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="cable-routes-section">
          <div className="section-header">
            <h3>Rutas de Cable (ONT)</h3>
            <button onClick={() => setShowRouteForm(true)} className="btn-add-antenna">
              ➕ Agregar Ruta
            </button>
          </div>
          <div className="routes-list">
            {cableRoutes.length === 0 ? (
              <p className="no-data">No hay rutas de cable registradas</p>
            ) : (
              cableRoutes.map(route => (
                <div key={route.id} className="route-item">
                  <div className="route-info">
                    <strong>{route.name}</strong>
                    <div className="route-details">
                      <span>{route.points_count} puntos</span>
                      {route.distance && <span>{route.distance.toFixed(2)} km</span>}
                    </div>
                    {route.description && <div className="route-description">{route.description}</div>}
                  </div>
                  <div className="route-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id); }} className="btn-delete-small">
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="antenas-section">
          <div className="section-header">
            <h3>Antenas Proveedoras</h3>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <button onClick={handleAddAntennaOnMap} className="btn-add-antenna" title="Haz clic en el mapa para colocar la antena">
                📍 Agregar en Mapa
              </button>
              <button onClick={handleAddAntenna} className="btn-add-antenna-alt" title="Agregar con coordenadas manualmente">
                ➕ Manual
              </button>
            </div>
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
          <h3>Clientes ({clientsWithLocation.length}/{filteredClients.length})</h3>
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
                        <span className="no-location">📍❌</span>
                      ) : (
                        <span className="has-location">📍✓</span>
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
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        
        {isPlacingMarker && (
          <div className="map-instruction-overlay">
            <div className="instruction-box">
              <h3>📍 Modo: Colocar Antena</h3>
              <p>Haz clic en el mapa donde quieres colocar la antena</p>
              <button onClick={() => {
                setIsPlacingMarker(false);
                isPlacingMarkerRef.current = false;
                if (googleMapRef.current) {
                  googleMapRef.current.setOptions({ draggableCursor: null });
                }
              }} className="btn-cancel">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="map-info-box">
          <p><strong>Clientes en mapa:</strong> {clientsWithLocation.length} de {filteredClients.length}</p>
          <p><strong>Antenas registradas:</strong> {antennas.length}</p>
          <p><strong>Rutas de cable:</strong> {cableRoutes.length}</p>
          <p className="help-text">💡 Haz clic en los marcadores para ver información</p>
          <p className="help-text">📡 Los sectores rojos muestran la cobertura de las antenas</p>
        </div>
      </div>

      {showAntennaForm && (
        <AntennaForm
          antenna={editingAntenna}
          networks={networks}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {showRouteForm && (
        <CableRouteForm
          networks={networks}
          onClose={() => setShowRouteForm(false)}
          onSuccess={handleRouteFormSuccess}
        />
      )}
    </div>
  );
};

// Componente de formulario de antena (igual que antes)
const AntennaForm = ({ antenna, networks, onClose, onSuccess }) => {
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
                placeholder="19.4698"
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
                placeholder="-104.6492"
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

// Componente de formulario para rutas de cable (igual que antes)
const CableRouteForm = ({ networks, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    network_type: 'Red ONT',
    description: '',
    color: '#3498db',
    points_input: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const lines = formData.points_input.trim().split('\n');
      const points = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const parts = trimmedLine.split(',').map(p => p.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push({ lat, lng });
          }
        }
      }
      
      if (points.length < 2) {
        setError('Debes ingresar al menos 2 puntos válidos (formato: lat, lng)');
        setLoading(false);
        return;
      }

      const dataToSend = {
        name: formData.name,
        description: formData.description,
        network_type: formData.network_type,
        color: formData.color,
        points: points
      };

      await api.post('/cable-routes', dataToSend);
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la ruta de cable');
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
          <h2>Dibujar Ruta de Cable</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre de la Ruta *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Cable Principal, Ruta Norte, etc."
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
              {networks.map((network) => (
                <option key={network.id} value={network.name}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descripción de la ruta (opcional)"
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <input
              type="color"
              name="color"
              value={formData.color}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Puntos de la Ruta *</label>
            <textarea
              name="points_input"
              value={formData.points_input}
              onChange={handleChange}
              rows="10"
              required
              placeholder={'Ingresa las coordenadas de la ruta, una por línea.\nFormato: latitud, longitud\n\nEjemplo:\n19.4698, -104.6492\n19.4705, -104.6485\n19.4712, -104.6478'}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
            <small style={{ display: 'block', marginTop: '5px' }}>
              💡 Cada línea debe tener: latitud, longitud<br/>
              📍 Puedes copiar coordenadas desde Google Maps haciendo clic derecho en el mapa
            </small>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Ruta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Map;


// Updated: 20251202204631
