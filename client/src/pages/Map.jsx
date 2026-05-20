import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Map.css';

// Fix para los iconos de Leaflet en producción
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Leaflet admite SVG en data URL; no usar btoa() con Unicode (emojis) — revienta y deja MapWrapper colgado.
const svgUtf8DataUrl = (svg) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());

// Icono personalizado para antenas
const antennaIcon = new L.Icon({
  iconUrl: svgUtf8DataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="11" fill="#e74c3c" stroke="white" stroke-width="2"/>
      <text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-weight="bold">📡</text>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Icono personalizado para clientes
const clientIcon = new L.Icon({
  iconUrl: svgUtf8DataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
      <circle cx="12" cy="12" r="11" fill="#3498db" stroke="white" stroke-width="2"/>
      <text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-weight="bold">👤</text>
    </svg>
  `),
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28]
});

const clientIconSelected = new L.Icon({
  iconUrl: svgUtf8DataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="40" height="40">
      <circle cx="14" cy="14" r="13" fill="#2980b9" stroke="#d35400" stroke-width="3"/>
      <circle cx="14" cy="14" r="10" fill="#3498db" stroke="white" stroke-width="1"/>
      <text x="14" y="19" text-anchor="middle" fill="white" font-size="16" font-weight="bold">👤</text>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

/**
 * Cliente georreferenciado: halo + marcador destacado + popup abierto si se eligió desde la lista.
 */
function ClientMapMarker({ client, isSelected, onMarkerClick }) {
  const markerRef = useRef(null);
  const la = parseFloat(client.latitude);
  const lng = parseFloat(client.longitude);
  const position = [la, lng];

  useEffect(() => {
    if (!isSelected) return;
    const le = markerRef.current;
    const open = () => {
      try {
        if (le && typeof le.openPopup === 'function') le.openPopup();
      } catch (_) {
        /* ignore */
      }
    };
    const t = window.setTimeout(open, 480);
    return () => window.clearTimeout(t);
  }, [isSelected, client.id, client.latitude, client.longitude]);

  return (
    <>
      {isSelected && (
        <Circle
          center={position}
          radius={75}
          pathOptions={{
            color: '#d35400',
            fillColor: '#f39c12',
            fillOpacity: 0.14,
            weight: 3,
            opacity: 1,
            className: 'map-client-selected-halo',
          }}
          interactive={false}
        />
      )}
      <Marker
        ref={markerRef}
        position={position}
        icon={isSelected ? clientIconSelected : clientIcon}
        zIndexOffset={isSelected ? 2000 : 0}
        eventHandlers={{
          click: () => onMarkerClick(client),
        }}
      >
        <Popup>
          <div className="popup-content">
            <h4>👤 {client.name}</h4>
            {isSelected ? (
              <p className="map-popup-selected-flag" role="status">
                <strong>Seleccionado en la lista</strong>
              </p>
            ) : null}
            <p>
              <strong>Número:</strong> #{client.client_number}
            </p>
            <p>
              <strong>Red:</strong> {client.network_type || 'Sin red'}
            </p>
            <p>
              <strong>Dirección:</strong> {client.address}
            </p>
            {client.phone && (
              <p>
                <strong>Teléfono:</strong> {client.phone}
              </p>
            )}
            {client.package_name && (
              <p>
                <strong>Paquete:</strong> {client.package_name}
              </p>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// Componente para ajustar el centro del mapa
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

/** Primera apertura: centrar/acercar en todas las antenas con coordenadas (evita iniciar en CDMX si hay infraestructura). */
function FitMapToAntennasOnLoad({ antennasFetchDone, antennas, onSyncedView }) {
  const map = useMap();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!antennasFetchDone || ranRef.current) return;

    const pts = antennas
      .map((a) => [parseFloat(a.latitude), parseFloat(a.longitude)])
      .filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln))
      .map(([la, ln]) => L.latLng(la, ln));

    ranRef.current = true;
    if (pts.length === 0) return;

    const apply = () => {
      map.invalidateSize();
      if (pts.length === 1) {
        map.setView(pts[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 15 });
      }
      const c = map.getCenter();
      onSyncedView({ center: [c.lat, c.lng], zoom: map.getZoom() });
    };

    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(apply);
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2 != null) cancelAnimationFrame(id2);
    };
  }, [antennasFetchDone, antennas, map, onSyncedView]);

  return null;
}

// Componente para dibujar sector de cobertura
function CoverageWedge({ antenna, color }) {
  const map = useMap();
  
  useEffect(() => {
    if (!antenna.latitude || !antenna.longitude) return;
    
    const center = [parseFloat(antenna.latitude), parseFloat(antenna.longitude)];
    const range = parseFloat(antenna.range) * 1000; // Convertir km a metros
    const azimuth = parseFloat(antenna.azimuth);
    const aperture = parseFloat(antenna.aperture);
    
    // Calcular los puntos del sector
    const startAngle = azimuth - aperture / 2;
    const endAngle = azimuth + aperture / 2;
    
    const points = [center];
    const numPoints = Math.max(20, Math.ceil(aperture / 5));
    
    for (let i = 0; i <= numPoints; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
      const rad = (angle * Math.PI) / 180;
      
      const lat = center[0] + (range / 111320) * Math.cos(rad);
      const lng = center[1] + (range / (111320 * Math.cos(center[0] * Math.PI / 180))) * Math.sin(rad);
      
      points.push([lat, lng]);
    }
    
    points.push(center);
    
    const polygon = L.polygon(points, {
      color: color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2
    }).addTo(map);
    
    return () => {
      map.removeLayer(polygon);
    };
  }, [antenna, color, map]);
  
  return null;
}

/**
 * Sector de cobertura usando relieve ( servidor + OpenTopoData SRTM ).
 * Aproximación por línea de vista; no incluye difracción ni Fresnel exacto.
 */
function TerrainLosPolygon({ antenna, color }) {
  const map = useMap();

  useEffect(() => {
    let polygon = null;
    let cancelled = false;

    const run = async () => {
      if (!antenna?.latitude || !antenna?.longitude) return;
      try {
        const res = await api.post('/terrain/antenna-sector', {
          antenna,
          use_terrain: true
        });
        if (cancelled || !map) return;
        const pts = res.data?.points;
        if (!Array.isArray(pts) || pts.length < 4) return;
        polygon = L.polygon(pts, {
          color,
          fillColor: color,
          fillOpacity: 0.22,
          weight: 2
        });
        polygon.addTo(map);
      } catch (err) {
        console.warn('Cobertura relieve:', err?.message || err);
      }
    };

    const t = window.setTimeout(run, Math.min(1200, Math.max(0, (Number(antenna.id) || 0) % 5) * 140));
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (polygon && map) map.removeLayer(polygon);
    };
  }, [
    map,
    color,
    antenna?.id,
    antenna?.latitude,
    antenna?.longitude,
    antenna?.range,
    antenna?.azimuth,
    antenna?.aperture,
    antenna?.mast_height_m,
    antenna?.site_elevation_m
  ]);

  return null;
}

/** Clic en el mapa para tomar coordenadas (modo ubicación activo). */
function MapPlacementClickHandler({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      onPick({ lat, lng });
    }
  });
  return null;
}

function PlacementChoiceModal({ coords, onClose, onPickAntenna, onPickClient }) {
  const latFixed = coords.lat.toFixed(6);
  const lngFixed = coords.lng.toFixed(6);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>¿Qué quieres ubicar aquí?</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p style={{ color: '#555', marginBottom: 16 }}>
          Coordenadas: <strong>{latFixed}</strong>, <strong>{lngFixed}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="btn-primary" onClick={onPickAntenna}>
            Antena proveedora (torre)
          </button>
          <button type="button" className="btn-primary" style={{ background: '#2980b9' }} onClick={onPickClient}>
            Ubicación de un cliente
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientCoordsPickerModal({ clients, coords, filterNetwork, onClose, onSuccess = () => {}, toastFn }) {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);

  const list = useMemo(() => {
    const rows = Array.isArray(clients) ? clients : [];
    const t = q.trim().toLowerCase();
    let filtered = rows;
    if (filterNetwork && filterNetwork !== 'all') {
      filtered = filtered.filter((c) => c.network_type === filterNetwork);
    }
    if (t.length > 0) {
      filtered = filtered.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const num = String(c.client_number || '').toLowerCase();
        const addr = (c.address || '').toLowerCase();
        return name.includes(t) || num.includes(t) || addr.includes(t);
      });
    }
    const sorted = [...filtered].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
    );
    return sorted.slice(0, 200);
  }, [clients, q, filterNetwork]);

  const submit = async () => {
    const id = selectedId ? parseInt(selectedId, 10) : NaN;
    if (!Number.isFinite(id)) {
      toastFn.error('Selecciona un cliente');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/clients/${id}/map-location`, {
        latitude: coords.lat,
        longitude: coords.lng
      });
      toastFn.success('Ubicación del cliente guardada');
      onSuccess();
      onClose();
    } catch (err) {
      toastFn.error(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const latFixed = coords.lat.toFixed(6);
  const lngFixed = coords.lng.toFixed(6);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cliente en el mapa</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p style={{ color: '#555', fontSize: 14 }}>
          Coordenadas: <strong>{latFixed}</strong>, <strong>{lngFixed}</strong>
        </p>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Buscar cliente
        </label>
        <input
          type="search"
          className="modal-search-input"
          placeholder="Nombre, número o domicilio…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box'
          }}
          autoComplete="off"
        />
        <select
          size={10}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            width: '100%',
            flex: 1,
            minHeight: 220,
            marginBottom: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 8,
            boxSizing: 'border-box'
          }}
        >
          <option value="">— Elige un cliente —</option>
          {list.map((c) => (
            <option key={c.id} value={String(c.id)}>
              #{c.client_number ?? '—'} {c.name ?? ''}
              {c.latitude && c.longitude ? ' (ya tiene ubicación)' : ''}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          {list.length >= 200 ? 'Mostrando 200 coincidencias como máximo. Refina la búsqueda.' :
            `${list.length} cliente(s) en la lista`}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar ubicación'}
          </button>
        </div>
      </div>
    </div>
  );
}

const Map = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [antennas, setAntennas] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Evita aplicar vista a antenas antes de que llegue GET /antennas */
  const [antennasFetchDone, setAntennasFetchDone] = useState(false);
  const [showAntennaForm, setShowAntennaForm] = useState(false);
  const [editingAntenna, setEditingAntenna] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAntenna, setSelectedAntenna] = useState(null);
  // Centro por defecto (solo si no hay antenas con coordenadas)
  const [mapCenter, setMapCenter] = useState([19.4326, -99.1332]);
  const [mapZoom, setMapZoom] = useState(13);
  const [showClients, setShowClients] = useState(true);
  const [showAntennas, setShowAntennas] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  /** Cobertura con relieve + línea de vista (requiere que el servidor llegue a OpenTopoData) */
  const [coverageUseTerrain, setCoverageUseTerrain] = useState(true);
  const [showCableRoutes, setShowCableRoutes] = useState(true);
  const [cableRoutes, setCableRoutes] = useState([]);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [networks, setNetworks] = useState([]);
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [currentRoutePoints, setCurrentRoutePoints] = useState([]);
  const [showRouteForm, setShowRouteForm] = useState(false);

  /** Activa clic en mapa para abrir modal antena/cliente */
  const [pickOnMapPlacement, setPickOnMapPlacement] = useState(false);
  const [placementChoiceCoords, setPlacementChoiceCoords] = useState(null);
  const [coordsForClientPick, setCoordsForClientPick] = useState(null);
  /** Coordenadas iniciales al registrar antena desde el mapa */
  const [antennaMapPrefill, setAntennaMapPrefill] = useState(null);

  useEffect(() => {
    fetchClients();
    fetchAntennas();
    fetchNetworks();
    fetchCableRoutes();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      const rows = response.data;
      setClients(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAntennas = async () => {
    try {
      const response = await api.get('/antennas');
      const rows = response.data;
      setAntennas(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error al cargar antenas:', error);
    } finally {
      setAntennasFetchDone(true);
    }
  };

  const syncViewFromAntennasFit = useCallback(({ center, zoom }) => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      const rows = response.data;
      setNetworks(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const fetchCableRoutes = async () => {
    try {
      const response = await api.get('/cable-routes');
      const rows = response.data;
      setCableRoutes(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error al cargar rutas de cable:', error);
    }
  };

  const handleMapPlacementPick = useCallback(({ lat, lng }) => {
    setPlacementChoiceCoords({ lat, lng });
  }, []);

  const placementClickEnabled =
    pickOnMapPlacement &&
    !placementChoiceCoords &&
    coordsForClientPick == null &&
    !showAntennaForm &&
    !showRouteForm;

  const handleAddAntenna = () => {
    setAntennaMapPrefill(null);
    setEditingAntenna(null);
    setShowAntennaForm(true);
  };

  const handleEditAntenna = (antenna) => {
    setAntennaMapPrefill(null);
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
    setAntennaMapPrefill(null);
    fetchAntennas();
  };

  const handleRouteFormSuccess = () => {
    setShowRouteForm(false);
    setCurrentRoutePoints([]);
    fetchCableRoutes();
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

  const handleClientClick = async (client) => {
    setSelectedClient(client);
    setSelectedAntenna(null);

    const lat0 = parseFloat(client.latitude);
    const lng0 = parseFloat(client.longitude);
    if (Number.isFinite(lat0) && Number.isFinite(lng0)) {
      setMapCenter([lat0, lng0]);
      setMapZoom(16);
      return;
    }

    const addr = (client.address || '').trim();
    if (!addr) {
      toast.error('Este cliente no tiene domicilio: no se puede buscar ubicación.');
      return;
    }

    try {
      toast.info('Buscando ubicación desde el domicilio (OpenStreetMap)…');
      const res = await api.post(`/clients/${client.id}/geocode-location`, {});
      if (res.data?.skipped) {
        const la = parseFloat(res.data.latitude);
        const ln = parseFloat(res.data.longitude);
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          setMapCenter([la, ln]);
          setMapZoom(16);
        }
        return;
      }
      const la = parseFloat(res.data.latitude);
      const ln = parseFloat(res.data.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        toast.error('No se pudieron interpretar las coordenadas.');
        return;
      }
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, latitude: la, longitude: ln } : c))
      );
      setSelectedClient((prev) =>
        prev && prev.id === client.id ? { ...prev, latitude: la, longitude: ln } : prev
      );
      setMapCenter([la, ln]);
      setMapZoom(16);
      toast.success(res.data.display_name ? 'Ubicación encontrada y guardada' : 'Ubicación guardada');
    } catch (err) {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'No se pudo ubicar el domicilio. Revísalo o márcalo en el mapa.');
    }
  };

  const handleAntennaClick = (antenna) => {
    setSelectedAntenna(antenna);
    setSelectedClient(null);
    if (antenna.latitude && antenna.longitude) {
      setMapCenter([parseFloat(antenna.latitude), parseFloat(antenna.longitude)]);
      setMapZoom(15);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (filterNetwork === 'all') return true;
      return client.network_type === filterNetwork;
    });
  }, [clients, filterNetwork]);

  // Clientes con ubicación válida para el mapa
  const clientsWithLocation = useMemo(() => {
    return filteredClients.filter(
      (c) =>
        Number.isFinite(parseFloat(c.latitude)) && Number.isFinite(parseFloat(c.longitude))
    );
  }, [filteredClients]);

  // Colores por red
  const networkColors = {
    'Red Satelital': '#e74c3c',
    'Red ONT': '#3498db',
    'default': '#95a5a6'
  };

  const getNetworkColor = (networkType) => {
    return networkColors[networkType] || networkColors.default;
  };

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
            <label>
              <input
                type="checkbox"
                checked={showCoverage}
                onChange={(e) => setShowCoverage(e.target.checked)}
              />
              Mostrar Cobertura
            </label>
          </div>
          <div className="control-group" style={{ paddingLeft: 26 }}>
            <label style={{ opacity: showCoverage ? 1 : 0.55 }}>
              <input
                type="checkbox"
                checked={coverageUseTerrain}
                disabled={!showCoverage}
                onChange={(e) => setCoverageUseTerrain(e.target.checked)}
              />
              Modelar con relieve y altura (LOS aprox.)
            </label>
            <small style={{ display: 'block', marginTop: 4, marginLeft: 26, color: '#64748b', lineHeight: 1.35 }}>
              Usa DEM SRTM (~30 m) y altura de antena. El servidor debe tener salida HTTPS. Desactívalo para el sector plano clásico.
            </small>
          </div>
          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={showCableRoutes}
                onChange={(e) => setShowCableRoutes(e.target.checked)}
              />
              Mostrar Rutas de Cable (ONT)
            </label>
          </div>
          <div className="control-group">
            <label>Filtrar por Red:</label>
            <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)}>
              <option value="all">Todas las redes</option>
              {(Array.isArray(networks) ? networks : []).map(network => (
                <option key={network.id} value={network.name}>{network.name}</option>
              ))}
            </select>
          </div>
          <div className="control-group" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee' }}>
            <label>
              <input
                type="checkbox"
                checked={pickOnMapPlacement}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPickOnMapPlacement(on);
                  if (!on) {
                    setPlacementChoiceCoords(null);
                    setCoordsForClientPick(null);
                  }
                }}
              />
              Ubicar con clic en el mapa
            </label>
            <small style={{ display: 'block', marginTop: 6, color: '#64748b', lineHeight: 1.35 }}>
              Con esto activo, pulsa un punto vacío del mapa y elige si es <strong>antena proveedora</strong> o <strong>cliente</strong>.
            </small>
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
                <div
                  key={route.id}
                  className="route-item"
                >
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
                      {antenna.azimuth && <span>Azimut: {antenna.azimuth}°</span>}
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
                      {!Number.isFinite(parseFloat(client.latitude)) ||
                      !Number.isFinite(parseFloat(client.longitude)) ? (
                        <span className="no-location" title="Sin coordenadas: al pulsar intentamos ubicar por domicilio">
                          📍❌
                        </span>
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
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          className={`leaflet-map${placementClickEnabled ? ' map-placement-pick-active' : ''}`}
        >
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <FitMapToAntennasOnLoad
            antennasFetchDone={antennasFetchDone}
            antennas={antennas}
            onSyncedView={syncViewFromAntennasFit}
          />
          <MapPlacementClickHandler
            enabled={placementClickEnabled}
            onPick={handleMapPlacementPick}
          />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marcadores de antenas */}
          {showAntennas && antennas.map(antenna => {
            if (!antenna.latitude || !antenna.longitude) return null;
            
            const position = [parseFloat(antenna.latitude), parseFloat(antenna.longitude)];
            
            return (
              <React.Fragment key={`antenna-${antenna.id}`}>
                <Marker
                  position={position}
                  icon={antennaIcon}
                  eventHandlers={{
                    click: () => handleAntennaClick(antenna)
                  }}
                >
                  <Popup>
                    <div className="popup-content">
                      <h4>📡 {antenna.name}</h4>
                      <p><strong>Red:</strong> {antenna.network_type}</p>
                      <p><strong>Dirección:</strong> {antenna.address}</p>
                      <p><strong>Azimut:</strong> {antenna.azimuth}°</p>
                      <p><strong>Apertura:</strong> {antenna.aperture}°</p>
                      <p><strong>Alcance:</strong> {antenna.range} km</p>
                      {antenna.mast_height_m != null && antenna.mast_height_m !== '' && (
                        <p><strong>Altura equipo:</strong> {antenna.mast_height_m} m</p>
                      )}
                      {antenna.site_elevation_m != null && antenna.site_elevation_m !== '' && (
                        <p><strong>Cota sitio:</strong> {Number(antenna.site_elevation_m).toFixed(1)} m s.n.m.</p>
                      )}
                      {antenna.notes && <p><strong>Notas:</strong> {antenna.notes}</p>}
                    </div>
                  </Popup>
                </Marker>
                
                {/* Área de cobertura (plana o con relieve) */}
                {showCoverage && (
                  coverageUseTerrain ? (
                    <TerrainLosPolygon antenna={antenna} color={getNetworkColor(antenna.network_type)} />
                  ) : (
                    <CoverageWedge antenna={antenna} color={getNetworkColor(antenna.network_type)} />
                  )
                )}
              </React.Fragment>
            );
          })}

          {/* Marcadores de clientes */}
          {showClients &&
            clientsWithLocation.map((client) => (
              <ClientMapMarker
                key={`client-${client.id}`}
                client={client}
                isSelected={selectedClient?.id === client.id}
                onMarkerClick={handleClientClick}
              />
            ))}

          {/* Rutas de cable (ONT) */}
          {showCableRoutes && cableRoutes.map(route => {
            if (!route.points || route.points.length < 2) return null;
            
            const positions = route.points.map(p => [p.lat, p.lng]);
            const color = route.color || '#3498db';
            
            return (
              <Polyline
                key={`route-${route.id}`}
                positions={positions}
                color={color}
                weight={4}
                opacity={0.7}
              >
                <Popup>
                  <div className="popup-content">
                    <h4>🔌 {route.name}</h4>
                    <p><strong>Red:</strong> {route.network_type}</p>
                    {route.description && <p><strong>Descripción:</strong> {route.description}</p>}
                    <p><strong>Puntos:</strong> {route.points.length}</p>
                    <p><strong>Distancia:</strong> {route.distance?.toFixed(2)} km</p>
                  </div>
                </Popup>
              </Polyline>
            );
          })}
        </MapContainer>

        <div className="map-legend">
          <h4>Leyenda</h4>
          <div className="legend-item">
            <span className="legend-icon">📡</span>
            <span>Antenas Proveedoras</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon">👤</span>
            <span>Clientes</span>
          </div>
          {showCoverage && (
            <div className="legend-item">
              <span className="legend-icon">◔</span>
              <span>Área de Cobertura</span>
            </div>
          )}
          {showCableRoutes && cableRoutes.length > 0 && (
            <div className="legend-item">
              <span className="legend-icon">🔌</span>
              <span>Rutas de Cable (ONT)</span>
            </div>
          )}
        </div>
      </div>

      {placementChoiceCoords && (
        <PlacementChoiceModal
          coords={placementChoiceCoords}
          onClose={() => setPlacementChoiceCoords(null)}
          onPickAntenna={() => {
            const c = placementChoiceCoords;
            setPlacementChoiceCoords(null);
            setAntennaMapPrefill(c);
            setEditingAntenna(null);
            setShowAntennaForm(true);
          }}
          onPickClient={() => {
            const c = placementChoiceCoords;
            setPlacementChoiceCoords(null);
            setCoordsForClientPick(c);
          }}
        />
      )}

      {coordsForClientPick && (
        <ClientCoordsPickerModal
          clients={clients}
          coords={coordsForClientPick}
          filterNetwork={filterNetwork}
          onClose={() => setCoordsForClientPick(null)}
          onSuccess={() => {
            fetchClients();
          }}
          toastFn={toast}
        />
      )}

      {showAntennaForm && (
        <AntennaForm
          antenna={editingAntenna}
          networks={networks}
          prefillCoordinates={editingAntenna ? null : antennaMapPrefill}
          onClose={() => {
            setShowAntennaForm(false);
            setEditingAntenna(null);
            setAntennaMapPrefill(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {showRouteForm && (
        <CableRouteForm
          networks={networks}
          onClose={() => {
            setShowRouteForm(false);
            setCurrentRoutePoints([]);
          }}
          onSuccess={handleRouteFormSuccess}
        />
      )}
    </div>
  );
};

// Componente de formulario de antena
const emptyAntennaFormState = () => ({
  name: '',
  network_type: '',
  address: '',
  latitude: '',
  longitude: '',
  mast_height_m: '15',
  site_elevation_m: '',
  azimuth: '0',
  aperture: '60',
  range: '2',
  notes: ''
});

const AntennaForm = ({ antenna, networks, prefillCoordinates, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(emptyAntennaFormState);
  const [loading, setLoading] = useState(false);
  const [elevLoading, setElevLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (antenna) {
      setFormData({
        name: antenna.name || '',
        network_type: antenna.network_type || '',
        address: antenna.address || '',
        latitude: antenna.latitude != null && antenna.latitude !== '' ? String(antenna.latitude) : '',
        longitude: antenna.longitude != null && antenna.longitude !== '' ? String(antenna.longitude) : '',
        mast_height_m:
          antenna.mast_height_m != null && antenna.mast_height_m !== ''
            ? String(antenna.mast_height_m)
            : '15',
        site_elevation_m:
          antenna.site_elevation_m != null && antenna.site_elevation_m !== ''
            ? String(antenna.site_elevation_m)
            : '',
        azimuth: antenna.azimuth || '0',
        aperture: antenna.aperture || '60',
        range: antenna.range || '2',
        notes: antenna.notes || ''
      });
      return;
    }
    const next = emptyAntennaFormState();
    if (
      prefillCoordinates &&
      Number.isFinite(Number(prefillCoordinates.lat)) &&
      Number.isFinite(Number(prefillCoordinates.lng))
    ) {
      next.latitude = Number(prefillCoordinates.lat).toFixed(6);
      next.longitude = Number(prefillCoordinates.lng).toFixed(6);
    }
    setFormData(next);
  }, [antenna, prefillCoordinates]);

  const fetchSiteElevationFromApi = async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Indica latitud y longitud válidas primero.');
      return;
    }
    setElevLoading(true);
    try {
      const res = await api.get('/terrain/elevation', { params: { lat, lng } });
      const el = res.data?.elevation;
      if (!Number.isFinite(el)) {
        toast.error('Respuesta de relieve inválida');
        return;
      }
      setFormData((d) => ({
        ...d,
        site_elevation_m: String(Math.round(el * 10) / 10)
      }));
      toast.success('Cota del relieve cargada (SRTM ~30 m, aprox.)');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo consultar el relieve');
    } finally {
      setElevLoading(false);
    }
  };

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
              {(Array.isArray(networks) ? networks : []).map((network) => (
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
              <label>Altura equipo sobre el suelo (m) *</label>
              <input
                type="number"
                name="mast_height_m"
                value={formData.mast_height_m}
                onChange={handleChange}
                min="0.5"
                max="250"
                step="0.5"
                required
              />
              <small>Poste o torre; se suma al terreno para línea de vista con el relieve</small>
            </div>
            <div className="form-group">
              <label>Cota del sitio (m s.n.m.)</label>
              <input
                type="number"
                name="site_elevation_m"
                value={formData.site_elevation_m}
                onChange={handleChange}
                step="0.1"
                placeholder="Opcional — se infiere si queda vacío"
              />
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 8, width: '100%' }}
                onClick={fetchSiteElevationFromApi}
                disabled={elevLoading}
              >
                {elevLoading ? 'Consultando relieve…' : 'Rellenar cota desde relieve (SRTM)'}
              </button>
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

// Componente de formulario para rutas de cable
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
      // Parsear puntos desde el input
      const lines = formData.points_input.trim().split('\n');
      const points = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Formato esperado: lat, lng (ejemplo: 19.432608, -99.133209)
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
              placeholder={'Ingresa las coordenadas de la ruta, una por línea.\nFormato: latitud, longitud\n\nEjemplo:\n19.432608, -99.133209\n19.433012, -99.132845\n19.433456, -99.132501'}
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
