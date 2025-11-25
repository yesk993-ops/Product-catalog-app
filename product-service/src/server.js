require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const productRoutes = require('./routes/productRoutes');
const seedProducts = require('./scripts/seedProducts');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().then(() => {
  // Seed default products after database connection
  // Run in background so it doesn't block server startup
  setTimeout(() => {
    seedProducts().catch(err => {
      console.error('Seeding failed (non-critical):', err.message);
    });
  }, 3000); // Wait 3 seconds for DB to be fully ready
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'product-service',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/products', productRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Product Service API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      products: '/api/products'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;

