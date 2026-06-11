import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Brain,
  Shield,
  Activity,
  Terminal,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import useApi from '../hooks/useApi';

export default function Dashboard({
  incidents,
  setIncidents,
  agentSteps,
  connected,
  lastEvent,
}) {
  const navigate = useNavigate();
  const { fetchIncidents, fetchStats } = useApi();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    avgResolution: 15,
    accuracy: 94,
  });
  const [errorData, setErrorData] = useState([]);
  const stepsEndRef = useRef(null);

  // Auto-scroll agent reasoning steps to bottom
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentSteps]);

  // Load stats and incidents on mount
  useEffect(() => {
    async function loadData() {
      const incList = await fetchIncidents();
      if (incList && incList.length > 0) {
        setIncidents(incList);
      }
      
      const statData = await fetchStats();
      if (statData) {
        setStats({
          total: statData.total || 0,
          active: incList.filter((i) => i.status !== 'resolved').length,
          avgResolution: statData.avg_resolution_minutes || 15,
          accuracy: statData.ai_accuracy || 94,
        });
      }
    }
    loadData();
  }, [fetchIncidents, fetchStats, setIncidents]);

  // Update stats dynamically when incidents array changes
  useEffect(() => {
    const activeCount = incidents.filter((i) => i.status !== 'resolved').length;
    setStats((prev) => ({
      ...prev,
      total: incidents.length,
      active: activeCount,
    }));
  }, [incidents]);

  // Generate realistic mock error rate chart data (updates every few seconds)
  useEffect(() => {
    const activeIncident = incidents.some((i) => i.status !== 'resolved');
    const points = [];
    const now = new Date();
    for (let i = 15; i >= 0; i--) {
      const timeStr = new Date(now.getTime() - i * 60000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      // Spike errors if incident is active
      let rate = Math.random() * 2 + 1; // 1-3% base error rate
      if (activeIncident && i <= 5) {
        rate = Math.random() * 20 + 35; // 35-55% error rate spike
      }
      points.push({ time: timeStr, errorRate: parseFloat(rate.toFixed(1)) });
    }
    setErrorData(points);
  }, [incidents]);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const hasActive = activeIncidents.length > 0;

  return (
    <div className="space-y-6">
      {/* ── KPI Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Incidents */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sentinel-gray uppercase tracking-wider">
                Total Incidents
              </p>
              <h3 className="text-3xl font-bold mt-2 font-mono">{stats.total}</h3>
            </div>
            <div className="p-3 rounded-lg bg-sentinel-blue/10 border border-sentinel-blue/20">
              <Activity className="w-6 h-6 text-sentinel-blue" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sentinel-blue/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
        </div>

        {/* Active Now */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sentinel-gray uppercase tracking-wider">
                Active Incidents
              </p>
              <h3 className="text-3xl font-bold mt-2 font-mono flex items-center gap-3">
                {stats.active}
                {stats.active > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-sentinel-red animate-pulse-red" />
                )}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-sentinel-red/10 border border-sentinel-red/20">
              <AlertTriangle className="w-6 h-6 text-sentinel-red" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sentinel-red/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
        </div>

        {/* Mean Time to Resolve */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sentinel-gray uppercase tracking-wider">
                Avg Resolution Time
              </p>
              <h3 className="text-3xl font-bold mt-2 font-mono">
                {stats.avgResolution} <span className="text-sm text-sentinel-gray">min</span>
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-sentinel-green/10 border border-sentinel-green/20">
              <Clock className="w-6 h-6 text-sentinel-green" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sentinel-green/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
        </div>

        {/* AI Accuracy */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sentinel-gray uppercase tracking-wider">
                AI Agent Accuracy
              </p>
              <h3 className="text-3xl font-bold mt-2 font-mono">{stats.accuracy}%</h3>
            </div>
            <div className="p-3 rounded-lg bg-sentinel-cyan/10 border border-sentinel-cyan/20">
              <Brain className="w-6 h-6 text-sentinel-cyan" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sentinel-cyan/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
        </div>
      </div>

      {/* ── Middle Layout (60/40 Split) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Live Incident Feed (3/5 width) */}
        <div className="lg:col-span-3 glass-card p-6 flex flex-col h-[460px]">
          <div className="flex items-center justify-between mb-5 border-b border-sentinel-border pb-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-sentinel-cyan" />
              <h4 className="font-bold tracking-wide text-sm uppercase">
                Active & Live Incidents
              </h4>
            </div>
            {hasActive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sentinel-red/10 border border-sentinel-red/20 text-[10px] text-sentinel-red font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-sentinel-red animate-pulse" />
                Live Outage
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {incidents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-12 h-12 text-sentinel-green mb-3 animate-pulse" />
                <h5 className="font-bold text-sentinel-green">ALL SYSTEMS OPERATIONAL</h5>
                <p className="text-xs text-sentinel-gray mt-1 max-w-[280px]">
                  No anomalies detected. AEGIS is active and monitoring telemetry streams.
                </p>
              </div>
            ) : (
              incidents.map((incident) => {
                const isResolved = incident.status === 'resolved';
                const severityColors = {
                  P1: 'border-sentinel-red/30 bg-sentinel-red/10 text-sentinel-red',
                  P2: 'border-sentinel-yellow/30 bg-sentinel-yellow/10 text-sentinel-yellow',
                  P3: 'border-sentinel-blue/30 bg-sentinel-blue/10 text-sentinel-blue',
                  P4: 'border-sentinel-gray/30 bg-sentinel-gray/10 text-sentinel-gray',
                };
                const statusColors = {
                  detected: 'bg-sentinel-red/10 border-sentinel-red/30 text-sentinel-red',
                  investigating: 'bg-sentinel-blue/10 border-sentinel-blue/30 text-sentinel-blue animate-pulse',
                  root_cause_found: 'bg-sentinel-cyan/10 border-sentinel-cyan/30 text-sentinel-cyan',
                  resolved: 'bg-sentinel-green/10 border-sentinel-green/30 text-sentinel-green',
                };

                return (
                  <div
                    key={incident.incident_id}
                    onClick={() => navigate(`/incidents/${incident.incident_id}`)}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-sentinel-darker/40 border border-sentinel-border hover:border-sentinel-cyan/30 hover:bg-sentinel-cyan/[0.02] cursor-pointer transition-all duration-200 group slide-in"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            severityColors[incident.severity] || severityColors.P2
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            statusColors[incident.status] || statusColors.detected
                          }`}
                        >
                          {incident.status?.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-sentinel-gray">
                          {incident.incident_id}
                        </span>
                      </div>
                      <h5 className="font-semibold text-sm group-hover:text-sentinel-cyan transition-colors">
                        {incident.title}
                      </h5>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {incident.affected_services?.map((svc) => (
                          <span
                            key={svc}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3 md:mt-0 text-xs text-sentinel-gray">
                      <span className="font-mono">
                        {new Date(incident.started_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <ArrowRight className="w-4 h-4 text-sentinel-gray group-hover:text-sentinel-cyan group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Agent Reasoning Feed (2/5 width) */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col h-[460px]">
          <div className="flex items-center justify-between mb-5 border-b border-sentinel-border pb-3">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-sentinel-cyan" />
              <h4 className="font-bold tracking-wide text-sm uppercase">
                Agent reasoning monitor
              </h4>
            </div>
            {hasActive && (
              <span className="w-2.5 h-2.5 rounded-full bg-sentinel-cyan animate-pulse" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-1">
            {agentSteps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sentinel-gray">
                <Terminal className="w-10 h-10 mb-2 opacity-40 text-sentinel-cyan" />
                <p>Waiting for incident trigger...</p>
                <p className="text-[10px] mt-1">Telemetry correlation idle.</p>
              </div>
            ) : (
              agentSteps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="p-3 rounded bg-sentinel-darker/70 border border-sentinel-border/50 text-gray-300 slide-in"
                >
                  <div className="flex items-center justify-between border-b border-sentinel-border/30 pb-1 mb-1.5">
                    <span className="text-sentinel-cyan font-bold">
                      Step {step.step_number}: {step.tool_name}
                    </span>
                    <span className="text-[10px] text-sentinel-gray">
                      {step.latency_ms}ms
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-sentinel-gray">Input:</span>{' '}
                      <span className="text-sentinel-yellow">
                        {JSON.stringify(step.tool_input)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-sentinel-gray">Output:</span>{' '}
                      <p className="text-[11px] text-gray-400 leading-relaxed max-h-16 overflow-y-auto bg-black/20 p-1.5 rounded mt-0.5 border border-white/5">
                        {step.tool_output}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={stepsEndRef} />
          </div>
        </div>
      </div>

      {/* ── Bottom: Real-Time Telemetry/Error Rate ───── */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-sentinel-cyan" />
            <h4 className="font-bold tracking-wide text-sm uppercase">
              System Error rate telemetry (Live)
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sentinel-gray font-mono">
            <TrendingUp className="w-4 h-4 text-sentinel-green" />
            <span>Target threshold &lt; 5.0%</span>
          </div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={errorData}>
              <defs>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={hasActive ? '#ff3366' : '#00ff88'}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={hasActive ? '#ff3366' : '#00ff88'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1629',
                  borderColor: '#1e2d4a',
                  color: '#fff',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              />
              <Area
                type="monotone"
                dataKey="errorRate"
                stroke={hasActive ? '#ff3366' : '#00ff88'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#errorGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
