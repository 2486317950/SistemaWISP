import React, { useState, useEffect } from 'react';

/**
 * Wrapper para el Mapa - solo renderiza en el cliente.
 * Evita errores de Leaflet con SSR o hidratación.
 */
const MapWrapper = () => {
  const [MapComponent, setMapComponent] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    import('./Map')
      .then((mod) => {
        if (!cancelled) setMapComponent(() => mod.default);
      })
      .catch((err) => {
        console.error('Error al cargar el módulo del mapa:', err);
        if (!cancelled) setLoadError(err?.message || 'No se pudo cargar el mapa.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="loading" style={{ padding: '40px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: '#c0392b', marginBottom: 16 }}>No se pudo cargar el mapa.</p>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>{loadError}</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Recargar página
        </button>
      </div>
    );
  }

  if (!MapComponent) {
    return (
      <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
        Cargando mapa...
      </div>
    );
  }

  return <MapComponent />;
};

export default MapWrapper;
