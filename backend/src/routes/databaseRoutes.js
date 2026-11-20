const express = require('express');
const controllers = require('../controllers/databaseController.js');

const router = express.Router();
router.get('/junctions', controllers.getJunctions);
router.get('/traffic/history', controllers.getTrafficHistory);
router.get('/signals/current', controllers.getCurrentSignals);
router.get('/signals/history', controllers.getSignalHistory);
router.get('/emergency/history', controllers.getEmergencyHistory);
router.get('/analytics', controllers.getAnalytics);

module.exports = router;
