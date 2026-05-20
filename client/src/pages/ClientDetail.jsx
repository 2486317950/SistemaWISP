import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { generateClientPDF } from '../utils/pdfGenerator';
import './ClientDetail.css';

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalFlash, setPortalFlash] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [charges, setCharges] = useState([]);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeConcept, setChargeConcept] = useState('');
  const [chargeSubmitting, setChargeSubmitting] = useState(false);
  const [chargeEditing, setChargeEditing] = useState(null); // { id, amount, concept }
  const [chargeRowSaving, setChargeRowSaving] = useState(false);
  const [chargeDeletingId, setChargeDeletingId] = useState(null);

  useEffect(() => {
    setLoadError(null);
    fetchClient();
  }, [id]);

  const reloadCharges = () => {
    if (!id) return Promise.resolve();
    return api.get(`/clients/${id}/charges`)
      .then((res) => setCharges(res.data || []))
      .catch(() => setCharges([]));
  };

  useEffect(() => {
    setChargeEditing(null);
    setChargeDeletingId(null);
  }, [id]);

  useEffect(() => {
    if (id) reloadCharges();
  }, [id]);

  useEffect(() => {
    if (location.hash === '#cobros' && client) {
      const el = document.getElementById('cobros');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [client, location.hash]);

  const fetchClient = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get(`/clients/${id}`);
      setClient(response.data);
      setPortalEnabled(response.data.portal_enabled === 1 || response.data.portal_enabled === true);
    } catch (error) {
      console.error('Error al cargar cliente:', error);
      const msg = error.response?.status === 404
        ? 'Cliente no encontrado'
        : (error.response?.data?.error || 'Error al cargar el cliente');
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!client || pdfGenerating) return;
    setPdfGenerating(true);
    setTimeout(() => {
      try {
        generateClientPDF(client);
      } finally {
        setPdfGenerating(false);
      }
    }, 0);
  };

  if (loading && !client) {
    return <div className="loading">Cargando cliente...</div>;
  }

  if (loadError && !client) {
    return (
      <div className="client-detail">
        <div className="detail-header">
          <button className="btn-back" onClick={() => navigate('/sistema/clients')}>← Volver</button>
        </div>
        <div className="error-message-banner">{loadError}</div>
        <p style={{ marginTop: '1rem' }}>
          <button className="btn-primary" onClick={fetchClient}>Reintentar</button>
        </p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="client-detail">
        <div className="detail-header">
          <button className="btn-back" onClick={() => navigate('/sistema/clients')}>← Volver</button>
        </div>
        <div className="error">Cliente no encontrado</div>
      </div>
    );
  }

  const isInactive = (client.status || 'activo') === 'baja';

  const handleStatusChange = async () => {
    if (statusSaving) return;
    const newStatus = isInactive ? 'activo' : 'baja';
    const confirmMsg = newStatus === 'baja'
      ? '¿Dar de baja a este cliente? El registro se conserva y podrás reactivarlo después.'
      : '¿Reactivar a este cliente?';
    if (!window.confirm(confirmMsg)) return;
    setStatusSaving(true);
    try {
      await api.patch(`/clients/${id}/status`, { status: newStatus });
      setClient(prev => ({ ...prev, status: newStatus }));
      setPortalFlash({ type: 'success', message: newStatus === 'baja' ? 'Cliente dado de baja.' : 'Cliente reactivado.' });
    } catch (err) {
      setPortalFlash({ type: 'error', message: err.response?.data?.error || 'Error al cambiar estado' });
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="client-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/sistema/clients')}>
          ← Volver
        </button>
        <h1>{client.name}</h1>
        <span className={`client-status-badge status-${client.status || 'activo'}`}>
          {(client.status || 'activo') === 'baja' ? 'Dado de baja' : 'Activo'}
        </span>
        <button className="btn-download" onClick={handleDownloadPDF} disabled={pdfGenerating}>
          {pdfGenerating ? '⏳ Generando...' : '📥 Descargar PDF'}
        </button>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h2>Estado del cliente</h2>
          <p className="section-desc">
            Dar de baja conserva todo el historial (pagos, instalaciones, folios). El cliente no se elimina y puedes reactivarlo cuando quieras.
          </p>
          <div className="client-status-actions">
            <button
              type="button"
              className={isInactive ? 'btn-primary' : 'btn-danger'}
              onClick={handleStatusChange}
              disabled={statusSaving}
            >
              {statusSaving ? 'Guardando...' : isInactive ? 'Reactivar cliente' : 'Dar de baja'}
            </button>
          </div>
        </div>

        <div className="detail-section">
          <h2>Información Personal</h2>
          <div className="info-grid">
            {client.client_number && (
              <div className="info-item">
                <strong>🔢 Número de Cliente:</strong>
                <p>{client.client_number}</p>
              </div>
            )}
            <div className="info-item">
              <strong>📍 Domicilio:</strong>
              <p>{client.address}</p>
            </div>
            {client.phone && (
              <div className="info-item">
                <strong>📞 Teléfono:</strong>
                <p>
                  {client.phone}
                  <a
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-link"
                    title="Abrir WhatsApp"
                  >
                    💬 WhatsApp
                  </a>
                </p>
              </div>
            )}
            {client.email && (
              <div className="info-item">
                <strong>📧 Email:</strong>
                <p>{client.email}</p>
              </div>
            )}
            {client.network_type && (
              <div className="info-item">
                <strong>📡 Tipo de Red:</strong>
                <p>{client.network_type}</p>
              </div>
            )}
            {client.package_name && (
              <div className="info-item">
                <strong>📦 Paquete Contratado:</strong>
                <p>{client.package_name} - {client.speed} - ${client.package_price}</p>
              </div>
            )}
            {(client.card_recurring_debit === 1 || client.card_recurring_debit === true) &&
              client.card_charge_day != null && (
                <div className="info-item">
                  <strong>💳 Cobro recurrente tarjeta:</strong>
                  <p>
                    Activado · día <strong>{client.card_charge_day}</strong> de cada mes · monto por paquete
                  </p>
                </div>
              )}
            {client.notes && (
              <div className="info-item full-width">
                <strong>📝 Anotaciones:</strong>
                <p>{client.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h2>🌐 Portal del Cliente</h2>
          {portalFlash && (
            <div className={`flash-banner ${portalFlash.type}`}>
              {portalFlash.message}
              <button type="button" className="flash-dismiss" onClick={() => setPortalFlash(null)} aria-label="Cerrar">×</button>
            </div>
          )}
          <p className="section-desc">Permite al cliente consultar saldo, pagos, recibos y abrir tickets en <a href="/portal/login" target="_blank" rel="noopener noreferrer">/portal</a></p>
          <div className="portal-setup">
            <label className="portal-check">
              <input
                type="checkbox"
                checked={portalEnabled}
                onChange={(e) => setPortalEnabled(e.target.checked)}
              />
              Habilitar acceso al portal
            </label>
            <div className="portal-password-row">
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                value={portalPassword}
                onChange={(e) => setPortalPassword(e.target.value)}
              />
              <button
                className="btn-save-portal"
                onClick={async () => {
                  setPortalSaving(true);
                  try {
                    await api.post(`/clients/${id}/portal-setup`, {
                      portal_enabled: portalEnabled,
                      portal_password: portalPassword || undefined
                    });
                    setPortalPassword('');
                    setPortalFlash({ type: 'success', message: 'Portal configurado correctamente' });
                  } catch (err) {
                    setPortalFlash({ type: 'error', message: err.response?.data?.error || 'Error al guardar' });
                  } finally {
                    setPortalSaving(false);
                  }
                }}
                disabled={portalSaving}
              >
                {portalSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            {client.client_number && (
              <>
                <p className="portal-hint">El cliente accede con: número <strong>{client.client_number}</strong> y la contraseña que configures.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const res = await api.post(`/clients/${id}/generate-portal-reset-code`);
                      setPortalFlash({ type: 'success', message: `Código: ${res.data.code}. Válido 1 hora. Indica al cliente que use "Olvidé mi contraseña" en el portal e ingrese su número y este código.` });
                    } catch (err) {
                      setPortalFlash({ type: 'error', message: err.response?.data?.error || 'Error al generar código' });
                    }
                  }}
                >
                  Generar código de restablecimiento
                </button>
              </>
            )}
            {(client.app_version_name || client.app_version_code) && (
              <p className="portal-hint" style={{ marginTop: 8 }}>
                📱 <strong>Versión de la app:</strong> {client.app_version_name || '?'} (código: {client.app_version_code ?? '?'})
                {client.app_last_seen && (
                  <span> · Última vez: {new Date(client.app_last_seen).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div id="cobros" className="detail-section">
          <h2>💰 Cobros</h2>
          <p className="section-desc">Cobros adicionales que se suman a la mensualidad del cliente. El cliente los ve en su portal y puede pagarlos junto con su mensualidad.</p>
          <div className="charges-form">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Monto ($)"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Concepto (opcional)"
              value={chargeConcept}
              onChange={(e) => setChargeConcept(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={chargeSubmitting || !chargeAmount || parseFloat(chargeAmount) <= 0}
              onClick={async () => {
                setChargeSubmitting(true);
                try {
                  await api.post(`/clients/${id}/charges`, { amount: parseFloat(chargeAmount), concept: chargeConcept.trim() || '' });
                  setChargeAmount('');
                  setChargeConcept('');
                  await reloadCharges();
                } catch (err) {
                  window.alert(err.response?.data?.error || 'Error al agregar cobro');
                } finally {
                  setChargeSubmitting(false);
                }
              }}
            >
              {chargeSubmitting ? 'Agregando...' : 'Agregar cobro'}
            </button>
          </div>
          {charges.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th>Pendiente</th>
                    <th>Fecha</th>
                    <th className="charges-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id}>
                      {chargeEditing != null && Number(chargeEditing.id) === Number(c.id) ? (
                        <>
                          <td colSpan={1}>
                            <input
                              className="charges-inline-input charges-inline-wide"
                              type="text"
                              value={chargeEditing.concept}
                              onChange={(e) => setChargeEditing({ ...chargeEditing, concept: e.target.value })}
                              placeholder="Concepto"
                            />
                          </td>
                          <td>
                            <input
                              className="charges-inline-input"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={chargeEditing.amount}
                              onChange={(e) => setChargeEditing({ ...chargeEditing, amount: e.target.value })}
                            />
                          </td>
                          <td>${parseFloat(c.amount_remaining).toFixed(2)}</td>
                          <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                          <td className="charges-actions-col">
                            <div className="charges-actions">
                              <button
                                type="button"
                                className="btn-charge-save"
                                disabled={chargeRowSaving || !chargeEditing.amount || parseFloat(chargeEditing.amount) <= 0}
                                onClick={async () => {
                                  setChargeRowSaving(true);
                                  try {
                                    await api.put(`/clients/${encodeURIComponent(id)}/charges/${encodeURIComponent(c.id)}`, {
                                      amount: parseFloat(String(chargeEditing.amount).replace(',', '.')),
                                      concept: chargeEditing.concept.trim() || ''
                                    });
                                    setChargeEditing(null);
                                    await reloadCharges();
                                  } catch (err) {
                                    window.alert(err.response?.data?.error || 'Error al guardar');
                                  } finally {
                                    setChargeRowSaving(false);
                                  }
                                }}
                              >
                                Guardar
                              </button>
                              <button type="button" className="btn-charge-cancel" disabled={chargeRowSaving} onClick={() => setChargeEditing(null)}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{c.concept || '—'}</td>
                          <td>${parseFloat(c.amount).toFixed(2)}</td>
                          <td>${parseFloat(c.amount_remaining).toFixed(2)}</td>
                          <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES') : '—'}</td>
                          <td className="charges-actions-col">
                            <div className="charges-actions">
                              <button
                                type="button"
                                className="btn-charge-edit"
                                disabled={!!chargeDeletingId || chargeEditing != null}
                                onClick={() =>
                                  setChargeEditing({
                                    id: c.id,
                                    amount: String(parseFloat(c.amount).toFixed(2)),
                                    concept: c.concept || ''
                                  })
                                }
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn-charge-delete"
                                disabled={chargeDeletingId === c.id || chargeEditing != null}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      '¿Eliminar este cobro por completo?\nLos pagos ya registrados del cliente no se revierten; solo desaparece esta línea de adeudo.'
                                    )
                                  )
                                    return;
                                  setChargeDeletingId(c.id);
                                  try {
                                    await api.delete(`/clients/${encodeURIComponent(id)}/charges/${encodeURIComponent(c.id)}`);
                                    await reloadCharges();
                                  } catch (err) {
                                    window.alert(err.response?.data?.error || 'Error al eliminar');
                                  } finally {
                                    setChargeDeletingId(null);
                                  }
                                }}
                              >
                                {chargeDeletingId === c.id ? '…' : 'Eliminar'}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">No hay cobros. Agrega uno arriba para que se sume a la mensualidad del cliente.</p>
          )}
        </div>

        <div className="detail-section">
          <h2>Historial de Pagos</h2>
          {client.payments && client.payments.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Recibo</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {client.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.payment_date).toLocaleDateString('es-ES')}</td>
                      <td>${payment.amount}</td>
                      <td>{payment.receipt_number || '-'}</td>
                      <td>{payment.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">No hay pagos registrados</p>
          )}
        </div>

        <div className="detail-section">
          <h2>Instalaciones</h2>
          {client.installations && client.installations.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Paquete</th>
                    <th>Estado</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {client.installations.map((installation) => (
                    <tr key={installation.id}>
                      <td>{new Date(installation.installation_date).toLocaleDateString('es-ES')}</td>
                      <td>{installation.installation_type}</td>
                      <td>
                        {installation.package_name ? (
                          <span style={{ fontSize: '0.9em' }}>
                            {installation.package_name}
                            {installation.package_speed && ` - ${installation.package_speed}`}
                            {installation.package_price && ` - $${installation.package_price}`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-${installation.status}`}>
                          {installation.status}
                        </span>
                      </td>
                      <td>{installation.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">No hay instalaciones registradas</p>
          )}
        </div>

        <div className="detail-section">
          <h2>Folios de Reparación</h2>
          {client.folios && client.folios.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha de Visita</th>
                    <th>Problema</th>
                    <th>Estado</th>
                    <th>Notas Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {client.folios.map((folio) => {
                    // Función helper para formatear fechas sin problemas de zona horaria
                    const formatDate = (dateString) => {
                      if (!dateString) return '-';
                      const dateParts = dateString.split('T')[0].split('-');
                      if (dateParts.length === 3) {
                        const [year, month, day] = dateParts;
                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        return date.toLocaleDateString('es-ES');
                      }
                      return new Date(dateString).toLocaleDateString('es-ES');
                    };
                    return (
                    <tr key={folio.id}>
                      <td><strong>{folio.folio_number}</strong></td>
                      <td>{formatDate(folio.visit_date)}</td>
                      <td>{folio.problem_description || '-'}</td>
                      <td>
                        <span className={`status-badge status-${folio.status}`}>
                          {folio.status}
                        </span>
                      </td>
                      <td>{folio.technician_notes || '-'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">No hay folios registrados</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default ClientDetail;

