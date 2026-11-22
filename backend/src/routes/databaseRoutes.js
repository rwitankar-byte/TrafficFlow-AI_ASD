const express = require('express');
const controllers = require('../controllers/databaseController.js');

const router = express.Router();

// Database Status & Connectivity Info
router.get('/database/status', controllers.getDatabaseStatus);

// Traffic Queries by Date, Time & Rush Hours
router.get('/traffic/by-date', controllers.getTrafficByDate);
router.get('/traffic/rush-dates', controllers.getRushTrafficDates);
router.get('/traffic/history', controllers.getTrafficHistory);

// Core Junction & Signal Historical Data
router.get('/junctions', controllers.getJunctions);
router.get('/signals/current', controllers.getCurrentSignals);
router.get('/signals/history', controllers.getSignalHistory);
router.get('/emergency/history', controllers.getEmergencyHistory);
router.get('/analytics', controllers.getAnalytics);

module.exports = router;
