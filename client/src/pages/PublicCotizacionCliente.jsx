import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CotizadorSheetView from '../components/CotizadorSheetView';
import { getCompanyById } from '../config/cotizadorCompanies';
import './PublicCotizacionCliente.css';
import './CotizadorPage.css';

const getBaseApi = () => {
  if (import.meta.env.DEV) return '/api';
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
};

const PublicCotizacionCliente = () => {
  const { publicToken } = useParams();
  const token = publicToken || '';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    fetch(`${getBaseApi()}/public/cotizador-quote/${encodeURIComponent(token)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setError(j.error || 'No se pudo cargar');
          setData(null);
        } else {
          setData(j);
        }
      })
      .catch(() => setError('Error de red'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const company = useMemo(() => (data ? getCompanyById(data.company_id) : null), [data]);

  const totals = useMemo(() => {
    if (!data || !company) return null;
    const items = data.items || [];
    let subtotal = 0;
    items.forEach((row) => {
      const q = parseFloat(row.quantity) || 0;
      const p = parseFloat(row.unit_price) || 0;
      subtotal += q * p;
    });
    const discount = parseFloat(data.discount) || 0;
    const discountType = data.discount_type === 'fixed' ? 'fixed' : 'percentage';
    let discountAmount = 0;
    if (discount > 0) {
      discountAmount = discountType === 'percentage' ? subtotal * (discount / 100) : Math.min(discount, subtotal);
    }
    const subAfter = Math.max(0, subtotal - discountAmount);
    const taxPct = parseFloat(data.tax) || 0;
    const taxAmount = subAfter * (taxPct / 100);
    const total = parseFloat(data.total) || subAfter + taxAmount;
    return { subtotal, discountAmount, taxPct, taxAmount, total };
  }, [data, company]);

  const postDecision = (path) => {
    setSubmitting(true);
    setError('');
    fetch(`${getBaseApi()}/public/cotizador-quote/${encodeURIComponent(token)}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setError(j.error || 'No se pudo registrar');
          if (j.client_status) setDone({ status: j.client_status, message: j.error });
          return;
        }
        setDone({ status: path === 'accept' ? 'aceptada' : 'rechazada', message: j.message });
        load();
      })
      .catch(() => setError('Error de red'))
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="public-cot-page">
        <div className="public-cot-card">Cargando cotización…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="public-cot-page">
        <div className="public-cot-card public-cot-error">{error}</div>
      </div>
    );
  }

  if (!data || !company || !totals) {
    return null;
  }

  const canRespond = data.can_respond && !done;
  const statusLabel =
    data.client_status === 'aceptada'
      ? 'Aceptada'
      : data.client_status === 'rechazada'
        ? 'Rechazada'
        : 'Pendiente de tu respuesta';

  return (
    <div className="public-cot-page">
      <div className="public-cot-header">
        <h1>Cotización</h1>
        <p className="public-cot-ref">Ref. {data.folio}</p>
        <p className="public-cot-status">
          Estado: <strong>{statusLabel}</strong>
        </p>
      </div>

      {done ? (
        <div className={`public-cot-banner ${done.status === 'aceptada' ? 'is-ok' : 'is-no'}`}>{done.message}</div>
      ) : null}
      {error && data ? <div className="public-cot-banner is-warn">{error}</div> : null}

      <div className="public-cot-sheet-wrap">
        <CotizadorSheetView
          company={company}
          folio={data.folio}
          quotationDate={data.quotation_date}
          validUntil={data.valid_until}
          clientName={data.client_name}
          clientAddress={data.client_address}
          clientEmail={data.client_email}
          clientPhone={data.client_phone}
          items={data.items}
          subtotal={totals.subtotal}
          discountAmount={totals.discountAmount}
          taxPct={totals.taxPct}
          taxAmount={totals.taxAmount}
          total={totals.total}
          notes={data.notes}
          terms={data.terms}
          footerExtra={
            data.client_responded_at
              ? `Respuesta del cliente: ${statusLabel} · ${new Date(data.client_responded_at).toLocaleString('es-MX')}`
              : undefined
          }
        />
      </div>

      {canRespond ? (
        <div className="public-cot-actions">
          <p className="public-cot-actions-title">¿Deseas aceptar o rechazar esta cotización?</p>
          <div className="public-cot-buttons">
            <button
              type="button"
              className="public-cot-btn public-cot-btn-reject"
              disabled={submitting}
              onClick={() => postDecision('reject')}
            >
              Rechazar
            </button>
            <button
              type="button"
              className="public-cot-btn public-cot-btn-accept"
              disabled={submitting}
              onClick={() => postDecision('accept')}
            >
              Aceptar
            </button>
          </div>
        </div>
      ) : null}

      {!canRespond && !done ? (
        <p className="public-cot-closed">Esta cotización ya no admite respuesta en línea.</p>
      ) : null}
    </div>
  );
};

export default PublicCotizacionCliente;
