import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import './PortalPayments.css';

const PortalPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/client-portal/payments')
      .then((res) => setPayments(res.data || []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => {
    if (!d) return '-';
    const parts = String(d).split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  };

  const getPaymentMethodLabel = (method) => {
    if (!method) return '-';
    const labels = {
      efectivo: 'Efectivo',
      'deposito-tarjeta': 'Depósito / Tarjeta',
      transferencia: 'Transferencia',
      stripe: 'Tarjeta (en línea)'
    };
    return labels[method] || method;
  };

  if (loading) {
    return <div className="portal-loading">Cargando pagos...</div>;
  }

  return (
    <div className="portal-payments">
      <h2>Historial de pagos</h2>
      <div className="portal-payment-methods">
        <h3>Métodos de pago</h3>
        <div className="payment-method-item">
          <span className="method-icon">💳</span>
          <span><strong>Depósito / OXXO</strong></span>
          <span className="method-detail">Tarjeta: 4217 4701 7385 4544</span>
        </div>
        <div className="payment-method-item">
          <span className="method-icon">💸</span>
          <span><strong>Transferencia bancaria</strong></span>
          <span className="method-detail">CLABE: 728969000131749378</span>
        </div>
        <p className="payment-warning">
          ⚠️ Para evitar suspensión del servicio, realiza tu pago del 1 al 6 de cada mes.
        </p>
      </div>
      {payments.length === 0 ? (
        <div className="portal-empty">No hay pagos registrados</div>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Método de pago</th>
                <th>Recibo</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Fecha">{formatDate(p.payment_date)}</td>
                  <td data-label="Concepto">{p.payment_type === 'mensualidad' ? 'Mensualidad' : p.payment_type || '-'}</td>
                  <td data-label="Monto">${parseFloat(p.amount || 0).toFixed(2)}</td>
                  <td data-label="Método de pago">{getPaymentMethodLabel(p.payment_method)}</td>
                  <td data-label="Recibo">{p.receipt_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PortalPayments;
