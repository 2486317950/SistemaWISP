import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ClientPortalProvider, useClientPortal } from './context/ClientPortalContext';
import Login from './pages/Login';
import PortalLogin from './pages/portal/PortalLogin';
import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalPayments from './pages/portal/PortalPayments';
import PortalReceipts from './pages/portal/PortalReceipts';
import PortalUsage from './pages/portal/PortalUsage';
import PortalInvoices from './pages/portal/PortalInvoices';
import PortalFAQ from './pages/portal/PortalFAQ';
import PortalProfile from './pages/portal/PortalProfile';
import PortalReferral from './pages/portal/PortalReferral';
import PortalContract from './pages/portal/PortalContract';
import PortalCreditRequest from './pages/portal/PortalCreditRequest';
import PortalCredits from './pages/portal/PortalCredits';
import PortalTickets from './pages/portal/PortalTickets';
import PortalPaymentProofs from './pages/portal/PortalPaymentProofs';
import PortalInstallation from './pages/portal/PortalInstallation';
import PortalPackages from './pages/portal/PortalPackages';
import PortalChangeAddress from './pages/portal/PortalChangeAddress';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ServiceStatusPage from './pages/ServiceStatusPage';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Cobros from './pages/Cobros';
import ClientPortalLastAccess from './pages/ClientPortalLastAccess';
import ClientContract from './pages/ClientContract';
import Contracts from './pages/Contracts';
import Packages from './pages/Packages';
import Payments from './pages/Payments';
import Credits from './pages/Credits';
import PromotionalCredits from './pages/PromotionalCredits';
import ProviderPayments from './pages/ProviderPayments';
import SupplyInvoices from './pages/SupplyInvoices';
import Quotations from './pages/Quotations';
import Installations from './pages/Installations';
import Folios from './pages/Folios';
import Tickets from './pages/Tickets';
import Receipts from './pages/Receipts';
import PaymentProofs from './pages/PaymentProofs';
import CreditPaymentProofs from './pages/CreditPaymentProofs';
import CreditRequests from './pages/CreditRequests';
import Expenses from './pages/Expenses';
import Transfers from './pages/Transfers';
import Stripe from './pages/Stripe';
import Employees from './pages/Employees';
import Investors from './pages/Investors';
import Settings from './pages/Settings';
import Users from './pages/Users';
import WhatsApp from './pages/WhatsApp';
import PortalChats from './pages/PortalChats';
import ClientNotifications from './pages/ClientNotifications';
import PortalUnlock from './pages/PortalUnlock';
import IPCredentials from './pages/IPCredentials';
import Networks from './pages/Networks';
import MonthlyGrowth from './pages/MonthlyGrowth';
import MonthlyReports from './pages/MonthlyReports';
import ContactEntries from './pages/ContactEntries';
import AuditLogs from './pages/AuditLogs';
const Map = lazy(() => import('./pages/MapWrapper'));
import FinancialProjections from './pages/FinancialProjections';
import ElectronicInvoices from './pages/ElectronicInvoices';
import Traffic from './pages/Traffic';
import TrafficDetail from './pages/TrafficDetail';
import Stock from './pages/Stock';
import Layout from './components/Layout';
import CotizadorLayout from './components/CotizadorLayout';
import CotizadorPage from './pages/CotizadorPage';
import PublicCotizacionCliente from './pages/PublicCotizacionCliente';
import InvestorLayout from './components/InvestorLayout';
import InvestorLogin from './pages/investor/InvestorLogin';
import InvestorDashboard from './pages/investor/InvestorDashboard';
import InvestorPayments from './pages/investor/InvestorPayments';
import InvestorExpenses from './pages/investor/InvestorExpenses';
import InvestorClients from './pages/investor/InvestorClients';
import InvestorNetworks from './pages/investor/InvestorNetworks';
import ErrorBoundary from './components/ErrorBoundary';
import PageTitle from './components/PageTitle';
import { ToastProvider } from './context/ToastContext';
import './App.css';
import './styles/toast.css';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5',
        color: '#7f8c8d',
        fontSize: '18px'
      }}>
        <div>Verificando autenticación...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    const redirect = location.pathname && location.pathname !== '/' ? `?redirect=${encodeURIComponent(location.pathname)}` : '';
    return <Navigate to={`/sistema/login${redirect}`} replace />;
  }
  
  return children;
};

// Componente para bloquear acceso de técnicos a rutas no permitidas
const TechnicianProtectedRoute = ({ children, allowedForTechnician = false }) => {
  const { isTechnician } = useAuth();
  
  if (isTechnician && !allowedForTechnician) {
    return <Navigate to="/sistema/installations" replace />;
  }
  
  return children;
};

// Redirigir inversionistas al app de inversionista (no pueden acceder al panel del personal).
// Si tu cuenta tiene rol "investor" en la base de datos, siempre irás a /investor al intentar /sistema.
const StaffOnlyRoute = ({ children }) => {
  const { isInvestor } = useAuth();
  if (isInvestor) {
    return <Navigate to="/investor" replace state={{ redirectedFromSistema: true }} />;
  }
  return children;
};

// Ruta protegida para inversionistas: solo inversionistas, redirige a /investor/login si no está autenticado
const InvestorPrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #0d9488 0%, #134e4a 100%)', color: 'white' }}>
        Verificando...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/investor/login" replace state={{ from: location.pathname }} />;
  }
  if (user?.role !== 'investor') {
    return <Navigate to="/investor/login" replace />;
  }
  return children;
};

const PortalRoute = ({ children }) => {
  const { isAuthenticated, loading } = useClientPortal();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>
        Cargando...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ClientPortalProvider>
          <SocketProvider>
            <ToastProvider>
            <Router>
            <PageTitle />
            <Routes>
            <Route path="/sistema/login" element={<Login />} />
            <Route path="/sistema/c/:publicToken" element={<PublicCotizacionCliente />} />
              <Route path="/login" element={<Navigate to="/sistema/login" replace />} />
              <Route path="/privacidad" element={<PrivacyPolicy />} />
              <Route path="/estado" element={<ServiceStatusPage />} />
              <Route path="/portal/login" element={<PortalLogin />} />
              <Route path="/portal" element={<PortalRoute><PortalLayout /></PortalRoute>}>
                <Route index element={<PortalDashboard />} />
                <Route path="dashboard" element={<PortalDashboard />} />
                <Route path="payments" element={<PortalPayments />} />
                <Route path="receipts" element={<PortalReceipts />} />
                <Route path="payment-proofs" element={<PortalPaymentProofs />} />
                <Route path="tickets" element={<PortalTickets />} />
                <Route path="usage" element={<PortalUsage />} />
                <Route path="invoices" element={<PortalInvoices />} />
                <Route path="installation" element={<PortalInstallation />} />
                <Route path="packages" element={<PortalPackages />} />
                <Route path="change-address" element={<PortalChangeAddress />} />
                <Route path="faq" element={<PortalFAQ />} />
                <Route path="profile" element={<PortalProfile />} />
                <Route path="referral" element={<PortalReferral />} />
                <Route path="contract" element={<PortalContract />} />
                <Route path="credit-request" element={<PortalCreditRequest />} />
                <Route path="credits" element={<PortalCredits />} />
              </Route>
            <Route path="/investor/login" element={<InvestorLogin />} />
            <Route path="/investor" element={
              <InvestorPrivateRoute>
                <TechnicianProtectedRoute>
                  <InvestorLayout />
                </TechnicianProtectedRoute>
              </InvestorPrivateRoute>
            }>
              <Route index element={<InvestorDashboard />} />
              <Route path="pagos" element={<InvestorPayments />} />
              <Route path="gastos" element={<InvestorExpenses />} />
              <Route path="clientes" element={<InvestorClients />} />
              <Route path="redes" element={<InvestorNetworks />} />
            </Route>
            <Route
              path="/sistema"
              element={
                <PrivateRoute>
                  <StaffOnlyRoute>
                    <Outlet />
                  </StaffOnlyRoute>
                </PrivateRoute>
              }
            >
              <Route
                path="cotizador"
                element={
                  <TechnicianProtectedRoute>
                    <CotizadorLayout />
                  </TechnicianProtectedRoute>
                }
              >
                <Route index element={<CotizadorPage />} />
              </Route>
              <Route element={<Layout />}>
              {/* Redirigir técnicos del dashboard a instalaciones */}
              <Route index element={
                <TechnicianProtectedRoute allowedForTechnician={false}>
                  <Dashboard />
                </TechnicianProtectedRoute>
              } />
              {/* Rutas permitidas solo para técnicos */}
              <Route path="installations" element={
                <TechnicianProtectedRoute allowedForTechnician={true}>
                  <Installations />
                </TechnicianProtectedRoute>
              } />
              <Route path="folios" element={
                <TechnicianProtectedRoute allowedForTechnician={true}>
                  <Folios />
                </TechnicianProtectedRoute>
              } />
              <Route path="tickets" element={
                <TechnicianProtectedRoute>
                  <Tickets />
                </TechnicianProtectedRoute>
              } />
              {/* Rutas bloqueadas para técnicos */}
              <Route path="clients" element={
                <TechnicianProtectedRoute>
                  <Clients />
                </TechnicianProtectedRoute>
              } />
              <Route path="clients/portal-last-access" element={
                <TechnicianProtectedRoute>
                  <ClientPortalLastAccess />
                </TechnicianProtectedRoute>
              } />
              <Route path="clients/:id" element={
                <TechnicianProtectedRoute>
                  <ClientDetail />
                </TechnicianProtectedRoute>
              } />
              <Route path="client-contract" element={
                <TechnicianProtectedRoute>
                  <ClientContract />
                </TechnicianProtectedRoute>
              } />
              <Route path="contracts" element={
                <TechnicianProtectedRoute>
                  <Contracts />
                </TechnicianProtectedRoute>
              } />
              <Route path="packages" element={
                <TechnicianProtectedRoute>
                  <Packages />
                </TechnicianProtectedRoute>
              } />
              <Route path="cobros" element={
                <TechnicianProtectedRoute>
                  <Cobros />
                </TechnicianProtectedRoute>
              } />
              <Route path="payments" element={
                <TechnicianProtectedRoute>
                  <Payments />
                </TechnicianProtectedRoute>
              } />
              <Route path="credits" element={
                <TechnicianProtectedRoute>
                  <Credits />
                </TechnicianProtectedRoute>
              } />
              <Route path="promotional-credits" element={
                <TechnicianProtectedRoute>
                  <PromotionalCredits />
                </TechnicianProtectedRoute>
              } />
              <Route path="provider-payments" element={
                <TechnicianProtectedRoute>
                  <ProviderPayments />
                </TechnicianProtectedRoute>
              } />
              <Route path="supply-invoices" element={
                <TechnicianProtectedRoute>
                  <SupplyInvoices />
                </TechnicianProtectedRoute>
              } />
              <Route path="quotations" element={
                <TechnicianProtectedRoute>
                  <Quotations />
                </TechnicianProtectedRoute>
              } />
              <Route path="receipts" element={
                <TechnicianProtectedRoute>
                  <Receipts />
                </TechnicianProtectedRoute>
              } />
              <Route path="payment-proofs" element={
                <TechnicianProtectedRoute>
                  <PaymentProofs />
                </TechnicianProtectedRoute>
              } />
              <Route path="credit-payment-proofs" element={
                <TechnicianProtectedRoute>
                  <CreditPaymentProofs />
                </TechnicianProtectedRoute>
              } />
              <Route path="credit-requests" element={
                <TechnicianProtectedRoute>
                  <CreditRequests />
                </TechnicianProtectedRoute>
              } />
              <Route path="expenses" element={
                <TechnicianProtectedRoute>
                  <Expenses />
                </TechnicianProtectedRoute>
              } />
              <Route path="stock" element={
                <TechnicianProtectedRoute>
                  <Stock />
                </TechnicianProtectedRoute>
              } />
              <Route path="transfers" element={
                <TechnicianProtectedRoute>
                  <Transfers />
                </TechnicianProtectedRoute>
              } />
              <Route path="employees" element={
                <TechnicianProtectedRoute>
                  <Employees />
                </TechnicianProtectedRoute>
              } />
              <Route path="investors" element={
                <TechnicianProtectedRoute>
                  <Investors />
                </TechnicianProtectedRoute>
              } />
              <Route path="whatsapp" element={
                <TechnicianProtectedRoute>
                  <WhatsApp />
                </TechnicianProtectedRoute>
              } />
              <Route path="client-notifications" element={
                <TechnicianProtectedRoute>
                  <ClientNotifications />
                </TechnicianProtectedRoute>
              } />
              <Route path="contact-entries" element={
                <TechnicianProtectedRoute>
                  <ContactEntries />
                </TechnicianProtectedRoute>
              } />
              <Route path="portal-chats" element={
                <TechnicianProtectedRoute>
                  <PortalChats />
                </TechnicianProtectedRoute>
              } />
              <Route path="portal-unlock" element={
                <TechnicianProtectedRoute allowedForTechnician={true}>
                  <PortalUnlock />
                </TechnicianProtectedRoute>
              } />
              <Route path="ip-credentials" element={
                <TechnicianProtectedRoute>
                  <IPCredentials />
                </TechnicianProtectedRoute>
              } />
              <Route path="networks" element={
                <TechnicianProtectedRoute>
                  <Networks />
                </TechnicianProtectedRoute>
              } />
              <Route path="map" element={
                <TechnicianProtectedRoute>
                  <Suspense fallback={<div className="loading">Cargando mapa...</div>}>
                    <Map />
                  </Suspense>
                </TechnicianProtectedRoute>
              } />
              <Route path="financial-projections" element={
                <TechnicianProtectedRoute>
                  <FinancialProjections />
                </TechnicianProtectedRoute>
              } />
              <Route path="electronic-invoices" element={
                <TechnicianProtectedRoute>
                  <ElectronicInvoices />
                </TechnicianProtectedRoute>
              } />
              <Route path="settings" element={
                <TechnicianProtectedRoute>
                  <Settings />
                </TechnicianProtectedRoute>
              } />
              <Route path="users" element={
                <TechnicianProtectedRoute>
                  <Users />
                </TechnicianProtectedRoute>
              } />
              <Route path="stripe" element={
                <TechnicianProtectedRoute>
                  <Stripe />
                </TechnicianProtectedRoute>
              } />
              <Route path="growth" element={
                <Navigate to={`/sistema/growth/month/${new Date().toISOString().slice(0, 7)}`} replace />
              } />
              <Route path="growth/month/:month" element={
                <TechnicianProtectedRoute>
                  <MonthlyGrowth />
                </TechnicianProtectedRoute>
              } />
              <Route path="monthly-reports" element={
                <TechnicianProtectedRoute>
                  <MonthlyReports />
                </TechnicianProtectedRoute>
              } />
              <Route path="traffic" element={
                <TechnicianProtectedRoute allowedForTechnician={true}>
                  <Traffic />
                </TechnicianProtectedRoute>
              } />
              <Route path="traffic/:clientId" element={
                <TechnicianProtectedRoute allowedForTechnician={true}>
                  <TrafficDetail />
                </TechnicianProtectedRoute>
              } />
              <Route path="audit" element={
                <TechnicianProtectedRoute>
                  <AuditLogs />
                </TechnicianProtectedRoute>
              } />
              </Route>
            </Route>
          </Routes>
            </Router>
            </ToastProvider>
          </SocketProvider>
        </ClientPortalProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
