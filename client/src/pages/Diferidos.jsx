import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatLocalDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import './Diferidos.css';

const Diferidos = () => {
  const { toast } = useToast();
  const [diferidos, setDiferidos] = useState([]);
  const [clients, setClients] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDiferido, setEditingDiferido] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [referralType, setReferralType] = useState('client'); // 'client', 'installation', 'custom'

  // Form data
  const [formData, setFormData] = useState({
    referrer_client_id: '',
    referred_client_id: '',
    referred_installation_id: '',
    referred_custom_name: '',
    referred_custom_address: '',
    referred_custom_phone: '',
    notes: ''
  });

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchDiferidos();
    fetchClients();
    fetchInstallations();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('diferidos', (event, data) => {
      console.log('Evento de referido recibido:', event, data);
      fetchDiferidos();
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  const fetchDiferidos = async () => {
    try {
      const response = await api.get('/diferidos');
      setDiferidos(response.data);
    } catch (error) {
      console.error('Error al cargar referidos:', error);
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

  const fetchInstallations = async () => {
    try {
      const response = await api.get('/installations');
      setInstallations(response.data);
    } catch (error) {
      console.error('Error al cargar instalaciones:', error);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.referrer_client_id) {
      toast.warning('El cliente referidor es requerido');
      return;
    }

    if (referralType === 'client' && !formData.referred_client_id) {
      toast.warning('Debe seleccionar un cliente referido');
      return;
    }

    if (referralType === 'installation' && !formData.referred_installation_id) {
      toast.warning('Debe seleccionar una instalación');
      return;
    }

    if (referralType === 'custom' && (!formData.referred_custom_name || !formData.referred_custom_address)) {
      toast.warning('El nombre y domicilio son requeridos para referidos personalizados');
      return;
    }

    try {
      const payload = {
        referrer_client_id: formData.referrer_client_id,
        notes: formData.notes || null
      };

      if (referralType === 'client') {
        payload.referred_client_id = formData.referred_client_id;
      } else if (referralType === 'installation') {
        payload.referred_installation_id = formData.referred_installation_id;
      } else if (referralType === 'custom') {
        payload.referred_custom_name = formData.referred_custom_name;
        payload.referred_custom_address = formData.referred_custom_address;
        payload.referred_custom_phone = formData.referred_custom_phone || null;
      }

      if (editingDiferido) {
        await api.put(`/diferidos/${editingDiferido.id}`, payload);
        toast.success('Referido actualizado exitosamente');
      } else {
        await api.post('/diferidos', payload);
        toast.success('Referido registrado exitosamente');
      }

      resetForm();
      fetchDiferidos();
    } catch (error) {
      console.error('Error al guardar referido:', error);
      toast.error(error.response?.data?.error || 'Error al guardar el referido');
    }
  };

  const handleApplyBenefits = async (diferido) => {
    if (diferido.benefit_status === 'aplicado') {
      toast.warning('Los beneficios ya han sido aplicados');
      return;
    }

    if (!window.confirm('¿Estás seguro de aplicar los beneficios de este referido?')) {
      return;
    }

    try {
      await api.post(`/diferidos/${diferido.id}/apply-benefits`);
      toast.success('Beneficios aplicados exitosamente');
      fetchDiferidos();
    } catch (error) {
      console.error('Error al aplicar beneficios:', error);
      toast.error(error.response?.data?.error || 'Error al aplicar los beneficios');
    }
  };

  const handleDelete = async (diferido) => {
    if (!window.confirm('¿Eliminar este referido?')) return;
    try {
      await api.delete(`/diferidos/${diferido.id}`);
      toast.success('Referido eliminado exitosamente');
      fetchDiferidos();
    } catch (error) {
      console.error('Error al eliminar referido:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar el referido');
    }
  };

  const resetForm = () => {
    setFormData({
      referrer_client_id: '',
      referred_client_id: '',
      referred_installation_id: '',
      referred_custom_name: '',
      referred_custom_address: '',
      referred_custom_phone: '',
      notes: ''
    });
    setReferralType('client');
    setEditingDiferido(null);
    setShowForm(false);
  };

  const handleEdit = (diferido) => {
    setEditingDiferido(diferido);
    setFormData({
      referrer_client_id: diferido.referrer_client_id || '',
      referred_client_id: diferido.referred_client_id || '',
      referred_installation_id: diferido.referred_installation_id || '',
      referred_custom_name: diferido.referred_custom_name || '',
      referred_custom_address: diferido.referred_custom_address || '',
      referred_custom_phone: diferido.referred_custom_phone || '',
      notes: diferido.notes || ''
    });

    if (diferido.referred_installation_id) {
      setReferralType('installation');
    } else if (diferido.referred_custom_name) {
      setReferralType('custom');
    } else {
      setReferralType('client');
    }

    setShowForm(true);
  };

  const filteredDiferidos = diferidos.filter(diferido => {
    // Filtro por estado
    if (filterStatus !== 'all' && diferido.benefit_status !== filterStatus) {
      return false;
    }

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const referrerName = (diferido.referrer_name || '').toLowerCase();
      const referrerNumber = (diferido.referrer_client_number || '').toLowerCase();
      const referredName = (diferido.referred_name || '').toLowerCase();
      const referredNumber = (diferido.referred_client_number || '').toLowerCase();
      return referrerName.includes(query) || 
             referrerNumber.includes(query) || 
             referredName.includes(query) || 
             referredNumber.includes(query);
    }

    return true;
  });

  const getStatusBadge = (status) => {
    const statuses = {
      pendiente: { label: 'Pendiente', class: 'badge-pending', color: '#f39c12' },
      aplicado: { label: 'Aplicado', class: 'badge-applied', color: '#27ae60' }
    };
    const statusInfo = statuses[status] || statuses.pendiente;
    return (
      <span 
        className={`status-badge ${statusInfo.class}`}
        style={{ backgroundColor: statusInfo.color }}
      >
        {statusInfo.label}
      </span>
    );
  };

  const getBenefitTypeLabel = (type) => {
    const types = {
      mes_gratis: 'Mes Gratis',
      descuento_20: '20% Descuento'
    };
    return types[type] || type;
  };

  const getPaymentTypeLabel = (type) => {
    const types = {
      contado: 'Contado',
      credito: 'Crédito'
    };
    return types[type] || type;
  };

  if (loading) {
    return <LoadingSpinner message="Cargando referidos..." fullScreen />;
  }

  return (
    <div className="diferidos-page">
      <div className="page-header">
        <h1>Referidos</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aplicado">Aplicados</option>
          </select>
          <button className="btn-primary" onClick={() => {
            resetForm();
            setShowForm(true);
          }}>
            + Registrar Referido
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDiferido ? 'Editar Referido' : 'Registrar Nuevo Referido'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label>Cliente Referidor *</label>
                  <select
                    value={formData.referrer_client_id}
                    onChange={(e) => setFormData({ ...formData, referrer_client_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar cliente referidor</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.client_number ? `(#${client.client_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo de Referido *</label>
                  <select
                    value={referralType}
                    onChange={(e) => {
                      setReferralType(e.target.value);
                      setFormData({
                        ...formData,
                        referred_client_id: '',
                        referred_installation_id: '',
                        referred_custom_name: '',
                        referred_custom_address: '',
                        referred_custom_phone: ''
                      });
                    }}
                    required
                    disabled={!!editingDiferido}
                  >
                    <option value="client">Cliente Existente</option>
                    <option value="installation">Por Instalación</option>
                    <option value="custom">Nombre Personalizado</option>
                  </select>
                </div>

                {referralType === 'client' && (
                  <div className="form-group">
                    <label>Cliente Referido *</label>
                    <select
                      value={formData.referred_client_id}
                      onChange={(e) => setFormData({ ...formData, referred_client_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cliente referido</option>
                      {clients
                        .filter(client => client.id !== formData.referrer_client_id)
                        .map(client => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.client_number ? `(#${client.client_number})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {referralType === 'installation' && (
                  <div className="form-group">
                    <label>Instalación *</label>
                    <select
                      value={formData.referred_installation_id}
                      onChange={(e) => setFormData({ ...formData, referred_installation_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar instalación</option>
                      {installations.map(installation => (
                        <option key={installation.id} value={installation.id}>
                          Folio: {installation.installation_folio} - {installation.client_name} 
                          {installation.installation_date ? ` (${formatLocalDate(installation.installation_date)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {referralType === 'custom' && (
                  <>
                    <div className="form-group">
                      <label>Nombre del Referido *</label>
                      <input
                        type="text"
                        value={formData.referred_custom_name}
                        onChange={(e) => setFormData({ ...formData, referred_custom_name: e.target.value })}
                        required
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div className="form-group">
                      <label>Domicilio *</label>
                      <input
                        type="text"
                        value={formData.referred_custom_address}
                        onChange={(e) => setFormData({ ...formData, referred_custom_address: e.target.value })}
                        required
                        placeholder="Dirección completa"
                      />
                    </div>
                    <div className="form-group">
                      <label>Teléfono</label>
                      <input
                        type="text"
                        value={formData.referred_custom_phone}
                        onChange={(e) => setFormData({ ...formData, referred_custom_phone: e.target.value })}
                        placeholder="Teléfono de contacto"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                    placeholder="Notas adicionales..."
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-submit">
                    {editingDiferido ? 'Actualizar' : 'Registrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="diferidos-table-container">
        <table className="diferidos-table">
          <thead>
            <tr>
              <th>Cliente Referidor</th>
              <th>Cliente Referido</th>
              <th>Instalación</th>
              <th>Beneficio</th>
              <th>Tipo de Pago</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredDiferidos.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  {diferidos.length === 0 ? 'No hay referidos registrados' : 'No se encontraron referidos con los filtros seleccionados'}
                </td>
              </tr>
            ) : (
              filteredDiferidos.map((diferido) => (
                <tr key={diferido.id}>
                  <td>
                    <div>
                      <strong>{diferido.referrer_name || 'Sin nombre'}</strong>
                      {diferido.referrer_client_number && (
                        <div className="client-number">#{diferido.referrer_client_number}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{diferido.referred_name || diferido.referred_custom_name || 'Sin nombre'}</strong>
                      {diferido.referred_client_number && (
                        <div className="client-number">#{diferido.referred_client_number}</div>
                      )}
                      {diferido.referred_custom_name && (
                        <div className="custom-badge" style={{ fontSize: '0.85em', color: '#666' }}>
                          (Personalizado)
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {diferido.installation_folio ? (
                      <div>
                        <strong>Folio: {diferido.installation_folio}</strong>
                        {diferido.installation_date && (
                          <div className="installation-date">
                            {formatLocalDate(diferido.installation_date)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>{getBenefitTypeLabel(diferido.benefit_type)}</td>
                  <td>{diferido.payment_type ? getPaymentTypeLabel(diferido.payment_type) : '-'}</td>
                  <td>{getStatusBadge(diferido.benefit_status || 'pendiente')}</td>
                  <td>{formatLocalDate(diferido.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {diferido.benefit_status !== 'aplicado' && (
                        <button
                          className="btn-apply"
                          onClick={() => handleApplyBenefits(diferido)}
                          style={{
                            backgroundColor: '#27ae60',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            fontWeight: '500'
                          }}
                        >
                          Aplicar Beneficio
                        </button>
                      )}
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(diferido)}
                        style={{
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9em'
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(diferido)}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9em'
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
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

export default Diferidos;
