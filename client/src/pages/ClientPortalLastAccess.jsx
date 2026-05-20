import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './ClientPortalLastAccess.css';

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-MX');
};

const sourceLabel = (src) => {
  if (!src) return '—';
  const s = String(src).toLowerCase();
  if (s === 'app') return 'App';
  if (s === 'web') return 'Web';
  return src;
};

export default function ClientPortalLastAccess() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    api.get('/clients/portal-last-access')
      .then((res) => {
        if (!mounted) return;
        setRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.error || 'Error al cargar accesos del portal');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const num = (r.client_number || '').toString().toLowerCase();
      return name.includes(q) || num.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="portal-last-access-page">
      <div className="portal-last-access-header">
        <div>
          <h1>Último acceso (Portal)</h1>
          <div className="portal-last-access-subtitle">
            Web o App del cliente
          </div>
        </div>
        <div className="portal-last-access-actions">
          <Link to="/sistema/clients" className="btn-secondary">← Volver a Clientes</Link>
        </div>
      </div>

      {error && (
        <div className="portal-last-access-error">
          {error}
          <button type="button" className="btn-dismiss-error" onClick={() => setError(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      <div className="portal-last-access-filters">
        <input
          type="text"
          placeholder="Buscar por nombre o número de cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Cargando accesos...</div>
      ) : (
        <div className="portal-last-access-table-wrap">
          <table className="portal-last-access-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Último acceso</th>
                <th>Origen</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="client-cell">
                      <Link to={`/sistema/clients/${r.id}`} className="client-link">
                        {r.name || 'Sin nombre'}
                      </Link>
                      {r.client_number ? <span className="client-number">#{r.client_number}</span> : null}
                      {r.status === 'baja' ? <span className="badge badge-inactive">Baja</span> : null}
                    </div>
                  </td>
                  <td>{formatDateTime(r.portal_last_seen)}</td>
                  <td>
                    <span className={`badge ${String(r.portal_last_seen_source || '').toLowerCase() === 'app' ? 'badge-app' : 'badge-web'}`}>
                      {sourceLabel(r.portal_last_seen_source)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.portal_enabled ? 'badge-enabled' : 'badge-disabled'}`}>
                      {r.portal_enabled ? 'Habilitado' : 'Deshabilitado'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">No hay resultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

