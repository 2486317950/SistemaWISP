import React, { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './AutoBilling.css';

const AutoBilling = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ is_enabled: 0, day_of_month: 1 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auto-billing/settings');
      setSettings(response.data || { is_enabled: 0, day_of_month: 1 });
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/auto-billing/settings', settings);
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      toast.error('Error al guardar configuración');
    }
  };

  const handleGenerate = async () => {
    if (!confirm('¿Generar facturas automáticas para este mes?')) return;
    try {
      setGenerating(true);
      const response = await api.post('/auto-billing/generate');
      toast.success(`Facturación completada: ${response.data.generated} facturas generadas`);
    } catch (error) {
      console.error('Error al generar facturas:', error);
      toast.error('Error al generar facturas');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando configuración..." fullScreen />;
  }

  return (
    <div className="auto-billing-page">
      <div className="page-header">
        <h1>🧾 Facturación Automática</h1>
      </div>

      <div className="settings-section">
        <h2>Configuración</h2>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.is_enabled === 1}
              onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked ? 1 : 0 })}
            />
            Habilitar facturación automática
          </label>
        </div>
        <div className="form-group">
          <label>Día del mes para generar facturas</label>
          <input
            type="number"
            min="1"
            max="28"
            value={settings.day_of_month}
            onChange={(e) => setSettings({ ...settings, day_of_month: parseInt(e.target.value) })}
          />
        </div>
        <button className="btn-primary" onClick={handleSaveSettings}>
          Guardar Configuración
        </button>
      </div>

      <div className="generate-section">
        <h2>Generar Facturas Manualmente</h2>
        <p>Genera facturas automáticas para todos los clientes activos del mes actual.</p>
        <button 
          className="btn-primary" 
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generando...' : 'Generar Facturas del Mes'}
        </button>
      </div>
    </div>
  );
};

export default AutoBilling;











