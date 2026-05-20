import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import QuotationForm from '../components/QuotationForm';
import { generateQuotationPDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './Payments.css';

// Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
};

const Quotations = () => {
  const { toast } = useToast();
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    fetchQuotations();
    fetchClients();
  }, []);

  const fetchQuotations = async () => {
    try {
      const response = await api.get('/quotations');
      setQuotations(response.data);
    } catch (error) {
      console.error('Error al cargar cotizaciones:', error);
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

  const fetchQuotationDetails = async (id) => {
    try {
      const response = await api.get(`/quotations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al cargar detalles de cotización:', error);
      return null;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    try {
      await api.delete(`/quotations/${id}`);
      fetchQuotations();
    } catch (error) {
      toast.error('Error al eliminar la cotización');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingQuotation(null);
    fetchQuotations();
  };

  // Agrupar cotizaciones por mes
  const quotationsByMonth = useMemo(() => {
    const grouped = {};
    
    quotations.forEach(quotation => {
      const date = parseLocalDate(quotation.quotation_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          quotations: [],
          totalAmount: 0,
          totalQuotations: 0
        };
      }
      
      grouped[monthKey].quotations.push(quotation);
      grouped[monthKey].totalAmount += parseFloat(quotation.total) || 0;
      grouped[monthKey].totalQuotations += 1;
    });
    
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [quotations]);

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  const handleGeneratePDF = async (quotation) => {
    try {
      // Si no tenemos los items, obtenerlos primero
      let quotationWithItems = quotation;
      if (!quotation.items || quotation.items.length === 0) {
        quotationWithItems = await fetchQuotationDetails(quotation.id);
        if (!quotationWithItems) {
          toast.error('Error al cargar los detalles de la cotización');
          return;
        }
      }
      generateQuotationPDF(quotationWithItems);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const handleSendEmail = async (quotation) => {
    if (!quotation.client_email) {
      toast.warning('La cotización no tiene un email de cliente asociado');
      return;
    }

    try {
      // Obtener los detalles completos de la cotización
      const quotationWithItems = await fetchQuotationDetails(quotation.id);
      if (!quotationWithItems) {
        toast.error('Error al cargar los detalles de la cotización');
        return;
      }

      // Crear el PDF temporalmente
      generateQuotationPDF(quotationWithItems);

      // Crear el enlace de mailto con el PDF adjunto
      const subject = encodeURIComponent(`Cotización ${quotation.quotation_number}`);
      const body = encodeURIComponent(
        `Estimado/a ${quotation.client_name},\n\n` +
        `Adjunto encontrará la cotización ${quotation.quotation_number}.\n\n` +
        `Por favor, revise los detalles y no dude en contactarnos si tiene alguna pregunta.\n\n` +
        `Saludos cordiales`
      );
      
      // Nota: Los navegadores no permiten adjuntar archivos directamente desde mailto
      // Se puede usar un servicio de email o mostrar instrucciones
      const mailtoLink = `mailto:${quotation.client_email}?subject=${subject}&body=${body}`;
      
      // Abrir el cliente de email
      window.location.href = mailtoLink;
      
      // Mostrar mensaje informativo
      toast.info('Se abrirá su cliente de email. Por favor, adjunte el PDF que se descargó automáticamente.');
    } catch (error) {
      console.error('Error al enviar email:', error);
      toast.error('Error al preparar el envío por email');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pendiente: '#f39c12',
      enviada: '#3498db',
      aceptada: '#27ae60',
      rechazada: '#e74c3c',
      vencida: '#95a5a6'
    };
    return (
      <span
        style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: '500',
          backgroundColor: statusColors[status] || '#95a5a6',
          color: 'white'
        }}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <div className="loading">Cargando cotizaciones...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Cotizaciones</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Nueva Cotización
          </button>
        </div>
      </div>

      {showForm && (
        <QuotationForm
          quotation={editingQuotation}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingQuotation(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {quotationsByMonth.length === 0 ? (
        <div className="empty-state">
          <p>No hay cotizaciones registradas</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {quotationsByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Cotizaciones:</span>
                    <span className="stat-value">{monthData.totalQuotations}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Monto Total:</span>
                    <span className="stat-value amount">${monthData.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="payments-table-container">
                    <table className="payments-table">
                      <thead>
                        <tr>
                          <th>Número</th>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th>Email</th>
                          <th>Total</th>
                          <th>Estado</th>
                          <th>Items</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.quotations.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              No hay cotizaciones en este mes
                            </td>
                          </tr>
                        ) : (
                          monthData.quotations.map((quotation) => (
                <tr key={quotation.id}>
                  <td><strong>{quotation.quotation_number}</strong></td>
                  <td>{new Date(quotation.quotation_date).toLocaleDateString('es-ES')}</td>
                  <td>{quotation.client_name}</td>
                  <td>{quotation.client_email || '-'}</td>
                  <td className="amount">${parseFloat(quotation.total).toFixed(2)}</td>
                  <td>{getStatusBadge(quotation.status)}</td>
                  <td>{quotation.items_count || 0}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleGeneratePDF(quotation)}
                        title="Generar PDF"
                      >
                        📄
                      </button>
                      {quotation.client_email && (
                        <button
                          className="btn-icon"
                          onClick={() => handleSendEmail(quotation)}
                          title="Enviar por Email"
                        >
                          📧
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={async () => {
                          const full = await fetchQuotationDetails(quotation.id);
                          if (!full) {
                            toast.error('Error al cargar los detalles de la cotización');
                            return;
                          }
                          setEditingQuotation(full);
                          setShowForm(true);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(quotation.id)}
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

export default Quotations;
















