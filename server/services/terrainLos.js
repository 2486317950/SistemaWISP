/**
 * Línea de vista aproximada sobre DEM (elevaciones vía OpenTopoData — SRTM 30 m).
 * No sustituye un estudio de propagación profesional (Fresnel, difracción, clima…).
 */

const https = require('https');

const OPENTOPO_BASE = 'https://api.opentopodata.org/v1/srtm30m';

const EARTH_R_M = 6371000;

/**
 * Punto geodésico a bearings y distancia en metros.
 */
function destinationPoint(latDeg, lngDeg, bearingDeg, distanceMeters) {
  const lat1 = (latDeg * Math.PI) / 180;
  const lng1 = (lngDeg * Math.PI) / 180;
  const brng = (bearingDeg * Math.PI) / 180;
  const dR = distanceMeters / EARTH_R_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function keyLl(lat, lng, prec = 6) {
  return `${Number(lat).toFixed(prec)},${Number(lng).toFixed(prec)}`;
}

function parseLocationsFromOpenTopo(payload) {
  const out = new Map();
  if (!payload || !Array.isArray(payload.results)) return out;
  for (let i = 0; i < payload.results.length; i++) {
    const r = payload.results[i];
    const loc = r.location;
    if (!loc || loc.lat == null || loc.lng == null) continue;
    let el = r.elevation;
    if (typeof el !== 'number' || !Number.isFinite(el)) el = 0;
    out.set(keyLl(loc.lat, loc.lng), el);
  }
  return out;
}

function fetchOpenTopoBatches(coordsList, timeoutMs = 25000) {
  const chunks = [];
  const maxPerBatch = 90;
  for (let i = 0; i < coordsList.length; i += maxPerBatch) {
    chunks.push(coordsList.slice(i, i + maxPerBatch));
  }

  const runBatch = (batch) =>
    new Promise((resolve, reject) => {
      const locParam = batch.map((c) => `${c.lat},${c.lng}`).join('|');
      const url = `${OPENTOPO_BASE}?locations=${encodeURIComponent(locParam)}`;
      const req = https.get(
        url,
        { headers: { 'User-Agent': 'SistemaWISP-terrain/1.0' }, timeout: timeoutMs },
        (res) => {
          let body = '';
          res.on('data', (ch) => {
            body += ch;
          });
          res.on('end', () => {
            try {
              const js = JSON.parse(body);
              if (js.status && js.status !== 'OK' && js.status !== 'ok') {
                return reject(new Error(js.error || 'OpenTopo error'));
              }
              resolve(js);
            } catch (e) {
              reject(new Error(`OpenTopo malformado: ${e.message}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenTopo timeout'));
      });
    });

  const elevMap = new Map();
  return (async () => {
    /* eslint-disable no-await-in-loop */
    for (const batch of chunks) {
      const json = await runBatch(batch);
      const parsed = parseLocationsFromOpenTopo(json);
      parsed.forEach((v, k) => elevMap.set(k, v));
    }
    return elevMap;
  })();
}

/**
 * Elevación AMSL conocida por mapa coord -> m
 */
function elevAt(lat, lng, map) {
  const k = keyLl(lat, lng);
  if (map.has(k)) return map.get(k);
  const fuzzy = [...map.entries()].find(([kk]) => {
    const parts = kk.split(',');
    return (
      Math.abs(parseFloat(parts[0]) - lat) < 1e-5 && Math.abs(parseFloat(parts[1]) - lng) < 1e-5
    );
  });
  if (fuzzy) return fuzzy[1];
  return 0;
}

/**
 * Para un haz (bearing fijo): distancia máxima LOS hasta maxDistanceM antes de cortar.
 * antennaTopAmsl: altura antena sobre el nivel del mar (cota sitio + mástil).
 * marginM: margen de franqueo sobre el terreno (simplificado).
 */
function losDistanceAlongRay({
  centerLat,
  centerLng,
  bearingDeg,
  maxDistanceM,
  stepM,
  antennaTopAmsl,
  observerHeightM,
  marginM,
  skipFirstM,
  elevMap
}) {
  const samples = [];
  for (let d = 0; d <= maxDistanceM; d += stepM) {
    const p = destinationPoint(centerLat, centerLng, bearingDeg, d);
    samples.push({ d, lat: p.lat, lng: p.lng });
  }

  const far = samples[samples.length - 1];
  const elevFar = elevAt(far.lat, far.lng, elevMap);
  const receiverAmsl = elevFar + observerHeightM;

  let lastClear = 0;
  for (let i = 0; i < samples.length; i++) {
    const { d, lat, lng } = samples[i];
    if (d < skipFirstM) continue;
    const terrain = elevAt(lat, lng, elevMap);
    const zLine =
      maxDistanceM <= 0
        ? antennaTopAmsl
        : antennaTopAmsl + ((receiverAmsl - antennaTopAmsl) * d) / maxDistanceM;
    if (terrain + marginM >= zLine) {
      return Math.max(skipFirstM, lastClear || 35);
    }
    lastClear = d;
  }
  return maxDistanceM;
}

/**
 * Construye anillo [lat,lng][] del sector (centro + arco + cierre), con radio variable por relieves.
 */
async function buildTerrainSectorRing(antenna, options = {}) {
  const lat0 = parseFloat(antenna.latitude);
  const lng0 = parseFloat(antenna.longitude);
  const rangeKm = parseFloat(antenna.range);
  const azimuth = parseFloat(antenna.azimuth);
  const aperture = parseFloat(antenna.aperture);

  if (!Number.isFinite(lat0) || !Number.isFinite(lng0) || !Number.isFinite(rangeKm)) {
    throw new Error('Coordenadas o alcance inválidos');
  }

  const maxDistM = Math.max(50, rangeKm * 1000);
  const stepM = Math.min(420, Math.max(140, Math.round(maxDistM / 22)));
  const mastM =
    antenna.mast_height_m != null && antenna.mast_height_m !== ''
      ? parseFloat(antenna.mast_height_m)
      : 15;
  const siteEl =
    antenna.site_elevation_m != null && antenna.site_elevation_m !== ''
      ? parseFloat(antenna.site_elevation_m)
      : null;
  const observerH = options.observer_height_m != null ? parseFloat(options.observer_height_m) : 3;
  const marginM = options.terrain_margin_m != null ? parseFloat(options.terrain_margin_m) : 8;
  const skipFirstM = options.skip_first_m != null ? parseFloat(options.skip_first_m) : 40;

  const startAngle = azimuth - aperture / 2;
  const endAngle = azimuth + aperture / 2;
  const numRadials = Math.max(7, Math.min(28, Math.ceil(aperture / 6)));

  const collectPoints = [];
  collectPoints.push({ lat: lat0, lng: lng0 });

  for (let i = 0; i <= numRadials; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / numRadials;
    for (let d = 0; d <= maxDistM; d += stepM) {
      const p = destinationPoint(lat0, lng0, angle, d);
      collectPoints.push({ lat: p.lat, lng: p.lng });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const p of collectPoints) {
    const k = keyLl(p.lat, p.lng);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }

  const elevMap = await fetchOpenTopoBatches(unique);

  let siteElevationAmsl = siteEl;
  if (!Number.isFinite(siteElevationAmsl)) {
    siteElevationAmsl = elevAt(lat0, lng0, elevMap);
  }

  const antennaTopAmsl = siteElevationAmsl + (Number.isFinite(mastM) ? mastM : 15);

  const arcPoints = [];
  for (let i = 0; i <= numRadials; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / numRadials;
    const effM = losDistanceAlongRay({
      centerLat: lat0,
      centerLng: lng0,
      bearingDeg: angle,
      maxDistanceM: maxDistM,
      stepM,
      antennaTopAmsl,
      observerHeightM: observerH,
      marginM,
      skipFirstM,
      elevMap
    });
    const edge = destinationPoint(lat0, lng0, angle, effM);
    arcPoints.push([edge.lat, edge.lng]);
  }

  const ring = [[lat0, lng0], ...arcPoints, [lat0, lng0]];
  return {
    ring,
    meta: {
      antennaTopAmsl,
      siteElevationAmsl,
      stepM,
      numRadials,
      dataSource: 'OpenTopoData SRTM 30m'
    }
  };
}

async function queryElevationAt(lat, lng) {
  const m = await fetchOpenTopoBatches([{ lat: Number(lat), lng: Number(lng) }]);
  return elevAt(Number(lat), Number(lng), m);
}

function buildFlatSectorRing(antenna) {
  const center = [parseFloat(antenna.latitude), parseFloat(antenna.longitude)];
  const range = parseFloat(antenna.range) * 1000;
  const azimuth = parseFloat(antenna.azimuth);
  const aperture = parseFloat(antenna.aperture);
  const startAngle = azimuth - aperture / 2;
  const endAngle = azimuth + aperture / 2;
  const points = [center];
  const numPoints = Math.max(20, Math.ceil(aperture / 5));
  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
    const rad = (angle * Math.PI) / 180;
    const lat = center[0] + (range / 111320) * Math.cos(rad);
    const lng = center[1] + (range / (111320 * Math.cos((center[0] * Math.PI) / 180))) * Math.sin(rad);
    points.push([lat, lng]);
  }
  points.push(center);
  return { ring: points, meta: { flat: true } };
}

module.exports = {
  buildTerrainSectorRing,
  buildFlatSectorRing,
  destinationPoint,
  fetchOpenTopoBatches,
  queryElevationAt
};
