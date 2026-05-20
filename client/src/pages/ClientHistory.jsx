import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import './ClientHistory.css';

const ClientHistory = () => {
  const { id } = useParams();
  const [history, setHistory] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClient();
      fetchHistory();
    }
  }, [id]);

  const fetchClient = async () => {
    try {
      const response = await api.get(`/clients/${id}`);
      setClient(response.data);
    } catch (error) {
      console.error('Error al cargar cliente:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/clients/${id}/history`);
      setHistory(response.data || []);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando historial..." fullScreen />;
  }

  return (
    <div className="client-history-page">
      <div className="page-header">
        <h1>📜 Historial de {client?.name || 'Cliente'}</h1>
      </div>

      {history.length === 0 ? (
        <p className="no-data">No hay historial registrado para este cliente</p>
      ) : (
        <div className="history-timeline">
          {history.map((item, index) => (
            <div key={item.id} className="history-item">
              <div className="history-date">
                {formatLocalDate(item.created_at)}
              </div>
              <div className="history-content">
                <h3>{item.action_type}</h3>
                {item.old_value && (
                  <div className="change-detail">
                    <strong>Antes:</strong> {typeof item.old_value === 'string' ? item.old_value : JSON.stringify(item.old_value)}
                  </div>
                )}
                {item.new_value && (
                  <div className="change-detail">
                    <strong>Después:</strong> {typeof item.new_value === 'string' ? item.new_value : JSON.stringify(item.new_value)}
                  </div>
                )}
                {item.notes && (
                  <div className="history-notes">
                    <strong>Notas:</strong> {item.notes}
                  </div>
                )}
                {item.changed_by_username && (
                  <div className="history-user">
                    Por: {item.changed_by_username}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientHistory;











