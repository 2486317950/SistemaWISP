import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import FolioForm from '../components/FolioForm';
import { generateFolioPDF, downloadFolioPDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './Folios.css';

// Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
};

const Folios = () => {
  const { toast } = useToast();
  const [folios, setFolios] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFolio, setEditingFolio] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    fetchFolios();
    fetchClients();
  }, []);

  const fetchFolios = async () => {
    try {
      const response = await api.get('/folios');
      setFolios(response.data);
    } catch (error) {
      console.error('Error al cargar folios:', error);
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
    if (!window.confirm('¿Eliminar este folio?')) return;
    try {
      await api.delete(`/folios/${id}`);
      fetchFolios();
    } catch (error) {
      toast.error('Error al eliminar el folio');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingFolio(null);
    fetchFolios();
  };

  const getResolutionMethodLabel = (method) => {
    const methods = {
      'visita-domiciliaria': 'Visita Domiciliaria',
      'chat-ia': 'Chat con IA',
      'asesor': 'Asesor',
      'remoto': 'Soporte Remoto',
      'otro': 'Otro'
    };
    return methods[method] || method || '-';
  };

  // Función helper para formatear fechas sin problemas de zona horaria
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Si la fecha viene en formato YYYY-MM-DD, la parseamos manualmente
    const dateParts = dateString.split('T')[0].split('-');
    if (dateParts.length === 3) {
      const [year, month, day] = dateParts;
      // Crear fecha en hora local para evitar problemas de zona horaria
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('es-ES');
    }
    // Fallback: intentar con Date normal
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  // Filtrar folios por búsqueda
  const filteredFolios = useMemo(() => {
    return folios.filter(folio => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      const formattedDate = folio.visit_date ? formatDate(folio.visit_date).toLowerCase() : '';
      const isoDate = folio.visit_date ? folio.visit_date.toLowerCase() : '';
      const resolutionDate = folio.resolution_date ? formatDate(folio.resolution_date).toLowerCase() : '';
      const resolutionMethod = getResolutionMethodLabel(folio.resolution_method).toLowerCase();
      
      return (
        (folio.folio_number && folio.folio_number.toLowerCase().includes(searchLower)) ||
        (folio.client_name && folio.client_name.toLowerCase().includes(searchLower)) ||
        (folio.client_number && folio.client_number.toLowerCase().includes(searchLower)) ||
        (folio.client_address && folio.client_address.toLowerCase().includes(searchLower)) ||
        (folio.problem_description && folio.problem_description.toLowerCase().includes(searchLower)) ||
        (folio.status && folio.status.toLowerCase().includes(searchLower)) ||
        (folio.technician_notes && folio.technician_notes.toLowerCase().includes(searchLower)) ||
        (resolutionMethod && resolutionMethod.includes(searchLower)) ||
        (formattedDate && formattedDate.includes(searchLower)) ||
        (isoDate && isoDate.includes(searchLower)) ||
        (resolutionDate && resolutionDate.includes(searchLower)) ||
        (folio.resolution_cost && folio.resolution_cost.toString().includes(searchLower))
      );
    });
  }, [folios, searchTerm]);

  // Agrupar folios por mes
  const foliosByMonth = useMemo(() => {
    const grouped = {};
    
    filteredFolios.forEach(folio => {
      const date = parseLocalDate(folio.visit_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          folios: [],
          totalCost: 0,
          totalFolios: 0
        };
      }
      
      grouped[monthKey].folios.push(folio);
      grouped[monthKey].totalCost += parseFloat(folio.resolution_cost) || 0;
      grouped[monthKey].totalFolios += 1;
    });
    
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredFolios]);

  const toggleMonth = (monthKey) => {
    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
  };

  if (loading) {
    return <div className="loading">Cargando folios...</div>;
  }

  return (
    <div className="folios-page">
      <div className="page-header">
        <h1>Folios de Reparación</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Crear Folio
        </button>
      </div>

      {showForm && (
        <FolioForm
          folio={editingFolio}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingFolio(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Buscar por número de folio, cliente, domicilio, problema, estado, método de resolución, notas o fecha..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {foliosByMonth.length === 0 ? (
        <div className="empty-state">
          <p>{searchTerm ? 'No se encontraron folios que coincidan con la búsqueda' : 'No hay folios registrados'}</p>
        </div>
      ) : (
        <div className="payments-by-month">
          {foliosByMonth.map((monthData) => (
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
                    <span className="stat-label">Total Folios:</span>
                    <span className="stat-value">{monthData.totalFolios}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Costo Total:</span>
                    <span className="stat-value amount">${monthData.totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {selectedMonth === monthData.monthKey && (
                <div className="month-card-content">
                  <div className="folios-table-container">
                    <table className="folios-table">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Fecha Visita</th>
                          <th>Cliente</th>
                          <th>N° Cliente</th>
                          <th>Domicilio</th>
                          <th>Problema</th>
                          <th>Estado</th>
                          <th>Método Resolución</th>
                          <th>Fecha Resolución</th>
                          <th>Costo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.folios.length === 0 ? (
                          <tr>
                            <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              No hay folios en este mes
                            </td>
                          </tr>
                        ) : (
                          monthData.folios.map((folio) => (
              <tr key={folio.id}>
                <td><strong>{folio.folio_number}</strong></td>
                <td>{formatDate(folio.visit_date)}</td>
                <td>{folio.client_name}</td>
                <td>{folio.client_number || '-'}</td>
                <td>{folio.client_address}</td>
                <td>{folio.problem_description ? (folio.problem_description.length > 30 ? folio.problem_description.substring(0, 30) + '...' : folio.problem_description) : '-'}</td>
                <td>
                  <span className={`status-badge status-${folio.status}`}>
                    {folio.status}
                  </span>
                </td>
                <td>
                  {folio.resolution_method ? (
                    <span className="resolution-method-badge">
                      {getResolutionMethodLabel(folio.resolution_method)}
                    </span>
                  ) : '-'}
                </td>
                <td>{formatDate(folio.resolution_date)}</td>
                <td>{folio.resolution_cost ? `$${parseFloat(folio.resolution_cost).toFixed(2)}` : '-'}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-icon"
                      onClick={() => generateFolioPDF(folio)}
                      title="Previsualizar PDF"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => downloadFolioPDF(folio)}
                      title="Descargar PDF"
                    >
                      📥
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => {
                        setEditingFolio(folio);
                        setShowForm(true);
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(folio.id)}
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

export default Folios;

