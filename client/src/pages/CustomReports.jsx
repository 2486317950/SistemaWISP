import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { exportToExcel } from '../utils/excelExport';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './CustomReports.css';

const CustomReports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entity_type: 'clients',
    fields: [],
    filters: {}
  });

  const entityFields = {
    clients: ['id', 'name', 'client_number', 'address', 'phone', 'email', 'network_type', 'status', 'created_at'],
    payments: ['id', 'client_id', 'amount', 'payment_date', 'payment_method', 'receipt_number', 'notes'],
    installations: ['id', 'client_id', 'installation_date', 'installation_type', 'status', 'installation_fee', 'is_paid'],
    folios: ['id', 'folio_number', 'client_id', 'visit_date', 'problem_description', 'status', 'resolution_cost']
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/custom-reports');
      setReports(response.data || []);
    } catch (error) {
      console.error('Error al cargar reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/custom-reports', formData);
      toast.success('Reporte creado exitosamente');
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        entity_type: 'clients',
        fields: [],
        filters: {}
      });
      fetchReports();
    } catch (error) {
      console.error('Error al crear reporte:', error);
      toast.error(error.response?.data?.error || 'Error al crear reporte');
    }
  };

  const handleExecute = async (reportId) => {
    try {
      const response = await api.post(`/custom-reports/${reportId}/execute`, {
        start_date: '',
        end_date: ''
      });
      exportToExcel(response.data.data, response.data.report_name, 'Datos', toast);
    } catch (error) {
      console.error('Error al ejecutar reporte:', error);
      toast.error('Error al ejecutar reporte');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este reporte?')) return;
    try {
      await api.delete(`/custom-reports/${id}`);
      toast.success('Reporte eliminado exitosamente');
      fetchReports();
    } catch (error) {
      console.error('Error al eliminar reporte:', error);
      toast.error('Error al eliminar reporte');
    }
  };

  const toggleField = (field) => {
    setFormData({
      ...formData,
      fields: formData.fields.includes(field)
        ? formData.fields.filter(f => f !== field)
        : [...formData.fields, field]
    });
  };

  if (loading) {
    return <LoadingSpinner message="Cargando reportes..." fullScreen />;
  }

  return (
    <div className="custom-reports-page">
      <div className="page-header">
        <h1>📊 Reportes Personalizados</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Crear Reporte
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Reporte Personalizado</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Tipo de Entidad *</label>
                <select
                  value={formData.entity_type}
                  onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, fields: [] })}
                  required
                >
                  <option value="clients">Clientes</option>
                  <option value="payments">Pagos</option>
                  <option value="installations">Instalaciones</option>
                  <option value="folios">Folios</option>
                </select>
              </div>
              <div className="form-group">
                <label>Campos a Incluir *</label>
                <div className="fields-checkboxes">
                  {entityFields[formData.entity_type]?.map(field => (
                    <label key={field} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.fields.includes(field)}
                        onChange={() => toggleField(field)}
                      />
                      {field}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit" disabled={formData.fields.length === 0}>
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="reports-list">
        {reports.length === 0 ? (
          <p className="no-data">No hay reportes personalizados</p>
        ) : (
          <div className="reports-grid">
            {reports.map(report => (
              <div key={report.id} className="report-card">
                <h3>{report.name}</h3>
                {report.description && <p>{report.description}</p>}
                <p><strong>Tipo:</strong> {report.entity_type}</p>
                <p><strong>Campos:</strong> {report.fields?.join(', ') || 'N/A'}</p>
                <div className="report-actions">
                  <button className="btn-primary" onClick={() => handleExecute(report.id)}>
                    Ejecutar
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(report.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomReports;











