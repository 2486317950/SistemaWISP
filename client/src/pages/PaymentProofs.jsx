import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import './PaymentProofs.css';

const PaymentProofs = () => {
  const { toast } = useToast();
  const { subscribe, isConnected } = useSocket();
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!selected) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    api.get(`/payment-proofs/file/${selected.id}`, { responseType: 'blob' })
      .then((res) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(res.data));
      })
      .catch(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      });
    return () => {};
  }, [selected?.id]);

  const loadProofs = useCallback(
    (options = {}) => {
      const { background } = options;
      if (!background) setLoading(true);
      const params = {
        ...(filter ? { status: filter } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        _t: Date.now()
      };
      return api
        .get('/payment-proofs', {
          params,
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        .then((res) => {
          setProofs(res.data || []);
          return res.data || [];
        })
        .catch((err) => {
          console.error('Error al cargar comprobantes:', err);
          toast.error(err.response?.data?.error || 'No se pudo cargar la lista. Reintenta o usa Recomprobar.');
          return [];
        })
        .finally(() => {
          if (!background) setLoading(false);
        });
    },
    [filter, debouncedSearch]
  );

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

  useEffect(() => {
    if (!isConnected) return undefined;
    const unsubscribe = subscribe('payment_proofs', () => {
      loadProofs({ background: true });
    });
    return () => unsubscribe();
  }, [subscribe, isConnected, loadProofs]);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      const [diagRes] = await Promise.all([
        api.get('/payment-proofs/recheck', {
          params: { _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        }),
        loadProofs({ background: true })
      ]);
      const d = diagRes.data || {};
      const total = d.total ?? 0;
      const pend = d.pendientes ?? 0;
      const sinArch = d.sin_archivo ?? 0;
      toast.success(
        `Lista actualizada: ${total} comprobante(s) en el sistema${pend ? ` (${pend} pendiente(s))` : ''}.`
      );
      if (sinArch > 0) {
        toast.warning(
          `${sinArch} registro(s) sin archivo en la base de datos; si un cliente dice que envió, puede fallar la vista previa.`
        );
      }
    } catch {
      toast.error('No se pudo recomprobar la lista.');
    } finally {
      setRechecking(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await api.put(`/payment-proofs/${selected.id}/approve`, { reviewed_notes: reviewNotes });
      setSelected(null);
      setReviewNotes('');
      loadProofs();
      toast.success(res.data?.message || 'Comprobante aprobado. Pago y recibo generados.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.put(`/payment-proofs/${selected.id}/reject`, { reviewed_notes: reviewNotes });
      setSelected(null);
      setReviewNotes('');
      loadProofs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel = (s) => {
    const map = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
    return map[s] || s;
  };

  const groupByNetwork = (items) => {
    const groups = {};
    (items || []).forEach((p) => {
      const net = p.network || 'General';
      if (!groups[net]) groups[net] = [];
      groups[net].push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const s = String(d);
    return s.includes('T') ? s.split('T')[0].split('-').reverse().join('/') + ' ' + s.split('T')[1]?.slice(0, 5) : s;
  };

  const clientLine = (p) => {
    const name = p.client_name?.trim() || null;
    const num = p.client_number != null && String(p.client_number).trim() !== '' ? String(p.client_number).trim() : null;
    if (name || num) {
      return `${name || 'Sin nombre'} (${num ?? '—'})`;
    }
    return `Cliente #${p.client_id ?? '?'} (sin ficha o eliminado)`;
  };

  return (
    <div className="payment-proofs-page">
      <div className="page-header">
        <h1>Comprobantes de pago (clientes)</h1>
        <p className="page-desc">
          Mensualidad e instalación desde el portal o el chat.           Las <strong>parcelas de crédito</strong> están en{' '}
          <Link to="/sistema/credit-payment-proofs">Comprobantes de crédito</Link>.
        </p>
      </div>

      <div className="filter-bar filter-bar-with-action">
        <input
          type="search"
          className="proofs-search-input"
          placeholder="Buscar por nombre, número de cliente, archivo, ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Buscar comprobantes"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobados</option>
          <option value="rechazado">Rechazados</option>
        </select>
        {filter && (
          <span className="filter-active-hint" title="Cambia el filtro a «Todos» para ver comprobantes en otros estados">
            Filtro: {filter === 'pendiente' ? 'solo pendientes' : filter === 'aprobado' ? 'solo aprobados' : 'solo rechazados'}
          </span>
        )}
        <button
          type="button"
          className="btn-recheck-proofs"
          onClick={handleRecheck}
          disabled={rechecking || loading}
          title="Vuelve a cargar desde el servidor y muestra un resumen (útil si un cliente acaba de subir un comprobante)"
        >
          {rechecking ? 'Recomprobando…' : '↻ Recomprobar lista'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : proofs.length === 0 ? (
        <div className="empty-state">
          {debouncedSearch
            ? `Ningún comprobante coincide con «${debouncedSearch}». Prueba otro término o revisa Comprobantes de crédito si fue una parcela.`
            : filter
              ? 'No hay comprobantes con este estado. Prueba «Todos» en el filtro.'
              : 'No hay comprobantes'}
        </div>
      ) : (
        <div className="proofs-grid">
          <div className="proofs-list">
            {groupByNetwork(proofs).map(([network, items]) => (
              <div key={network} className="proofs-network-group">
                <div className="proofs-network-header">📡 {network}</div>
                {items.map((p) => (
                  <div
                    key={p.id}
                    className={`proof-card ${selected?.id === p.id ? 'selected' : ''} status-${p.status}`}
                    onClick={() => setSelected(p)}
                  >
                    <div className="proof-card-header">
                      <span className="proof-client">{clientLine(p)}</span>
                      <span className={`proof-status status-${p.status}`}>{statusLabel(p.status)}</span>
                    </div>
                    <div className="proof-card-meta">
                      <span className="proof-type-tag">{p.proof_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}</span>
                      {p.file_name} · {formatDate(p.created_at)}
                    </div>
                    {p.amount && <div className="proof-amount">${parseFloat(p.amount).toFixed(2)}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="proof-detail">
            {selected ? (
              <>
                <div className="detail-header">
                  <h3>{clientLine(selected)}</h3>
                  <span className={`status-badge status-${selected.status}`}>{statusLabel(selected.status)}</span>
                </div>
                <div className="preview-area">
                  {previewUrl && (
                    selected.file_type?.startsWith('image/') ? (
                      <img src={previewUrl} alt="Comprobante" />
                    ) : (
                      <iframe title="Comprobante" src={previewUrl} className="pdf-preview" />
                    )
                  )}
                  {selected && (
                    <a
                      href={previewUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="open-new-btn"
                      onClick={(e) => !previewUrl && e.preventDefault()}
                    >
                      Abrir en nueva pestaña
                    </a>
                  )}
                </div>
                <div className="detail-info">
                  <p><strong>Tipo:</strong> {selected.proof_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}</p>
                  <p><strong>Archivo:</strong> {selected.file_name}</p>
                  {selected.amount && <p><strong>Monto:</strong> ${parseFloat(selected.amount).toFixed(2)}</p>}
                  {selected.notes && <p><strong>Notas del cliente:</strong> {selected.notes}</p>}
                  <p><strong>Fecha:</strong> {formatDate(selected.created_at)}</p>
                  {selected.reviewed_notes && (
                    <p><strong>Notas de revisión:</strong> {selected.reviewed_notes}</p>
                  )}
                </div>
                {selected.payment_id && (
                  <p className="proof-linked"><strong>Pago #</strong>{selected.payment_id} · <strong>Recibo generado</strong></p>
                )}
                {selected.status === 'pendiente' && (
                  <div className="review-actions">
                    <textarea
                      placeholder="Notas de revisión (opcional)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={2}
                    />
                    <div className="action-buttons">
                      <button className="btn-approve" onClick={handleApprove} disabled={actionLoading}>
                        ✓ Aprobar
                      </button>
                      <button className="btn-reject" onClick={handleReject} disabled={actionLoading}>
                        ✗ Rechazar
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="no-selection">Selecciona un comprobante</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentProofs;
