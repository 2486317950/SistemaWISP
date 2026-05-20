import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import ProviderPaymentForm from '../components/ProviderPaymentForm';
import { useToast } from '../context/ToastContext';
import './ProviderPayments.css';

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

const ProviderPayments = () => {
  const { toast } = useToast();
  const { subscribe } = useSocket();
  const [payments, setPayments] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchNetworks();
    fetchPayments();
    fetchSummary();
  }, []);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribeProviderPayments = subscribe('provider_payments', (event, data) => {
      console.log('Evento de pago a proveedor recibido:', event, data);
      fetchPayments();
      fetchSummary();
    });

    return () => {
      unsubscribeProviderPayments();
    };
  }, [subscribe]);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get('/provider-payments');
      setPayments(response.data);
    } catch (error) {
      console.error('Error al cargar pagos a proveedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      // Obtener el mes actual en formato YYYY-MM
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonth = `${year}-${month}`;
      
      const response = await api.get('/provider-payments/summary/by-network', {
        params: {
          month: currentMonth
        }
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
    }
  };

  const handleAdd = () => {
    setEditingPayment(null);
    setShowForm(true);
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este pago a proveedor?')) return;
    try {
      await api.delete(`/provider-payments/${id}`);
      fetchPayments();
      fetchSummary();
    } catch (error) {
      console.error('Error al eliminar pago a proveedor:', error);
      toast.error('Error al eliminar el pago a proveedor');
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPayment(null);
    fetchPayments();
    fetchSummary();
  };

  // Agrupar pagos por tipo de red
  const paymentsByNetwork = useMemo(() => {
    const grouped = {};
    
    // Inicializar grupos con todas las redes
    networks.forEach(network => {
      grouped[network.name] = [];
    });

    payments.forEach(payment => {
      if (grouped[payment.network_type]) {
        grouped[payment.network_type].push(payment);
      } else {
        // Si hay un pago con una red que no está en la lista de redes activas, agregarlo
        if (!grouped[payment.network_type]) {
          grouped[payment.network_type] = [];
        }
        grouped[payment.network_type].push(payment);
      }
    });

    return grouped;
  }, [payments, networks]);

  // Calcular totales por red (solo del mes actual)
  const networkTotals = useMemo(() => {
    const totals = {};
    
    // Obtener el mes actual en formato YYYY-MM
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${month}`;
    
    // Inicializar totales con todas las redes
    networks.forEach(network => {
      totals[network.name] = { total: 0, paid: 0, remaining: 0 };
    });

    payments.forEach(payment => {
      // Filtrar solo pagos del mes actual
      const paymentDate = parseLocalDate(payment.payment_date);
      const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (paymentMonth === currentMonth) {
        if (!totals[payment.network_type]) {
          totals[payment.network_type] = { total: 0, paid: 0, remaining: 0 };
        }
        totals[payment.network_type].total += parseFloat(payment.total_amount) || 0;
        totals[payment.network_type].paid += parseFloat(payment.paid_amount) || 0;
        totals[payment.network_type].remaining += parseFloat(payment.remaining_amount) || 0;
      }
    });

    return totals;
  }, [payments, networks]);

  if (loading) {
    return <div className="provider-payments-loading">Cargando...</div>;
  }

  return (
    <div className="provider-payments-page">
      <div className="page-header">
        <h1>💳 Pago a Proveedores</h1>
        <button className="btn-primary" onClick={handleAdd}>
          ➕ Agregar Pago
        </button>
      </div>

      {/* Resumen por tipo de red */}
      <div className="summary-section">
        <h2>Resumen por Tipo de Red</h2>
        <div className="summary-cards">
          {networks.map((network) => {
            const totals = networkTotals[network.name] || { total: 0, paid: 0, remaining: 0 };
            return (
              <div key={network.id} className="summary-card">
                <h3>{network.name}</h3>
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">${totals.total.toFixed(2)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Pagado:</span>
                    <span className="stat-value paid">${totals.paid.toFixed(2)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Restante:</span>
                    <span className="stat-value remaining">${totals.remaining.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de pagos por tipo de red */}
      <div className="payments-section">
        <h2>Pagos Registrados</h2>
        
        {networks.map((network) => {
          const networkPayments = paymentsByNetwork[network.name] || [];
          return (
            <div key={network.id} className="network-section">
              <h3>{network.name}</h3>
              {networkPayments.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto Total</th>
                        <th>Monto Pagado</th>
                        <th>Monto Restante</th>
                        <th>Notas</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{parseLocalDate(payment.payment_date).toLocaleDateString('es-ES')}</td>
                          <td>${parseFloat(payment.total_amount).toFixed(2)}</td>
                          <td className="paid-amount">${parseFloat(payment.paid_amount).toFixed(2)}</td>
                          <td className={parseFloat(payment.remaining_amount) > 0 ? 'remaining-amount' : 'paid-complete'}>
                            ${parseFloat(payment.remaining_amount).toFixed(2)}
                          </td>
                          <td>{payment.notes || '-'}</td>
                          <td>
                            <button className="btn-edit" onClick={() => handleEdit(payment)}>
                              ✏️ Editar
                            </button>
                            <button className="btn-delete" onClick={() => handleDelete(payment.id)}>
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-message">No hay pagos registrados para {network.name}</p>
              )}
            </div>
          );
        })}
        
        {/* Mostrar pagos de redes que no están en la lista de redes activas */}
        {Object.keys(paymentsByNetwork).filter(networkName => 
          !networks.some(n => n.name === networkName)
        ).map((networkName) => {
          const networkPayments = paymentsByNetwork[networkName] || [];
          if (networkPayments.length === 0) return null;
          return (
            <div key={networkName} className="network-section">
              <h3>{networkName} (Red inactiva)</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto Total</th>
                      <th>Monto Pagado</th>
                      <th>Monto Restante</th>
                      <th>Notas</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{new Date(payment.payment_date).toLocaleDateString('es-ES')}</td>
                        <td>${parseFloat(payment.total_amount).toFixed(2)}</td>
                        <td className="paid-amount">${parseFloat(payment.paid_amount).toFixed(2)}</td>
                        <td className={parseFloat(payment.remaining_amount) > 0 ? 'remaining-amount' : 'paid-complete'}>
                          ${parseFloat(payment.remaining_amount).toFixed(2)}
                        </td>
                        <td>{payment.notes || '-'}</td>
                        <td>
                          <button className="btn-edit" onClick={() => handleEdit(payment)}>
                            ✏️ Editar
                          </button>
                          <button className="btn-delete" onClick={() => handleDelete(payment.id)}>
                            🗑️ Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <ProviderPaymentForm
          payment={editingPayment}
          onClose={() => {
            setShowForm(false);
            setEditingPayment(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default ProviderPayments;

