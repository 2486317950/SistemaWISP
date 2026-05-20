import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './ClientForm.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SupplyInvoiceForm = ({ invoice, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    invoice_number: '',
    company: '',
    amount: '',
    invoice_date: getLocalDateString(),
    file: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [existingFile, setExistingFile] = useState(null);

  const handleViewExistingFile = async () => {
    if (!invoice) return;
    
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

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        company: invoice.company || '',
        amount: invoice.amount || '',
        invoice_date: invoice.invoice_date || getLocalDateString(),
        file: null
      });
      if (invoice.has_file || invoice.file_name) {
        setExistingFile(invoice.id);
      }
    }
  }, [invoice]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        file: file
      });
      
      // Crear preview si es una imagen
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('invoice_number', formData.invoice_number);
      formDataToSend.append('company', formData.company);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('invoice_date', formData.invoice_date);
      
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      if (invoice) {
        await api.put(`/supply-invoices/${invoice.id}`, formDataToSend);
      } else {
        await api.post('/supply-invoices', formDataToSend);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la factura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{invoice ? 'Editar Factura de Insumos' : 'Registrar Factura de Insumos'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Número de Factura *</label>
            <input
              type="text"
              name="invoice_number"
              value={formData.invoice_number}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Empresa *</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label>Fecha de Factura *</label>
            <input
              type="date"
              name="invoice_date"
              value={formData.invoice_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>PDF o Imagen de la Factura</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            {preview && (
              <div style={{ marginTop: '10px' }}>
                <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px' }} />
              </div>
            )}
            {existingFile && !formData.file && invoice && (
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={handleViewExistingFile}
                  style={{ 
                    color: '#667eea', 
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit'
                  }}
                  title="Hacer clic para descargar el archivo actual"
                >
                  📥 Descargar archivo actual {invoice.file_name ? `(${invoice.file_name})` : ''}
                </button>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplyInvoiceForm;

