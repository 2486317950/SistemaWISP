import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import TransferForm from '../components/TransferForm';
import AccountForm from '../components/AccountForm';
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

const Transfers = () => {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState({});
  const [activeTab, setActiveTab] = useState('transfers'); // 'transfers' o 'accounts'

  useEffect(() => {
    fetchTransfers();
    fetchAccounts();
    fetchEmployees();
  }, []);

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/transfers');
      setTransfers(response.data);
    } catch (error) {
      console.error('Error al cargar transferencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    }
  };

  // Filtrar transferencias por rango de fechas
  const filteredTransfers = useMemo(() => {
    let filtered = [...transfers];
    
    if (dateFilter.start) {
      filtered = filtered.filter(t => parseLocalDate(t.transfer_date) >= parseLocalDate(dateFilter.start));
    }
    
    if (dateFilter.end) {
      const endDate = parseLocalDate(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => parseLocalDate(t.transfer_date) <= endDate);
    }
    
    return filtered;
  }, [transfers, dateFilter]);

  // Agrupar transferencias por mes
  const transfersByMonth = useMemo(() => {
    const grouped = {};
    
    filteredTransfers.forEach(transfer => {
      const date = parseLocalDate(transfer.transfer_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          transfers: [],
          totalAmount: 0,
          totalTransfers: 0
        };
      }
      
      grouped[monthKey].transfers.push(transfer);
      grouped[monthKey].totalAmount += parseFloat(transfer.amount) || 0;
      grouped[monthKey].totalTransfers += 1;
    });
    
    // Ordenar por mes (más reciente primero)
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredTransfers]);

  const handleDeleteTransfer = async (id) => {
    if (!window.confirm('¿Eliminar esta transferencia?')) return;
    try {
      await api.delete(`/transfers/${id}`);
      fetchTransfers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar la transferencia');
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('¿Eliminar esta cuenta?')) return;
    try {
      await api.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar la cuenta');
    }
  };

  const handleTransferFormSubmit = () => {
    setShowTransferForm(false);
    setEditingTransfer(null);
    fetchTransfers();
  };

  const handleAccountFormSubmit = () => {
    setShowAccountForm(false);
    setEditingAccount(null);
    fetchAccounts();
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
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

  // Filtrar transferencias dentro de un mes específico por búsqueda
  const getFilteredTransfersForMonth = (monthData) => {
    const query = searchQuery[monthData.monthKey]?.toLowerCase() || '';
    if (!query) return monthData.transfers;
    
    return monthData.transfers.filter(transfer => {
      const description = (transfer.description || '').toLowerCase();
      const amount = transfer.amount.toString();
      const accountName = (transfer.account_name || '').toLowerCase();
      const employeeName = (transfer.employee_name || '').toLowerCase();
      const notes = (transfer.notes || '').toLowerCase();
      const transferType = transfer.transfer_type === 'account' ? 'cuenta' : 'empleado';
      
      return description.includes(query) ||
             amount.includes(query) ||
             accountName.includes(query) ||
             employeeName.includes(query) ||
             notes.includes(query) ||
             transferType.includes(query);
    });
  };

  if (loading) {
    return <div className="loading">Cargando transferencias...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Transferencias</h1>
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            onClick={() => {
              setEditingAccount(null);
              setShowAccountForm(true);
            }}
            style={{ marginRight: '10px' }}
          >
            + Agregar Cuenta
          </button>
          <button 
            className="btn-primary" 
            onClick={() => {
              setEditingTransfer(null);
              setShowTransferForm(true);
            }}
          >
            + Registrar Transferencia
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('transfers')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'transfers' ? '#667eea' : 'transparent',
            color: activeTab === 'transfers' ? 'white' : '#666',
            cursor: 'pointer',
            borderBottom: activeTab === 'transfers' ? '3px solid #667eea' : '3px solid transparent',
            fontWeight: activeTab === 'transfers' ? 'bold' : 'normal'
          }}
        >
          Transferencias ({transfers.length})
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'accounts' ? '#667eea' : 'transparent',
            color: activeTab === 'accounts' ? 'white' : '#666',
            cursor: 'pointer',
            borderBottom: activeTab === 'accounts' ? '3px solid #667eea' : '3px solid transparent',
            fontWeight: activeTab === 'accounts' ? 'bold' : 'normal'
          }}
        >
          Cuentas ({accounts.length})
        </button>
      </div>

      {/* Formularios - se muestran independientemente de la pestaña activa */}
      {showTransferForm && (
        <TransferForm
          transfer={editingTransfer}
          accounts={accounts}
          employees={employees}
          onClose={() => {
            setShowTransferForm(false);
            setEditingTransfer(null);
          }}
          onSuccess={handleTransferFormSubmit}
        />
      )}

      {showAccountForm && (
        <AccountForm
          account={editingAccount}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
          onSuccess={handleAccountFormSubmit}
        />
      )}

      {activeTab === 'transfers' && (
        <>
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

          {transfersByMonth.length === 0 ? (
            <div className="empty-state">
              <p>No hay transferencias registradas</p>
            </div>
          ) : (
            <div className="payments-by-month">
              {transfersByMonth.map((monthData) => (
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
                        <span className="stat-label">Total Transferencias:</span>
                        <span className="stat-value" style={{ color: '#e74c3c' }}>${monthData.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Cantidad:</span>
                        <span className="stat-value">{monthData.totalTransfers}</span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedMonth === monthData.monthKey && (
                    <div className="month-card-content">
                      <div className="month-actions">
                        <div className="search-box">
                          <input
                            type="text"
                            placeholder="🔍 Buscar en este mes (descripción, monto, cuenta, empleado, notas)..."
                            value={searchQuery[monthData.monthKey] || ''}
                            onChange={(e) => handleSearchChange(monthData.monthKey, e.target.value)}
                            className="search-input"
                          />
                        </div>
                      </div>
                      <div className="payments-table-container">
                        <table className="payments-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Tipo</th>
                              <th>Monto</th>
                              <th>Cuenta/Empleado</th>
                              <th>Descripción</th>
                              <th>Notas</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredTransfersForMonth(monthData).length === 0 ? (
                              <tr>
                                <td colSpan="7" className="no-results">
                                  {searchQuery[monthData.monthKey] 
                                    ? 'No se encontraron transferencias que coincidan con la búsqueda' 
                                    : 'No hay transferencias en este mes'}
                                </td>
                              </tr>
                            ) : (
                              getFilteredTransfersForMonth(monthData).map((transfer) => (
                                <tr key={transfer.id}>
                                  <td>{new Date(transfer.transfer_date).toLocaleDateString('es-ES')}</td>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.85em',
                                        fontWeight: 'bold',
                                        backgroundColor: transfer.transfer_type === 'account' ? '#e3f2fd' : '#fff3e0',
                                        color: transfer.transfer_type === 'account' ? '#1976d2' : '#f57c00',
                                        display: 'inline-block'
                                      }}>
                                        {transfer.transfer_type === 'account' ? '💰 Cuenta' : '👤 Empleado'}
                                      </span>
                                      {(transfer.is_expense === 1 || transfer.is_expense === true) && (
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.75em',
                                          fontWeight: 'bold',
                                          backgroundColor: '#ffebee',
                                          color: '#c62828',
                                          display: 'inline-block'
                                        }}>
                                          📉 Gasto
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="amount" style={{ color: '#e74c3c' }}>
                                    ${parseFloat(transfer.amount).toFixed(2)}
                                  </td>
                                  <td>
                                    {transfer.transfer_type === 'account' ? (
                                      <span>
                                        {transfer.account_name || 'N/A'}
                                        {transfer.bank_name && <span style={{ color: '#666', fontSize: '0.9em' }}> - {transfer.bank_name}</span>}
                                      </span>
                                    ) : (
                                      <div>
                                        <div style={{ fontWeight: 'bold' }}>{transfer.employee_name_from_table || transfer.employee_name || 'N/A'}</div>
                                        {transfer.employee_payroll_account && (
                                          <div style={{ 
                                            fontSize: '0.85em', 
                                            color: '#667eea', 
                                            marginTop: '4px',
                                            fontWeight: 'bold'
                                          }}>
                                            💳 Cuenta Nómina: {transfer.employee_payroll_account}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td>{transfer.description || '-'}</td>
                                  <td>{transfer.notes || '-'}</td>
                                  <td>
                                    <div className="table-actions">
                                      <button
                                        className="btn-icon"
                                        onClick={() => {
                                          setEditingTransfer(transfer);
                                          setShowTransferForm(true);
                                        }}
                                        title="Editar"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        className="btn-icon"
                                        onClick={() => handleDeleteTransfer(transfer.id)}
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
        </>
      )}

      {activeTab === 'accounts' && (
        <>
          {accounts.length === 0 ? (
            <div className="empty-state">
              <p>No hay cuentas registradas</p>
            </div>
          ) : (
            <div className="payments-table-container">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Número de Cuenta</th>
                    <th>Banco</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Notas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td style={{ fontWeight: 'bold' }}>{account.account_name}</td>
                      <td>{account.account_number || '-'}</td>
                      <td>{account.bank_name || '-'}</td>
                      <td>{account.account_type || '-'}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85em',
                          fontWeight: 'bold',
                          backgroundColor: (account.is_active === 1 || account.is_active === true) ? '#e8f5e9' : '#ffebee',
                          color: (account.is_active === 1 || account.is_active === true) ? '#2e7d32' : '#c62828'
                        }}>
                          {(account.is_active === 1 || account.is_active === true) ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>{account.notes || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setEditingAccount(account);
                              setShowAccountForm(true);
                            }}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDeleteAccount(account.id)}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Transfers;

