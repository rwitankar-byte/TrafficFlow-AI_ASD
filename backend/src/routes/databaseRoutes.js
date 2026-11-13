const express = require('express');
const { getAnalytics, getCurrentSignals, getEmergencyHistory, getJunctions, getSignalHistory, getTrafficHistory } = require('../controllers/databaseController.js');

const router = express.Router();
router.get('/junctions', getJunctions);
router.get('/traffic/history', getTrafficHistory);
router.get('/signals/current', getCurrentSignals);
router.get('/signals/history', getSignalHistory);
router.get('/emergency/history', getEmergencyHistory);
router.get('/analytics', getAnalytics);

module.exports = router;
