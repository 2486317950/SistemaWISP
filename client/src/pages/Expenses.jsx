import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import { generateMonthlyExpensesPDF, previewMonthlyExpensesPDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './Payments.css';

const Expenses = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [supplyInvoices, setSupplyInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState({});

  useEffect(() => {
    fetchExpenses();
    fetchSupplyInvoices();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await api.get('/expenses');
      setExpenses(response.data);
    } catch (error) {
      console.error('Error al cargar gastos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplyInvoices = async () => {
    try {
      const response = await api.get('/supply-invoices');
      setSupplyInvoices(response.data);
    } catch (error) {
      console.error('Error al cargar facturas de insumos:', error);
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

  // Filtrar gastos por rango de fechas
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];
    
    if (dateFilter.start) {
      filtered = filtered.filter(e => parseLocalDate(e.expense_date) >= parseLocalDate(dateFilter.start));
    }
    
    if (dateFilter.end) {
      const endDate = parseLocalDate(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => parseLocalDate(e.expense_date) <= endDate);
    }
    
    return filtered;
  }, [expenses, dateFilter]);

  // Agrupar gastos por mes
  const expensesByMonth = useMemo(() => {
    const grouped = {};
    
    filteredExpenses.forEach(expense => {
      const date = parseLocalDate(expense.expense_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          expenses: [],
          totalAmount: 0,
          totalExpenses: 0
        };
      }
      
      grouped[monthKey].expenses.push(expense);
      grouped[monthKey].totalAmount += parseFloat(expense.amount) || 0;
      grouped[monthKey].totalExpenses += 1;
    });
    
    // Ordenar por mes (más reciente primero)
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredExpenses]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (error) {
      toast.error('Error al eliminar el gasto');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
  };

  const handleExportPDF = (monthData) => {
    generateMonthlyExpensesPDF(monthData);
  };

  const handlePreviewPDF = (monthData) => {
    previewMonthlyExpensesPDF(monthData);
  };

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  const handleSearchChange = (monthKey, value) => {
    setSearchQuery(prev => ({
      ...prev,
      [monthKey]: value
    }));
  };

  // Filtrar gastos dentro de un mes específico por búsqueda
  const getFilteredExpensesForMonth = (monthData) => {
    const query = searchQuery[monthData.monthKey]?.toLowerCase() || '';
    if (!query) return monthData.expenses;
    
    return monthData.expenses.filter(expense => {
      const description = (expense.description || '').toLowerCase();
      const amount = expense.amount.toString();
      const invoiceNumber = (expense.supply_invoice_number || '').toLowerCase();
      const company = (expense.supply_invoice_company || '').toLowerCase();
      const notes = (expense.notes || '').toLowerCase();
      
      return description.includes(query) ||
             amount.includes(query) ||
             invoiceNumber.includes(query) ||
             company.includes(query) ||
             notes.includes(query);
    });
  };

  if (loading) {
    return <div className="loading">Cargando gastos...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Gastos</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Registrar Gasto
          </button>
        </div>
      </div>

      {/* Filtros */}
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

      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          supplyInvoices={supplyInvoices}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {expensesByMonth.length === 0 ? (
        <div className="empty-state">
          <p>No hay gastos registrados</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {expensesByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Gastos:</span>
                    <span className="stat-value" style={{ color: '#e74c3c' }}>${monthData.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Cantidad:</span>
                    <span className="stat-value">{monthData.totalExpenses}</span>
                  </div>
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="month-actions">
                    <div className="search-box">
                      <input
                        type="text"
                        placeholder="🔍 Buscar en este mes (descripción, monto, factura, notas)..."
                        value={searchQuery[monthData.monthKey] || ''}
                        onChange={(e) => handleSearchChange(monthData.monthKey, e.target.value)}
                        className="search-input"
                      />
                    </div>
                    <button 
                      className="btn-preview-pdf"
                      onClick={() => handlePreviewPDF(monthData)}
                      title="Previsualizar PDF"
                    >
                      👁️ Previsualizar PDF
                    </button>
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
                          <th>Descripción</th>
                          <th>Monto</th>
                          <th>Factura Vinculada</th>
                          <th>Notas</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredExpensesForMonth(monthData).length === 0 ? (
                          <tr>
                            <td colSpan="6" className="no-results">
                              {searchQuery[monthData.monthKey] 
                                ? 'No se encontraron gastos que coincidan con la búsqueda' 
                                : 'No hay gastos en este mes'}
                            </td>
                          </tr>
                        ) : (
                          getFilteredExpensesForMonth(monthData).map((expense) => (
                        <tr key={expense.id}>
                          <td>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</td>
                          <td>{expense.description}</td>
                          <td className="amount" style={{ color: '#e74c3c' }}>
                            ${parseFloat(expense.amount).toFixed(2)}
                          </td>
                          <td>
                            {expense.supply_invoice_id ? (
                              <span style={{ color: '#667eea' }}>
                                {expense.supply_invoice_number || 'N/A'} - {expense.supply_invoice_company || 'N/A'}
                                {expense.supply_invoice_amount && (
                                  <span> (${parseFloat(expense.supply_invoice_amount).toFixed(2)})</span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: '#999' }}>-</span>
                            )}
                          </td>
                          <td>{expense.notes || '-'}</td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setShowForm(true);
                                }}
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleDelete(expense.id)}
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

export default Expenses;

