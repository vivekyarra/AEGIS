import { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Trash2,
  RefreshCw,
  AlertOctagon,
  ShieldCheck,
  Flame,
  Radio,
} from 'lucide-react';
import useApi from '../hooks/useApi';

export default function DemoControl({ connected }) {
  const {
    triggerTestIncident,
    injectChaos,
    stopChaos,
    fetchShopStatus,
    resetIncidents,
    seedDemoData,
  } = useApi();

  // Test Incident state
  const [testService, setTestService] = useState('checkout-service');
  const [testSeverity, setTestSeverity] = useState('P1');
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

  // Chaos Injection state
  const [errorRate, setErrorRate] = useState(75);
  const [duration, setDuration] = useState(120);
  const [chaosLoading, setChaosLoading] = useState(false);
  const [shopStatus, setShopStatus] = useState(null);

  // Database actions state
  const [dbLoading, setDbLoading] = useState(false);

  // Fetch shop status on mount and poll every 4s
  useEffect(() => {
    async function loadStatus() {
      const status = await fetchShopStatus();
      if (status) {
        setShopStatus(status);
      }
    }
    loadStatus();

    const interval = setInterval(loadStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchShopStatus]);

  const handleTriggerIncident = async () => {
    setTriggerLoading(true);
    setTriggerResult(null);
    const result = await triggerTestIncident(testService, testSeverity);
    if (result) {
      setTriggerResult(result);
    }
    setTriggerLoading(false);
  };

  const handleInjectChaos = async () => {
    setChaosLoading(true);
    const result = await injectChaos(errorRate, duration);
    if (result) {
      // Refresh status immediately
      const status = await fetchShopStatus();
      if (status) setShopStatus(status);
    }
    setChaosLoading(false);
  };

  const handleStopChaos = async () => {
    setChaosLoading(true);
    const result = await stopChaos();
    if (result) {
      // Refresh status immediately
      const status = await fetchShopStatus();
      if (status) setShopStatus(status);
    }
    setChaosLoading(false);
  };

  const handleResetDb = async () => {
    if (!confirm('Are you sure you want to clear all incidents and re-seed defaults?')) return;
    setDbLoading(true);
    const result = await resetIncidents();
    if (result && result.status === 'success') {
      alert('Incident database reset completed successfully.');
    }
    setDbLoading(false);
  };

  const handleSeedDb = async () => {
    setDbLoading(true);
    const result = await seedDemoData();
    if (result && result.status === 'success') {
      alert('Demo incidents seeded successfully.');
    }
    setDbLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sentinel-border pb-4">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide">
            Hackathon Demo Control
          </h2>
          <p className="text-xs text-sentinel-gray mt-1">
            Simulate live production incidents, inject latency/errors into target services, and manage backend memory.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── COLUMN 1: Outage Simulator ─────────────── */}
        <div className="space-y-6">
          {/* Section 1: Trigger Incident */}
          <div className="glass-card p-6 border-t-2 border-t-sentinel-red">
            <div className="flex items-center gap-3 mb-5">
              <Flame className="w-5 h-5 text-sentinel-red" />
              <h4 className="font-bold text-sm uppercase tracking-wide">
                Simulate Incident Webhook
              </h4>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-xs text-sentinel-gray leading-relaxed">
                Send a mock problem notification webhook to AEGIS. This will register a new active incident and immediately invoke the autonomous Gemini response agent loop.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Service Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs text-sentinel-gray font-semibold uppercase">
                    Target Service
                  </label>
                  <select
                    value={testService}
                    onChange={(e) => setTestService(e.target.value)}
                    className="w-full bg-sentinel-darker border border-sentinel-border text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-sentinel-cyan/50"
                  >
                    <option value="checkout-service">checkout-service</option>
                    <option value="payment-service">payment-service</option>
                    <option value="product-service">product-service</option>
                    <option value="order-service">order-service</option>
                    <option value="db-service">db-service</option>
                  </select>
                </div>

                {/* Severity Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs text-sentinel-gray font-semibold uppercase">
                    Severity Level
                  </label>
                  <select
                    value={testSeverity}
                    onChange={(e) => setTestSeverity(e.target.value)}
                    className="w-full bg-sentinel-darker border border-sentinel-border text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-sentinel-cyan/50"
                  >
                    <option value="P1">P1 (Critical Availability)</option>
                    <option value="P2">P2 (Performance Spike)</option>
                    <option value="P3">P3 (Minor Errors)</option>
                    <option value="P4">P4 (Warning Threshold)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleTriggerIncident}
                disabled={triggerLoading}
                className="w-full py-2.5 bg-sentinel-red hover:bg-sentinel-red/90 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wide"
              >
                {triggerLoading ? 'Triggering...' : 'Fire Incident Webhook'}
              </button>

              {triggerResult && (
                <div className="p-3 bg-sentinel-green/10 border border-sentinel-green/20 rounded-lg text-xs font-mono text-sentinel-green">
                  Webhook payload accepted. Active Incident ID:{' '}
                  <span className="font-bold underline">{triggerResult.incident_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Quick Actions */}
          <div className="glass-card p-6 border-t-2 border-t-sentinel-purple">
            <div className="flex items-center gap-3 mb-5">
              <Activity className="w-5 h-5 text-sentinel-purple" />
              <h4 className="font-bold text-sm uppercase tracking-wide">
                Agent Memory & DB Control
              </h4>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-sentinel-gray leading-relaxed">
                Manage backend storage states. Clear active traces to reset the hackathon pitch demo flow, or seed pre-recorded historical incidents.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleResetDb}
                  disabled={dbLoading}
                  className="py-2.5 border border-sentinel-red/30 hover:border-sentinel-red/50 bg-sentinel-red/5 hover:bg-sentinel-red/10 text-sentinel-red font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset DB
                </button>

                <button
                  onClick={handleSeedDb}
                  disabled={dbLoading}
                  className="py-2.5 border border-sentinel-cyan/30 hover:border-sentinel-cyan/50 bg-sentinel-cyan/5 hover:bg-sentinel-cyan/10 text-sentinel-cyan font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                  <RefreshCw className="w-4 h-4" />
                  Seed Demo Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 2: ShopStream Chaos Injection ───── */}
        <div className="space-y-6">
          {/* Section 3: Live Status */}
          <div className="glass-card p-6 border-t-2 border-t-sentinel-cyan">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-sentinel-cyan" />
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  ShopStream Service Status
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-sentinel-gray">
                <span className="w-2 h-2 rounded-full bg-sentinel-green animate-pulse" />
                <span>ShopStream API Online</span>
              </div>
            </div>

            {shopStatus ? (
              <div className="space-y-4">
                {/* Status indicator */}
                {shopStatus.chaos_active ? (
                  <div className="p-4 bg-sentinel-red/10 border border-sentinel-red/20 rounded-lg flex items-center gap-3 text-sentinel-red">
                    <AlertOctagon className="w-6 h-6 animate-pulse" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wide">
                        Chaos Injection Active
                      </h5>
                      <p className="text-[11px] text-sentinel-gray mt-0.5">
                        Checkout service is currently returning artificial 500 errors.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-sentinel-green/10 border border-sentinel-green/20 rounded-lg flex items-center gap-3 text-sentinel-green">
                    <ShieldCheck className="w-6 h-6" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wide">
                        Service Operating Normally
                      </h5>
                      <p className="text-[11px] text-sentinel-gray mt-0.5">
                        Clean telemetry. Real-time transactions are responding within SLAs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 bg-sentinel-darker/50 p-4 rounded-lg border border-sentinel-border font-mono text-xs">
                  <div>
                    <span className="text-sentinel-gray">Active Rate:</span>{' '}
                    <span className={shopStatus.chaos_active ? 'text-sentinel-red font-bold' : 'text-gray-300'}>
                      {shopStatus.chaos_active ? `${shopStatus.errorRate}% Errors` : '0%'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sentinel-gray">Time Remaining:</span>{' '}
                    <span className="text-gray-300">
                      {shopStatus.chaos_active ? `${shopStatus.seconds_remaining}s` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-sentinel-gray">
                Connection to ShopStream service unavailable.
              </div>
            )}
          </div>

          {/* Section 4: Inject Chaos Control */}
          <div className="glass-card p-6 border-t-2 border-t-sentinel-yellow">
            <div className="flex items-center gap-3 mb-5">
              <Flame className="w-5 h-5 text-sentinel-yellow" />
              <h4 className="font-bold text-sm uppercase tracking-wide">
                Inject Production Failure
              </h4>
            </div>

            <div className="space-y-5">
              <p className="text-xs text-sentinel-gray leading-relaxed">
                Degrade the ShopStream checkout container. This creates real telemetry anomalies inside Dynatrace (elevating HTTP error rates), which triggers the webhook loop.
              </p>

              {/* Slider for error rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-sentinel-gray uppercase">Error Intensity</span>
                  <span className="text-sentinel-yellow">{errorRate}% HTTP 500s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={errorRate}
                  onChange={(e) => setErrorRate(parseInt(e.target.value))}
                  className="w-full h-1 bg-sentinel-darker rounded-lg appearance-none cursor-pointer accent-sentinel-yellow border border-sentinel-border"
                />
              </div>

              {/* Duration selection */}
              <div className="space-y-2">
                <span className="text-xs text-sentinel-gray font-semibold uppercase block">
                  Outage Duration
                </span>
                <div className="flex gap-2">
                  {[60, 120, 240].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDuration(t)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                        duration === t
                          ? 'border-sentinel-yellow bg-sentinel-yellow/10 text-sentinel-yellow'
                          : 'border-sentinel-border bg-sentinel-darker hover:text-white'
                      }`}
                    >
                      {t} seconds
                    </button>
                  ))}
                </div>
              </div>

              {/* Inject / Stop Actions */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={handleInjectChaos}
                  disabled={chaosLoading}
                  className="flex-1 py-2.5 bg-sentinel-yellow hover:bg-sentinel-yellow/90 disabled:opacity-50 text-sentinel-darker font-bold rounded-lg text-xs transition-colors uppercase tracking-wide"
                >
                  Inject Failure
                </button>

                <button
                  onClick={handleStopChaos}
                  disabled={chaosLoading}
                  className="flex-1 py-2.5 border border-sentinel-green bg-sentinel-green/5 hover:bg-sentinel-green/10 text-sentinel-green font-bold rounded-lg text-xs transition-colors uppercase tracking-wide"
                >
                  Stop Chaos / Restore
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
