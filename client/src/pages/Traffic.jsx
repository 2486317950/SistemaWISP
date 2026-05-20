import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import './Traffic.css';

const Traffic = () => {
  const { canUpdate, canDelete } = useAuth();
  const [traffic, setTraffic] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = 10; // Fijado a 10 segundos

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchTraffic();
    fetchStats();
    
    // Auto-refresh si está habilitado
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchTraffic();
        fetchStats();
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribe = subscribe('traffic', (event, data) => {
      console.log('Evento de tráfico recibido:', event, data);
      fetchTraffic();
      fetchStats();
    });

    return unsubscribe;
  }, [subscribe]);

  const fetchTraffic = async () => {
    try {
      const response = await api.get('/traffic');
      setTraffic(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar tráfico:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/traffic/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
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

  const getStatusBadge = (status) => {
    const color = getStatusColor(status);
    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: color }}
      >
        {status ? status.toUpperCase() : 'DESCONOCIDO'}
      </span>
    );
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
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // diferencia en segundos
    
    if (diff < 60) return `Hace ${diff} segundos`;
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTraffic = traffic.filter(item => {
    const matchesSearch = 
      !searchTerm ||
      (item.client_name && item.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.client_number && item.client_number.toString().includes(searchTerm)) ||
      (item.ip_address && item.ip_address.includes(searchTerm)) ||
      (item.mac_address && item.mac_address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (item.connection_status && item.connection_status === statusFilter);
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="traffic-container">
        <div className="loading">Cargando tráfico...</div>
      </div>
    );
  }

  return (
    <div className="traffic-container">
      <div className="traffic-header">
        <h1>Monitoreo de Tráfico</h1>
        <div className="header-controls">
          <label className="auto-refresh-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-actualizar (10 seg)
          </label>
          <button onClick={() => { fetchTraffic(); fetchStats(); }} className="refresh-btn">
            Actualizar
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="traffic-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total_clients || 0}</div>
            <div className="stat-label">Total Clientes</div>
          </div>
          <div className="stat-card connected">
            <div className="stat-value">{stats.connected || 0}</div>
            <div className="stat-label">Conectados</div>
          </div>
          <div className="stat-card disconnected">
            <div className="stat-value">{stats.disconnected || 0}</div>
            <div className="stat-label">Desconectados</div>
          </div>
          <div className="stat-card problems">
            <div className="stat-value">{stats.problems || 0}</div>
            <div className="stat-label">Con Problemas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatSpeed(stats.avg_download)}</div>
            <div className="stat-label">Vel. Desc. Promedio</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatSpeed(stats.avg_upload)}</div>
            <div className="stat-label">Vel. Sub. Promedio</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatLatency(stats.avg_latency)}</div>
            <div className="stat-label">Latencia Promedio</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="traffic-filters">
        <input
          type="text"
          placeholder="Buscar por cliente, número, IP o MAC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="all">Todos los estados</option>
          <option value="conectado">Conectados</option>
          <option value="desconectado">Desconectados</option>
          <option value="problema">Con Problemas</option>
        </select>
      </div>

      {/* Tabla de tráfico */}
      <div className="traffic-table-container">
        <table className="traffic-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Velocidad Descarga</th>
              <th>Velocidad Subida</th>
              <th>Latencia</th>
              <th>Pérdida de Paquetes</th>
              <th>Paquetes</th>
              <th>IP</th>
              <th>Última Vez Visto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTraffic.length === 0 ? (
              <tr>
                <td colSpan="10" className="no-data">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No se encontraron registros con los filtros aplicados'
                    : 'No hay registros de tráfico'}
                </td>
              </tr>
            ) : (
              filteredTraffic.map((item) => (
                <tr key={item.id} className={item.connection_status === 'conectado' ? 'row-connected' : item.connection_status === 'problema' ? 'row-problem' : 'row-disconnected'}>
                  <td>
                    <div className="client-info">
                      {item.client_id ? (
                        <Link 
                          to={`/traffic/${item.client_id}`} 
                          className="client-link traffic-detail-link"
                          title="Ver métricas detalladas"
                        >
                          {item.client_name || 'Sin nombre'}
                          {item.client_number && ` (#${item.client_number})`}
                        </Link>
                      ) : (
                        <span>{item.client_name || 'Cliente no asignado'}</span>
                      )}
                      {item.installation_folio && (
                        <div className="installation-folio">
                          Inst: {item.installation_folio}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{getStatusBadge(item.connection_status)}</td>
                  <td>{formatSpeed(item.download_speed)}</td>
                  <td>{formatSpeed(item.upload_speed)}</td>
                  <td>{formatLatency(item.latency)}</td>
                  <td>{item.packet_loss ? `${item.packet_loss.toFixed(2)}%` : 'N/A'}</td>
                  <td>
                    {item.packets_sent || item.packets_received ? (
                      <div className="packets-info">
                        <span className="packets-sent">Enviados: {item.packets_sent || 0}</span>
                        <span className="packets-received">Recibidos: {item.packets_received || 0}</span>
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>{item.ip_address || 'N/A'}</td>
                  <td>{formatDate(item.last_seen)}</td>
                  <td>
                    {item.client_id && (
                      <Link 
                        to={`/sistema/clients/${item.client_id}`} 
                        className="action-link"
                      >
                        Ver Cliente
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Traffic;

