const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedDatabase } = require('./backend/db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./backend/routes/auth.routes'));
app.use('/api/products', require('./backend/routes/products.routes'));
app.use('/api/categories', require('./backend/routes/categories.routes'));
app.use('/api/suppliers', require('./backend/routes/suppliers.routes'));
app.use('/api/warehouses', require('./backend/routes/warehouses.routes'));
app.use('/api/stock', require('./backend/routes/stock.routes'));
app.use('/api/purchase-orders', require('./backend/routes/purchase_orders.routes'));
app.use('/api/analytics', require('./backend/routes/analytics.routes'));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'StockPilot ERP System',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application (SPA) fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint Not Found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-seed database and start listening with port fallback
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`=======================================================`);
    console.log(` StockPilot ERP Web Application Running!`);
    console.log(` URL: http://localhost:${portToTry}`);
    console.log(` Default Demo Login: admin@stockpilot.com / Demo@123`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${portToTry} in use, trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

seedDatabase(false)
  .then(() => {
    if (process.env.NODE_ENV !== 'test') {
      const initialPort = parseInt(process.env.PORT, 10) || 3000;
      startServer(initialPort);
    }
  })
  .catch((err) => {
    console.error('Failed to initialize StockPilot database:', err);
  });


module.exports = app;
