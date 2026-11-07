// server.js – entry point for the backend API
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const trafficRoutes = require('./routes/trafficRoutes');

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
