import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import { generateMonthlyPaymentsPDF } from '../utils/pdfGenerator';
import './Payments.css';

// Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Si es formato YYYY-MM-DD, parsear como fecha local
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Si tiene hora o es otro formato, usar el constructor normal
  const date = new Date(dateString);
  // Si la fecha parece estar en UTC pero queremos local, ajustar
  if (typeof dateString === 'string' && dateString.includes('T') && dateString.endsWith('Z')) {
    const localDate = new Date(dateString);
    return new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
  }
  return date;
};

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState({});
  const [showChart, setShowChart] = useState(false);

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchPayments();
    fetchClients();
  }, []);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribePayments = subscribe('payments', (event, data) => {
      console.log('Evento de pago recibido:', event, data);
      fetchPayments();
    });

    const unsubscribeReceipts = subscribe('receipts', (event, data) => {
      console.log('Evento de recibo recibido:', event, data);
      fetchPayments();
    });

    return () => {
      unsubscribePayments();
      unsubscribeReceipts();
    };
  }, [subscribe]);

  const fetchPayments = async () => {
    setLoadError(null);
    try {
      const response = await api.get('/revenues');
      setPayments(response.data);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
      try {
        const fallbackResponse = await api.get('/payments');
        setPayments(fallbackResponse.data);
      } catch (fallbackError) {
        console.error('Error al cargar pagos (fallback):', fallbackError);
        setLoadError(error.response?.data?.error || 'Error al cargar los pagos');
      }
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

  // Filtrar pagos por rango de fechas
  const filteredPayments = useMemo(() => {
    let filtered = [...payments];
    
    if (dateFilter.start) {
      filtered = filtered.filter(p => {
        const paymentDate = parseLocalDate(p.date || p.payment_date);
        return paymentDate >= parseLocalDate(dateFilter.start);
      });
    }
    
    if (dateFilter.end) {
      const endDate = parseLocalDate(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => {
        const paymentDate = parseLocalDate(p.date || p.payment_date);
        return paymentDate <= endDate;
      });
    }
    
    return filtered;
  }, [payments, dateFilter]);

  // Agrupar pagos por mes
  const paymentsByMonth = useMemo(() => {
    const grouped = {};
    
    filteredPayments.forEach(payment => {
      // Parsear la fecha correctamente para evitar problemas de zona horaria
      const date = parseLocalDate(payment.date || payment.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          payments: [],
          totalAmount: 0,
          totalPayments: 0,
          freeMonths: 0,
          installationPayments: 0,
          installationAmount: 0
        };
      }
      
      grouped[monthKey].payments.push(payment);
      grouped[monthKey].totalAmount += parseFloat(payment.amount) || 0;
      grouped[monthKey].totalPayments += 1;
      if (payment.is_free_month) {
        grouped[monthKey].freeMonths += 1;
      }
      // Contar pagos por instalación
      if (payment.revenue_type === 'installation') {
        grouped[monthKey].installationPayments += 1;
        grouped[monthKey].installationAmount += parseFloat(payment.amount) || 0;
      }
    });
    
    // Ordenar por mes (más reciente primero)
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredPayments]);

  // Filtrar pagos dentro de un mes específico por búsqueda
  const getFilteredPaymentsForMonth = (monthData) => {
    const query = searchQuery[monthData.monthKey]?.toLowerCase() || '';
    if (!query) return monthData.payments;
    
    return monthData.payments.filter(payment => {
      const clientName = (payment.client_name || '').toLowerCase();
      const clientNumber = (payment.client_number || '').toLowerCase();
      const address = (payment.client_address || '').toLowerCase();
      const receipt = (payment.receipt_number || '').toLowerCase();
      const notes = (payment.notes || '').toLowerCase();
      const amount = payment.amount.toString();
      const revenueType = (payment.revenue_type_label || '').toLowerCase();
      const installationType = (payment.installation_type || '').toLowerCase();
      
      return clientName.includes(query) ||
             clientNumber.includes(query) ||
             address.includes(query) ||
             receipt.includes(query) ||
             notes.includes(query) ||
             amount.includes(query) ||
             revenueType.includes(query) ||
             installationType.includes(query);
    });
  };

  // Calcular datos para gráfico
  const chartData = useMemo(() => {
    return paymentsByMonth.map(month => ({
      month: month.monthName,
      amount: month.totalAmount,
      payments: month.totalPayments
    }));
  }, [paymentsByMonth]);

  // Calcular altura máxima para gráfico
  const maxAmount = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d.amount));
  }, [chartData]);

  const handleDelete = async (payment) => {
    const isInstallation = payment.revenue_type === 'installation';
    if (isInstallation) {
      setFlash({ type: 'info', message: 'Para eliminar o modificar un pago por instalación, ve a la sección de Instalaciones.' });
      return;
    }
    if (!window.confirm('¿Eliminar este pago?')) return;

    try {
      await api.delete(`/payments/${payment.id}`);
      setLoadError(null);
      fetchPayments();
    } catch (error) {
      setFlash({ type: 'error', message: error.response?.data?.error || 'Error al eliminar el pago' });
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingPayment(null);
    fetchPayments();
  };

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  const handleExportPDF = (monthData) => {
    generateMonthlyPaymentsPDF(monthData);
  };

  const handleSearchChange = (monthKey, value) => {
    setSearchQuery(prev => ({
      ...prev,
      [monthKey]: value
    }));
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
  };

  if (loading) {
    return <div className="loading">Cargando pagos...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Pagos</h1>
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            onClick={() => setShowChart(!showChart)}
            title="Mostrar/Ocultar Gráfico"
          >
            {showChart ? '📊 Ocultar Gráfico' : '📊 Ver Gráfico'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Registrar Pago
          </button>
        </div>
      </div>

      {loadError && (
        <div className="error-message-banner">
          {loadError}
          <button type="button" className="btn-dismiss-error" onClick={() => setLoadError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {flash && (
        <div className={`payments-flash flash-${flash.type}`}>
          {flash.message}
          <button type="button" className="btn-dismiss-error" onClick={() => setFlash(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {/* Filtro por rango de fechas */}
      <div className="filters-section">
        <div className="date-filter">
          <label>Filtrar por Fechas:</label>
          <input
            type="date"
            value={dateFilter.start}
            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
            placeholder="Fecha inicio"
          />
          <span>hasta</span>
          <input
            type="date"
            value={dateFilter.end}
            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
            placeholder="Fecha fin"
          />
          {(dateFilter.start || dateFilter.end) && (
            <button className="btn-clear-filter" onClick={clearDateFilter}>
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Gráfico de ingresos mensuales */}
      {showChart && chartData.length > 0 && (
        <div className="chart-container">
          <h3>Gráfico de Ingresos Mensuales</h3>
          <div className="chart">
            {chartData.map((data, index) => (
              <div key={index} className="chart-bar-container">
                <div className="chart-bar-wrapper">
                  <div 
                    className="chart-bar"
                    style={{ 
                      height: `${(data.amount / maxAmount) * 100}%`,
                      backgroundColor: index % 2 === 0 ? '#667eea' : '#764ba2'
                    }}
                    title={`${data.month}: $${data.amount.toFixed(2)}`}
                  >
                    <span className="chart-value">${data.amount.toFixed(0)}</span>
                  </div>
                </div>
                <div className="chart-label">{data.month.split(' ')[0]}</div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#667eea' }}></span>
              <span>Meses pares</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#764ba2' }}></span>
              <span>Meses impares</span>
            </div>
          </div>
        </div>
      )}

      {showForm && editingPayment && editingPayment.revenue_type !== 'installation' && (
        <PaymentForm
          payment={editingPayment}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingPayment(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}
      {showForm && !editingPayment && (
        <PaymentForm
          payment={null}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingPayment(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {paymentsByMonth.length === 0 ? (
        <div className="empty-state">
          <p>No hay pagos registrados</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {paymentsByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Pagos:</span>
                    <span className="stat-value">{monthData.totalPayments}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Monto Total:</span>
                    <span className="stat-value amount">${monthData.totalAmount.toFixed(2)}</span>
                  </div>
                  {monthData.installationPayments > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Pagos por Instalación:</span>
                      <span className="stat-value">${monthData.installationAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {monthData.freeMonths > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Meses Gratis:</span>
                      <span className="stat-value free-month">{monthData.freeMonths}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="month-actions">
                    <div className="search-box">
                      <input
                        type="text"
                        placeholder="🔍 Buscar en este mes (cliente, número, domicilio, recibo, notas, monto)..."
                        value={searchQuery[monthData.monthKey] || ''}
                        onChange={(e) => handleSearchChange(monthData.monthKey, e.target.value)}
                        className="search-input"
                      />
                    </div>
                    <button 
                      className="btn-export-pdf"
                      onClick={() => handleExportPDF(monthData)}
                      title="Exportar a PDF"
                    >
                      📄 Exportar PDF
                    </button>
                  </div>
                  <div className="payments-table-container">
                    <table className="payments-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Cliente</th>
                          <th>N° Cliente</th>
                          <th>Domicilio</th>
                          <th>Monto</th>
                          <th>Método</th>
                          <th>Recibo</th>
                          <th>Notas</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredPaymentsForMonth(monthData).length === 0 ? (
                          <tr>
                            <td colSpan="10" className="no-results">
                              {searchQuery[monthData.monthKey] 
                                ? 'No se encontraron pagos que coincidan con la búsqueda' 
                                : 'No hay pagos en este mes'}
                            </td>
                          </tr>
                        ) : (
                          getFilteredPaymentsForMonth(monthData).map((payment) => {
                            const paymentDate = payment.date || payment.payment_date;
                            const isInstallation = payment.revenue_type === 'installation';
                            // Permitir editar:
                            // 1. Pagos normales (revenue_type === 'payment')
                            // 2. Pagos de tipo 'instalacion' o 'personalizado' creados desde la sección de pagos (tienen payment_type)
                            // NO permitir editar instalaciones que vienen de la tabla installations (solo tienen revenue_type === 'installation' sin payment_type)
                            const canEdit = payment.revenue_type === 'payment' || 
                                          (payment.payment_type === 'instalacion' || payment.payment_type === 'personalizado');
                            
                            // Determinar el tipo de pago para mostrar el badge correcto
                            const paymentTypeLabel = payment.revenue_type_label || 'Pago Mensual';
                            const isPaymentInstallation = payment.payment_type === 'instalacion' || payment.revenue_type === 'installation';
                            const isPaymentPersonalized = payment.payment_type === 'personalizado';
                            
                            // Obtener etiqueta del método de pago
                            const getPaymentMethodLabel = (method) => {
                              if (!method) return '-';
                              const labels = {
                                'efectivo': '💵 Efectivo',
                                'deposito-tarjeta': '💳 Depósito en Tarjeta',
                                'transferencia': '🏦 Transferencia'
                              };
                              return labels[method] || method;
                            };
                            
                            return (
                              <tr key={`${payment.revenue_type}-${payment.id}`}>
                                <td>{new Date(paymentDate).toLocaleDateString('es-ES')}</td>
                                <td>
                                  <span className={`revenue-type-badge ${isPaymentInstallation ? 'installation' : isPaymentPersonalized ? 'personalized' : 'payment'}`}>
                                    {isPaymentInstallation ? '🔧 Instalación' : isPaymentPersonalized ? '📝 Personalizado' : '💰 Pago'}
                                  </span>
                                </td>
                                <td>{payment.client_name || '-'}</td>
                                <td>{payment.client_number || '-'}</td>
                                <td>{payment.client_address || '-'}</td>
                                <td className="amount">
                                  ${parseFloat(payment.amount).toFixed(2)}
                                  {payment.is_free_month && (
                                    <span className="free-badge" title="Mes Gratis"> 🎁</span>
                                  )}
                                </td>
                                <td>{getPaymentMethodLabel(payment.payment_method)}</td>
                                <td>{payment.receipt_number || '-'}</td>
                                <td>
                                  {isInstallation && payment.installation_type ? (
                                    <span>{payment.notes ? `${payment.notes} | ` : ''}{payment.installation_type}</span>
                                  ) : (
                                    payment.notes || '-'
                                  )}
                                </td>
                                <td>
                                  <div className="table-actions">
                                    {canEdit ? (
                                      <>
                                        <button
                                          className="btn-icon"
                                          onClick={() => {
                                            setEditingPayment(payment);
                                            setShowForm(true);
                                          }}
                                          title="Editar"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          className="btn-icon"
                                          onClick={() => handleDelete(payment)}
                                          title="Eliminar"
                                        >
                                          🗑️
                                        </button>
                                      </>
                                    ) : (
                                      <span style={{ color: '#666', fontSize: '0.85em' }}>
                                        Editar en Instalaciones
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    {searchQuery[monthData.monthKey] && getFilteredPaymentsForMonth(monthData).length > 0 && (
                      <div className="search-results-info">
                        Mostrando {getFilteredPaymentsForMonth(monthData).length} de {monthData.payments.length} pagos
                      </div>
                    )}
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

export default Payments;

