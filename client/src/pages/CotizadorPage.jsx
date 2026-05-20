import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { COTIZADOR_COMPANIES, getCompanyById } from '../config/cotizadorCompanies';
import CotizadorSheetView from '../components/CotizadorSheetView';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { publicCotizacionClienteUrl } from '../utils/cotizadorShareUrl';
import './CotizadorPage.css';

const getLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const emptyItem = () => ({
  description: '',
  quantity: 1,
  unit_price: 0,
});

/** Iniciales del cliente: primera letra del nombre + primera del apellido (ej. María López → ML). */
function initialsFromClientName(rawName) {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return 'XX';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstLetter = (s) => {
    const n = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const m = n.match(/[A-Za-z]/);
    return m ? m[0].toUpperCase() : '';
  };
  if (parts.length === 1) {
    const letters = parts[0]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase();
    const a = letters[0] || 'X';
    const b = letters[1] || a;
    return `${a}${b}`;
  }
  const a = firstLetter(parts[0]) || 'X';
  const b = firstLetter(parts[parts.length - 1]) || 'X';
  return `${a}${b}`;
}

/** Fecha en folio: DD/MMYY como 14/0226 (14 feb 2026). */
function folioFechaCorta(quotationDate) {
  if (!quotationDate || !/^\d{4}-\d{2}-\d{2}$/.test(quotationDate)) return '00/0000';
  const [y, m, d] = quotationDate.split('-');
  return `${d}/${m}${y.slice(-2)}`;
}

/** Folio: INICIALES-CÓDIGO-DIVISIÓN-DD/MMYY (ej. ML-CDENER-14/0226). */
function buildCotizadorFolio(quotationDate, company, clientName) {
  const ini = initialsFromClientName(clientName);
  const brand = company.folioBrand || 'CDCOM';
  const fecha = folioFechaCorta(quotationDate);
  return `${ini}-${brand}-${fecha}`;
}

const CotizadorPage = () => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState(COTIZADOR_COMPANIES[0].id);
  const company = useMemo(() => getCompanyById(companyId), [companyId]);

  const [quotationDate, setQuotationDate] = useState(getLocalDateString());
  const [validUntil, setValidUntil] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    'Precios en MXN. La vigencia de esta cotización se indica en el documento. Servicios sujetos a disponibilidad técnica en la zona.'
  );

  const [savedRows, setSavedRows] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [publicTokenSaved, setPublicTokenSaved] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshSaved = useCallback(() => {
    api
      .get('/cotizador-quotes')
      .then((r) => setSavedRows(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSavedLoading(true);
    api
      .get('/cotizador-quotes')
      .then((res) => {
        if (!cancelled) setSavedRows(res.data || []);
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudo cargar el listado de cotizaciones guardadas');
      })
      .finally(() => {
        if (!cancelled) setSavedLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  const folio = useMemo(
    () => buildCotizadorFolio(quotationDate, company, clientName),
    [quotationDate, company, clientName]
  );

  const subtotal = useMemo(() => {
    return items.reduce((acc, row) => {
      const q = parseFloat(row.quantity) || 0;
      const p = parseFloat(row.unit_price) || 0;
      return acc + q * p;
    }, 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    if (d <= 0) return 0;
    if (discountType === 'percentage') return subtotal * (d / 100);
    return Math.min(d, subtotal);
  }, [subtotal, discount, discountType]);

  const subAfter = Math.max(0, subtotal - discountAmount);
  const taxPct = parseFloat(tax) || 0;
  const taxAmount = subAfter * (taxPct / 100);
  const total = subAfter + taxAmount;

  const updateItem = (index, field, raw) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (field === 'description') row.description = raw;
      else row[field] = parseFloat(raw) || 0;
      next[index] = row;
      return next;
    });
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  const buildPayload = () => ({
    company_id: companyId,
    folio,
    client_name: clientName.trim(),
    client_email: clientEmail.trim() || null,
    client_phone: clientPhone.trim() || null,
    client_address: clientAddress.trim() || null,
    quotation_date: quotationDate,
    valid_until: validUntil || null,
    discount: parseFloat(discount) || 0,
    discount_type: discountType,
    tax: parseFloat(tax) || 0,
    notes: notes.trim() || null,
    terms: terms.trim() || null,
    items: items.map((row) => ({
      description: row.description,
      quantity: parseFloat(row.quantity) || 0,
      unit_price: parseFloat(row.unit_price) || 0,
    })),
  });

  const handleSave = async () => {
    if (!clientName.trim()) {
      toast.error('Indica el nombre del cliente');
      return;
    }
    const payload = buildPayload();
    if (!payload.items.some((i) => String(i.description || '').trim())) {
      toast.error('Agrega al menos un concepto con descripción');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { data } = await api.put(`/cotizador-quotes/${editingId}`, payload);
        toast.success(data.message || 'Cotización actualizada');
        if (data.public_token) setPublicTokenSaved(data.public_token);
        refreshSaved();
      } else {
        const { data } = await api.post('/cotizador-quotes', payload);
        toast.success(data.message || 'Cotización guardada');
        setEditingId(data.id);
        setPublicTokenSaved(data.public_token || '');
        refreshSaved();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setPublicTokenSaved('');
    setCompanyId(COTIZADOR_COMPANIES[0].id);
    setQuotationDate(getLocalDateString());
    setValidUntil('');
    setClientName('');
    setClientAddress('');
    setClientEmail('');
    setClientPhone('');
    setItems([emptyItem()]);
    setDiscount(0);
    setDiscountType('percentage');
    setTax(0);
    setNotes('');
    setTerms(
      'Precios en MXN. La vigencia de esta cotización se indica en el documento. Servicios sujetos a disponibilidad técnica en la zona.'
    );
  };

  const loadSaved = async (id) => {
    try {
      const { data } = await api.get(`/cotizador-quotes/${id}`);
      setEditingId(data.id);
      setPublicTokenSaved(data.public_token || '');
      setCompanyId(data.company_id || COTIZADOR_COMPANIES[0].id);
      setClientName(data.client_name || '');
      setClientAddress(data.client_address || '');
      setClientEmail(data.client_email || '');
      setClientPhone(data.client_phone || '');
      setQuotationDate(data.quotation_date || getLocalDateString());
      setValidUntil(data.valid_until || '');
      setDiscount(data.discount ?? 0);
      setDiscountType(data.discount_type === 'fixed' ? 'fixed' : 'percentage');
      setTax(data.tax ?? 0);
      setNotes(data.notes || '');
      setTerms(data.terms || '');
      if (data.items && data.items.length > 0) {
        setItems(
          data.items.map((it) => ({
            description: it.description || '',
            quantity: parseFloat(it.quantity) || 0,
            unit_price: parseFloat(it.unit_price) || 0,
          }))
        );
      } else {
        setItems([emptyItem()]);
      }
      toast.success('Cotización cargada en el editor');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al cargar');
    }
  };

  const copyShareLink = () => {
    const url = publicCotizacionClienteUrl(publicTokenSaved);
    if (!url) {
      toast.error('Guarda la cotización para generar el enlace al cliente');
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado al portapapeles'),
      () => toast.error('No se pudo copiar (permiso del navegador)')
    );
  };

  const openClientPreview = () => {
    const url = publicCotizacionClienteUrl(publicTokenSaved);
    if (!url) {
      toast.error('Guarda primero para obtener la vista del cliente');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteSaved = async (id) => {
    if (!window.confirm('¿Eliminar esta cotización guardada?')) return;
    try {
      await api.delete(`/cotizador-quotes/${id}`);
      toast.success('Eliminada');
      if (editingId === id) handleNew();
      refreshSaved();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const shareUrlDisplay = publicCotizacionClienteUrl(publicTokenSaved);

  return (
    <div className="cotizador-page">
      <div className="cotizador-triple-row">
        <section className="cotizador-controls no-print" aria-label="Editor de cotización">
          <h1 className="cotizador-h1">Cotizador con plantillas</h1>
          <p className="cotizador-intro">
            Usa las mismas credenciales que el panel. Elige la división del ecosistema CDCom (mismas empresas e imágenes que en la página
            principal del dominio). Cada una aplica un diseño distinto a la hoja (vista previa e impresión). Puedes guardar, compartir un enlace
            único con el cliente y que responda desde el navegador.
          </p>

          <div className="cotizador-toolbar">
            <button type="button" className="cotizador-btn-secondary" onClick={handleNew}>
              Nueva cotización
            </button>
            <button type="button" className="cotizador-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar guardada' : 'Guardar cotización'}
            </button>
            <button type="button" className="cotizador-btn-secondary" onClick={openClientPreview} disabled={!publicTokenSaved}>
              Previsualizar (cliente)
            </button>
            <button type="button" className="cotizador-btn-secondary" onClick={copyShareLink} disabled={!publicTokenSaved}>
              Copiar enlace cliente
            </button>
          </div>
          {shareUrlDisplay ? (
            <div className="cotizador-share-url">
              <span className="cotizador-share-label">Enlace público</span>
              <code>{shareUrlDisplay}</code>
            </div>
          ) : null}

          <div className="cotizador-field">
          <label htmlFor="cotizador-empresa">División (como en la web principal)</label>
          <select
            id="cotizador-empresa"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="cotizador-select"
          >
            {COTIZADOR_COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="cotizador-grid2">
          <div className="cotizador-field">
            <label>Fecha de cotización</label>
            <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} />
          </div>
          <div className="cotizador-field">
            <label>Válida hasta</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>

        <h2 className="cotizador-h2">Cliente</h2>
        <div className="cotizador-grid2">
          <div className="cotizador-field cotizador-field-span2">
            <label>Nombre</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre o razón social" />
          </div>
          <div className="cotizador-field cotizador-field-span2">
            <label>Folio de cotización</label>
            <div className="cotizador-folio-readonly" title={folio}>
              {folio}
            </div>
            <p className="cotizador-folio-hint">
              Formato: <strong>iniciales</strong> del cliente, <strong>código</strong> de la división ({company.folioBrand}) y{' '}
              <strong>fecha</strong> (día/mes + año en 2 cifras, ej. 14/0226 = 14-feb-2026).
            </p>
          </div>
          <div className="cotizador-field cotizador-field-span2">
            <label>Dirección</label>
            <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
          </div>
          <div className="cotizador-field">
            <label>Correo</label>
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div className="cotizador-field">
            <label>Teléfono</label>
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
        </div>

        <h2 className="cotizador-h2">Conceptos</h2>
        <div className="cotizador-items-editor">
          {items.map((row, index) => (
            <div key={index} className="cotizador-item-row">
              <input
                className="cotizador-desc"
                placeholder="Descripción"
                value={row.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="cotizador-qty"
                value={row.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="cotizador-price"
                value={row.unit_price}
                onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
              />
              <span className="cotizador-line-sub">${(row.quantity * row.unit_price).toFixed(2)}</span>
              <button type="button" className="cotizador-remove" onClick={() => removeRow(index)} disabled={items.length <= 1}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="cotizador-add-row" onClick={addRow}>
            + Línea
          </button>
        </div>

        <div className="cotizador-grid2">
          <div className="cotizador-field">
            <label>Descuento</label>
            <div className="cotizador-inline">
              <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="percentage">%</option>
                <option value="fixed">MXN</option>
              </select>
            </div>
          </div>
          <div className="cotizador-field">
            <label>IVA / impuesto (%)</label>
            <input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
        </div>

        <div className="cotizador-field">
          <label>Notas</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="cotizador-field">
          <label>Términos</label>
          <textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>

        <div className="cotizador-actions">
          <button type="button" className="cotizador-btn-print" onClick={handlePrint}>
            Imprimir / PDF
          </button>
        </div>
        </section>

        <div className="cotizador-sheet-preview" aria-label="Vista previa de cotización">
          <p className="cotizador-sheet-preview-label no-print">Vista previa</p>
          <div className="cotizador-sheet-wrap cotizador-sheet-wrap--inline">
            <CotizadorSheetView
              company={company}
              folio={folio}
              quotationDate={quotationDate}
              validUntil={validUntil}
              clientName={clientName}
              clientAddress={clientAddress}
              clientEmail={clientEmail}
              clientPhone={clientPhone}
              items={items}
              subtotal={subtotal}
              discountAmount={discountAmount}
              taxPct={taxPct}
              taxAmount={taxAmount}
              total={total}
              notes={notes}
              terms={terms}
              footerExtra={`Documento generado desde SistemaWISP · ${new Date().toLocaleDateString('es-MX')}`}
            />
          </div>
        </div>

        <aside className="cotizador-saved-sidebar no-print" aria-label="Visualizador de cotizaciones">
          <h2 className="cotizador-saved-sidebar-title">Visualizador</h2>
          <p className="cotizador-saved-sidebar-hint">Selecciona una para abrirla en el editor.</p>
          <div className="cotizador-saved-wrap cotizador-saved-wrap--sidebar">
            {savedLoading ? (
              <p className="cotizador-saved-muted">Cargando…</p>
            ) : savedRows.length === 0 ? (
              <p className="cotizador-saved-muted">Aún no hay cotizaciones guardadas.</p>
            ) : (
              <ul className="cotizador-saved-list">
                {savedRows.map((row) => (
                  <li key={row.id} className={`cotizador-saved-item ${editingId === row.id ? 'cotizador-saved-item--active' : ''}`}>
                    <div className="cotizador-saved-main">
                      <strong>{row.folio}</strong>
                      <span className="cotizador-saved-meta">
                        {row.client_name} · {row.company_id} · ${parseFloat(row.total || 0).toFixed(2)}
                      </span>
                      <span className={`cotizador-saved-status cotizador-saved-status--${row.client_status || 'pendiente'}`}>
                        Cliente: {row.client_status || 'pendiente'}
                      </span>
                    </div>
                    <div className="cotizador-saved-actions">
                      <button type="button" className="cotizador-mini-btn" onClick={() => loadSaved(row.id)}>
                        Abrir
                      </button>
                      <button
                        type="button"
                        className="cotizador-mini-btn"
                        onClick={() => window.open(publicCotizacionClienteUrl(row.public_token), '_blank')}
                      >
                        Ver
                      </button>
                      <button type="button" className="cotizador-mini-btn cotizador-mini-btn-danger" onClick={() => handleDeleteSaved(row.id)}>
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CotizadorPage;
