import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Brain as BrainIcon,
  Activity as ActivityIcon,
  Terminal as TerminalIcon,
  Zap as ZapIcon,
  Cpu,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  AlertTriangle,
  Clock,
  Compass,
} from 'lucide-react';

export default function AgentMonitor({ incidents, agentSteps }) {
  const [expandedIncident, setExpandedIncident] = useState(null);

  // Filter incidents that have agent steps/trace records
  const investigatedIncidents = incidents.filter(
    (inc) => inc.agent_steps && inc.agent_steps.length > 0
  );

  // Calculate tool usage counts across all investigations
  const toolCounts = {
    get_problem_details: 0,
    get_affected_services: 0,
    get_service_logs: 0,
    get_recent_commits: 0,
    correlate_commits_to_incident: 0,
    find_similar_incidents: 0,
    get_service_metrics: 0,
  };

  let totalLatency = 0;
  let stepCount = 0;

  incidents.forEach((inc) => {
    inc.agent_steps?.forEach((step) => {
      if (toolCounts[step.tool_name] !== undefined) {
        toolCounts[step.tool_name]++;
      }
      totalLatency += step.latency_ms || 0;
      stepCount++;
    });
  });

  const chartData = Object.keys(toolCounts).map((name) => ({
    tool: name.replace(/_/g, ' '),
    invocations: toolCounts[name],
  }));

  const avgLatencyPerStep = stepCount > 0 ? Math.round(totalLatency / stepCount) : 180;

  const toggleExpand = (id) => {
    if (expandedIncident === id) {
      setExpandedIncident(null);
    } else {
      setExpandedIncident(id);
    }
  };

  // Default mock trace if no live investigations have occurred yet
  const displayIncidents = investigatedIncidents.length > 0 ? investigatedIncidents : [
    {
      incident_id: 'INC-DEMO998',
      title: 'High latency on product-service checkout flow',
      status: 'resolved',
      severity: 'P1',
      total_investigation_ms: 8400,
      root_cause_confidence: 0.94,
      agent_steps: [
        {
          step_number: 1,
          tool_name: 'get_problem_details',
          tool_input: { problem_id: 'P-910283' },
          tool_output: '{"problemId": "P-910283", "title": "Latency spike on checkout-service", "severityLevel": "AVAILABILITY", "status": "OPEN"}',
          latency_ms: 180,
          success: true,
        },
        {
          step_number: 2,
          tool_name: 'get_affected_services',
          tool_input: { problem_id: 'P-910283' },
          tool_output: '{"affected_services": ["checkout-service", "payment-service"]}',
          latency_ms: 140,
          success: true,
        },
        {
          step_number: 3,
          tool_name: 'get_service_logs',
          tool_input: { service_name: 'checkout-service' },
          tool_output: '[{"timestamp": "09:02:11", "content": "Database connection pool exhausted - wait timeout", "severity": "CRITICAL"}]',
          latency_ms: 310,
          success: true,
        },
        {
          step_number: 4,
          tool_name: 'get_recent_commits',
          tool_input: { hours_back: 3 },
          tool_output: '[{"id": "e4d3c2b1", "title": "Refactor database connection pooling in checkout-service", "author_name": "Devin Adams"}]',
          latency_ms: 450,
          success: true,
        },
        {
          step_number: 5,
          tool_name: 'correlate_commits_to_incident',
          tool_input: { incident_timestamp: '09:02:00', service_name: 'checkout-service' },
          tool_output: '{"commits_near_incident": [{"id": "e4d3c2b1", "title": "Refactor database connection pooling"}]}',
          latency_ms: 220,
          success: true,
        },
        {
          step_number: 6,
          tool_name: 'find_similar_incidents',
          tool_input: { service_name: 'checkout-service', error_keywords: 'connection,pool' },
          tool_output: '{"similar_incidents": [{"id": "INC-A92F1C8B", "root_cause": "Memory leak in payment processor connection pool"}]}',
          latency_ms: 190,
          success: true,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sentinel-border pb-4">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide">
            Agent Diagnostics Monitor
          </h2>
          <p className="text-xs text-sentinel-gray mt-1">
            Analyze the internal execution efficiency, tool invocations, and thinking pipeline of AEGIS.
          </p>
        </div>
      </div>

      {/* ── Diagnostics Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tool Call Frequency Bar Chart */}
        <div className="glass-card p-6 flex flex-col h-[360px] lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-sentinel-border pb-3 mb-5">
            <Cpu className="w-5 h-5 text-sentinel-cyan" />
            <h4 className="font-bold text-sm uppercase tracking-wide">
              Agent Tool Call Frequency
            </h4>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="tool"
                  type="category"
                  stroke="#64748b"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1629',
                    borderColor: '#1e2d4a',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="invocations" fill="#00d4ff" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#00d4ff" fillOpacity={0.8 - (index % 4) * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Metrics Card */}
        <div className="glass-card p-6 flex flex-col justify-between h-[360px]">
          <div className="flex items-center gap-3 border-b border-sentinel-border pb-3 mb-5">
            <ActivityIcon className="w-5 h-5 text-sentinel-cyan" />
            <h4 className="font-bold text-sm uppercase tracking-wide">
              Agent Performance Stats
            </h4>
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sentinel-gray">
                <Clock className="w-4 h-4" />
                <span>Avg Latency per Tool Call</span>
              </div>
              <span className="font-mono text-lg font-bold text-sentinel-cyan">
                {avgLatencyPerStep}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sentinel-gray">
                <Compass className="w-4 h-4" />
                <span>Autonomy Level</span>
              </div>
              <span className="font-mono text-xs font-bold text-sentinel-green bg-sentinel-green/10 border border-sentinel-green/20 px-2 py-0.5 rounded uppercase">
                100% Autonomous
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sentinel-gray">
                <TerminalIcon className="w-4 h-4" />
                <span>Toolsets Registered</span>
              </div>
              <span className="font-mono text-lg font-bold text-white">7 Tools</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-sentinel-gray">
                <BrainIcon className="w-4 h-4" />
                <span>Reasoning Model</span>
              </div>
              <span className="font-mono text-xs font-bold text-sentinel-purple bg-sentinel-purple/10 border border-sentinel-purple/20 px-2 py-0.5 rounded">
                Gemini 2.0 Flash
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expandable Investigation Trace History ─── */}
      <div className="space-y-4">
        <h4 className="font-bold text-sm uppercase tracking-wide border-b border-sentinel-border pb-2">
          Agent Investigation Trace History
        </h4>

        <div className="space-y-4">
          {displayIncidents.map((inc) => {
            const isExpanded = expandedIncident === inc.incident_id;
            return (
              <div key={inc.incident_id} className="glass-card overflow-hidden transition-all duration-200">
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(inc.incident_id)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-sentinel-darker/35 border-b border-sentinel-border/40 cursor-pointer hover:bg-sentinel-cyan/[0.01]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-sentinel-cyan">
                        {inc.incident_id}
                      </span>
                      <span className="text-sentinel-gray font-mono">
                        {(inc.total_investigation_ms / 1000).toFixed(2)}s Latency
                      </span>
                      <span className="text-sentinel-gray font-mono">
                        {inc.agent_steps?.length || 0} Steps
                      </span>
                    </div>
                    <h5 className="font-semibold text-sm text-gray-200">{inc.title}</h5>
                  </div>

                  <div className="flex items-center gap-4 mt-2 md:mt-0">
                    <div className="flex items-center gap-2 bg-sentinel-cyan/10 border border-sentinel-cyan/20 px-2 py-0.5 rounded text-xs text-sentinel-cyan font-mono">
                      <span>Confidence:</span>
                      <span className="font-bold">
                        {Math.round((inc.root_cause_confidence || 0.9) * 100)}%
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-sentinel-gray" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-sentinel-gray" />
                    )}
                  </div>
                </div>

                {/* Expanded Trace Details */}
                {isExpanded && (
                  <div className="p-6 bg-sentinel-darker/60 border-t border-sentinel-border/40 space-y-5">
                    <div className="relative border-l border-sentinel-border/50 ml-3.5 pl-6 space-y-6">
                      {inc.agent_steps.map((step) => (
                        <div key={step.step_number} className="relative slide-in">
                          <span className="absolute -left-[35px] top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-sentinel-dark border border-sentinel-border text-[10px] font-bold text-sentinel-cyan">
                            {step.step_number}
                          </span>

                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white font-mono">
                                {step.tool_name}
                              </span>
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-sentinel-gray border border-white/5">
                                {step.latency_ms}ms
                              </span>
                            </div>

                            <div className="bg-black/25 p-2 rounded border border-sentinel-border/30 text-[10px]">
                              <div>
                                <span className="text-sentinel-yellow font-semibold">Args:</span>{' '}
                                <code className="text-gray-300 font-mono">
                                  {JSON.stringify(step.tool_input)}
                                </code>
                              </div>
                              <div className="mt-1 border-t border-sentinel-border/20 pt-1">
                                <span className="text-sentinel-gray font-semibold">Result:</span>
                                <p className="text-gray-400 font-mono mt-0.5 max-h-24 overflow-y-auto">
                                  {step.tool_output}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
