import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './CotizadorLayout.css';

const CotizadorLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="cotizador-layout-root">
      <header className="cotizador-layout-header">
        <Link to="/sistema" className="cotizador-layout-back">
          ← Panel Sistema
        </Link>
        <span className="cotizador-layout-brand">Cotizador CDCOM</span>
        <div className="cotizador-layout-user">
          <span className="cotizador-layout-username" title={user?.username}>
            {user?.username}
          </span>
          <button type="button" className="cotizador-layout-logout" onClick={() => logout()}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="cotizador-layout-main">
        <Outlet />
      </main>
    </div>
  );
};

export default CotizadorLayout;
