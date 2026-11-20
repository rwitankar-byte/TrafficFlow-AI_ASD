// api/index.js - Vercel Serverless Function entry point
let express, cors;
try {
  express = require('express');
  cors = require('cors');
} catch (e) {
  express = require('../backend/node_modules/express');
  cors = require('../backend/node_modules/cors');
}

const trafficRoutes = require('../backend/src/routes/trafficRoutes');
const databaseRoutes = require('../backend/src/routes/databaseRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get(['/', '/api'], (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'TrafficFlow-AI Smart Traffic Management API',
    platform: 'Vercel Serverless Functions',
    endpoints: {
      decision: '/api/traffic/decision',
      current: '/api/traffic/current'
    }
  });
});

// Support both /api/traffic and direct /traffic mounts for Vercel routing
app.use('/api/traffic', trafficRoutes);
app.use('/traffic', trafficRoutes);
app.use('/api', databaseRoutes);

module.exports = app;
