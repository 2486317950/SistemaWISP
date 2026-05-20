import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import './InvestorShared.css';

const getDefaultMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const InvestorExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [month, setMonth] = useState(getDefaultMonth);
  const { subscribe } = useSocket();

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses');
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    const unsub = subscribe('expenses', () => fetchExpenses());
    return unsub;
  }, [subscribe]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

  const byMonth = expenses.filter((e) => {
    if (!e.expense_date) return false;
    const d = new Date(e.expense_date);
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}` === month;
  });
  const filtered = byMonth.filter(
    (e) => !filter || (e.description || '').toLowerCase().includes(filter.toLowerCase())
  );

  const total = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  if (loading) return <div className="investor-loading">Cargando gastos...</div>;

  return (
    <div className="investor-page">
      <h2 className="investor-page-title">Gastos</h2>
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
          placeholder="Buscar por descripcion..."
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
              <th>Descripcion</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="3">No hay gastos</td></tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.expense_date)}</td>
                  <td>{e.description || '-'}</td>
                  <td>{formatCurrency(e.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestorExpenses;
