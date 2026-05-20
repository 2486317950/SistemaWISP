import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useClientPortal } from '../../context/ClientPortalContext';
import portalApi from '../../services/portalApi';
import PortalMustChangePassword from './PortalMustChangePassword';
import ChatWidget from '../../components/portal/ChatWidget';
import OfflineBanner from '../../components/OfflineBanner';
import './PortalLayout.css';

const PortalLayout = () => {
  const { client, logout } = useClientPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [contactSettings, setContactSettings] = useState({});
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifPromptAsked, setNotifPromptAsked] = useState(false);

  const fetchContactSettings = () => {
    portalApi.get('/client-portal/settings')
      .then((res) => setContactSettings(res.data || {}))
      .catch(() => {});
  };

  const fetchNotifications = () => {
    portalApi.get('/client-portal/notifications')
      .then((res) => setNotifications(res.data || []))
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    if (client) {
      fetchNotifications();
      fetchContactSettings();
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [client]);

  useEffect(() => {
    if (notifOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [notifOpen]);

  useEffect(() => {
    if (!client) return;
    const registerFCM = () => {
      if (typeof window === 'undefined' || !window.Android?.isApp?.()) return;
      const token = window.Android.getFCMToken?.();
      if (token && token.length > 50) {
        portalApi.post('/client-portal/register-fcm', { token })
          .catch(() => {});
      }
    };
    registerFCM();
    const retry = setInterval(registerFCM, 3000);
    return () => clearInterval(retry);
  }, [client]);

  // En web (no en la app): mostrar aviso para activar notificaciones si aún no se ha preguntado
  const isWeb = typeof window !== 'undefined' && !window.Android?.isApp?.();
  useEffect(() => {
    if (!client || !isWeb) return;
    if (typeof Notification === 'undefined') return;
    const permission = Notification.permission;
    const dismissed = localStorage.getItem('portal_notif_prompt_dismissed') === '1';
    if (permission === 'default' && !dismissed) setShowNotifPrompt(true);
  }, [client, isWeb]);

  const handleRequestNotificationPermission = () => {
    if (typeof Notification === 'undefined') return;
    setNotifPromptAsked(true);
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setShowNotifPrompt(false);
        localStorage.setItem('portal_notif_prompt_dismissed', '1');
      }
      if (permission === 'denied') {
        setShowNotifPrompt(false);
        localStorage.setItem('portal_notif_prompt_dismissed', '1');
      }
    }).catch(() => {
      setNotifPromptAsked(false);
    });
  };

  const handleDismissNotifPrompt = () => {
    setShowNotifPrompt(false);
    localStorage.setItem('portal_notif_prompt_dismissed', '1');
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const markAsRead = (id) => {
    portalApi.put(`/client-portal/notifications/${id}/read`)
      .then(() => fetchNotifications());
  };
  const markAllRead = () => {
    portalApi.put('/client-portal/notifications/read-all')
      .then(() => fetchNotifications());
  };

  const formatDate = (d) => {
    if (!d) return '';
    const s = String(d);
    const date = s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
    const [y, m, day] = date.split('-');
    return `${day}/${m}/${y}`;
  };

  const navSections = [
    { title: 'Principal', items: [
      { path: '/portal', label: 'Inicio', icon: '🏠' }
    ]},
    { title: 'Finanzas', items: [
      { path: '/portal/payments', label: 'Pagos', icon: '💰' },
      { path: '/portal/receipts', label: 'Recibos', icon: '🧾' },
      { path: '/portal/payment-proofs', label: 'Comprobantes', icon: '📤' },
      { path: '/portal/credits', label: 'Créditos', icon: '💳' },
      { path: '/portal/credit-request', label: 'Nuevo crédito', icon: '📝' }
    ]},
    { title: 'Servicios', items: [
      { path: '/portal/usage', label: 'Consumo', icon: '📊' },
      { path: '/portal/invoices', label: 'Facturas', icon: '📄' },
      { path: '/portal/installation', label: 'Mi instalación', icon: '📡' },
      { path: '/portal/packages', label: 'Paquetes', icon: '📦' },
      { path: '/portal/change-address', label: 'Cambio de domicilio', icon: '🏠' },
      { path: '/portal/contract', label: 'Contrato', icon: '📋' }
    ]},
    { title: 'Cuenta', items: [
      { path: '/portal/profile', label: 'Perfil', icon: '👤' }
    ]},
    { title: 'Soporte', items: [
      { path: '/portal/tickets', label: 'Soporte', icon: '🎫' },
      { path: '/portal/faq', label: 'FAQ', icon: '❓' },
      { path: '/estado', label: 'Estado del servicio', icon: '📡' }
    ]},
    { title: 'Programas', items: [
      { path: '/portal/referral', label: 'Referir', icon: '👥' }
    ]}
  ];

  const toggleSection = (title) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  useEffect(() => setNavOpen(false), [location.pathname]);

  useEffect(() => {
    const section = navSections.find((s) =>
      s.items.some((item) => location.pathname === item.path)
    );
    if (section) {
      setExpandedSections((prev) => new Set(prev).add(section.title));
    }
  }, [location.pathname]);

  if (client?.mustChangePassword) {
    return <PortalMustChangePassword />;
  }

  return (
    <div className="portal-layout">
      <OfflineBanner />
      {showNotifPrompt && (
        <div className="portal-notif-prompt" role="region" aria-label="Activar notificaciones">
          <div className="portal-notif-prompt-inner">
            <span className="portal-notif-prompt-text">
              🔔 ¿Quieres recibir avisos de pagos, créditos y comprobantes aunque no tengas el portal abierto?
            </span>
            <div className="portal-notif-prompt-actions">
              <button
                type="button"
                className="portal-notif-prompt-btn primary"
                onClick={handleRequestNotificationPermission}
                disabled={notifPromptAsked}
              >
                {notifPromptAsked ? 'Activando…' : 'Activar notificaciones'}
              </button>
              <button
                type="button"
                className="portal-notif-prompt-btn secondary"
                onClick={handleDismissNotifPrompt}
                disabled={notifPromptAsked}
              >
                Ahora no
              </button>
            </div>
            <button
              type="button"
              className="portal-notif-prompt-close"
              onClick={handleDismissNotifPrompt}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <header className="portal-header">
        <div className="portal-header-content">
          <div className="portal-header-left">
            <button
              type="button"
              className="portal-menu-btn"
              onClick={() => setNavOpen(!navOpen)}
              aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              <span className={navOpen ? 'open' : ''} />
              <span className={navOpen ? 'open' : ''} />
              <span className={navOpen ? 'open' : ''} />
            </button>
            <h1>Portal del Cliente</h1>
          </div>
          <div className="portal-user">
            <div className="portal-notif-wrap">
              <button
                type="button"
                className="portal-notif-btn"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notificaciones"
              >
                🔔
                {unreadCount > 0 && <span className="portal-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {notifOpen && createPortal(
                <div className="portal-notif-modal">
                  <div className="portal-notif-backdrop" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                  <div className="portal-notif-dropdown" role="dialog" aria-label="Notificaciones">
                    <div className="portal-notif-header">
                      <span>Notificaciones</span>
                      <button type="button" className="portal-notif-close" onClick={() => setNotifOpen(false)} aria-label="Cerrar">
                        ✕
                      </button>
                    </div>
                    {unreadCount > 0 && (
                      <div className="portal-notif-actions">
                        <button type="button" className="portal-notif-read-all" onClick={markAllRead}>
                          Marcar todas leídas
                        </button>
                      </div>
                    )}
                    <div className="portal-notif-list">
                      {notifications.length === 0 ? (
                        <div className="portal-notif-empty">No hay notificaciones</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`portal-notif-item ${n.is_read ? '' : 'unread'}`}
                            onClick={() => {
                              markAsRead(n.id);
                              setNotifOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                          >
                            <div className="portal-notif-item-title">{n.title}</div>
                            {n.message && <div className="portal-notif-item-msg">{n.message}</div>}
                            <div className="portal-notif-item-date">{formatDate(n.created_at)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
            <span className="portal-user-name">{client?.name} ({client?.client_number})</span>
            <button onClick={logout} className="portal-logout-btn">Salir</button>
          </div>
        </div>
      </header>
      <nav className={`portal-nav ${navOpen ? 'open' : ''}`}>
        <div className="portal-nav-inner">
          {navSections.map((section) => {
            const isExpanded = expandedSections.has(section.title);
            return (
              <div key={section.title} className={`portal-nav-section ${isExpanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="portal-nav-section-title"
                  onClick={() => toggleSection(section.title)}
                  aria-expanded={isExpanded}
                >
                  {section.title}
                  <span className="portal-nav-section-chevron">{isExpanded ? '▼' : '▶'}</span>
                </button>
                <div className="portal-nav-section-items">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`portal-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                      <span className="portal-nav-icon">{item.icon}</span>
                      <span className="portal-nav-label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>
      {navOpen && <div className="portal-nav-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <main className="portal-main">
        <Outlet />
      </main>
      <ChatWidget />
      {(contactSettings.contact_phone || contactSettings.contact_whatsapp) && (
        <div className="portal-contact-fab">
          {contactSettings.contact_whatsapp && (
            <a
              href={`https://wa.me/${String(contactSettings.contact_whatsapp).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-fab-btn whatsapp"
              title="WhatsApp"
              aria-label="Contactar por WhatsApp"
            >
              💬
            </a>
          )}
          {contactSettings.contact_phone && (
            <a
              href={`tel:${String(contactSettings.contact_phone).replace(/\s/g, '')}`}
              className="portal-fab-btn call"
              title="Llamar"
              aria-label="Llamar"
            >
              📞
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default PortalLayout;
