import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './InvestorShared.css';

const InvestorClients = () => {
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, packagesRes] = await Promise.all([
        api.get('/clients?status=all'),
        api.get('/packages')
      ]);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
    } catch (err) {
      console.error(err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const getPackageName = (id) => {
    const pkg = packages.find((p) => p.id === id);
    return pkg ? `${pkg.name} - $${parseFloat(pkg.price || 0).toFixed(2)}` : '-';
  };

  const filtered = clients.filter(
    (c) =>
      !filter ||
      (c.name || '').toLowerCase().includes(filter.toLowerCase()) ||
      (c.client_number || '').toLowerCase().includes(filter.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="investor-loading">Cargando clientes...</div>;

  return (
    <div className="investor-page">
      <h2 className="investor-page-title">Clientes</h2>
      <div className="investor-toolbar">
        <input
          type="text"
          placeholder="Buscar por nombre, número o dirección..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="investor-search"
        />
        <div className="investor-total">
          Total: <strong>{filtered.length}</strong> clientes
        </div>
      </div>
      <div className="investor-table-wrap">
        <table className="investor-data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Paquete</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="5">No hay clientes</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.client_number || '-'}</td>
                  <td><strong>{c.name || '-'}</strong></td>
                  <td>{c.address || '-'}</td>
                  <td>{getPackageName(c.package_id)}</td>
                  <td>{c.phone || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestorClients;
