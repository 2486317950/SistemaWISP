import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './InvestorShared.css';

const InvestorNetworks = () => {
  const [networks, setNetworks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [networksRes, summaryRes] = await Promise.allSettled([
        api.get('/networks'),
        api.get('/revenues/summary/current-month')
      ]);
      setNetworks(networksRes.status === 'fulfilled' && Array.isArray(networksRes.value?.data) ? networksRes.value.data : []);
      setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value?.data : null);
    } catch (err) {
      console.error(err);
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  const networkStats = summary?.network_stats || [];
  const getNetworkStats = (name) =>
    networkStats.find((n) => (n.network_type || n.name || '').toLowerCase() === (name || '').toLowerCase());

  if (loading) return <div className="investor-loading">Cargando redes...</div>;

  return (
    <div className="investor-page">
      <h2 className="investor-page-title">Redes</h2>
      <div className="investor-networks-grid">
        {networks.length === 0 ? (
          <p>No hay redes configuradas</p>
        ) : (
          networks.map((net) => {
            const stats = getNetworkStats(net.name);
            const perceptions = parseFloat(stats?.total_perceptions || 0);
            const paidProvider = parseFloat(stats?.paid_to_provider || 0);
            const profit = parseFloat(stats?.profit || perceptions - paidProvider);
            return (
              <div key={net.id} className="investor-network-card">
                <h3>{net.name}</h3>
                {net.description && <p className="investor-network-desc">{net.description}</p>}
                <div className="investor-network-stats">
                  <div>
                    <span className="label">Percepciones</span>
                    <span className="value">{formatCurrency(perceptions)}</span>
                  </div>
                  <div>
                    <span className="label">Pagado a proveedor</span>
                    <span className="value">{formatCurrency(paidProvider)}</span>
                  </div>
                  <div>
                    <span className="label">Ganancia</span>
                    <span className={`value ${profit >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(profit)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default InvestorNetworks;
