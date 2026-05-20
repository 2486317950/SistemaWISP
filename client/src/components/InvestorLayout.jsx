import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './InvestorLayout.css';

const INVESTOR_REMEMBER_KEY = 'investor_remember';

const InvestorLayout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const redirectedFromSistema = location.state?.redirectedFromSistema === true;
  const dismissRedirectNotice = () => navigate(location.pathname, { replace: true, state: {} });

  const handleLogout = () => {
    localStorage.removeItem(INVESTOR_REMEMBER_KEY);
    logout();
  };

  const menuItems = [
    { path: '/investor', label: 'Dashboard', icon: '📊' },
    { path: '/investor/pagos', label: 'Pagos', icon: '💰' },
    { path: '/investor/gastos', label: 'Gastos', icon: '📉' },
    { path: '/investor/clientes', label: 'Clientes', icon: '👥' },
    { path: '/investor/redes', label: 'Redes', icon: '📡' }
  ];

  return (
    <div className="investor-layout">
      {mobileMenuOpen && (
        <div className="investor-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`investor-sidebar ${sidebarOpen ? 'open' : 'closed'} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="investor-sidebar-header">
          <h2>📈 App Inversionista</h2>
          <button className="investor-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="investor-sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`investor-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}
            >
              <span className="investor-nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="investor-nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="investor-main">
        <header className="investor-header">
          <button className="investor-mobile-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
          <div className="investor-header-content">
            <h1>App del Inversionista</h1>
            <div className="investor-header-user">
              {user && <span>{user.username}</span>}
              <button onClick={handleLogout} className="investor-logout-btn">Cerrar sesión</button>
            </div>
          </div>
        </header>
        <div className="investor-content">
          {redirectedFromSistema && (
            <div className="investor-redirect-notice" style={{
              background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'
            }}>
              <span>Tu cuenta es de <strong>inversionista</strong>. El panel del personal (/sistema) es solo para cuentas de personal. Para acceder ahí, cierra sesión e inicia en <a href="/sistema/login">/sistema/login</a> con una cuenta de personal.</span>
              <button type="button" onClick={dismissRedirectNotice} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>Entendido</button>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default InvestorLayout;
