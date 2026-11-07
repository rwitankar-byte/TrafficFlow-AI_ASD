// server.js – entry point for the backend API
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Simple health check route
app.get('/', (req, res) => {
  res.send('Smart Traffic Management backend is running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

