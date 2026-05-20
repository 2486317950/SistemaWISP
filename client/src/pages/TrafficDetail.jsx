import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import './TrafficDetail.css';

const TrafficDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { canUpdate, canDelete } = useAuth();
  const [trafficData, setTrafficData] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchTrafficDetail();
    fetchClientInfo();
    
    // Auto-refresh si está habilitado
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchTrafficDetail();
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [clientId, autoRefresh, refreshInterval]);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribe = subscribe('traffic', (event, data) => {
      if (data && data.client_id === parseInt(clientId)) {
        fetchTrafficDetail();
      }
    });

    return unsubscribe;
  }, [subscribe, clientId]);

  const fetchTrafficDetail = async () => {
    try {
      const response = await api.get(`/traffic/client/${clientId}`);
      if (response.data && response.data.length > 0) {
        setTrafficData(response.data[0]); // Tomar el más reciente
      } else {
        setTrafficData(null);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar detalle de tráfico:', error);
      setLoading(false);
    }
  };

  const fetchClientInfo = async () => {
    try {
      const response = await api.get(`/clients/${clientId}`);
      setClientInfo(response.data);
    } catch (error) {
      console.error('Error al cargar información del cliente:', error);
    }
  };

  const formatSpeed = (speed) => {
    if (!speed) return 'N/A';
    if (speed >= 1000) {
      return `${(speed / 1000).toFixed(2)} Gbps`;
    }
    return `${speed.toFixed(2)} Mbps`;
  };

  const formatLatency = (latency) => {
    if (!latency) return 'N/A';
    return `${latency.toFixed(0)} ms`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'conectado':
        return '#27ae60';
      case 'desconectado':
        return '#e74c3c';
      case 'problema':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  const getLatencyQuality = (latency) => {
    if (!latency) return { quality: 'N/A', color: '#95a5a6' };
    if (latency < 50) return { quality: 'Excelente', color: '#27ae60' };
    if (latency < 100) return { quality: 'Buena', color: '#2ecc71' };
    if (latency < 200) return { quality: 'Aceptable', color: '#f39c12' };
    return { quality: 'Mala', color: '#e74c3c' };
  };

  const getPacketLossQuality = (packetLoss) => {
    if (!packetLoss) return { quality: 'N/A', color: '#95a5a6' };
    if (packetLoss < 0.1) return { quality: 'Excelente', color: '#27ae60' };
    if (packetLoss < 1) return { quality: 'Buena', color: '#2ecc71' };
    if (packetLoss < 3) return { quality: 'Aceptable', color: '#f39c12' };
    return { quality: 'Mala', color: '#e74c3c' };
  };

  const calculateUptime = () => {
    if (!trafficData || !trafficData.last_seen) return 'N/A';
    const lastSeen = new Date(trafficData.last_seen);
    const now = new Date();
    const diff = Math.floor((now - lastSeen) / 1000); // diferencia en segundos
    
    if (trafficData.connection_status === 'desconectado') {
      return 'Desconectado';
    }
    
    if (diff < 60) return `${diff} segundos`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} horas`;
    return `${Math.floor(diff / 86400)} días`;
  };

  if (loading) {
    return (
      <div className="traffic-detail-container">
        <div className="loading">Cargando métricas...</div>
      </div>
    );
  }

  if (!trafficData) {
    return (
      <div className="traffic-detail-container">
        <div className="header-actions">
          <button onClick={() => navigate('/traffic')} className="back-btn">
            ← Volver
          </button>
        </div>
        <div className="no-data-message">
          <h2>No hay datos de tráfico para este cliente</h2>
          <p>El cliente aún no tiene registros de monitoreo de tráfico.</p>
        </div>
      </div>
    );
  }

  const latencyQuality = getLatencyQuality(trafficData.latency);
  const packetLossQuality = getPacketLossQuality(trafficData.packet_loss);

  return (
    <div className="traffic-detail-container">
      <div className="header-actions">
        <button onClick={() => navigate('/traffic')} className="back-btn">
          ← Volver al Monitoreo
        </button>
        <div className="refresh-controls">
          <label className="auto-refresh-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-actualizar
          </label>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="refresh-interval-select"
            >
              <option value={10}>10 seg</option>
              <option value={30}>30 seg</option>
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
            </select>
          )}
          <button onClick={fetchTrafficDetail} className="refresh-btn">
            Actualizar
          </button>
        </div>
      </div>

      <div className="traffic-detail-header">
        <div className="client-header-info">
          <h1>{clientInfo?.name || trafficData.client_name || 'Cliente'}</h1>
          {clientInfo?.client_number && (
            <span className="client-number">#{clientInfo.client_number}</span>
          )}
          {clientInfo?.address && (
            <p className="client-address">{clientInfo.address}</p>
          )}
        </div>
        <div 
          className="status-indicator-large"
          style={{ backgroundColor: getStatusColor(trafficData.connection_status) }}
        >
          {trafficData.connection_status ? trafficData.connection_status.toUpperCase() : 'DESCONOCIDO'}
        </div>
      </div>

      <div className="metrics-grid">
        {/* Métricas de Velocidad */}
        <div className="metric-card speed-card">
          <div className="metric-header">
            <h3>Velocidad de Descarga</h3>
            <span className="metric-icon">⬇️</span>
          </div>
          <div className="metric-value-large">
            {formatSpeed(trafficData.download_speed)}
          </div>
          {trafficData.package_speed && (
            <div className="metric-comparison">
              Plan contratado: {trafficData.package_speed}
            </div>
          )}
        </div>

        <div className="metric-card speed-card">
          <div className="metric-header">
            <h3>Velocidad de Subida</h3>
            <span className="metric-icon">⬆️</span>
          </div>
          <div className="metric-value-large">
            {formatSpeed(trafficData.upload_speed)}
          </div>
        </div>

        {/* Métricas de Latencia */}
        <div className="metric-card latency-card">
          <div className="metric-header">
            <h3>Latencia</h3>
            <span className="metric-icon">⏱️</span>
          </div>
          <div className="metric-value-large">
            {formatLatency(trafficData.latency)}
          </div>
          <div 
            className="metric-quality"
            style={{ color: latencyQuality.color }}
          >
            {latencyQuality.quality}
          </div>
        </div>

        {/* Métricas de Pérdida de Paquetes */}
        <div className="metric-card packet-loss-card">
          <div className="metric-header">
            <h3>Pérdida de Paquetes</h3>
            <span className="metric-icon">📦</span>
          </div>
          <div className="metric-value-large">
            {trafficData.packet_loss ? `${trafficData.packet_loss.toFixed(2)}%` : 'N/A'}
          </div>
          <div 
            className="metric-quality"
            style={{ color: packetLossQuality.color }}
          >
            {packetLossQuality.quality}
          </div>
        </div>

        {/* Estadísticas de Paquetes */}
        <div className="metric-card packets-card">
          <div className="metric-header">
            <h3>Estadísticas de Paquetes</h3>
            <span className="metric-icon">📊</span>
          </div>
          <div className="packets-stats">
            <div className="packet-stat-item">
              <span className="packet-stat-label">Enviados:</span>
              <span className="packet-stat-value">{trafficData.packets_sent || 0}</span>
            </div>
            <div className="packet-stat-item">
              <span className="packet-stat-label">Recibidos:</span>
              <span className="packet-stat-value success">{trafficData.packets_received || 0}</span>
            </div>
            <div className="packet-stat-item">
              <span className="packet-stat-label">Total:</span>
              <span className="packet-stat-value">{trafficData.packets_total || 0}</span>
            </div>
            {trafficData.packets_sent > 0 && (
              <div className="packet-stat-item">
                <span className="packet-stat-label">Tasa de Éxito:</span>
                <span className="packet-stat-value" style={{ 
                  color: ((trafficData.packets_received || 0) / trafficData.packets_sent * 100) >= 50 ? '#27ae60' : '#e74c3c' 
                }}>
                  {((trafficData.packets_received || 0) / trafficData.packets_sent * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Información de Conexión */}
        <div className="metric-card connection-card">
          <div className="metric-header">
            <h3>Información de Conexión</h3>
            <span className="metric-icon">🔌</span>
          </div>
          <div className="connection-details">
            <div className="connection-item">
              <span className="connection-label">IP Address:</span>
              <span className="connection-value">{trafficData.ip_address || 'N/A'}</span>
            </div>
            {trafficData.mac_address && (
              <div className="connection-item">
                <span className="connection-label">MAC Address:</span>
                <span className="connection-value">{trafficData.mac_address}</span>
              </div>
            )}
            {trafficData.device_type && (
              <div className="connection-item">
                <span className="connection-label">Tipo de Dispositivo:</span>
                <span className="connection-value">{trafficData.device_type}</span>
              </div>
            )}
            {trafficData.signal_strength !== null && (
              <div className="connection-item">
                <span className="connection-label">Fuerza de Señal:</span>
                <span className="connection-value">{trafficData.signal_strength} dBm</span>
              </div>
            )}
          </div>
        </div>

        {/* Tiempo de Actividad */}
        <div className="metric-card uptime-card">
          <div className="metric-header">
            <h3>Tiempo de Actividad</h3>
            <span className="metric-icon">⏰</span>
          </div>
          <div className="metric-value-large">
            {calculateUptime()}
          </div>
          <div className="metric-subtitle">
            Última vez visto: {formatDate(trafficData.last_seen)}
          </div>
        </div>

        {/* Información del Paquete */}
        {trafficData.package_name && (
          <div className="metric-card package-card">
            <div className="metric-header">
              <h3>Paquete Contratado</h3>
              <span className="metric-icon">📦</span>
            </div>
            <div className="package-details">
              <div className="package-name">{trafficData.package_name}</div>
              {trafficData.package_speed && (
                <div className="package-speed">Velocidad: {trafficData.package_speed}</div>
              )}
            </div>
          </div>
        )}

        {/* Información de Instalación */}
        {trafficData.installation_folio && (
          <div className="metric-card installation-card">
            <div className="metric-header">
              <h3>Instalación</h3>
              <span className="metric-icon">🔧</span>
            </div>
            <div className="installation-details">
              <div className="installation-folio">Folio: {trafficData.installation_folio}</div>
              {trafficData.installation_status && (
                <div className="installation-status">
                  Estado: {trafficData.installation_status}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notas */}
        {trafficData.notes && (
          <div className="metric-card notes-card">
            <div className="metric-header">
              <h3>Notas</h3>
              <span className="metric-icon">📝</span>
            </div>
            <div className="notes-content">
              {trafficData.notes}
            </div>
          </div>
        )}

        {/* Información de Actualización */}
        <div className="metric-card update-card">
          <div className="metric-header">
            <h3>Última Actualización</h3>
            <span className="metric-icon">🔄</span>
          </div>
          <div className="update-details">
            <div className="update-time">{formatDate(trafficData.updated_at)}</div>
            <div className="update-created">
              Registro creado: {formatDate(trafficData.created_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficDetail;

