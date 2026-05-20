import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import './ClientSegmentation.css';

const ClientSegmentation = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [segments, setSegments] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState('all');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    calculateSegments();
  }, [clients]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSegments = () => {
    const now = new Date();
    const segmentsData = {
      vip: [],
      at_risk: [],
      new_clients: [],
      inactive: [],
      high_value: []
    };

    clients.forEach(client => {
      // VIP: Clientes activos con más de 12 meses
      const createdDate = new Date(client.created_at);
      const monthsActive = (now - createdDate) / (1000 * 60 * 60 * 24 * 30);
      if (client.status === 'activo' && monthsActive > 12) {
        segmentsData.vip.push(client);
      }

      // En riesgo: Sin pagos recientes
      if (client.status === 'activo' && !client.last_payment_date) {
        segmentsData.at_risk.push(client);
      }

      // Nuevos: Menos de 3 meses
      if (monthsActive < 3) {
        segmentsData.new_clients.push(client);
      }

      // Inactivos
      if (client.status === 'suspendido' || client.status === 'inactivo') {
        segmentsData.inactive.push(client);
      }

      // Alto valor: Paquete premium
      const packagePrice = parseFloat(client.package_price || 0);
      if (packagePrice > 500) {
        segmentsData.high_value.push(client);
      }
    });

    setSegments(segmentsData);
  };

  const getSegmentClients = () => {
    switch (selectedSegment) {
      case 'vip':
        return segments.vip || [];
      case 'at_risk':
        return segments.at_risk || [];
      case 'new_clients':
        return segments.new_clients || [];
      case 'inactive':
        return segments.inactive || [];
      case 'high_value':
        return segments.high_value || [];
      default:
        return clients;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando segmentación..." fullScreen />;
  }

  return (
    <div className="client-segmentation-page">
      <div className="page-header">
        <h1>🎯 Segmentación de Clientes</h1>
      </div>

      <div className="segments-overview">
        <div className="segment-card" onClick={() => setSelectedSegment('all')}>
          <h3>Total</h3>
          <p>{clients.length}</p>
        </div>
        <div className="segment-card vip" onClick={() => setSelectedSegment('vip')}>
          <h3>VIP</h3>
          <p>{segments.vip?.length || 0}</p>
        </div>
        <div className="segment-card at-risk" onClick={() => setSelectedSegment('at_risk')}>
          <h3>En Riesgo</h3>
          <p>{segments.at_risk?.length || 0}</p>
        </div>
        <div className="segment-card new" onClick={() => setSelectedSegment('new_clients')}>
          <h3>Nuevos</h3>
          <p>{segments.new_clients?.length || 0}</p>
        </div>
        <div className="segment-card inactive" onClick={() => setSelectedSegment('inactive')}>
          <h3>Inactivos</h3>
          <p>{segments.inactive?.length || 0}</p>
        </div>
        <div className="segment-card high-value" onClick={() => setSelectedSegment('high_value')}>
          <h3>Alto Valor</h3>
          <p>{segments.high_value?.length || 0}</p>
        </div>
      </div>

      <div className="clients-list">
        <h2>
          {selectedSegment === 'all' ? 'Todos los Clientes' :
           selectedSegment === 'vip' ? 'Clientes VIP' :
           selectedSegment === 'at_risk' ? 'Clientes en Riesgo' :
           selectedSegment === 'new_clients' ? 'Clientes Nuevos' :
           selectedSegment === 'inactive' ? 'Clientes Inactivos' :
           'Clientes de Alto Valor'}
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Número</th>
              <th>Estado</th>
              <th>Paquete</th>
              <th>Fecha Creación</th>
            </tr>
          </thead>
          <tbody>
            {getSegmentClients().map(client => (
              <tr key={client.id} onClick={() => navigate(`/sistema/clients/${client.id}`)} style={{ cursor: 'pointer' }}>
                <td>{client.name}</td>
                <td>{client.client_number || '-'}</td>
                <td>
                  <span className={`badge status-${client.status}`}>
                    {client.status || 'activo'}
                  </span>
                </td>
                <td>${parseFloat(client.package_price || 0).toLocaleString('es-MX')}</td>
                <td>{formatLocalDate(client.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientSegmentation;

