require('dotenv').config();
const express = require('express');
const { v4: uuid } = require('uuid');
const cors = require('cors');
const morgan = require('morgan');

const { PRODUCTS } = require('./data/products');
const { chaosState, chaosMw } = require('./middleware/chaos');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use(chaosMw); // Apply chaos middleware globally

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    service: "shopstream",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GET /products
app.get('/products', async (req, res) => {
  // Add random delay 50-150ms
  const delay = Math.floor(Math.random() * 100) + 50;
  await sleep(delay);

  res.json({
    products: PRODUCTS,
    count: PRODUCTS.length,
    timestamp: new Date().toISOString()
  });
});

// GET /products/:id
app.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  const product = PRODUCTS.find(p => p.id === id);

  if (!product) {
    return res.status(404).json({
      error: "Product not found",
      id: id
    });
  }

  // Add random delay 20-80ms
  const delay = Math.floor(Math.random() * 60) + 20;
  await sleep(delay);

  res.json(product);
});

// POST /orders
app.post('/orders', async (req, res) => {
  const { product_id, quantity, user_id } = req.body;

  if (!product_id || !quantity || !user_id) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing required fields: product_id, quantity, user_id"
    });
  }

  const product = PRODUCTS.find(p => p.id === product_id);
  if (!product) {
    return res.status(404).json({
      error: "Product not found",
      product_id: product_id
    });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      error: "Out of stock",
      message: `Requested ${quantity} items, but only ${product.stock} available.`
    });
  }

  // Add delay 100-200ms
  const delay = Math.floor(Math.random() * 100) + 100;
  await sleep(delay);

  res.json({
    order_id: uuid(),
    product_id,
    quantity,
    user_id,
    total: (product.price * quantity).toFixed(2),
    status: "processing",
    estimated_delivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  });
});

// POST /checkout
app.post('/checkout', async (req, res) => {
  const { order_id, payment_method } = req.body;

  if (!order_id || !payment_method) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing required fields: order_id, payment_method"
    });
  }

  // Add delay 200-400ms
  const delay = Math.floor(Math.random() * 200) + 200;
  await sleep(delay);

  res.json({
    transaction_id: uuid(),
    order_id: order_id,
    status: "success",
    amount_charged: (Math.random() * 200 + 20).toFixed(2),
    payment_method: payment_method,
    processed_at: new Date().toISOString()
  });
});

// GET /admin/status
app.get('/admin/status', (req, res) => {
  res.json({
    errorInjectionActive: chaosState.errorInjectionActive,
    errorRate: chaosState.errorRate,
    latencyMultiplierActive: chaosState.latencyMultiplierActive,
    extraLatencyMs: chaosState.extraLatencyMs,
    injectionStarted: chaosState.injectionStarted,
    injectionEndsAt: chaosState.injectionEndsAt,
    requestCount: chaosState.requestCount,
    errorCount: chaosState.errorCount,
    chaos_active: chaosState.errorInjectionActive || chaosState.latencyMultiplierActive,
    seconds_remaining: chaosState.injectionEndsAt ?
      Math.max(0, Math.floor((new Date(chaosState.injectionEndsAt) - Date.now()) / 1000)) : 0
  });
});

// POST /admin/inject-errors
app.post('/admin/inject-errors', (req, res) => {
  const duration_seconds = req.body.duration_seconds || 120;
  const error_rate = req.body.error_rate !== undefined ? req.body.error_rate : 85;

  chaosState.errorInjectionActive = true;
  chaosState.errorRate = error_rate;
  chaosState.injectionStarted = new Date();
  chaosState.injectionEndsAt = new Date(Date.now() + duration_seconds * 1000);

  console.log(`🔴 CHAOS INJECTED: error_rate=${error_rate}% for ${duration_seconds}s`);

  res.json({
    message: "Error injection active",
    error_rate,
    duration_seconds,
    ends_at: chaosState.injectionEndsAt,
    warning: "ShopStream checkout service is now degraded"
  });
});

// POST /admin/stop-injection
app.post('/admin/stop-injection', (req, res) => {
  chaosState.reset();
  console.log("🟢 CHAOS STOPPED: Service restored.");
  res.json({
    message: "Chaos injection stopped. Service restored."
  });
});

// POST /admin/inject-latency
app.post('/admin/inject-latency', (req, res) => {
  const latency_ms = req.body.latency_ms || 2000;
  const duration_seconds = req.body.duration_seconds || 120;

  chaosState.latencyMultiplierActive = true;
  chaosState.extraLatencyMs = latency_ms;
  chaosState.injectionStarted = new Date();
  chaosState.injectionEndsAt = new Date(Date.now() + duration_seconds * 1000);

  console.log(`🟡 LATENCY INJECTED: latency_ms=${latency_ms}ms for ${duration_seconds}s`);

  res.json({
    message: "Latency injection active",
    latency_ms,
    duration_seconds,
    ends_at: chaosState.injectionEndsAt
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 ShopStream API running on port ${PORT}`);
});

// Handle SIGTERM gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
