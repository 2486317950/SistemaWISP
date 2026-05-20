import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './DashboardWidgets.css';

const DashboardWidgets = ({ onSave }) => {
  const { toast } = useToast();
  const [widgets, setWidgets] = useState([]);
  const [availableWidgets] = useState([
    { type: 'revenue', label: 'Ingresos', icon: '💰' },
    { type: 'expenses', label: 'Gastos', icon: '📉' },
    { type: 'clients', label: 'Clientes', icon: '👥' },
    { type: 'payments', label: 'Pagos', icon: '💵' },
    { type: 'installations', label: 'Instalaciones', icon: '🔧' },
    { type: 'folios', label: 'Folios', icon: '📋' },
    { type: 'credits', label: 'Créditos', icon: '💳' },
    { type: 'chart', label: 'Gráfico', icon: '📊' }
  ]);

  useEffect(() => {
    fetchWidgets();
  }, []);

  const fetchWidgets = async () => {
    try {
      const response = await api.get('/dashboard-widgets');
      setWidgets(response.data || []);
    } catch (error) {
      console.error('Error al cargar widgets:', error);
    }
  };

  const handleToggleWidget = (widgetType) => {
    const existing = widgets.find(w => w.widget_type === widgetType);
    if (existing) {
      setWidgets(widgets.filter(w => w.widget_type !== widgetType));
    } else {
      setWidgets([...widgets, {
        widget_type: widgetType,
        position: widgets.length,
        config: {},
        is_visible: 1
      }]);
    }
  };

  const handleSave = async () => {
    try {
      await api.post('/dashboard-widgets', { widgets });
      if (onSave) onSave();
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar widgets:', error);
      toast.error('Error al guardar configuración');
    }
  };

  return (
    <div className="dashboard-widgets-config">
      <h2>Configurar Widgets del Dashboard</h2>
      <div className="widgets-list">
        {availableWidgets.map(widget => {
          const isEnabled = widgets.some(w => w.widget_type === widget.type);
          return (
            <div
              key={widget.type}
              className={`widget-item ${isEnabled ? 'enabled' : ''}`}
              onClick={() => handleToggleWidget(widget.type)}
            >
              <span className="widget-icon">{widget.icon}</span>
              <span className="widget-label">{widget.label}</span>
              <span className="widget-toggle">{isEnabled ? '✓' : ''}</span>
            </div>
          );
        })}
      </div>
      <button className="btn-primary" onClick={handleSave}>
        Guardar Configuración
      </button>
    </div>
  );
};

export default DashboardWidgets;











