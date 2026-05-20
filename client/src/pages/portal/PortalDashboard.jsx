import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import portalApi from '../../services/portalApi';
import './PortalDashboard.css';

const PortalDashboard = () => {
  const [balance, setBalance] = useState(null);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState({});
  const [lastReceipt, setLastReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMessage, setStripeMessage] = useState(null);
  const [stripeRecurring, setStripeRecurring] = useState(false);
  const [stripeChargeDay, setStripeChargeDay] = useState('1');

  const loadData = () => {
    return Promise.all([
      portalApi.get('/client-portal/balance'),
      portalApi.get('/client-portal/service-info').catch(() => null),
      portalApi.get('/client-portal/announcements').catch(() => []),
      portalApi.get('/client-portal/settings').catch(() => ({})),
      portalApi.get('/client-portal/last-receipt').catch(() => null)
    ]).then(([balRes, svcRes, annRes, setRes, lastRes]) => {
      setBalance(balRes.data);
      setServiceInfo(svcRes?.data || null);
      setAnnouncements(Array.isArray(annRes?.data) ? annRes.data : []);
      setSettings(setRes?.data || {});
      setLastReceipt(lastRes?.data || null);
    });
  };

  useEffect(() => {
    loadData()
      .catch((err) => setError(err.response?.data?.error || 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!serviceInfo) return;
    const sug = parseInt(serviceInfo.package_suggested_charge_day, 10);
    const existing = parseInt(serviceInfo.card_charge_day, 10);
    const pick =
      Number.isFinite(sug) && sug >= 1 && sug <= 28
        ? sug
        : Number.isFinite(existing) && existing >= 1 && existing <= 28
          ? existing
          : 1;
    setStripeChargeDay(String(pick));
    setStripeRecurring(
      serviceInfo.card_recurring_debit === 1 ||
        serviceInfo.card_recurring_debit === true ||
        serviceInfo.stripe_subscription_status === 'active'
    );
  }, [serviceInfo]);

  // Mensaje tras volver de Stripe (éxito o cancelado). Confirmar sesión para registrar pago si el webhook no llegó.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripe = params.get('stripe');
    const sessionId = params.get('session_id');
    if (stripe === 'success') {
      setStripeMessage({ type: 'success', text: 'Pago realizado correctamente. Se reflejará en tu cuenta en unos momentos.' });
      window.history.replaceState({}, '', window.location.pathname);
      if (sessionId) {
        portalApi.post('/client-portal/confirm-stripe-session', { session_id: sessionId })
          .then(() => loadData())
          .catch(() => loadData());
      } else {
        loadData();
      }
    } else if (stripe === 'canceled') {
      setStripeMessage({ type: 'cancel', text: 'Pago cancelado.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const rawDue = balance?.amount_still_owed ?? balance?.amount_to_pay ?? 0;
  const amountDue = (parseFloat(rawDue) || 0) <= 1 ? 0 : parseFloat(rawDue) || 0;
  const canPayStripe = amountDue >= 10; // Stripe exige mínimo $10 MXN

  const handlePay = (paymentMethod) => {
    const amount = amountDue;
    if (amount < 0.5) return;
    setStripeMessage(null);
    setStripeLoading(true);
    const payload = { amount, payment_method: paymentMethod };
    if (paymentMethod === 'card') {
      payload.recurring = !!stripeRecurring;
      payload.charge_day = stripeRecurring ? parseInt(stripeChargeDay, 10) : undefined;
    }
    portalApi.post('/client-portal/create-checkout-session', payload)
      .then((res) => {
        if (res.data?.url) window.location.href = res.data.url;
        else setStripeMessage({ type: 'error', text: 'No se recibió la URL de pago.' });
      })
      .catch((err) => {
        setStripeMessage({ type: 'error', text: err.response?.data?.error || 'No se pudo iniciar el pago. Intenta más tarde.' });
      })
      .finally(() => setStripeLoading(false));
  };

  const handleApplyPromo = () => {
    const pending = balance?.pending_promotional_discount;
    if (!pending || applyingPromo) return;
    setApplyingPromo(true);
    setPromoMessage(null);
    portalApi.post('/client-portal/apply-promo')
      .then((res) => {
        setPromoMessage(res.data?.message || 'Descuento aplicado correctamente.');
        return loadData();
      })
      .catch((err) => setPromoMessage(err.response?.data?.error || 'No se pudo aplicar el descuento.'))
      .finally(() => setApplyingPromo(false));
  };

  if (loading) {
    return <div className="portal-loading">Cargando...</div>;
  }

  if (error) {
    return (
      <div className="portal-error-box">
        {error}
        <button type="button" className="portal-retry-btn" onClick={() => { setError(''); setLoading(true); loadData().catch((err) => setError(err.response?.data?.error || 'Error al cargar')).finally(() => setLoading(false)); }}>
          Reintentar
        </button>
      </div>
    );
  }

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') : s.split('-').reverse().join('/');
  };

  const serviceStatusLabel = (s) => ({ activo: 'Activo', suspendido: 'Suspendido', baja: 'Baja' }[s] || s || 'Activo');

  const now = new Date();
  const day = now.getDate();
  const monthName = now.toLocaleDateString('es', { month: 'long' });
  const paymentReminder = day <= 6
    ? `📅 Período de pago actual: 1 al 6 de ${monthName}. ${6 - day} día(s) restante(s).`
    : day < 28
      ? `📅 Próximo período de pago: 1 al 6 de ${now.toLocaleDateString('es', { month: 'long', year: 'numeric' }).split(' ').slice(1).join(' ')}.`
      : `📅 Próximo período de pago: 1 al 6 del próximo mes.`;

  const paymentMethods = Array.isArray(settings.payment_methods) && settings.payment_methods.length > 0
    ? settings.payment_methods
    : [
        { name: 'Depósito / OXXO', detail: 'Tarjeta: 4217 4701 7385 4544' },
        { name: 'Transferencia bancaria', detail: 'CLABE: 728969000131749378' }
      ].map((m) => `${m.name} | ${m.detail}`);

  const parsePaymentMethod = (str) => {
    if (!str || typeof str !== 'string') return { name: str, detail: '' };
    const idx = str.indexOf('|');
    if (idx >= 0) return { name: str.slice(0, idx).trim(), detail: str.slice(idx + 1).trim() };
    return { name: str, detail: '' };
  };

  const hasContact = settings.contact_phone || settings.contact_whatsapp;
  const serviceStatus = settings.service_status || 'normal';
  const showServiceBanner = serviceStatus !== 'normal' && settings.service_status_message;

  return (
    <div className="portal-dashboard">
      <h2>Resumen de tu cuenta</h2>

      {showServiceBanner && (
        <div className={`portal-service-status-banner status-${serviceStatus}`}>
          <strong>{serviceStatus === 'mantenimiento' ? '🔧 Mantenimiento' : '⚠️ Aviso'}</strong>
          <p>{settings.service_status_message}</p>
        </div>
      )}

      {serviceInfo && (
        <div className="portal-service-card">
          <h3>📡 Tu servicio</h3>
          <div className="service-info-grid">
            <div><span className="label">Estado:</span> <span className={`status-badge status-${serviceInfo.service_status || 'activo'}`}>{serviceStatusLabel(serviceInfo.service_status)}</span></div>
            <div><span className="label">Paquete:</span> {serviceInfo.package_name || '-'} {serviceInfo.speed ? `(${serviceInfo.speed})` : ''}</div>
            <div><span className="label">Próximo período de pago:</span> 1 al 6 de cada mes</div>
          </div>
          <div className="portal-payment-reminder">
            {paymentReminder}
          </div>
        </div>
      )}

      {announcements.length > 0 && (
        <div className="portal-announcements">
          <h3>📢 Avisos</h3>
          {announcements.map((a) => (
            <div key={a.id} className={`announcement-item type-${a.type || 'info'}`}>
              <strong>{a.title}</strong>
              {a.content && <p>{a.content}</p>}
            </div>
          ))}
        </div>
      )}

      {balance?.pending_promotional_discount && (
        <div className="portal-promo-banner">
          <div className="portal-promo-banner-content">
            <span className="portal-promo-banner-icon">🎁</span>
            <div>
              <strong>Tienes un descuento disponible</strong>
              {balance.pending_promotional_discount.description && (
                <p className="portal-promo-banner-desc">{balance.pending_promotional_discount.description}</p>
              )}
              {!balance.pending_promotional_discount.description && (
                <p className="portal-promo-banner-desc">
                  {balance.pending_promotional_discount.discount_type === 'percent'
                    ? `${balance.pending_promotional_discount.discount_value}% de descuento en tu mensualidad`
                    : `$${parseFloat(balance.pending_promotional_discount.discount_value).toFixed(2)} de descuento`}
                </p>
              )}
            </div>
            <button
              type="button"
              className="portal-promo-apply-btn"
              onClick={handleApplyPromo}
              disabled={applyingPromo}
            >
              {applyingPromo ? 'Aplicando...' : 'Aplicar descuento'}
            </button>
          </div>
        </div>
      )}

      {promoMessage && (
        <div className={`portal-promo-toast ${promoMessage.includes('correctamente') ? 'success' : 'error'}`}>
          {promoMessage}
        </div>
      )}

      {(balance?.installation_debt || 0) > 0 && (
        <div className="portal-installation-debt-banner">
          <strong>⚠️ Deuda de instalación</strong>
          <p>Tienes una deuda de instalación pendiente: <strong>${parseFloat(balance.installation_debt).toFixed(2)}</strong>. Puedes subir tu comprobante en la sección <Link to="/portal/payment-proofs">Comprobantes</Link> y seleccionar &quot;Instalación&quot;.</p>
        </div>
      )}

      {((balance?.installation_debt || 0) > 0 || (balance?.installation_payments?.length || 0) > 0) && (
        <div className="portal-installation-section">
          <h3 className="portal-charges-title">📡 Instalación</h3>
          <div className="portal-installation-summary">
            {(balance?.installation_debt || 0) > 0 ? (
              <p className="portal-installation-debt">
                <strong>Deuda pendiente:</strong> ${parseFloat(balance.installation_debt).toFixed(2)}
              </p>
            ) : (
              <p className="portal-installation-paid">✓ Sin deuda de instalación pendiente.</p>
            )}
            {(balance?.installation_payments?.length || 0) > 0 && (
              <div className="portal-installation-abonos">
                <strong>Abonos realizados a instalación:</strong>
                <ul className="portal-installation-abonos-list">
                  {balance.installation_payments.map((p, i) => (
                    <li key={i}>
                      {formatDate(p.date)} — ${parseFloat(p.amount || 0).toFixed(2)}
                      {p.receipt_number && <span className="portal-receipt-ref"> (Recibo {p.receipt_number})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="portal-balance-card">
        <h3 className="portal-charges-title">Mensualidad (tu paquete)</h3>
        <div className="portal-net-monthly-hero">
          <div className="portal-net-monthly-label">Cobro neto mensualidad</div>
          <div className="portal-net-monthly-value">
            ${parseFloat(balance?.net_package_monthly ?? balance?.monthly_fee ?? 0).toFixed(2)}
          </div>
          <p className="portal-net-monthly-hint">
            Monto neto según tu paquete actual, después de descuentos promocionales, crédito de mensualidad y saldo a favor que apliquen. No incluye pagos ya registrados este mes ni otros cargos.
          </p>
        </div>
        {(balance?.extra_charges_total || 0) > 0 && (
          <div className="portal-extra-charges-banner">
            <strong>Cargos adicionales pendientes</strong>
            <span className="portal-extra-charges-note portal-extra-charges-total-inline">
              Total: ${parseFloat(balance.extra_charges_total).toFixed(2)}
            </span>
            <ul className="portal-extra-charges-by-concept">
              {(Array.isArray(balance.extra_charges) ? balance.extra_charges : []).map((c) => (
                <li key={c.id}>
                  <span className="portal-extra-charge-concept">
                    {c.concept && String(c.concept).trim() ? c.concept.trim() : 'Cobro adicional'}
                  </span>
                  <span className="portal-extra-charge-amt">
                    ${parseFloat(c.amount_remaining ?? c.amount ?? 0).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <span className="portal-extra-charges-note">Se suman al total a pagar más abajo.</span>
          </div>
        )}
        <details className="portal-charges-details">
          <summary className="portal-charges-details-summary">Ver desglose</summary>
          <div className="portal-charges-breakdown">
            <div className="portal-charge-row">
              <span>Cuota mensual del paquete</span>
              <span>${parseFloat(balance?.monthly_fee || 0).toFixed(2)}</span>
            </div>
            <div className="portal-charge-row portal-charge-row-promo">
              <span>Descuento promocional</span>
              <span className="credit-amount">
                {(balance?.promotional_discount || 0) > 0
                  ? `−$${parseFloat(balance.promotional_discount).toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="portal-charge-row">
              <span>Crédito / parcelas aplicadas a mensualidad</span>
              <span className="credit-amount">−${parseFloat(balance?.credit_amount || 0).toFixed(2)}</span>
            </div>
            {balance?.balance_credit > 0 && (
              <div className="portal-charge-row">
                <span>Saldo a favor</span>
                <span className="credit-amount">−${parseFloat(balance.balance_credit).toFixed(2)}</span>
              </div>
            )}
            {(balance?.current_month_paid_total || 0) > 0 && (
              <div className="portal-charge-row portal-charge-row-payment">
                <span>Pagos de mensualidad este mes</span>
                <span className="payment-amount">−${parseFloat(balance.current_month_paid_total).toFixed(2)}</span>
              </div>
            )}
            {(balance?.extra_charges_total || 0) > 0 && (
              <>
                {(Array.isArray(balance.extra_charges) ? balance.extra_charges : []).map((c) => (
                  <div key={c.id} className="portal-charge-row portal-charge-row-extra">
                    <span className="portal-extra-charge-detail-label">
                      Cobro adicional{c.concept && String(c.concept).trim() ? `: ${String(c.concept).trim()}` : ''}
                    </span>
                    <span>+${parseFloat(c.amount_remaining ?? c.amount ?? 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="portal-charge-row portal-charge-row-extra-subtotal">
                  <span>Subtotal cargos adicionales</span>
                  <span>+${parseFloat(balance.extra_charges_total).toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="portal-charge-row portal-charge-row-total">
              <span>Total pendiente a pagar (este mes)</span>
              <span className="portal-amount">
                ${amountDue.toFixed(2)}
              </span>
            </div>
          </div>
        </details>
        <p className="portal-promo-note">El descuento promocional (si aplica) lo asigna el personal desde el sistema.</p>
        {(balance?.credit_debt_paid_this_month || 0) > 0 && (
          <div className="portal-credit-debt-section">
            <h4 className="portal-section-subtitle">Pagos a deuda de crédito (parcelas)</h4>
            <div className="portal-charge-row">
              <span>Parcelas pagadas este mes</span>
              <span className="payment-amount">−${parseFloat(balance.credit_debt_paid_this_month).toFixed(2)}</span>
            </div>
            <Link to="/portal/credits" className="portal-link-parcelas">Ver parcelas en Mis créditos →</Link>
          </div>
        )}
        {stripeMessage && (
          <div className={`portal-stripe-message ${stripeMessage.type === 'success' ? 'success' : stripeMessage.type === 'cancel' ? 'cancel' : 'error'}`}>
            {stripeMessage.text}
          </div>
        )}
        <div className={`portal-status ${balance?.current_month_paid ? 'paid' : 'pending'}`}>
          {balance?.current_month_paid ? (
            <>✓ Este mes está pagado</>
          ) : (
            <>⚠ Pendiente de pago. Sube tu comprobante para que sea revisado. Fechas de pago: 1 al 6 de cada mes.</>
          )}
        </div>
        {amountDue >= 0.5 && (
          <div className="portal-stripe-pay">
            {canPayStripe ? (
              <>
                <div className="portal-stripe-recurring">
                  <label className="portal-stripe-recurring-toggle">
                    <input
                      type="checkbox"
                      checked={stripeRecurring}
                      onChange={(e) => setStripeRecurring(e.target.checked)}
                      disabled={stripeLoading}
                    />
                    Domiciliar cobro mensual con tarjeta (Stripe)
                  </label>
                  {stripeRecurring && (
                    <div className="portal-stripe-recurring-day">
                      <label>Día del mes para el cobro (1–28)</label>
                      <select
                        value={stripeChargeDay}
                        onChange={(e) => setStripeChargeDay(e.target.value)}
                        disabled={stripeLoading}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={String(d)}>Día {d}</option>
                        ))}
                      </select>
                      <small>
                        Si adeudas este mes, el cobro corre al confirmar (sin periodos gratuitos ni aplazados). Stripe guardará tu tarjeta para el mismo importe cada mes. El día 1–28 queda registrado como referencia.
                      </small>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="portal-btn-stripe"
                  onClick={() => handlePay('card')}
                  disabled={stripeLoading}
                >
                  {stripeLoading ? 'Redirigiendo...' : (stripeRecurring ? '💳 Configurar domiciliación' : '💳 Pagar con tarjeta')}
                </button>
                <button
                  type="button"
                  className="portal-btn-stripe portal-btn-stripe-oxxo"
                  onClick={() => handlePay('oxxo')}
                  disabled={stripeLoading}
                >
                  {stripeLoading ? 'Redirigiendo...' : '🏪 Pagar en OXXO'}
                </button>
              </>
            ) : (
              <p className="portal-stripe-min-msg">El monto mínimo para tarjeta u OXXO es $10.00 MXN. Tu saldo (${parseFloat(amountDue).toFixed(2)}) es menor; sube tu comprobante en la sección <Link to="/portal/payment-proofs">Comprobantes</Link>.</p>
            )}
          </div>
        )}
        {balance?.last_payment && (
          <div className="portal-last-payment">
            Último pago: ${parseFloat(balance.last_payment.amount).toFixed(2)} - {balance.last_payment.date}
          </div>
        )}
        {lastReceipt && (
          <div className="portal-last-receipt-link">
            <Link to={`/portal/receipts`} className="portal-btn-receipt">
              🧾 Ver último recibo ({lastReceipt.receipt_number})
            </Link>
          </div>
        )}
      </div>

      {hasContact && (
        <div className="portal-contact-quick">
          <h3>📞 Contactar soporte</h3>
          <div className="portal-contact-buttons">
            {settings.contact_whatsapp && (
              <a
                href={`https://wa.me/${String(settings.contact_whatsapp).replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-contact-btn whatsapp"
              >
                💬 WhatsApp
              </a>
            )}
            {settings.contact_phone && (
              <a
                href={`tel:${String(settings.contact_phone).replace(/\s/g, '')}`}
                className="portal-contact-btn call"
              >
                📞 Llamar
              </a>
            )}
          </div>
        </div>
      )}

      <div className="portal-payment-methods">
        <h3>Métodos de pago</h3>
        {paymentMethods.map((m, i) => {
          const { name, detail } = parsePaymentMethod(m);
          return (
            <div key={i} className="payment-method-item">
              <span className="method-icon">💳</span>
              <span><strong>{name || 'Método de pago'}</strong></span>
              {detail && <span className="method-detail">{detail}</span>}
            </div>
          );
        })}
        <p className="payment-warning">
          ⚠️ Para evitar suspensión del servicio, realiza tu pago del 1 al 6 de cada mes.
        </p>
      </div>
    </div>
  );
};

export default PortalDashboard;
