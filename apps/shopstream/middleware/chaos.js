const { v4: uuid } = require('uuid');

class ChaosState {
  constructor() {
    this.reset();
  }

  reset() {
    this.errorInjectionActive = false;
    this.errorRate = 0; // percentage (0-100)
    this.latencyMultiplierActive = false;
    this.extraLatencyMs = 0;
    this.injectionStarted = null;
    this.injectionEndsAt = null;
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

const chaosState = new ChaosState();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function chaosMw(req, res, next) {
  // Increment total request count
  chaosState.requestCount++;

  // Bypass chaos for health checks and admin controls
  if (req.path === '/health' || req.path.startsWith('/admin/')) {
    return next();
  }

  // Check if chaos period has expired
  if (chaosState.injectionEndsAt && Date.now() > chaosState.injectionEndsAt) {
    console.log("🕒 Chaos injection period ended. Auto-restoring service status.");
    chaosState.reset();
  }

  // Inject latency if enabled
  if (chaosState.latencyMultiplierActive && chaosState.extraLatencyMs > 0) {
    await sleep(chaosState.extraLatencyMs);
  }

  // Inject HTTP 500 errors if enabled and roll falls within rate percentage
  if (chaosState.errorInjectionActive) {
    const roll = Math.random() * 100;
    if (roll < chaosState.errorRate) {
      chaosState.errorCount++;
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Database connection pool exhausted - payment processing service unavailable",
        service: "checkout-service",
        timestamp: new Date().toISOString(),
        trace_id: uuid(),
        stack: "Error: ECONNREFUSED\n    at PaymentProcessor.charge (/app/services/payment.js:142:11)\n    at CheckoutController.process (/app/controllers/checkout.js:67:23)\n    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)"
      });
    }
  }

  next();
}

module.exports = {
  chaosState,
  chaosMw
};
