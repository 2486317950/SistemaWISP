/**
 * Geocodificación dominio público usando Nominatim (OpenStreetMap).
 * Políticas: https://operations.osmfoundation.org/policies/nominatim/ (UA identificativo, uso moderado).
 */

const https = require('https');

let lastNomAt = 0;
/** Espacio entre peticiones — Nominatim pide como máximo 1 solicitud por segundo típicamente */
const MIN_INTERVAL_MS = 1100;

function httpsGetJson(host, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname: host, path, headers, timeout: 15000 },
      (res) => {
        let buf = '';
        res.on('data', (ch) => {
          buf += ch;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error(`Respuesta JSON inválida: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

/**
 * Busca coords para un texto de domicilio.
 * @param {string} address
 * @param {string} [countryCodes] Códigos ISO separados por coma, ej "mx"
 * @returns {Promise<{lat:number,lng:number,display_name:string|null}|null>}
 */
async function nominatimSearchAddress(address, countryCodes) {
  const wait = lastNomAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNomAt = Date.now();

  const trimmed = typeof address === 'string' ? address.trim() : '';
  if (!trimmed) {
    throw new Error('Domicilio vacío');
  }

  const ua =
    process.env.NOMINATIM_USER_AGENT ||
    process.env.APP_PUBLIC_URL ||
    'SistemaWISP/1.0 (geocodificación; contacto soporte técnico del sistema)';

  let path =
    `/search?format=json&limit=5&accept-language=es&q=${encodeURIComponent(trimmed)}`;
  let cc =
    typeof countryCodes === 'string'
      ? countryCodes.trim().toLowerCase().replace(/[^a-z,]/g, '')
      : '';
  if (!cc) cc = 'mx';
  if (cc) path += `&countrycodes=${encodeURIComponent(cc)}`;

  const json = await httpsGetJson(
    'nominatim.openstreetmap.org',
    path,
    {
      'User-Agent': ua,
      Accept: 'application/json'
    }
  );

  if (!Array.isArray(json) || json.length === 0) return null;

  const first = json.find((item) => item.lat != null && item.lon != null) || json[0];
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, display_name: first.display_name ? String(first.display_name) : null };
}

module.exports = { nominatimSearchAddress };
