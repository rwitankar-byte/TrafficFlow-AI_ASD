const express = require('express');
const router = express.Router();
const { getCurrentTraffic } = require('../controllers/trafficController');

// GET /api/traffic/current
router.get('/current', getCurrentTraffic);

module.exports = router;

