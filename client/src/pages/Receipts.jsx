import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import ReceiptForm from '../components/ReceiptForm';
import { generateReceiptPDF, downloadReceiptPDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './Receipts.css';

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

const Receipts = () => {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    fetchReceipts();
    fetchClients();
  }, []);

  const fetchReceipts = async () => {
    try {
      const response = await api.get('/receipts');
      setReceipts(response.data);
    } catch (error) {
      console.error('Error al cargar recibos:', error);
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

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este recibo?')) return;
    try {
      await api.delete(`/receipts/${id}`);
      fetchReceipts();
    } catch (error) {
      toast.error('Error al eliminar el recibo');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingReceipt(null);
    fetchReceipts();
  };

  const fetchReceiptDetails = async (id) => {
    try {
      const response = await api.get(`/receipts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al cargar detalles del recibo:', error);
      return null;
    }
  };

  const handleSendEmail = async (receipt) => {
    // Obtener los detalles completos del recibo para asegurar que tenemos el email
    const receiptDetails = await fetchReceiptDetails(receipt.id);
    if (!receiptDetails) {
      toast.error('Error al cargar los detalles del recibo');
      return;
    }

    const clientEmail = receiptDetails.client_email;
    
    if (!clientEmail) {
      toast.warning('Este recibo no tiene un email de cliente asociado. Puede descargar el PDF y enviarlo manualmente.');
      return;
    }

    try {
      // Descargar el PDF primero
      downloadReceiptPDF(receiptDetails);

      // Crear el enlace de mailto
      const clientName = receiptDetails.client_name || receiptDetails.custom_name || 'Cliente';
      const subject = encodeURIComponent(`Recibo de Pago ${receiptDetails.receipt_number}`);
      const body = encodeURIComponent(
        `Estimado/a ${clientName},\n\n` +
        `Adjunto encontrará el recibo de pago ${receiptDetails.receipt_number}.\n\n` +
        `Por favor, conserve este documento como comprobante de pago.\n\n` +
        `Saludos cordiales`
      );
      
      const mailtoLink = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
      
      // Abrir el cliente de email
      window.location.href = mailtoLink;
      
      // Mostrar mensaje informativo
      toast.info('Se abrirá su cliente de email. Por favor, adjunte el PDF que se descargó automáticamente.');
    } catch (error) {
      console.error('Error al enviar email:', error);
      toast.error('Error al preparar el envío por email');
    }
  };

  const handlePrint = async (receipt) => {
    try {
      const receiptDetails = await fetchReceiptDetails(receipt.id);
      if (!receiptDetails) {
        toast.error('Error al cargar los detalles del recibo');
        return;
      }
      
      // Generar PDF y abrir en nueva ventana para imprimir
      generateReceiptPDF(receiptDetails);
      
      setTimeout(() => {
        toast.info('En la ventana de previsualización, use Ctrl+P (o Cmd+P en Mac) para imprimir el recibo.');
      }, 500);
    } catch (error) {
      console.error('Error al preparar impresión:', error);
      toast.error('Error al preparar la impresión');
    }
  };

  const handleCopyReceiptNumber = (receiptNumber) => {
    navigator.clipboard.writeText(receiptNumber).then(() => {
      toast.success(`Número de recibo ${receiptNumber} copiado al portapapeles`);
    }).catch(() => {
      toast.error('No se pudo copiar el número de recibo');
    });
  };

  const handleGenerateCFDI = async (receipt) => {
    try {
      const res = await api.post('/electronic-invoices/generate', { receipt_id: receipt.id });
      toast.success(res.data?.message || 'Factura electrónica generada');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Error al generar factura');
    }
  };

  // Función helper para formatear fechas sin problemas de zona horaria
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const dateParts = dateString.split('T')[0].split('-');
    if (dateParts.length === 3) {
      const [year, month, day] = dateParts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('es-ES');
    }
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const getReceiptTypeLabel = (type) => {
    return type === 'mensualidad' ? 'Mensualidad' : 'Instalación';
  };

  // Filtrar recibos por búsqueda
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      const formattedDate = receipt.receipt_date ? formatDate(receipt.receipt_date).toLowerCase() : '';
      const clientName = receipt.client_name || receipt.custom_name || '';
      const receiptNumber = receipt.receipt_number || '';
      const receiptType = getReceiptTypeLabel(receipt.receipt_type).toLowerCase();
      
      return (
        (receiptNumber.toLowerCase().includes(searchLower)) ||
        (clientName.toLowerCase().includes(searchLower)) ||
        (receiptType.includes(searchLower)) ||
        (formattedDate.includes(searchLower)) ||
        (receipt.concept && receipt.concept.toLowerCase().includes(searchLower)) ||
        (receipt.amount && receipt.amount.toString().includes(searchLower))
      );
    });
  }, [receipts, searchTerm]);

  // Agrupar recibos por mes
  const receiptsByMonth = useMemo(() => {
    const grouped = {};
    
    filteredReceipts.forEach(receipt => {
      // Parsear la fecha correctamente para evitar problemas de zona horaria
      const date = parseLocalDate(receipt.receipt_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          receipts: [],
          totalAmount: 0,
          totalReceipts: 0
        };
      }
      
      grouped[monthKey].receipts.push(receipt);
      grouped[monthKey].totalAmount += parseFloat(receipt.amount) || 0;
      grouped[monthKey].totalReceipts += 1;
    });
    
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredReceipts]);

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  if (loading) {
    return <div className="loading">Cargando recibos...</div>;
  }

  return (
    <div className="receipts-page">
      <div className="page-header">
        <h1>Recibos</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Crear Recibo
        </button>
      </div>

      {showForm && (
        <ReceiptForm
          receipt={editingReceipt}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingReceipt(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por número de recibo, cliente, tipo, concepto o fecha..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {receiptsByMonth.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'No se encontraron recibos que coincidan con la búsqueda' : 'No hay recibos registrados'}</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {receiptsByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Recibos:</span>
                    <span className="stat-value">{monthData.totalReceipts}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Monto Total:</span>
                    <span className="stat-value amount">${monthData.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="receipts-table-container">
                    <table className="receipts-table">
                      <thead>
                        <tr>
                          <th>Número</th>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Cliente</th>
                          <th>Dirección</th>
                          <th>Concepto</th>
                          <th>Monto</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.receipts.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              No hay recibos en este mes
                            </td>
                          </tr>
                        ) : (
                          monthData.receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td><strong>{receipt.receipt_number}</strong></td>
                <td>{formatDate(receipt.receipt_date)}</td>
                <td>
                  <span className={`receipt-type-badge receipt-type-${receipt.receipt_type}`}>
                    {getReceiptTypeLabel(receipt.receipt_type)}
                  </span>
                </td>
                <td>{receipt.client_name || receipt.custom_name || '-'}</td>
                <td>{receipt.client_address || receipt.custom_address || '-'}</td>
                <td>{receipt.concept || '-'}</td>
                <td className="amount">${parseFloat(receipt.amount).toFixed(2)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-icon"
                      onClick={() => generateReceiptPDF(receipt)}
                      title="Previsualizar PDF"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => downloadReceiptPDF(receipt)}
                      title="Descargar PDF"
                    >
                      📥
                    </button>
                    {receipt.client_email && (
                      <button
                        className="btn-icon"
                        onClick={() => handleSendEmail(receipt)}
                        title="Enviar por Email"
                      >
                        📧
                      </button>
                    )}
                    <button
                      className="btn-icon"
                      onClick={() => handlePrint(receipt)}
                      title="Imprimir"
                    >
                      🖨️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleCopyReceiptNumber(receipt.receipt_number)}
                      title="Copiar Número de Recibo"
                    >
                      📋
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleGenerateCFDI(receipt)}
                      title="Generar Factura Electrónica (CFDI)"
                    >
                      📑
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setEditingReceipt(receipt);
                        setShowForm(true);
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(receipt.id)}
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

export default Receipts;

