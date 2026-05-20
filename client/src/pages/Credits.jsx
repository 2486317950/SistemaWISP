import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { generateCreditPagarePDF } from '../utils/pdfGenerator';
import './Credits.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Credits = () => {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [flash, setFlash] = useState(null);

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchCredits();
  }, []);

  useEffect(() => {
    const unsub = subscribe('credits', (event, data) => {
      console.log('Evento de crédito recibido:', event, data);
      fetchCredits();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [subscribe]);

  const fetchCredits = async () => {
    try {
      const response = await api.get('/credits');
      setCredits(response.data);
    } catch (error) {
      console.error('Error al cargar créditos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMakePayment = async (e) => {
    e.preventDefault();
    setFlash(null);

    if (!selectedCredit || !paymentAmount || !paymentDate) {
      setFlash({ type: 'error', message: 'Por favor completa todos los campos requeridos' });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setFlash({ type: 'error', message: 'El monto debe ser un número mayor a 0' });
      return;
    }

    if (amount > selectedCredit.remaining_amount) {
      setFlash({ type: 'error', message: `El monto no puede exceder el saldo pendiente: $${selectedCredit.remaining_amount.toFixed(2)}` });
      return;
    }

    try {
      await api.post(`/credits/${selectedCredit.id}/payments`, {
        amount: amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: paymentNotes
      });

      setFlash({ type: 'success', message: 'Pago registrado exitosamente' });
      setShowPaymentForm(false);
      setSelectedCredit(null);
      setPaymentAmount('');
      setPaymentDate(getLocalDateString());
      setPaymentMethod('');
      setPaymentNotes('');
      fetchCredits();
    } catch (error) {
      console.error('Error al registrar pago:', error);
      setFlash({ type: 'error', message: error.response?.data?.error || 'Error al registrar el pago' });
    }
  };

  const handleDeleteCredit = async (credit) => {
    if (!window.confirm('¿Eliminar este crédito?')) return;
    setFlash(null);
    try {
      await api.delete(`/credits/${credit.id}`);
      setFlash({ type: 'success', message: 'Crédito eliminado exitosamente junto con todos sus pagos relacionados' });
      fetchCredits();
    } catch (error) {
      console.error('Error al eliminar crédito:', error);
      setFlash({ type: 'error', message: error.response?.data?.error || 'Error al eliminar el crédito' });
    }
  };

  const filteredCredits = credits.filter(credit => {
    // Filtro por estado
    if (filterStatus !== 'all' && credit.status !== filterStatus) {
      return false;
    }

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const clientName = (credit.client_name || credit.display_name || '').toLowerCase();
      const clientNumber = (credit.client_number || '').toLowerCase();
      return clientName.includes(query) || clientNumber.includes(query);
    }

    return true;
  });

  const getStatusBadge = (status) => {
    const statuses = {
      pendiente: { label: 'Pendiente', class: 'badge-pending' },
      parcial: { label: 'Parcial', class: 'badge-partial' },
      liquidado: { label: 'Liquidado', class: 'badge-paid' }
    };
    const statusInfo = statuses[status] || statuses.pendiente;
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  const getCreditTypeLabel = (type) => {
    return type === 'instalacion' ? 'Instalación' : 'Mensualidad';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  if (loading) {
    return <div className="loading">Cargando créditos...</div>;
  }

  return (
    <div className="credits-page">
      <div className="page-header">
        <h1>Créditos</h1>
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
            <option value="parcial">Parciales</option>
            <option value="liquidado">Liquidados</option>
          </select>
        </div>
      </div>

      {flash && (
        <div className={`credits-flash flash-${flash.type}`}>
          {flash.message}
          <button type="button" className="flash-dismiss" onClick={() => setFlash(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      <div className="credits-table-container">
        <table className="credits-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Monto Total</th>
              <th>Pagado</th>
              <th>Pendiente</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCredits.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  {credits.length === 0 ? 'No hay créditos registrados' : 'No se encontraron créditos con los filtros seleccionados'}
                </td>
              </tr>
            ) : (
              filteredCredits.map((credit) => (
                <tr key={credit.id}>
                  <td>
                    <div>
                      <strong>{credit.display_name || credit.client_name || 'Sin cliente'}</strong>
                      {credit.client_number && (
                        <div className="client-number">#{credit.client_number}</div>
                      )}
                    </div>
                  </td>
                  <td>{getCreditTypeLabel(credit.credit_type)}</td>
                  <td>{formatCurrency(credit.total_amount)}</td>
                  <td>{formatCurrency(credit.paid_amount)}</td>
                  <td>
                    <strong className={credit.remaining_amount > 0 ? 'text-danger' : 'text-success'}>
                      {formatCurrency(credit.remaining_amount)}
                    </strong>
                  </td>
                  <td>{getStatusBadge(credit.status)}</td>
                  <td>{new Date(credit.created_at).toLocaleDateString('es-MX')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn-pagare"
                        onClick={() => generateCreditPagarePDF(credit)}
                        title="Descargar PDF del pagaré"
                      >
                        Pagaré
                      </button>
                      {credit.status !== 'liquidado' && (
                        <button
                          className="btn-pay"
                          onClick={() => {
                            setSelectedCredit(credit);
                            setShowPaymentForm(true);
                            setPaymentAmount('');
                            setPaymentDate(getLocalDateString());
                          }}
                        >
                          Pagar
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteCredit(credit)}
                        title={credit.paid_amount > 0 ? "Eliminar crédito (se eliminarán todos los pagos relacionados)" : "Eliminar crédito"}
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

      {showPaymentForm && selectedCredit && (
        <div className="modal-overlay" onClick={() => setShowPaymentForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Pago de Crédito</h2>
              <button className="close-btn" onClick={() => setShowPaymentForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="credit-info">
                <p><strong>Cliente:</strong> {selectedCredit.display_name || selectedCredit.client_name || 'Sin cliente'}</p>
                <p><strong>Tipo:</strong> {getCreditTypeLabel(selectedCredit.credit_type)}</p>
                <p><strong>Monto Total:</strong> {formatCurrency(selectedCredit.total_amount)}</p>
                <p><strong>Pagado:</strong> {formatCurrency(selectedCredit.paid_amount)}</p>
                <p><strong>Pendiente:</strong> <strong>{formatCurrency(selectedCredit.remaining_amount)}</strong></p>
              </div>
              <form onSubmit={handleMakePayment}>
                <div className="form-group">
                  <label>Monto a Pagar *</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0.01"
                    max={selectedCredit.remaining_amount}
                    step="0.01"
                    required
                    placeholder={`Máximo: ${formatCurrency(selectedCredit.remaining_amount)}`}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Pago *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Método de Pago</label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Efectivo, Transferencia, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows="3"
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowPaymentForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-submit">
                    Registrar Pago
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Credits;


