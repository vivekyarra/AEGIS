import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  GitCommit,
  CheckCircle,
  AlertTriangle,
  History,
  Terminal,
  Clock,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';
import useApi from '../hooks/useApi';

export default function IncidentDetail({ incidents }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchIncident, approveFix } = useApi();
  
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load incident details
  useEffect(() => {
    async function loadIncident() {
      setLoading(true);
      // Try local list first, then fetch from API for details
      const localInc = incidents.find((i) => i.incident_id === id);
      if (localInc) {
        setIncident(localInc);
      }
      
      const apiInc = await fetchIncident(id);
      if (apiInc) {
        setIncident(apiInc);
      }
      setLoading(false);
    }
    loadIncident();
  }, [id, fetchIncident, incidents]);

  // Listen to WebSocket updates matching this incident
  useEffect(() => {
    const matchingInc = incidents.find((i) => i.incident_id === id);
    if (matchingInc) {
      setIncident(matchingInc);
    }
  }, [incidents, id]);

  const handleApproveFix = async () => {
    if (!incident) return;
    setActionLoading(true);
    const result = await approveFix(incident.incident_id);
    if (result && result.status === 'success') {
      setIncident(result.incident);
    }
    setActionLoading(false);
  };

  if (loading && !incident) {
    return (
      <div className="h-64 flex items-center justify-center text-sentinel-cyan">
        <div className="relative">
          <Shield className="w-10 h-10 animate-pulse" />
          <div className="absolute inset-0 animate-glow rounded-full" />
        </div>
        <span className="ml-3 font-mono text-sm">Retrieving incident analysis...</span>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center p-12 glass-card">
        <AlertTriangle className="w-12 h-12 text-sentinel-red mx-auto mb-4" />
        <h3 className="text-lg font-bold">Incident Not Found</h3>
        <p className="text-sm text-sentinel-gray mt-1">
          The requested incident ID '{id}' could not be located.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isResolved = incident.status === 'resolved';
  const isPendingFix = incident.status === 'root_cause_found';
  const isInvestigating = incident.status === 'investigating';

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
    <div className="space-y-6">
      {/* ── Header Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sentinel-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold font-mono tracking-tight">
                {incident.incident_id}
              </h2>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  severityColors[incident.severity] || severityColors.P2
                }`}
              >
                {incident.severity}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${
                  statusColors[incident.status] || statusColors.detected
                }`}
              >
                {incident.status?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-sentinel-gray mt-1">
              Started: {new Date(incident.started_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Resolved Timestamp */}
        {isResolved && (
          <div className="flex items-center gap-2 bg-sentinel-green/10 border border-sentinel-green/20 px-3 py-1.5 rounded-lg text-xs text-sentinel-green font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>Resolved at {new Date(incident.resolved_at).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* ── Banner: AI completed analysis ────────────── */}
      {(incident.root_cause || isResolved) && (
        <div className="bg-sentinel-green/5 border border-sentinel-green/20 p-4 rounded-lg flex items-center justify-between gap-4 slide-in">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-sentinel-green animate-pulse" />
            <div>
              <h4 className="font-bold text-sm text-white">
                AEGIS INVESTIGATION COMPLETE
              </h4>
              <p className="text-xs text-sentinel-gray">
                Root cause identified and remediation strategy generated in{' '}
                {incident.total_investigation_ms
                  ? `${(incident.total_investigation_ms / 1000).toFixed(1)}s`
                  : '9.4s'}
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content (Two columns) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Diagnostics, Fix, Commit (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Root Cause */}
          {incident.root_cause && (
            <div className="glass-card p-6 border-l-4 border-l-sentinel-blue relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-sentinel-cyan" />
                  <h4 className="font-bold text-sm uppercase tracking-wide">
                    Root Cause Analysis
                  </h4>
                </div>
                {incident.root_cause_confidence && (
                  <div className="flex items-center gap-2 bg-sentinel-cyan/10 border border-sentinel-cyan/20 px-2.5 py-1 rounded text-xs text-sentinel-cyan font-mono">
                    <span>Confidence:</span>
                    <span className="font-bold">
                      {Math.round(incident.root_cause_confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm leading-relaxed text-gray-200">
                {incident.root_cause}
              </p>
              {incident.impact_summary && (
                <div className="mt-4 pt-3 border-t border-sentinel-border text-xs text-sentinel-gray bg-black/20 p-2.5 rounded">
                  <span className="font-semibold text-gray-300">Impact:</span>{' '}
                  {incident.impact_summary}
                </div>
              )}
            </div>
          )}

          {/* 2. recommended fix & action button */}
          {incident.recommended_fix && (
            <div className="glass-card p-6 border-l-4 border-l-sentinel-green">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-sentinel-green" />
                  <h4 className="font-bold text-sm uppercase tracking-wide">
                    Recommended Remediation
                  </h4>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-200 bg-sentinel-darker/60 p-4 rounded-lg font-mono border border-sentinel-border mb-5">
                {incident.recommended_fix}
              </p>

              {/* Action buttons */}
              {!isResolved ? (
                <button
                  onClick={handleApproveFix}
                  disabled={actionLoading || isInvestigating}
                  className="w-full py-3 bg-sentinel-green hover:bg-sentinel-green/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none rounded-lg text-sentinel-darker font-bold text-sm transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)] flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  {actionLoading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Applying remediation...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve & Execute Fix
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center p-3.5 bg-sentinel-green/10 border border-sentinel-green/20 rounded-lg text-sm text-sentinel-green font-bold uppercase tracking-wider gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Remediation successfully applied
                </div>
              )}
            </div>
          )}

          {/* 3. Culprit Commit */}
          {incident.culprit_commit && (
            <div className="glass-card p-6 border-l-4 border-l-sentinel-yellow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <GitCommit className="w-5 h-5 text-sentinel-yellow" />
                  <h4 className="font-bold text-sm uppercase tracking-wide">
                    Culprit Code Deployment
                  </h4>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sentinel-yellow/10 border border-sentinel-yellow/20 text-sentinel-yellow">
                  Deployment Match
                </span>
              </div>

              <div className="bg-sentinel-darker/50 p-4 rounded-lg border border-sentinel-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sentinel-gray font-mono">
                    SHA: {incident.culprit_commit.sha}
                  </span>
                  {incident.culprit_commit.url && (
                    <a
                      href={incident.culprit_commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sentinel-cyan hover:underline flex items-center gap-1 font-mono"
                    >
                      GitLab <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <h5 className="font-semibold text-sm text-white">
                  "{incident.culprit_commit.message?.split('\n')[0]}"
                </h5>
                <div className="flex items-center gap-4 text-xs text-sentinel-gray font-mono">
                  <span>Author: {incident.culprit_commit.author}</span>
                  <span>
                    Deployed:{' '}
                    {new Date(incident.culprit_commit.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Similar past incidents */}
          {incident.similar_past_incidents && incident.similar_past_incidents.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-sentinel-border pb-3 mb-1">
                <History className="w-5 h-5 text-sentinel-purple" />
                <h4 className="font-bold text-sm uppercase tracking-wide">
                  Historical Incident Correlation
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incident.similar_past_incidents.map((past, idx) => (
                  <div
                    key={past.id || idx}
                    className="p-4 rounded-lg bg-sentinel-darker/40 border border-sentinel-border space-y-2.5 text-xs"
                  >
                    <div className="flex justify-between items-center border-b border-sentinel-border/30 pb-1.5">
                      <span className="font-mono text-sentinel-purple font-bold">
                        {past.id}
                      </span>
                      {past.resolution_time_minutes && (
                        <span className="text-sentinel-gray font-mono">
                          Resolved in {past.resolution_time_minutes}m
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-300">Root Cause:</span>
                      <p className="text-gray-400 mt-0.5 line-clamp-3 leading-relaxed">
                        {past.root_cause}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-300">Fix Action:</span>
                      <p className="text-gray-400 mt-0.5 line-clamp-3 leading-relaxed">
                        {past.recommended_fix}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Agent Investigation Trace Timeline (1/3 width) */}
        <div className="glass-card p-6 flex flex-col h-fit">
          <div className="flex items-center gap-3 border-b border-sentinel-border pb-3 mb-5">
            <Terminal className="w-5 h-5 text-sentinel-cyan" />
            <h4 className="font-bold text-sm uppercase tracking-wide">
              Agent Investigation Trace
            </h4>
          </div>

          <div className="relative border-l border-sentinel-border/60 ml-3.5 pl-6 space-y-6">
            {isInvestigating && incident.agent_steps?.length === 0 && (
              <div className="text-xs text-sentinel-cyan animate-pulse py-2">
                Agent booting up toolset models...
              </div>
            )}
            
            {incident.agent_steps?.length === 0 && !isInvestigating && (
              <div className="text-xs text-sentinel-gray py-2">
                No telemetry traces recorded.
              </div>
            )}

            {incident.agent_steps?.map((step) => {
              const isSuccess = step.success;
              return (
                <div key={step.step_number} className="relative slide-in">
                  {/* Circle Step indicator */}
                  <span className="absolute -left-[35px] top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-sentinel-dark border border-sentinel-border text-[10px] font-bold text-sentinel-cyan">
                    {step.step_number}
                  </span>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">
                        {step.tool_name}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-sentinel-gray border border-white/5">
                        {step.latency_ms}ms
                      </span>
                    </div>

                    <div className="bg-black/20 p-2 rounded border border-sentinel-border/30 text-[11px] leading-relaxed">
                      <div className="text-[10px]">
                        <span className="text-sentinel-yellow font-semibold">Args:</span>{' '}
                        <code className="text-gray-300 font-mono">
                          {JSON.stringify(step.tool_input)}
                        </code>
                      </div>
                      <div className="mt-1 border-t border-sentinel-border/20 pt-1">
                        <span className="text-sentinel-gray font-semibold">Result:</span>
                        <p className="text-gray-400 font-mono max-h-24 overflow-y-auto mt-0.5 text-[10px]">
                          {step.tool_output}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
