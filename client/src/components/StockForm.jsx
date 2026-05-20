import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const StockForm = ({ stockItem, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    unit: 'unidad',
    min_quantity: 0,
    cost: 0,
    location: '',
    supplier: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'Antenas',
    'Cables',
    'Conectores',
    'Equipos',
    'Herramientas',
    'Materiales',
    'Otros'
  ];

  const units = [
    'unidad',
    'metro',
    'kg',
    'litro',
    'caja',
    'rollo',
    'par'
  ];

  useEffect(() => {
    if (stockItem) {
      setFormData({
        name: stockItem.name || '',
        description: stockItem.description || '',
        category: stockItem.category || '',
        quantity: stockItem.quantity || 0,
        unit: stockItem.unit || 'unidad',
        min_quantity: stockItem.min_quantity || 0,
        cost: stockItem.cost || 0,
        location: stockItem.location || '',
        supplier: stockItem.supplier || '',
        notes: stockItem.notes || ''
      });
    }
  }, [stockItem]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'quantity' || name === 'min_quantity' || name === 'cost' 
        ? (value === '' ? 0 : parseFloat(value) || 0)
        : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (stockItem) {
        await api.put(`/stock/${stockItem.id}`, formData);
      } else {
        await api.post('/stock', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el insumo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{stockItem ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Nombre del Insumo *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Antena Ubiquiti NanoStation M5"
              required
            />
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descripción detallada del insumo"
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoría</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Unidad de Medida</label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
              >
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Cantidad Actual *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="0"
                step="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Cantidad Mínima</label>
              <input
                type="number"
                name="min_quantity"
                value={formData.min_quantity}
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="Alerta cuando baje de esta cantidad"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Costo Unitario</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Ubicación</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Ej: Almacén A, Estante 3"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Proveedor</label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notas adicionales"
              rows="2"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockForm;


