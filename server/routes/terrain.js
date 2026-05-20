const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');
const {
  buildTerrainSectorRing,
  buildFlatSectorRing,
  queryElevationAt
} = require('../services/terrainLos');

const router = express.Router();
router.use(authenticateToken);
router.use(blockTechnicians);

/**
 * Elevación (m s.n.m.) en un punto — OpenTopoData/SRTM (~30 m).
 */
router.get('/elevation', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat y lng numéricos requeridos' });
  }
  try {
    const elevation = await queryElevationAt(lat, lng);
    return res.json({ elevation, lat, lng });
  } catch (err) {
    return res.status(502).json({
      error: 'No se pudo consultar relieve. Revisa conexión o inténtalo después.',
      detail: err.message
    });
  }
});

/**
 * Polígono [lat,lng][] del sector usando relieve (línea de vista simplificada).
 */
router.post('/antenna-sector', async (req, res) => {
  const antenna = req.body && typeof req.body.antenna === 'object' ? req.body.antenna : req.body;
  if (!antenna || antenna.latitude == null || antenna.longitude == null) {
    return res.status(400).json({ error: 'Datos de antena incompletos' });
  }

  const useTerrain = !(req.body.use_terrain === false);

  if (!useTerrain) {
    const { ring, meta } = buildFlatSectorRing(antenna);
    return res.json({ points: ring, mode: 'flat', meta });
  }

  try {
    const { ring, meta } = await buildTerrainSectorRing(antenna, {
      observer_height_m: req.body.observer_height_m,
      terrain_margin_m: req.body.terrain_margin_m,
      skip_first_m: req.body.skip_first_m
    });
    return res.json({ points: ring, mode: 'terrain', meta });
  } catch (err) {
    const { ring, meta } = buildFlatSectorRing(antenna);
    return res.json({
      points: ring,
      mode: 'flat_fallback',
      warning: err.message,
      meta
    });
  }
});

module.exports = router;
