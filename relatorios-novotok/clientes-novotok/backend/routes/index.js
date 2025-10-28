const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./users');
const oracleRoutes = require('./oracle');

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
router.use('/users', userRoutes);
router.use('/oracle', oracleRoutes);

module.exports = router;