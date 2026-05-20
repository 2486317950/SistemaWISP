/** URL pública para que el cliente acepte o rechace (mismo origen + base Vite `/sistema/`). */
export function publicCotizacionClienteUrl(publicToken) {
  if (!publicToken) return '';
  const base = import.meta.env.BASE_URL || '/';
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${window.location.origin}${root}/c/${publicToken}`;
}
