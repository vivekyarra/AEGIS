import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowRight,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import useApi from '../hooks/useApi';

export default function IncidentList({ incidents, setIncidents }) {
  const navigate = useNavigate();
  const { fetchIncidents } = useApi();
  const [filter, setFilter] = useState('all'); // all, active, resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  // Sync with API on mount to pull latest list
  useEffect(() => {
    async function loadData() {
      const list = await fetchIncidents();
      if (list) {
        setIncidents(list);
      }
    }
    loadData();
  }, [fetchIncidents, setIncidents]);

  // Filter and search incidents
  const filteredIncidents = incidents.filter((inc) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'active'
        ? inc.status !== 'resolved'
        : inc.status === 'resolved';

    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.affected_services.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inc.root_cause && inc.root_cause.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const loadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const getSeverityStyle = (sev) => {
    const styles = {
      P1: 'border-sentinel-red/30 bg-sentinel-red/10 text-sentinel-red',
      P2: 'border-sentinel-yellow/30 bg-sentinel-yellow/10 text-sentinel-yellow',
      P3: 'border-sentinel-blue/30 bg-sentinel-blue/10 text-sentinel-blue',
      P4: 'border-sentinel-gray/30 bg-sentinel-gray/10 text-sentinel-gray',
    };
    return styles[sev] || styles.P2;
  };

  const getStatusStyle = (status) => {
    const styles = {
      detected: 'bg-sentinel-red/10 border-sentinel-red/30 text-sentinel-red',
      investigating: 'bg-sentinel-blue/10 border-sentinel-blue/30 text-sentinel-blue animate-pulse',
      root_cause_found: 'bg-sentinel-cyan/10 border-sentinel-cyan/30 text-sentinel-cyan',
      resolved: 'bg-sentinel-green/10 border-sentinel-green/30 text-sentinel-green',
    };
    return styles[status] || styles.detected;
  };

  const calculateDuration = (inc) => {
    if (!inc.started_at) return '-';
    const start = new Date(inc.started_at);
    const end = inc.resolved_at ? new Date(inc.resolved_at) : new Date();
    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    return `${diffMins} min`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sentinel-border pb-4">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide">
            Incident Repository
          </h2>
          <p className="text-xs text-sentinel-gray mt-1">
            Browse and query the history of detected anomalies, investigations, and fixes.
          </p>
        </div>
      </div>

      {/* ── Controls: Search & Tabs ──────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-[320px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-sentinel-gray" />
          <input
            type="text"
            placeholder="Search by ID, title, service, root cause..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sentinel-darker border border-sentinel-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-sentinel-cyan/50 font-sans text-white placeholder-sentinel-gray transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-sentinel-darker border border-sentinel-border p-1 rounded-lg">
          {['all', 'active', 'resolved'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilter(tab);
                setVisibleCount(10);
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                filter === tab
                  ? 'bg-sentinel-cyan/15 text-sentinel-cyan shadow'
                  : 'text-sentinel-gray hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── List / Table Layout ──────────────────────── */}
      <div className="glass-card overflow-hidden">
        {filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-sentinel-gray space-y-2">
            <Shield className="w-10 h-10 text-sentinel-cyan mx-auto opacity-30" />
            <p className="font-semibold text-sm">No incidents match search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sentinel-border bg-sentinel-darker/60 text-xs font-semibold text-sentinel-gray uppercase tracking-wider">
                  <th className="px-6 py-3.5">Incident ID</th>
                  <th className="px-6 py-3.5">Severity</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5">Impacted Services</th>
                  <th className="px-6 py-3.5">State</th>
                  <th className="px-6 py-3.5">Detection Time</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-border/40 text-sm">
                {filteredIncidents.slice(0, visibleCount).map((inc) => (
                  <tr
                    key={inc.incident_id}
                    onClick={() => navigate(`/incidents/${inc.incident_id}`)}
                    className="hover:bg-white/[0.01] cursor-pointer transition-colors group"
                  >
                    {/* ID */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-sentinel-cyan">
                      {inc.incident_id}
                    </td>

                    {/* Severity */}
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityStyle(
                          inc.severity
                        )}`}
                      >
                        {inc.severity}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="px-6 py-4 font-medium max-w-[280px] truncate">
                      {inc.title}
                    </td>

                    {/* Services */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {inc.affected_services?.map((svc) => (
                          <span
                            key={svc}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusStyle(
                          inc.status
                        )}`}
                      >
                        {inc.status?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Detection Time */}
                    <td className="px-6 py-4 font-mono text-xs text-sentinel-gray">
                      {new Date(inc.started_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      <span className="text-[10px] opacity-60">
                        {new Date(inc.started_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4 font-mono text-xs text-sentinel-gray">
                      {calculateDuration(inc)}
                    </td>

                    {/* Arrow */}
                    <td className="px-6 py-4 text-right">
                      <ArrowRight className="w-4 h-4 text-sentinel-gray group-hover:text-sentinel-cyan group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {filteredIncidents.length > visibleCount && (
          <div className="p-4 border-t border-sentinel-border text-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
