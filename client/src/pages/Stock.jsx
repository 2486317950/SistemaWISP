import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StockForm from '../components/StockForm';
import { useToast } from '../context/ToastContext';
import './Stock.css';

const Stock = () => {
  const { toast } = useToast();
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'low', 'out'
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      const response = await api.get('/stock');
      setStockItems(response.data);
    } catch (error) {
      console.error('Error al cargar stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este insumo del inventario?')) return;
    try {
      await api.delete(`/stock/${id}`);
      fetchStock();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al eliminar el insumo';
      toast.error(errorMessage);
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingItem(null);
    fetchStock();
  };

  const getStockStatus = (item) => {
    if (item.quantity === 0) return 'out';
    if (item.quantity <= item.min_quantity) return 'low';
    return 'ok';
  };

  const filteredItems = stockItems.filter(item => {
    // Filtro por estado
    if (filter === 'low' && getStockStatus(item) !== 'low') return false;
    if (filter === 'out' && getStockStatus(item) !== 'out') return false;
    
    // Filtro por categoría
    if (categoryFilter && item.category !== categoryFilter) return false;
    
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(search) ||
        (item.description && item.description.toLowerCase().includes(search)) ||
        (item.category && item.category.toLowerCase().includes(search))
      );
    }
    
    return true;
  });

  const categories = [...new Set(stockItems.map(item => item.category).filter(Boolean))];

  if (loading) {
    return <div className="loading">Cargando stock...</div>;
  }

  return (
    <div className="stock-page">
      <div className="page-header">
        <h1>📦 Gestión de Stock/Insumos</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar Insumo
        </button>
      </div>

      <div className="stock-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Buscar insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos ({stockItems.length})
          </button>
          <button
            className={`filter-btn ${filter === 'low' ? 'active' : ''}`}
            onClick={() => setFilter('low')}
          >
            ⚠️ Stock Bajo ({stockItems.filter(item => getStockStatus(item) === 'low').length})
          </button>
          <button
            className={`filter-btn ${filter === 'out' ? 'active' : ''}`}
            onClick={() => setFilter('out')}
          >
            ❌ Sin Stock ({stockItems.filter(item => getStockStatus(item) === 'out').length})
          </button>
        </div>

        {categories.length > 0 && (
          <div className="category-filter">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="category-select"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showForm && (
        <StockForm
          stockItem={editingItem}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <p>No hay insumos {searchTerm || categoryFilter || filter !== 'all' ? 'que coincidan con los filtros' : 'registrados'}</p>
          {!searchTerm && !categoryFilter && filter === 'all' && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              Agregar Primer Insumo
            </button>
          )}
        </div>
      ) : (
        <div className="stock-grid">
          {filteredItems.map((item) => {
            const status = getStockStatus(item);
            return (
              <div key={item.id} className={`stock-card ${status}`}>
                <div className="stock-card-header">
                  <div className="stock-status-badge">
                    {status === 'out' && '❌'}
                    {status === 'low' && '⚠️'}
                    {status === 'ok' && '✅'}
                  </div>
                  <h3>{item.name}</h3>
                </div>
                
                <div className="stock-card-body">
                  {item.description && (
                    <p className="stock-description">{item.description}</p>
                  )}
                  
                  <div className="stock-info-grid">
                    <div className="stock-info-item">
                      <span className="stock-label">Cantidad:</span>
                      <span className={`stock-value ${status}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                    
                    {item.min_quantity > 0 && (
                      <div className="stock-info-item">
                        <span className="stock-label">Mínimo:</span>
                        <span className="stock-value">{item.min_quantity} {item.unit}</span>
                      </div>
                    )}
                    
                    {item.cost > 0 && (
                      <div className="stock-info-item">
                        <span className="stock-label">Costo:</span>
                        <span className="stock-value">${item.cost.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {item.category && (
                      <div className="stock-info-item">
                        <span className="stock-label">Categoría:</span>
                        <span className="stock-value">{item.category}</span>
                      </div>
                    )}
                    
                    {item.location && (
                      <div className="stock-info-item">
                        <span className="stock-label">Ubicación:</span>
                        <span className="stock-value">{item.location}</span>
                      </div>
                    )}
                    
                    {item.supplier && (
                      <div className="stock-info-item">
                        <span className="stock-label">Proveedor:</span>
                        <span className="stock-value">{item.supplier}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="stock-card-actions">
                  <button
                    className="btn-edit"
                    onClick={() => {
                      setEditingItem(item);
                      setShowForm(true);
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(item.id)}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Stock;


