import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './ElectronicInvoices.css';

const ElectronicInvoices = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices');
  const [form, setForm] = useState({
    proveedor: 'Facturama',
    rfc: '',
    regimen_fiscal: '601',
    usuario_api: '',
    password_api: '',
    url_api: 'https://api.facturama.mx',
    serie: 'A'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, invoicesRes] = await Promise.all([
        api.get('/electronic-invoices/config'),
        api.get('/electronic-invoices')
      ]);
      setConfig(configRes.data);
      setInvoices(invoicesRes.data || []);
      if (configRes.data?.configured) {
        setForm(f => ({
          ...f,
          proveedor: configRes.data.proveedor || f.proveedor,
          rfc: configRes.data.rfc || f.rfc,
          regimen_fiscal: configRes.data.regimen_fiscal || f.regimen_fiscal,
          serie: configRes.data.serie || f.serie
        }));
      }
    } catch (err) {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/electronic-invoices/config', form);
      toast.success('Configuración guardada');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (receiptId) => {
    try {
      const res = await api.post('/electronic-invoices/generate', { receipt_id: receiptId });
      toast.success(res.data?.message || 'Factura generada');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Error al generar');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s;
  };

  return (
    <div className="electronic-invoices">
      <h1>Facturación Electrónica (CFDI)</h1>
      <p className="page-desc">
        Configura la integración con tu proveedor de facturación (Facturama, SW Sapien, etc.) para generar CFDI válidos ante el SAT.
      </p>

      <div className="ei-tabs">
        <button
          className={activeTab === 'invoices' ? 'active' : ''}
          onClick={() => setActiveTab('invoices')}
        >
          Facturas
        </button>
        <button
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          Configuración
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="ei-config-section">
          <form onSubmit={handleSaveConfig} className="ei-form">
            <div className="ei-form-row">
              <label>Proveedor</label>
              <select
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              >
                <option value="Facturama">Facturama</option>
                <option value="SW Sapien">SW Sapien</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="ei-form-row">
              <label>RFC *</label>
              <input
                type="text"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                placeholder="XAXX010101000"
                maxLength={13}
                required
              />
            </div>
            <div className="ei-form-row">
              <label>Régimen fiscal</label>
              <input
                type="text"
                value={form.regimen_fiscal}
                onChange={(e) => setForm({ ...form, regimen_fiscal: e.target.value })}
                placeholder="601 - General de Ley"
              />
            </div>
            <div className="ei-form-row">
              <label>URL API</label>
              <input
                type="url"
                value={form.url_api}
                onChange={(e) => setForm({ ...form, url_api: e.target.value })}
                placeholder="https://api.facturama.mx"
              />
            </div>
            <div className="ei-form-row">
              <label>Usuario API</label>
              <input
                type="text"
                value={form.usuario_api}
                onChange={(e) => setForm({ ...form, usuario_api: e.target.value })}
                placeholder="Usuario del proveedor"
              />
            </div>
            <div className="ei-form-row">
              <label>Contraseña API</label>
              <input
                type="password"
                value={form.password_api}
                onChange={(e) => setForm({ ...form, password_api: e.target.value })}
                placeholder="Contraseña (no se muestra si ya está guardada)"
              />
            </div>
            <div className="ei-form-row">
              <label>Serie</label>
              <input
                type="text"
                value={form.serie}
                onChange={(e) => setForm({ ...form, serie: e.target.value })}
                placeholder="A"
              />
            </div>
            <button type="submit" className="ei-save-btn" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </form>
          {config?.configured && (
            <div className="ei-config-status">
              ✓ Configuración activa: {config.proveedor} - RFC {config.rfc}
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="ei-invoices-section">
          {loading ? (
            <div className="loading">Cargando...</div>
          ) : (
            <>
              <p className="ei-note">
                Las facturas se generan desde Recibos. Conecta un proveedor real en Configuración para timbrado ante el SAT.
              </p>
              {invoices.length === 0 ? (
                <div className="empty-state">No hay facturas electrónicas generadas</div>
              ) : (
                <div className="ei-table-wrap">
                  <table className="ei-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>UUID</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>{inv.folio}</td>
                          <td>{inv.client_name} ({inv.client_number})</td>
                          <td>${parseFloat(inv.total || 0).toFixed(2)}</td>
                          <td className="uuid-cell">{inv.uuid || '-'}</td>
                          <td><span className="status-badge">{inv.estado_sat || 'generado'}</span></td>
                          <td>{formatDate(inv.fecha_emision)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ElectronicInvoices;
