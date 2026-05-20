import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import IPCredentialForm from '../components/IPCredentialForm';
import { useToast } from '../context/ToastContext';
import './IPCredentials.css';

const IPCredentials = () => {
  const { canUpdate, canDelete } = useAuth();
  const { toast } = useToast();
  const [ipCredentials, setIpCredentials] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIpCredential, setEditingIpCredential] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchIpCredentials();
    fetchClients();
  }, []);

  const fetchIpCredentials = async () => {
    try {
      const response = await api.get('/ip-credentials');
      setIpCredentials(response.data);
    } catch (error) {
      console.error('Error al cargar IPs y contraseñas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta IP y contraseña?')) return;
    try {
      await api.delete(`/ip-credentials/${id}`);
      fetchIpCredentials();
    } catch (error) {
      toast.error('Error al eliminar IP y contraseña');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingIpCredential(null);
    fetchIpCredentials();
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredIpCredentials = ipCredentials.filter(ip => {
    const searchLower = searchTerm.toLowerCase();
    return (
      ip.ip_address.toLowerCase().includes(searchLower) ||
      (ip.custom_name && ip.custom_name.toLowerCase().includes(searchLower)) ||
      (ip.client_name && ip.client_name.toLowerCase().includes(searchLower)) ||
      (ip.device_type && ip.device_type.toLowerCase().includes(searchLower)) ||
      (ip.username && ip.username.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return <div className="loading">Cargando IPs y contraseñas...</div>;
  }

  return (
    <div className="ip-credentials-page">
      <div className="page-header">
        <h1>🔐 IPs y Contraseñas</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar IP y Contraseña
        </button>
      </div>

      {showForm && (
        <IPCredentialForm
          ipCredential={editingIpCredential}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingIpCredential(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="search-container">
        <input
          type="text"
          placeholder="Buscar por IP, cliente, dispositivo o usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="ip-credentials-table-container">
        <table className="ip-credentials-table">
          <thead>
            <tr>
              <th>Cliente/Ubicación</th>
              <th>Tipo de Dispositivo</th>
              <th>Dirección IP</th>
              <th>Usuario</th>
              <th>Contraseña</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredIpCredentials.map((ip) => (
              <tr key={ip.id}>
                <td>
                  {ip.custom_name ? (
                    <span className="custom-name">
                      {ip.custom_name} <small>(Personalizado)</small>
                    </span>
                  ) : (
                    <div>
                      <div>{ip.client_name || '-'}</div>
                      {ip.client_number && (
                        <small className="client-number">#{ip.client_number}</small>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <span className="device-type-badge">{ip.device_type}</span>
                </td>
                <td>
                  <code className="ip-address">{ip.ip_address}</code>
                </td>
                <td>{ip.username || '-'}</td>
                <td>
                  {ip.password ? (
                    <div className="password-cell">
                      <code className="password-text">
                        {showPasswords[ip.id] ? ip.password : '••••••••'}
                      </code>
                      <button
                        className="btn-toggle-password"
                        onClick={() => togglePasswordVisibility(ip.id)}
                        title={showPasswords[ip.id] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPasswords[ip.id] ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{ip.notes || '-'}</td>
                <td>
                  <div className="table-actions">
                    {canUpdate && (
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setEditingIpCredential(ip);
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
                        onClick={() => handleDelete(ip.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredIpCredentials.length === 0 && (
        <div className="empty-state">
          <p>No hay IPs y contraseñas registradas</p>
        </div>
      )}
    </div>
  );
};

export default IPCredentials;


