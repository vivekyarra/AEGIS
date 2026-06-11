import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Brain,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

import useWebSocket from './hooks/useWebSocket';
import Dashboard from './pages/Dashboard';
import IncidentDetail from './pages/IncidentDetail';
import IncidentList from './pages/IncidentList';
import Analytics from './pages/Analytics';
import AgentMonitor from './pages/AgentMonitor';
import DemoControl from './pages/DemoControl';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/agent', icon: Brain, label: 'Agent Monitor' },
  { to: '/demo', icon: Zap, label: 'Demo Control' },
];

function getStepId(incidentId, step) {
  return [
    incidentId || 'unknown',
    step.step_number || 'step',
    step.tool_name || 'tool',
    step.timestamp || '',
  ].join(':');
}

function flattenIncidentSteps(incidents) {
  return incidents
    .flatMap((incident) =>
      (incident.agent_steps || []).map((step) => ({
        ...step,
        incident_id: incident.incident_id || incident.id,
        id: getStepId(incident.incident_id || incident.id, step),
      }))
    )
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
}

export default function App() {
  const location = useLocation();
  const { connected, incidents, setIncidents, lastEvent, agentSteps, setAgentSteps } =
    useWebSocket();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedSteps = flattenIncidentSteps(incidents);
    if (storedSteps.length === 0) return;

    setAgentSteps((prev) => {
      const seen = new Set(prev.map((step) => step.id));
      const merged = [...prev];

      storedSteps.forEach((step) => {
        if (!seen.has(step.id)) {
          seen.add(step.id);
          merged.push(step);
        }
      });

      return merged
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
        .slice(-100);
    });
  }, [incidents, setAgentSteps]);

  return (
    <div className="flex h-screen bg-aegis-darker font-sans text-white overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="w-[240px] flex-shrink-0 flex flex-col bg-aegis-dark border-r border-aegis-border">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-aegis-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-8 h-8 text-aegis-cyan" />
              <div className="absolute inset-0 animate-glow rounded-full" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide gradient-text">
                AEGIS
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-aegis-gray">
                Autonomous Response
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-aegis-cyan/10 text-aegis-cyan border border-aegis-cyan/20 shadow-[0_0_15px_rgba(0,212,255,0.08)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Connection status */}
        <div className="px-5 py-4 border-t border-aegis-border">
          <div className="flex items-center gap-2 text-xs">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-aegis-green" />
                <span className="text-aegis-green font-medium">Connected</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-aegis-green animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-aegis-red" />
                <span className="text-aegis-red font-medium">Disconnected</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-aegis-red animate-pulse-red" />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 flex-shrink-0 flex items-center justify-between px-6 border-b border-aegis-border bg-aegis-dark/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {format(time, 'EEE, MMM d · HH:mm:ss')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  connected ? 'bg-aegis-green' : 'bg-aegis-red animate-pulse-red'
                )}
              />
              <span className="text-gray-400">
                WebSocket {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  incidents={incidents}
                  setIncidents={setIncidents}
                  agentSteps={agentSteps}
                  connected={connected}
                  lastEvent={lastEvent}
                />
              }
            />
            <Route
              path="/incidents"
              element={
                <IncidentList
                  incidents={incidents}
                  setIncidents={setIncidents}
                />
              }
            />
            <Route
              path="/incidents/:id"
              element={<IncidentDetail incidents={incidents} />}
            />
            <Route
              path="/analytics"
              element={<Analytics incidents={incidents} />}
            />
            <Route
              path="/agent"
              element={
                <AgentMonitor
                  incidents={incidents}
                  agentSteps={agentSteps}
                />
              }
            />
            <Route path="/demo" element={<DemoControl connected={connected} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
