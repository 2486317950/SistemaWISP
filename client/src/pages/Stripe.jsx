import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './Stripe.css';

const Stripe = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('resumen');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [creatingPayout, setCreatingPayout] = useState(false);
  const [refundId, setRefundId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [creatingRefund, setCreatingRefund] = useState(false);
  const [paymentLinkAmount, setPaymentLinkAmount] = useState('');
  const [paymentLinkClientId, setPaymentLinkClientId] = useState('');
  const [paymentLinkType, setPaymentLinkType] = useState('mensualidad');
  const [paymentLinkMethod, setPaymentLinkMethod] = useState('auto');
  const [paymentLinkDesc, setPaymentLinkDesc] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [clients, setClients] = useState([]);
  const [oxxoClientId, setOxxoClientId] = useState('');
  const [oxxoAmount, setOxxoAmount] = useState('');
  const [oxxoDesc, setOxxoDesc] = useState('Mensualidad / servicio');
  const [oxxoEmail, setOxxoEmail] = useState('');
  const [oxxoExpiresDays, setOxxoExpiresDays] = useState('3');
  const [oxxoResult, setOxxoResult] = useState(null);
  const [creatingOxxo, setCreatingOxxo] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    fetchConnectionStatus();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'admin' || (activeSection !== 'oxxo' && activeSection !== 'enlace')) return;
    const load = async () => {
      try {
        const res = await api.get('/clients');
        setClients(Array.isArray(res.data) ? res.data : []);
      } catch {
        setClients([]);
      }
    };
    load();
  }, [user?.role, activeSection]);

  const fetchConnectionStatus = async () => {
    try {
      const res = await api.get('/stripe/connection-status');
      setConnectionStatus(res.data);
    } catch {
      setConnectionStatus({ configured: false });
    }
  };

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await api.get('/stripe/balance');
      setBalance(res.data);
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const res = await api.get('/stripe/balance-transactions?limit=50');
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const res = await api.get('/stripe/payouts?limit=20');
      setPayouts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await api.get('/stripe/events?limit=30');
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchReconciliation = async () => {
    setReconciliationLoading(true);
    try {
      const res = await api.get('/stripe/reconciliation?days=30');
      setReconciliation(res.data);
    } catch {
      setReconciliation(null);
    } finally {
      setReconciliationLoading(false);
    }
  };

  const handleCreatePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error('Monto inválido (mínimo 1 peso).');
      return;
    }
    setCreatingPayout(true);
    try {
      const res = await api.post('/stripe/create-payout', { amount, currency: 'mxn' });
      toast.success(res.data?.message || 'Transferencia creada.');
      setPayoutAmount('');
      setBalance(null);
      fetchPayouts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear transferencia.');
    } finally {
      setCreatingPayout(false);
    }
  };

  const handleRefund = async () => {
    const id = (refundId || '').trim();
    if (!id) {
      toast.error('Indica el ID del pago (payment_intent pi_... o charge ch_...)');
      return;
    }
    setCreatingRefund(true);
    try {
      const body = { reason: refundReason };
      if (id.startsWith('pi_')) body.payment_intent_id = id; else body.charge_id = id;
      if (refundAmount) body.amount = parseFloat(refundAmount);
      const res = await api.post('/stripe/refund', body);
      toast.success('Reembolso creado: ' + (res.data?.message || res.data?.refund_id));
      setRefundId('');
      setRefundAmount('');
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear reembolso.');
    } finally {
      setCreatingRefund(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    const amount = parseFloat(paymentLinkAmount);
    if (!Number.isFinite(amount) || amount < 10) {
      toast.error('Monto mínimo 10 pesos.');
      return;
    }
    const baseDescription = paymentLinkType === 'instalacion' ? 'Pago de instalación' : 'Pago de mensualidad';
    const finalDescription = paymentLinkDesc || baseDescription;
    setCreatingLink(true);
    setPaymentLinkUrl('');
    try {
      const res = await api.post('/stripe/payment-link', {
        amount,
        client_id: paymentLinkClientId.trim() ? paymentLinkClientId.trim() : undefined,
        description: finalDescription,
        payment_method: paymentLinkMethod === 'auto' ? undefined : paymentLinkMethod
      });
      setPaymentLinkUrl(res.data?.url || '');
      toast.success('Enlace creado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear enlace.');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleSyncUnregistered = async () => {
    setSyncingStripe(true);
    try {
      const res = await api.post('/stripe/sync-unregistered');
      toast.success(res.data?.message || 'Sincronización completada.');
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al sincronizar.');
    } finally {
      setSyncingStripe(false);
    }
  };

  const handleOxxoClientChange = (idStr) => {
    setOxxoClientId(idStr);
    const c = clients.find((x) => String(x.id) === String(idStr));
    if (c?.email) setOxxoEmail(c.email);
  };

  const buildWhatsAppOxxoUrl = (payload) => {
    const phone = payload?.client?.phone;
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    let wa = digits;
    if (wa.length === 10) wa = `521${wa}`;
    else if (wa.startsWith('52')) wa = wa;
    else wa = `52${wa}`;
    const name = payload?.client?.name || 'Cliente';
    const parts = [
      `Hola ${name},`,
      `Comprobante OXXO por $${Number(payload.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN.`,
      payload.description ? `Concepto: ${payload.description}` : '',
      payload.reference_number ? `Referencia: ${payload.reference_number}` : '',
      payload.hosted_voucher_url
        ? `Voucher con código de barras (abre e imprime en OXXO):\n${payload.hosted_voucher_url}`
        : '',
      '',
      'Paga en efectivo en cualquier OXXO antes del vencimiento indicado en el comprobante.'
    ].filter(Boolean);
    return `https://wa.me/${wa}?text=${encodeURIComponent(parts.join('\n'))}`;
  };

  const handleCreateOxxoVoucher = async () => {
    const amount = parseFloat(oxxoAmount);
    if (!oxxoClientId) {
      toast.error('Selecciona un cliente.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 10) {
      toast.error('Monto mínimo 10 MXN.');
      return;
    }
    if (!oxxoEmail.trim()) {
      toast.error('Stripe requiere un correo para OXXO. Indícalo o agrégalo al cliente.');
      return;
    }
    setCreatingOxxo(true);
    setOxxoResult(null);
    try {
      const res = await api.post('/stripe/oxxo-voucher', {
        client_id: parseInt(oxxoClientId, 10),
        amount,
        description: oxxoDesc.trim() || 'Pago OXXO',
        email: oxxoEmail.trim(),
        expires_after_days: parseInt(oxxoExpiresDays, 10) || 3
      });
      setOxxoResult(res.data);
      toast.success('Comprobante OXXO generado. Comparte el enlace o el número de referencia con el cliente.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar OXXO.');
    } finally {
      setCreatingOxxo(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="stripe-page">
        <h1>Stripe</h1>
        <p>Solo los administradores pueden acceder a esta sección.</p>
      </div>
    );
  }

  const sections = [
    { id: 'resumen', label: 'Resumen y saldo', icon: '📊' },
    { id: 'transacciones', label: 'Transacciones recientes', icon: '📋' },
    { id: 'payouts', label: 'Historial de transferencias a banco', icon: '🏦' },
    { id: 'transferir', label: 'Transferir a cuenta bancaria', icon: '💸' },
    { id: 'reembolsos', label: 'Reembolsos', icon: '↩️' },
    { id: 'enlace', label: 'Crear enlace de pago', icon: '🔗' },
    { id: 'oxxo', label: 'Pago OXXO (voucher)', icon: '🏪' },
    { id: 'conciliacion', label: 'Conciliación', icon: '⚖️' },
    { id: 'eventos', label: 'Eventos (webhooks)', icon: '📡' },
    { id: 'sincronizar', label: 'Sincronizar pagos', icon: '🔄' }
  ];

  return (
    <div className="stripe-page">
      <h1>💳 Stripe</h1>
      <p className="stripe-intro">Gestiona pagos en línea, saldo, transferencias a banco, reembolsos y conciliación.</p>

      {connectionStatus && (
        <div className={`stripe-status ${connectionStatus.configured ? 'ok' : 'error'}`}>
          {connectionStatus.configured ? (
            <>Conexión Stripe activa {connectionStatus.livemode ? '(modo live)' : '(modo prueba)'} {connectionStatus.error && ` — ${connectionStatus.error}`}</>
          ) : (
            'Stripe no configurado (STRIPE_SECRET_KEY).'
          )}
        </div>
      )}

      <div className="stripe-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`stripe-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="stripe-content">

        {activeSection === 'resumen' && (
          <div className="stripe-section">
            <h2>Saldo</h2>
            <button type="button" className="btn-primary" onClick={fetchBalance} disabled={balanceLoading}>
              {balanceLoading ? 'Cargando...' : 'Actualizar saldo'}
            </button>
            {balance && (
              <div className="stripe-balance-box">
                <h3>Disponible</h3>
                {(balance.available || []).length === 0 ? (
                  <p>$0.00</p>
                ) : (
                  (balance.available || []).map((item, i) => (
                    <p key={i}><strong>{item.currency?.toUpperCase()}:</strong> ${((item.amount || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  ))
                )}
                <h3>Pendiente de acreditar</h3>
                {(balance.pending || []).length === 0 ? (
                  <p>$0.00</p>
                ) : (
                  (balance.pending || []).map((item, i) => (
                    <p key={i}><strong>{item.currency?.toUpperCase()}:</strong> ${((item.amount || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'transacciones' && (
          <div className="stripe-section">
            <h2>Transacciones recientes</h2>
            <button type="button" className="btn-primary" onClick={fetchTransactions} disabled={transactionsLoading}>
              {transactionsLoading ? 'Cargando...' : 'Cargar transacciones'}
            </button>
            {transactions.length > 0 && (
              <div className="stripe-table-wrap">
                <table className="stripe-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th className="amount">Monto</th>
                      <th className="amount">Comisión</th>
                      <th className="amount">Neto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td>{t.created ? new Date(t.created * 1000).toLocaleString('es-MX') : '—'}</td>
                        <td>{t.type || '—'}</td>
                        <td>{t.description || t.id}</td>
                        <td className="amount">${((t.amount || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td className="amount">${((t.fee || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td className="amount">${((t.net || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td>{t.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === 'payouts' && (
          <div className="stripe-section">
            <h2>Historial de transferencias a banco</h2>
            <button type="button" className="btn-primary" onClick={fetchPayouts} disabled={payoutsLoading}>
              {payoutsLoading ? 'Cargando...' : 'Cargar historial'}
            </button>
            {payouts.length > 0 && (
              <div className="stripe-table-wrap">
                <table className="stripe-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>ID</th>
                      <th className="amount">Monto</th>
                      <th>Estado</th>
                      <th>Llegada estimada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id}>
                        <td>{p.created ? new Date(p.created * 1000).toLocaleString('es-MX') : '—'}</td>
                        <td><code>{p.id}</code></td>
                        <td className="amount">${((p.amount || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {p.currency?.toUpperCase()}</td>
                        <td>{p.status}</td>
                        <td>{p.arrival_date ? new Date(p.arrival_date * 1000).toLocaleDateString('es-MX') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === 'transferir' && (
          <div className="stripe-section">
            <h2>Transferir saldo a cuenta bancaria</h2>
            <p>El dinero se envía a la cuenta bancaria configurada en tu Dashboard de Stripe.</p>
            <div className="stripe-form-inline">
              <label>Monto (MXN):</label>
              <input type="number" min="1" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="Ej. 500" />
              <button type="button" className="btn-primary" onClick={handleCreatePayout} disabled={creatingPayout || !payoutAmount.trim()}>
                {creatingPayout ? 'Enviando...' : 'Transferir'}
              </button>
            </div>
          </div>
        )}

        {activeSection === 'reembolsos' && (
          <div className="stripe-section">
            <h2>Crear reembolso</h2>
            <p>Indica el ID del pago (payment_intent <code>pi_...</code> o charge <code>ch_...</code>). Puedes verlo en Transacciones o en el Dashboard de Stripe.</p>
            <div className="stripe-form">
              <label>ID del pago (pi_... o ch_...):</label>
              <input type="text" value={refundId} onChange={(e) => setRefundId(e.target.value)} placeholder="pi_xxx o ch_xxx" />
              <label>Monto a reembolsar (opcional; vacío = reembolso total):</label>
              <input type="number" min="0" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Ej. 350" />
              <label>Motivo:</label>
              <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
                <option value="requested_by_customer">Solicitado por el cliente</option>
                <option value="duplicate">Duplicado</option>
                <option value="fraudulent">Fraudulento</option>
              </select>
              <button type="button" className="btn-primary" onClick={handleRefund} disabled={creatingRefund || !refundId.trim()}>
                {creatingRefund ? 'Procesando...' : 'Crear reembolso'}
              </button>
            </div>
          </div>
        )}

        {activeSection === 'enlace' && (
          <div className="stripe-section">
            <h2>Crear enlace de pago</h2>
            <p>
              Genera un enlace para que un cliente pague (mínimo 10 MXN). Si eliges un cliente en la lista, el enlace queda vinculado
              (Stripe guarda <code>client_id</code> en metadata) y al cobrarse puede registrarse el pago en el sistema vía webhook.
              Con &quot;Sin vincular&quot;, el enlace es genérico: quien pague no quedará asociado automáticamente a una ficha de cliente.
            </p>
            <div className="stripe-form">
              <label>Monto (MXN): *</label>
              <input type="number" min="10" step="0.01" value={paymentLinkAmount} onChange={(e) => setPaymentLinkAmount(e.target.value)} placeholder="Ej. 350" />
              <label>Método de pago:</label>
              <select value={paymentLinkMethod} onChange={(e) => setPaymentLinkMethod(e.target.value)}>
                <option value="auto">Tarjeta y OXXO (según Stripe)</option>
                <option value="card">Solo tarjeta</option>
                <option value="oxxo">Solo OXXO</option>
              </select>
              <label>Tipo de pago:</label>
              <select value={paymentLinkType} onChange={(e) => setPaymentLinkType(e.target.value)}>
                <option value="mensualidad">Mensualidad</option>
                <option value="instalacion">Instalación</option>
              </select>
              <label>Cliente (opcional)</label>
              <select
                value={paymentLinkClientId}
                onChange={(e) => setPaymentLinkClientId(e.target.value)}
                className="stripe-select-wide"
              >
                <option value="">— Sin vincular —</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    #{c.id} {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
              <label>Descripción (opcional, si quieres algo diferente):</label>
              <input type="text" value={paymentLinkDesc} onChange={(e) => setPaymentLinkDesc(e.target.value)} placeholder="Se usa el tipo de pago si lo dejas vacío" />
              <button type="button" className="btn-primary" onClick={handleCreatePaymentLink} disabled={creatingLink || !paymentLinkAmount.trim()}>
                {creatingLink ? 'Creando...' : 'Crear enlace'}
              </button>
              {paymentLinkUrl && (
                <div className="stripe-link-result">
                  <label>Enlace:</label>
                  <a href={paymentLinkUrl} target="_blank" rel="noopener noreferrer">{paymentLinkUrl}</a>
                  <button type="button" onClick={() => navigator.clipboard.writeText(paymentLinkUrl)}>Copiar</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'oxxo' && (
          <div className="stripe-section">
            <h2>Pago en OXXO para un cliente</h2>
            <p>
              Genera el comprobante con código de barras en Stripe (monto mínimo 10 MXN). Cuando el cliente pague en tienda,
              el pago se registrará en el sistema como los demás cobros Stripe (webhook). Se requiere correo electrónico
              (Stripe lo exige para OXXO).
            </p>
            <div className="stripe-form">
              <label>Cliente *</label>
              <select
                value={oxxoClientId}
                onChange={(e) => handleOxxoClientChange(e.target.value)}
                className="stripe-select-wide"
              >
                <option value="">— Seleccionar —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
              <label>Monto (MXN) *</label>
              <input
                type="number"
                min="10"
                step="0.01"
                value={oxxoAmount}
                onChange={(e) => setOxxoAmount(e.target.value)}
                placeholder="Ej. 350"
              />
              <label>Descripción (concepto en Stripe)</label>
              <input
                type="text"
                value={oxxoDesc}
                onChange={(e) => setOxxoDesc(e.target.value)}
                placeholder="Ej. Mensualidad abril"
              />
              <label>Correo para el comprobante *</label>
              <input
                type="email"
                value={oxxoEmail}
                onChange={(e) => setOxxoEmail(e.target.value)}
                placeholder="Se rellena si el cliente tiene email en su ficha"
              />
              <label>Vencimiento del voucher (días, 1–7)</label>
              <select value={oxxoExpiresDays} onChange={(e) => setOxxoExpiresDays(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={String(d)}>{d} día{d !== 1 ? 's' : ''}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateOxxoVoucher}
                disabled={creatingOxxo || !oxxoClientId || !oxxoAmount.trim()}
              >
                {creatingOxxo ? 'Generando...' : 'Generar comprobante OXXO'}
              </button>
              {oxxoResult && (
                <div className="stripe-oxxo-result">
                  <h3>Comprobante listo</h3>
                  {oxxoResult.hosted_voucher_url && (
                    <p className="stripe-oxxo-row">
                      <strong>Voucher (código de barras):</strong>{' '}
                      <a href={oxxoResult.hosted_voucher_url} target="_blank" rel="noopener noreferrer">
                        Abrir página de Stripe
                      </a>
                      <button
                        type="button"
                        className="stripe-oxxo-inline-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(oxxoResult.hosted_voucher_url);
                          toast.success('Enlace copiado');
                        }}
                      >
                        Copiar enlace
                      </button>
                    </p>
                  )}
                  {oxxoResult.reference_number && (
                    <p className="stripe-oxxo-row">
                      <strong>Número de referencia:</strong>{' '}
                      <code className="stripe-oxxo-ref">{oxxoResult.reference_number}</code>
                      <button
                        type="button"
                        className="stripe-oxxo-inline-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(oxxoResult.reference_number);
                          toast.success('Referencia copiada');
                        }}
                      >
                        Copiar
                      </button>
                    </p>
                  )}
                  {oxxoResult.expires_after && (
                    <p className="stripe-oxxo-muted">
                      Vence: {new Date(oxxoResult.expires_after * 1000).toLocaleString('es-MX')}
                    </p>
                  )}
                  <p className="stripe-oxxo-muted">
                    ID interno: <code>{oxxoResult.payment_intent_id}</code>
                  </p>
                  {buildWhatsAppOxxoUrl(oxxoResult) ? (
                    <a
                      className="stripe-oxxo-wa"
                      href={buildWhatsAppOxxoUrl(oxxoResult)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Enviar por WhatsApp
                    </a>
                  ) : (
                    <p className="stripe-oxxo-muted">
                      Sin teléfono válido en la ficha del cliente: copia el enlace o la referencia y envíalos manualmente.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'conciliacion' && (
          <div className="stripe-section">
            <h2>Conciliación (últimos 30 días)</h2>
            <p>Compara los pagos registrados en el sistema (con Stripe) con las transacciones de Stripe.</p>
            <button type="button" className="btn-primary" onClick={fetchReconciliation} disabled={reconciliationLoading}>
              {reconciliationLoading ? 'Cargando...' : 'Cargar conciliación'}
            </button>
            {reconciliation && (
              <>
                <div className="stripe-recon-summary">
                  <p><strong>Sistema:</strong> {reconciliation.summary?.system_count ?? 0} pagos — ${(reconciliation.summary?.system_total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  <p><strong>Stripe (cargos):</strong> {reconciliation.summary?.stripe_charge_count ?? 0} — ${(reconciliation.summary?.stripe_charge_total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                </div>
                <h3>Pagos en el sistema (Stripe)</h3>
                <div className="stripe-table-wrap">
                  <table className="stripe-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Sesión Stripe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reconciliation.system_payments || []).map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.client_id}</td>
                          <td className="amount">${(parseFloat(p.amount) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-MX') : '—'}</td>
                          <td><code>{p.stripe_session_id || '—'}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeSection === 'eventos' && (
          <div className="stripe-section">
            <h2>Eventos recientes (webhooks)</h2>
            <p>Últimos eventos recibidos por Stripe (para depuración).</p>
            <button type="button" className="btn-primary" onClick={fetchEvents} disabled={eventsLoading}>
              {eventsLoading ? 'Cargando...' : 'Cargar eventos'}
            </button>
            {events.length > 0 && (
              <div className="stripe-table-wrap">
                <table className="stripe-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td>{e.created ? new Date(e.created * 1000).toLocaleString('es-MX') : '—'}</td>
                        <td><code>{e.type}</code></td>
                        <td><code>{e.id}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === 'sincronizar' && (
          <div className="stripe-section">
            <h2>Sincronizar pagos de Stripe</h2>
            <p>Registra en el sistema los pagos (tarjeta u OXXO) que ya se cobraron en Stripe pero no se guardaron (por ejemplo si el webhook falló). Revisa los últimos 90 días.</p>
            <button type="button" className="btn-primary" onClick={handleSyncUnregistered} disabled={syncingStripe}>
              {syncingStripe ? 'Sincronizando...' : 'Sincronizar pagos Stripe'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Stripe;
