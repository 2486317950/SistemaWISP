import React from 'react';

/**
 * Estado vacío reutilizable para listas/tablas sin datos.
 * @param {string} message - Mensaje principal (ej. "No hay paquetes")
 * @param {string} [submessage] - Texto secundario opcional
 * @param {React.ReactNode} [children] - Acciones opcionales (botón "Crear", etc.)
 */
const EmptyState = ({ message = 'No hay datos', submessage, children }) => (
  <div className="empty-state" style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6c757d' }}>
    <p style={{ fontSize: '1.1rem', marginBottom: submessage ? '0.5rem' : '1rem' }}>{message}</p>
    {submessage && <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{submessage}</p>}
    {children}
  </div>
);

export default EmptyState;
