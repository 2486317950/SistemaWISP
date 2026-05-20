import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_STAFF = 'CDCom Comunicaciones';
const BASE_PORTAL = 'Portal del Cliente';
const BASE_INVESTOR = 'Área de inversionistas';

const TITLES_BY_PATH = {
  '/sistema/login': `Iniciar sesión - ${BASE_STAFF}`,
  '/privacidad': `Política de privacidad - ${BASE_STAFF}`,
  '/portal/login': `Iniciar sesión - ${BASE_PORTAL}`,
  '/portal': `Inicio - ${BASE_PORTAL}`,
  '/portal/dashboard': `Inicio - ${BASE_PORTAL}`,
  '/portal/payments': `Pagos - ${BASE_PORTAL}`,
  '/portal/receipts': `Recibos - ${BASE_PORTAL}`,
  '/portal/payment-proofs': `Comprobantes - ${BASE_PORTAL}`,
  '/portal/tickets': `Soporte - ${BASE_PORTAL}`,
  '/portal/usage': `Consumo - ${BASE_PORTAL}`,
  '/portal/invoices': `Facturas - ${BASE_PORTAL}`,
  '/portal/installation': `Mi instalación - ${BASE_PORTAL}`,
  '/portal/packages': `Paquetes - ${BASE_PORTAL}`,
  '/portal/change-address': `Cambio de domicilio - ${BASE_PORTAL}`,
  '/portal/faq': `Preguntas frecuentes - ${BASE_PORTAL}`,
  '/portal/profile': `Perfil - ${BASE_PORTAL}`,
  '/portal/referral': `Referir - ${BASE_PORTAL}`,
  '/portal/contract': `Contrato - ${BASE_PORTAL}`,
  '/portal/credit-request': `Solicitar crédito - ${BASE_PORTAL}`,
  '/portal/credits': `Créditos - ${BASE_PORTAL}`,
  '/investor/login': `Iniciar sesión - ${BASE_INVESTOR}`,
  '/investor': `Resumen - ${BASE_INVESTOR}`,
  '/investor/pagos': `Pagos - ${BASE_INVESTOR}`,
  '/investor/gastos': `Gastos - ${BASE_INVESTOR}`,
  '/investor/clientes': `Clientes - ${BASE_INVESTOR}`,
  '/investor/redes': `Redes - ${BASE_INVESTOR}`,
  '/sistema': `Dashboard - ${BASE_STAFF}`,
  '/sistema/installations': `Instalaciones - ${BASE_STAFF}`,
  '/sistema/folios': `Folios - ${BASE_STAFF}`,
  '/sistema/tickets': `Tickets - ${BASE_STAFF}`,
  '/sistema/clients': `Clientes - ${BASE_STAFF}`,
  '/sistema/clients/portal-last-access': `Último acceso al portal - ${BASE_STAFF}`,
  '/sistema/client-contract': `Contrato de cliente - ${BASE_STAFF}`,
  '/sistema/contracts': `Contratos - ${BASE_STAFF}`,
  '/sistema/packages': `Paquetes - ${BASE_STAFF}`,
  '/sistema/cobros': `Cobros - ${BASE_STAFF}`,
  '/sistema/payments': `Pagos - ${BASE_STAFF}`,
  '/sistema/credits': `Créditos - ${BASE_STAFF}`,
  '/sistema/promotional-credits': `Créditos promocionales - ${BASE_STAFF}`,
  '/sistema/provider-payments': `Pago a proveedores - ${BASE_STAFF}`,
  '/sistema/supply-invoices': `Facturas de insumos - ${BASE_STAFF}`,
  '/sistema/quotations': `Cotizaciones - ${BASE_STAFF}`,
  '/sistema/receipts': `Recibos - ${BASE_STAFF}`,
  '/sistema/payment-proofs': `Comprobantes - ${BASE_STAFF}`,
  '/sistema/credit-payment-proofs': `Comprobantes de crédito - ${BASE_STAFF}`,
  '/sistema/credit-requests': `Solicitudes de crédito - ${BASE_STAFF}`,
  '/sistema/expenses': `Gastos - ${BASE_STAFF}`,
  '/sistema/stock': `Inventario - ${BASE_STAFF}`,
  '/sistema/transfers': `Transferencias - ${BASE_STAFF}`,
  '/sistema/employees': `Empleados - ${BASE_STAFF}`,
  '/sistema/investors': `Inversionistas - ${BASE_STAFF}`,
  '/sistema/whatsapp': `WhatsApp - ${BASE_STAFF}`,
  '/sistema/client-notifications': `Notificaciones a clientes - ${BASE_STAFF}`,
  '/sistema/portal-chats': `Chats del portal - ${BASE_STAFF}`,
  '/sistema/portal-unlock': `Desbloquear portal - ${BASE_STAFF}`,
  '/sistema/ip-credentials': `Credenciales IP - ${BASE_STAFF}`,
  '/sistema/networks': `Redes - ${BASE_STAFF}`,
  '/sistema/map': `Mapa - ${BASE_STAFF}`,
  '/sistema/financial-projections': `Proyecciones financieras - ${BASE_STAFF}`,
  '/sistema/electronic-invoices': `Facturación electrónica - ${BASE_STAFF}`,
  '/sistema/settings': `Configuración - ${BASE_STAFF}`,
  '/sistema/stripe': `Stripe - ${BASE_STAFF}`,
  '/sistema/users': `Usuarios - ${BASE_STAFF}`,
  '/sistema/monthly-reports': `Reportes mensuales - ${BASE_STAFF}`,
  '/sistema/traffic': `Tráfico - ${BASE_STAFF}`,
};

function getTitle(pathname) {
  if (TITLES_BY_PATH[pathname]) return TITLES_BY_PATH[pathname];
  if (pathname.startsWith('/sistema/clients/') && pathname !== '/sistema/clients/portal-last-access') {
    return `Cliente - ${BASE_STAFF}`;
  }
  if (pathname.startsWith('/sistema/growth/month/')) return `Crecimiento mensual - ${BASE_STAFF}`;
  if (pathname.startsWith('/sistema/traffic/')) return `Tráfico del cliente - ${BASE_STAFF}`;
  if (pathname.startsWith('/portal')) return `${pathname.split('/').filter(Boolean).pop() || 'Portal'} - ${BASE_PORTAL}`;
  if (pathname.startsWith('/investor')) return `${BASE_INVESTOR}`;
  if (pathname.startsWith('/sistema')) return `${BASE_STAFF}`;
  return BASE_STAFF;
}

export default function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getTitle(pathname);
  }, [pathname]);

  return null;
}
