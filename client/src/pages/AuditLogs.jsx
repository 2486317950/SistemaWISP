import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './AuditLogs.css';

const AuditLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [filter, setFilter] = useState({
    user_id: '',
    entity_type: '',
    action: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.user_id) params.user_id = filter.user_id;
      if (filter.entity_type) params.entity_type = filter.entity_type;
      if (filter.action) params.action = filter.action;
      if (filter.start_date) params.start_date = filter.start_date;
      if (filter.end_date) params.end_date = filter.end_date;
      
      const response = await api.get('/audit-logs', { params });
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al cargar logs:', error);
      setLogs([]);
      if (error.response?.status !== 404) {
        toast.error('Error al cargar logs de auditoría: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (filter.start_date) params.start_date = filter.start_date;
      if (filter.end_date) params.end_date = filter.end_date;
      
      const response = await api.get('/audit-logs/stats', { params });
      setStats(response.data || null);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      setStats(null);
      // No mostrar alerta para estadísticas, es opcional
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filter.start_date) params.start_date = filter.start_date;
      if (filter.end_date) params.end_date = filter.end_date;
      
      const response = await api.get('/audit-logs/export', { 
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al exportar logs:', error);
      toast.error('Error al exportar logs');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando logs de auditoría..." fullScreen />;
  }

  return (
    <div className="audit-logs-page">
      <div className="page-header">
        <h1>📋 Logs de Auditoría</h1>
        <button className="btn-primary" onClick={handleExport}>
          📥 Exportar CSV
        </button>
      </div>

      {stats && (
        <div className="stats-summary">
          <p><strong>Total de acciones:</strong> {stats.total_actions || 0}</p>
          <p><strong>Usuarios únicos:</strong> {stats.unique_users || 0}</p>
        </div>
      )}

      <div className="filters">
        <input
          type="date"
          value={filter.start_date}
          onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
          placeholder="Fecha inicio"
        />
        <input
          type="date"
          value={filter.end_date}
          onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
          placeholder="Fecha fin"
        />
        <select
          value={filter.entity_type}
          onChange={(e) => setFilter({ ...filter, entity_type: e.target.value })}
        >
          <option value="">Todos los tipos</option>
          <option value="client">Cliente</option>
          <option value="payment">Pago</option>
          <option value="installation">Instalación</option>
          <option value="folio">Folio</option>
          <option value="user">Usuario</option>
        </select>
        <select
          value={filter.action}
          onChange={(e) => setFilter({ ...filter, action: e.target.value })}
        >
          <option value="">Todas las acciones</option>
          <option value="create">Crear</option>
          <option value="update">Actualizar</option>
          <option value="delete">Eliminar</option>
        </select>
      </div>

      <div className="logs-list">
        {logs.length === 0 ? (
          <p className="no-data">No hay logs registrados</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Tipo Entidad</th>
                <th>ID Entidad</th>
                <th>IP</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => {
                if (!log || typeof log !== 'object') return null;
                const isExpanded = expandedIndex === index;
                let oldValues = '';
                let newValues = '';
                try {
                  if (log.old_values) {
                    oldValues = typeof log.old_values === 'string'
                      ? log.old_values
                      : JSON.stringify(log.old_values, null, 2);
                  }
                  if (log.new_values) {
                    newValues = typeof log.new_values === 'string'
                      ? log.new_values
                      : JSON.stringify(log.new_values, null, 2);
                  }
                } catch (e) {
                  console.error('Error al preparar detalles del log:', e);
                }

                return (
                  <React.Fragment key={log.id || index}>
                    <tr className={isExpanded ? 'audit-row expanded' : 'audit-row'}>
                      <td>{log.created_at ? formatLocalDate(log.created_at) : '-'}</td>
                      <td>{log.username || log.user_username || '-'}</td>
                      <td>
                        <span className={`badge action-${log.action || 'unknown'}`}>
                          {log.action || '-'}
                        </span>
                      </td>
                      <td>{log.entity_type || '-'}</td>
                      <td>{log.entity_id || '-'}</td>
                      <td>{log.ip_address || '-'}</td>
                      <td>
                        {(oldValues || newValues) && (
                          <button
                            className="btn-small"
                            onClick={() =>
                              setExpandedIndex(isExpanded ? null : index)
                            }
                          >
                            {isExpanded ? 'Ocultar cambios' : 'Ver cambios'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (oldValues || newValues) && (
                      <tr className="audit-details-row">
                        <td colSpan={7}>
                          <div className="audit-details">
                            {oldValues && (
                              <div>
                                <h4>Antes</h4>
                                <pre>{oldValues}</pre>
                              </div>
                            )}
                            {newValues && (
                              <div>
                                <h4>Después</h4>
                                <pre>{newValues}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

