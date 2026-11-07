const express = require('express');
const router = express.Router();
const { getCurrentTraffic, getTrafficDecision } = require('../controllers/trafficController');

// GET /api/traffic/current - get current traffic counts
router.get('/current', getCurrentTraffic);

// GET & POST /api/traffic/decision - get signal timing decision
router.get('/decision', getTrafficDecision);
router.post('/decision', getTrafficDecision);

module.exports = router;
