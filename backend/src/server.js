// server.js – Entry point for the Traffic Management Backend API
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const trafficRoutes = require('./routes/trafficRoutes');
const databaseRoutes = require('./routes/databaseRoutes');
const { disconnectPrisma } = require('./db/client.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON request parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Smart Traffic Management backend is running');
});

// Traffic API Routes
app.use('/api/traffic', trafficRoutes);
app.use('/api', databaseRoutes);

app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.path}: ${err.message}`);
  res.status(err.message.includes('DATABASE_URL') ? 503 : 400).json({ status: 'error', message: err.message });
});

// Start the Express server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

module.exports = app;
module.exports.app = app;
