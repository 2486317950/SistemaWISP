import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import OfflineBanner from './OfflineBanner';
import MaintenancePage from '../pages/MaintenancePage';
import './Layout.css';

const Layout = () => {
  const { logout, user, isAdmin, isTechnician } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(false);

  useEffect(() => {
    api.get('/public/maintenance-status')
      .then((res) => setMaintenanceOn(!!res.data?.enabled))
      .catch(() => setMaintenanceOn(false));
  }, []);

  if (maintenanceOn && user?.role !== 'admin') {
    return <MaintenancePage />;
  }

  // Registrar token FCM en la app del personal (Android) para notificaciones push
  useEffect(() => {
    if (!user) return;
    const isStaffApp = typeof window !== 'undefined' && window.Android?.isApp?.();
    if (!isStaffApp) return;
    const registerFCM = () => {
      const token = window.Android?.getFCMToken?.();
      if (token && token.length > 50) {
        api.post('/staff/register-fcm', { token }).catch(() => {});
      }
    };
    registerFCM();
    const retry = setInterval(registerFCM, 3000);
    return () => clearInterval(retry);
  }, [user]);
  
  // Menú para técnicos: solo instalaciones, folios y desbloquear portal
  const technicianMenuSections = [
    { title: 'Operaciones', items: [
      { path: '/sistema/installations', label: 'Instalaciones', icon: '🔧' },
      { path: '/sistema/folios', label: 'Folios', icon: '📋' },
      { path: '/sistema/portal-unlock', label: 'Desbloquear Portal', icon: '🔓' }
    ]}
  ];
  
  // Menú completo organizado en secciones
  const fullMenuSections = [
    { title: 'Principal', items: [
      { path: '/sistema', label: 'Dashboard', icon: '📊' }
    ]},
    { title: 'Clientes', items: [
      { path: '/sistema/clients', label: 'Clientes', icon: '👥' },
      { path: '/sistema/client-contract', label: 'Contrato Cliente', icon: '📄' },
      { path: '/sistema/contracts', label: 'Contratos Guardados', icon: '📋' },
      { path: '/sistema/packages', label: 'Paquetes', icon: '📦' }
    ]},
    { title: 'Finanzas', items: [
      { path: '/sistema/investors', label: 'Inversionistas', icon: '📈' },
      { path: '/sistema/cobros', label: 'Cobros', icon: '💰' },
      { path: '/sistema/payments', label: 'Pagos', icon: '💰' },
      { path: '/sistema/credits', label: 'Créditos', icon: '💳' },
      { path: '/sistema/promotional-credits', label: 'Créditos promocionales', icon: '🎁' },
      { path: '/sistema/provider-payments', label: 'Pago Proveedores', icon: '💳' },
      { path: '/sistema/supply-invoices', label: 'Facturas de Insumos', icon: '🧾' },
      { path: '/sistema/receipts', label: 'Recibos', icon: '🧾' },
      { path: '/sistema/payment-proofs', label: 'Comprobantes Clientes', icon: '📤' },
      { path: '/sistema/credit-payment-proofs', label: 'Comprobantes Crédito', icon: '💳' },
      { path: '/sistema/credit-requests', label: 'Solicitudes de Crédito', icon: '💳' },
      { path: '/sistema/expenses', label: 'Gastos', icon: '📉' },
      { path: '/sistema/transfers', label: 'Transferencias', icon: '💸' },
      ...(isAdmin ? [{ path: '/sistema/stripe', label: 'Stripe', icon: '💳' }] : [])
    ]},
    { title: 'Operaciones', items: [
      { path: '/sistema/quotations', label: 'Cotizaciones', icon: '📝' },
      { path: '/sistema/cotizador', label: 'Cotizador (plantillas)', icon: '📐' },
      { path: '/sistema/installations', label: 'Instalaciones', icon: '🔧' },
      { path: '/sistema/folios', label: 'Folios', icon: '📋' },
      { path: '/sistema/tickets', label: 'Tickets', icon: '🎫' }
    ]},
    { title: 'Inventario', items: [
      { path: '/sistema/stock', label: 'Stock/Insumos', icon: '📦' }
    ]},
    { title: 'Recursos Humanos', items: [
      { path: '/sistema/employees', label: 'Empleados', icon: '👔' }
    ]},
    { title: 'Red', items: [
      { path: '/sistema/ip-credentials', label: 'IPs y Contraseñas', icon: '🔐' },
      { path: '/sistema/networks', label: 'Redes', icon: '📡' },
      { path: '/sistema/map', label: 'Mapa', icon: '🗺️' },
      { path: '/sistema/traffic', label: 'Tráfico', icon: '📊' }
    ]},
    { title: 'Reportes', items: [
      { path: '/sistema/monthly-reports', label: 'Reportes Mensuales', icon: '📊' },
      { path: '/sistema/growth', label: 'Crecimiento Mensual', icon: '📈' },
      { path: '/sistema/financial-projections', label: 'Proyecciones Financieras', icon: '📉' }
    ]},
    { title: 'Facturación', items: [
      { path: '/sistema/electronic-invoices', label: 'Facturación Electrónica', icon: '📑' }
    ]},
    { title: 'Comunicación', items: [
      { path: '/sistema/whatsapp', label: 'WhatsApp', icon: '💬' },
      { path: '/sistema/portal-chats', label: 'Chats del Portal', icon: '💬' },
      { path: '/sistema/client-notifications', label: 'Notificaciones Clientes', icon: '🔔' },
      { path: '/sistema/contact-entries', label: 'Formularios web', icon: '📝' },
      { path: '/sistema/portal-unlock', label: 'Desbloquear Portal', icon: '🔓' }
    ]},
    { title: 'Sistema', items: [
      { path: '/sistema/settings', label: 'Configuración', icon: '⚙️' },
      ...(isAdmin ? [{ path: '/sistema/users', label: 'Usuarios', icon: '👤' }] : []),
      ...(isAdmin ? [{ path: '/sistema/audit', label: 'Auditoría', icon: '📋' }] : [])
    ]}
  ];
  
  const menuSections = isTechnician ? technicianMenuSections : fullMenuSections;

  return (
    <div className="layout">
      <OfflineBanner />
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h2>🌐 Sistema ISP</h2>
          <button className="toggle-btn" onClick={() => {
            setSidebarOpen(!sidebarOpen);
            if (window.innerWidth <= 768) {
              setMobileMenuOpen(false);
            }
          }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {menuSections.map((section) => (
            <div key={section.title} className="nav-section">
              {sidebarOpen && <div className="nav-section-title">{section.title}</div>}
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${location.pathname === item.path || (item.path === '/sistema/growth' && location.pathname.startsWith('/sistema/growth')) ? 'active' : ''}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) {
                      setMobileMenuOpen(false);
                    }
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {sidebarOpen && <span className="nav-label">{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <div className="header-content">
            <h1 className="page-title">CDCom Comunicaciones</h1>
            <div className="header-user-info">
              {user && (
                <div className="user-info">
                  <span className="user-label">Usuario:</span>
                  <span className="user-name">{user.username}</span>
                  {user.role && (
                    <span className="user-role">({user.role})</span>
                  )}
                </div>
              )}
              <button onClick={logout} className="logout-btn-fixed" title="Cerrar Sesión">
                <span>🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </header>
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

