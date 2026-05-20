import React, { useMemo, useState } from 'react';
import api from '../services/api';
import PackageForm from '../components/PackageForm';
import EmptyState from '../components/EmptyState';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import './Packages.css';

/** Evita crash de React si el API devuelve un valor no válido como hijo (objetos, etc.). */
function displayField(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

const Packages = () => {
  const { toast } = useToast();
  const { data: packagesRaw, loading, error, refetch } = useApi('/packages');

  const packages = useMemo(
    () => (Array.isArray(packagesRaw) ? packagesRaw : []),
    [packagesRaw]
  );
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este paquete? Los clientes que lo tengan asignado pueden verse afectados.')) return;
    try {
      await api.delete(`/packages/${id}`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar el paquete');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingPackage(null);
    refetch();
  };

  const filteredPackages = packages.filter(pkg => {
    if (filter === 'active') return pkg.is_active === 1 || pkg.is_active === true;
    if (filter === 'inactive') return pkg.is_active === 0 || pkg.is_active === false;
    return true; // 'all'
  });

  if (loading) {
    return <div className="loading">Cargando paquetes...</div>;
  }
  if (error) {
    return (
      <div className="packages-page">
        <div className="page-header">
          <h1>Paquetes de Internet</h1>
        </div>
        <div className="load-error" style={{ padding: '1rem', color: '#c0392b' }}>
          {error}
          <button type="button" className="btn-secondary" onClick={() => refetch()} style={{ marginLeft: '0.5rem' }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="packages-page">
      <div className="page-header">
        <h1>Paquetes de Internet</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar Paquete
        </button>
      </div>

      <div className="package-filters">
        <button
          className={`package-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          📦 Todos
        </button>
        <button
          className={`package-filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          ✅ Activos
        </button>
        <button
          className={`package-filter-btn ${filter === 'inactive' ? 'active' : ''}`}
          onClick={() => setFilter('inactive')}
        >
          ❌ Inactivos
        </button>
      </div>

      {showForm && (
        <PackageForm
          packageData={editingPackage}
          onClose={() => {
            setShowForm(false);
            setEditingPackage(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      <div className="packages-grid">
        {filteredPackages.map((pkg) => (
          <div key={pkg.id} className={`package-card ${(pkg.is_active === 0 || pkg.is_active === false) ? 'inactive' : ''}`}>
            <div className="package-header">
              <h3>
                {displayField(pkg.name)}
                {(pkg.is_active === 0 || pkg.is_active === false) && (
                  <span className="status-badge inactive-badge">Inactivo</span>
                )}
                {(pkg.is_active === 1 || pkg.is_active === true) && (
                  <span className="status-badge active-badge">Activo</span>
                )}
              </h3>
              <div className="package-actions">
                <button
                  className="btn-icon"
                  onClick={() => {
                    setEditingPackage(pkg);
                    setShowForm(true);
                  }}
                  title="Editar"
                  aria-label="Editar paquete"
                >
                  ✏️
                </button>
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(pkg.id)}
                  title="Eliminar"
                  aria-label="Eliminar paquete"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="package-info">
              {pkg.network_name && (
                <div className="package-network">
                  <span className="network-label">Red:</span>
                  <span className="network-value">{displayField(pkg.network_name)}</span>
                </div>
              )}
              <div className="package-speed">
                <span className="speed-label">Velocidad:</span>
                <span className="speed-value">{displayField(pkg.speed)}</span>
              </div>
              <div className="package-price">
                <span className="price-label">Precio:</span>
                <span className="price-value">${displayField(pkg.price)}</span>
              </div>
              {pkg.description && (
                <div className="package-description">
                  <p>{displayField(pkg.description)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPackages.length === 0 && (
        <EmptyState
          message={
            filter === 'all' ? 'No hay paquetes registrados' :
            filter === 'active' ? 'No hay paquetes activos' : 'No hay paquetes inactivos'
          }
        />
      )}
    </div>
  );
};

export default Packages;



