import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import './InvestorShared.css';

const getDefaultMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const InvestorPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [month, setMonth] = useState(getDefaultMonth);
  const { subscribe } = useSocket();

  const fetchPayments = async () => {
    try {
      const res = await api.get('/payments');
      setPayments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    const unsub = subscribe('payments', () => fetchPayments());
    return unsub;
  }, [subscribe]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

  const byMonth = payments.filter(
    (p) => p.payment_date && String(p.payment_date).slice(0, 7) === month
  );
  const filtered = byMonth.filter(
    (p) =>
      !filter ||
      (p.custom_name || '').toLowerCase().includes(filter.toLowerCase()) ||
      (p.client_name || '').toLowerCase().includes(filter.toLowerCase()) ||
      (p.payment_type || '').toLowerCase().includes(filter.toLowerCase())
  );

  const total = filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  if (loading) return <div className="investor-loading">Cargando pagos...</div>;

  return (
    <div className="investor-page">
      <h2 className="investor-page-title">Pagos</h2>
      <div className="investor-toolbar investor-toolbar-with-month">
        <div className="investor-toolbar-month">
          <label>Mes:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="investor-month-input"
          />
        </div>
        <input
          type="text"
          placeholder="Buscar por cliente o concepto..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="investor-search"
        />
        <div className="investor-total">
          Total del mes: <strong>{formatCurrency(total)}</strong> ({filtered.length} registros)
        </div>
      </div>
      <div className="investor-table-wrap">
        <table className="investor-data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente / Concepto</th>
              <th>Tipo</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="4">No hay pagos</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>{p.custom_name || p.client_name || '-'}</td>
                  <td>{p.payment_type || '-'}</td>
                  <td>{formatCurrency(p.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestorPayments;
