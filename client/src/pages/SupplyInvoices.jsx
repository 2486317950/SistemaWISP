import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import SupplyInvoiceForm from '../components/SupplyInvoiceForm';
import { generateMonthlySupplyInvoicesPDF } from '../utils/pdfGenerator';
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

const SupplyInvoices = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState({});

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/supply-invoices');
      // Normalizar has_file a booleano para facilitar su uso
      const normalizedInvoices = response.data.map(invoice => {
        const hasFile = invoice.has_file === 1 || invoice.has_file === true || !!invoice.file_name;
        return {
          ...invoice,
          has_file: hasFile
        };
      });
      console.log('Facturas cargadas:', normalizedInvoices.length, 'con archivos:', normalizedInvoices.filter(i => i.has_file).length);
      setInvoices(normalizedInvoices);
    } catch (error) {
      console.error('Error al cargar facturas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar facturas por rango de fechas
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];
    
    if (dateFilter.start) {
      filtered = filtered.filter(i => parseLocalDate(i.invoice_date) >= parseLocalDate(dateFilter.start));
    }
    
    if (dateFilter.end) {
      const endDate = parseLocalDate(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(i => parseLocalDate(i.invoice_date) <= endDate);
    }
    
    return filtered;
  }, [invoices, dateFilter]);

  // Agrupar facturas por mes
  const invoicesByMonth = useMemo(() => {
    const grouped = {};
    
    filteredInvoices.forEach(invoice => {
      const date = parseLocalDate(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          invoices: [],
          totalAmount: 0,
          totalInvoices: 0
        };
      }
      
      grouped[monthKey].invoices.push(invoice);
      grouped[monthKey].totalAmount += parseFloat(invoice.amount) || 0;
      grouped[monthKey].totalInvoices += 1;
    });
    
    // Ordenar por mes (más reciente primero)
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredInvoices]);

  // Filtrar facturas dentro de un mes específico por búsqueda
  const getFilteredInvoicesForMonth = (monthData) => {
    const query = searchQuery[monthData.monthKey]?.toLowerCase() || '';
    if (!query) return monthData.invoices;
    
    return monthData.invoices.filter(invoice => {
      const invoiceNumber = (invoice.invoice_number || '').toLowerCase();
      const company = (invoice.company || '').toLowerCase();
      const amount = invoice.amount.toString();
      
      return invoiceNumber.includes(query) ||
             company.includes(query) ||
             amount.includes(query);
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta factura de insumos?')) return;
    try {
      const response = await api.delete(`/supply-invoices/${id}`);
      if (response.data.warning) {
        toast.warning(`${response.data.message}\n\n${response.data.warning}`);
      } else {
        toast.success(response.data.message || 'Factura eliminada exitosamente');
      }
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar la factura');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingInvoice(null);
    fetchInvoices();
  };

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  const handleExportPDF = (monthData) => {
    generateMonthlySupplyInvoicesPDF(monthData);
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

  const handleViewFile = async (invoice) => {
    try {
      const url = `/api/supply-invoices/files/${invoice.id}`;
      
      // Obtener el token del localStorage
      const token = localStorage.getItem('token');
      
      // Crear un enlace temporal con el token en los headers
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar el archivo');
      }
      
      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Obtener el nombre del archivo de la factura o usar un nombre por defecto
      const fileName = invoice.file_name || `factura_${invoice.invoice_number || invoice.id}.pdf`;
      
      // Crear un enlace temporal para descargar el archivo
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName; // Forzar descarga con el nombre del archivo
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      toast.error('Error al descargar el archivo. Por favor, intenta nuevamente.');
    }
  };

  if (loading) {
    return <div className="loading">Cargando facturas...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Facturas de Insumos</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Registrar Factura
          </button>
        </div>
      </div>

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

      {showForm && (
        <SupplyInvoiceForm
          invoice={editingInvoice}
          onClose={() => {
            setShowForm(false);
            setEditingInvoice(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {invoicesByMonth.length === 0 ? (
        <div className="empty-state">
          <p>No hay facturas registradas</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {invoicesByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Facturas:</span>
                    <span className="stat-value">{monthData.totalInvoices}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Monto Total:</span>
                    <span className="stat-value amount">${monthData.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="month-actions">
                    <div className="search-box">
                      <input
                        type="text"
                        placeholder="🔍 Buscar en este mes (número, empresa, monto)..."
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
                          <th>Número de Factura</th>
                          <th>Empresa</th>
                          <th>Monto</th>
                          <th>Archivo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredInvoicesForMonth(monthData).length === 0 ? (
                          <tr>
                            <td colSpan="6" className="no-results">
                              {searchQuery[monthData.monthKey] 
                                ? 'No se encontraron facturas que coincidan con la búsqueda' 
                                : 'No hay facturas en este mes'}
                            </td>
                          </tr>
                        ) : (
                          getFilteredInvoicesForMonth(monthData).map((invoice) => (
                          <tr key={invoice.id}>
                            <td>{new Date(invoice.invoice_date).toLocaleDateString('es-ES')}</td>
                            <td>{invoice.invoice_number}</td>
                            <td>{invoice.company}</td>
                            <td className="amount">${parseFloat(invoice.amount).toFixed(2)}</td>
                            <td>
                              {invoice.has_file ? (
                                <button
                                  onClick={() => {
                                    console.log('Descargando archivo para factura:', invoice);
                                    handleViewFile(invoice);
                                  }}
                                  className="btn-download-file"
                                  style={{ 
                                    color: '#667eea', 
                                    textDecoration: 'underline',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    font: 'inherit',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                  }}
                                  title="Hacer clic para descargar el archivo"
                                >
                                  📥 Descargar {invoice.file_name ? `(${invoice.file_name})` : 'archivo'}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="btn-icon"
                                  onClick={() => {
                                    setEditingInvoice(invoice);
                                    setShowForm(true);
                                  }}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn-icon"
                                  onClick={() => handleDelete(invoice.id)}
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
                    {searchQuery[monthData.monthKey] && getFilteredInvoicesForMonth(monthData).length > 0 && (
                      <div className="search-results-info">
                        Mostrando {getFilteredInvoicesForMonth(monthData).length} de {monthData.invoices.length} facturas
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

export default SupplyInvoices;

