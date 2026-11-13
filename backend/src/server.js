// server.js – entry point for the backend API
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const trafficRoutes = require('./routes/trafficRoutes.js');
const databaseRoutes = require('./routes/databaseRoutes.js');
const { disconnectPrisma } = require('./db/client.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

module.exports = { app };
