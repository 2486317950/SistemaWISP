import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import InstallationForm from '../components/InstallationForm';
import { useToast } from '../context/ToastContext';
import { generateInstallationPDF, downloadInstallationPDF, generateCompletionFolioPDF, downloadCompletionFolioPDF } from '../utils/pdfGenerator';
import './Installations.css';

const Installations = () => {
  const { toast } = useToast();
  const [installations, setInstallations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInstallation, setEditingInstallation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [revenueTotalInstallations, setRevenueTotalInstallations] = useState(null);

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    fetchInstallations();
    fetchClients();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get(`/revenues/summary/for-month?month=${currentMonthKey}`)
      .then((res) => {
        if (!cancelled && res.data) setRevenueTotalInstallations(parseFloat(res.data.total_installations || 0) || 0);
      })
      .catch(() => { if (!cancelled) setRevenueTotalInstallations(null); });
    return () => { cancelled = true; };
  }, [currentMonthKey]);

  const fetchInstallations = async () => {
    try {
      const response = await api.get('/installations');
      setInstallations(response.data);
    } catch (error) {
      console.error('Error al cargar instalaciones:', error);
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

  const fetchInstallationDetails = async (id) => {
    try {
      const response = await api.get(`/installations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al cargar detalle de instalación:', error);
      return null;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta instalación?')) return;
    try {
      await api.delete(`/installations/${id}`);
      fetchInstallations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar la instalación');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingInstallation(null);
    fetchInstallations();
  };

  const [completingId, setCompletingId] = useState(null);
  const handleMarkComplete = async (installation) => {
    if (installation.status === 'completado') return;
    const msg = '¿Marcar esta instalación como completada? Se creará el cliente con el siguiente número (si no tiene cliente) y un contrato de 3 meses.';
    if (!window.confirm(msg)) return;
    setCompletingId(installation.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Preguntar si la instalación está pagada o será crédito
      let isPaid = installation.is_paid === true || installation.is_paid === 1;
      let isCredit = installation.is_credit === true || installation.is_credit === 1;
      const paidConfirm = window.confirm('¿La instalación ya está pagada? (Aceptar = Pagada, Cancelar = No pagada)');
      if (paidConfirm) {
        isPaid = true;
        isCredit = false;
      } else {
        const creditConfirm = window.confirm('¿Registrar esta instalación como crédito (el cliente pagará en parcialidades)?');
        if (creditConfirm) {
          isPaid = false;
          isCredit = true;
        } else {
          isPaid = false;
          isCredit = false;
        }
      }
      const payload = {
        client_id: installation.client_id || '',
        custom_name: installation.custom_name || '',
        address: installation.address || installation.display_address || installation.client_address || '',
        installation_date: installation.installation_date,
        installation_type: installation.installation_type || '',
        status: 'completado',
        notes: installation.notes || '',
        installation_fee: installation.installation_fee || 0,
        is_paid: isPaid,
        payment_date: isPaid ? (installation.payment_date || today) : null,
        is_credit: isCredit,
        technician_name: installation.technician_name || '',
        equipment_used: installation.equipment_used || '',
        completion_date: installation.completion_date || today,
        installation_time: installation.installation_time || null,
        package_id: installation.package_id || null,
        phone: installation.phone || ''
      };
      const res = await api.put(`/installations/${installation.id}`, payload);
      fetchInstallations();
      const parts = ['Instalación marcada como completada.'];
      if (res.data.client_created) parts.push('Cliente creado con el siguiente número.');
      if (res.data.contract_created) parts.push('Contrato de 3 meses generado.');
      if (res.data.completion_folio) parts.push(`Folio: ${res.data.completion_folio}`);
      toast.success(parts.join(' '));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al marcar como completada');
    } finally {
      setCompletingId(null);
    }
  };

  // Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  };

  // Agrupar instalaciones por mes
  const installationsByMonth = useMemo(() => {
    const grouped = {};
    
    installations.forEach(installation => {
      const date = parseLocalDate(installation.installation_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          installations: [],
          totalFee: 0,
          totalInstallations: 0,
          paidCount: 0,
          unpaidCount: 0
        };
      }
      
      grouped[monthKey].installations.push(installation);
      grouped[monthKey].totalFee += parseFloat(installation.installation_fee) || 0;
      grouped[monthKey].totalInstallations += 1;
      if (installation.is_paid === true || installation.is_paid === 1) {
        grouped[monthKey].paidCount += 1;
      } else {
        grouped[monthKey].unpaidCount += 1;
      }
    });
    
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [installations]);

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  if (loading) {
    return <div className="loading">Cargando instalaciones...</div>;
  }

  return (
    <div className="installations-page">
      <div className="page-header">
        <h1>Instalaciones</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Programar Instalación
        </button>
      </div>

      {revenueTotalInstallations !== null && (
        <div className="installations-revenue-total" style={{ marginBottom: 16, padding: '12px 16px', background: '#e8f5e9', borderRadius: 8, border: '1px solid #81c784' }}>
          <strong>Ingresos por instalaciones (mes actual)</strong> — Mismo criterio que Dashboard y app Inversionista: <strong>${typeof revenueTotalInstallations === 'number' ? revenueTotalInstallations.toFixed(2) : '0.00'}</strong>
        </div>
      )}

      {showForm && (
        <InstallationForm
          installation={editingInstallation}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingInstallation(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {installationsByMonth.length === 0 ? (
        <div className="empty-state">
          <p>No hay instalaciones programadas</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {installationsByMonth.map((monthData) => (
            <div key={monthData.monthKey} className="month-card">
              <div 
                className="month-card-header"
                onClick={() => toggleMonth(monthData.monthKey)}
              >
                <div className="month-card-title">
                  <h2>{monthData.monthName}</h2>
                  <span className="month-toggle">
                    {selectedMonth === monthData.monthKey ? '▼' : '▶'}
                  </span>
                </div>
                <div className="month-card-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Instalaciones:</span>
                    <span className="stat-value">{monthData.totalInstallations}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Costo Total:</span>
                    <span className="stat-value amount">${monthData.totalFee.toFixed(2)}</span>
                  </div>
                  {monthData.paidCount > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Pagadas:</span>
                      <span className="stat-value" style={{ color: '#27ae60' }}>{monthData.paidCount}</span>
                    </div>
                  )}
                  {monthData.unpaidCount > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Pendientes:</span>
                      <span className="stat-value" style={{ color: '#f39c12' }}>{monthData.unpaidCount}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="installations-table-container">
                    <table className="installations-table">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th>N° Cliente</th>
                          <th>Domicilio</th>
                          <th>Tipo</th>
                          <th>Paquete</th>
                          <th>Estado</th>
                          <th>Técnico</th>
                          <th>Equipo</th>
                          <th>Costo Instalación</th>
                          <th>Estado Pago</th>
                          <th>Notas</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.installations.length === 0 ? (
                          <tr>
                            <td colSpan="14" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              No hay instalaciones en este mes
                            </td>
                          </tr>
                        ) : (
                          monthData.installations.map((installation) => (
              <tr key={installation.id}>
                <td>
                  {installation.installation_folio ? (
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#667eea' }}>
                      {installation.installation_folio}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{new Date(installation.installation_date).toLocaleDateString('es-ES')}</td>
                <td>
                  {installation.custom_name ? (
                    <span style={{ fontStyle: 'italic', color: '#667eea' }}>
                      {installation.custom_name} <small>(Personalizado)</small>
                    </span>
                  ) : (
                    installation.client_name || '-'
                  )}
                </td>
                <td>{installation.client_number || '-'}</td>
                <td>{installation.display_address || installation.client_address || '-'}</td>
                <td>{installation.installation_type}</td>
                <td>
                  {installation.package_name ? (
                    <span style={{ fontSize: '0.9em' }}>
                      {installation.package_name}
                      {installation.package_speed && ` - ${installation.package_speed}`}
                      {installation.package_price && ` - $${installation.package_price}`}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={`status-badge status-${installation.status}`}>
                    {installation.status}
                  </span>
                </td>
                <td>{installation.technician_name || '-'}</td>
                <td>
                  {installation.equipment_used ? (
                    <span style={{ fontSize: '0.9em' }} title={installation.equipment_used}>
                      {installation.equipment_used.length > 30 
                        ? installation.equipment_used.substring(0, 30) + '...' 
                        : installation.equipment_used}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="amount">
                  {installation.installation_fee && parseFloat(installation.installation_fee) > 0 ? (
                    `$${parseFloat(installation.installation_fee).toFixed(2)}`
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {installation.installation_fee && parseFloat(installation.installation_fee) > 0 ? (
                    <span className={`status-badge ${installation.is_paid === true || installation.is_paid === 1 ? 'status-completado' : 'status-pendiente'}`}>
                      {installation.is_paid === true || installation.is_paid === 1 ? '✓ Pagado' : '⏳ Pendiente'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {installation.notes ? (
                    <span style={{ fontSize: '0.9em' }} title={installation.notes}>
                      {installation.notes.length > 30 
                        ? installation.notes.substring(0, 30) + '...' 
                        : installation.notes}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    {installation.status !== 'completado' && (
                      <button
                        className="btn-icon btn-complete"
                        onClick={() => handleMarkComplete(installation)}
                        disabled={completingId === installation.id}
                        title="Marcar como completada (crea cliente y contrato 3 meses)"
                      >
                        {completingId === installation.id ? '⏳' : '✅'}
                      </button>
                    )}
                    <button
                      className="btn-icon"
                      onClick={() => generateInstallationPDF(installation)}
                      title="Previsualizar PDF de Instalación"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => downloadInstallationPDF(installation)}
                      title="Descargar PDF de Instalación"
                    >
                      📥
                    </button>
                    {installation.status === 'completado' && installation.completion_folio && (
                      <>
                        <button
                          className="btn-icon"
                          onClick={() => generateCompletionFolioPDF(installation, toast)}
                          title="Previsualizar Folio de Completado"
                          style={{ color: '#27ae60' }}
                        >
                          ✅
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => downloadCompletionFolioPDF(installation, toast)}
                          title="Descargar Folio de Completado"
                          style={{ color: '#27ae60' }}
                        >
                          📋
                        </button>
                      </>
                    )}
                    <button
                      className="btn-icon"
                      onClick={async () => {
                        const full = await fetchInstallationDetails(installation.id);
                        if (!full) {
                          toast.error('Error al cargar el detalle de la instalación');
                          return;
                        }
                        setEditingInstallation(full);
                        setShowForm(true);
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(installation.id)}
                      title="Eliminar"
                    >
                      🗑️
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Installations;

