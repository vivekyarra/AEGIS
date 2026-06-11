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
      P1: 'border-aegis-red/30 bg-aegis-red/10 text-aegis-red',
      P2: 'border-aegis-yellow/30 bg-aegis-yellow/10 text-aegis-yellow',
      P3: 'border-aegis-blue/30 bg-aegis-blue/10 text-aegis-blue',
      P4: 'border-aegis-gray/30 bg-aegis-gray/10 text-aegis-gray',
    };
    return styles[sev] || styles.P2;
  };

  const getStatusStyle = (status) => {
    const styles = {
      detected: 'bg-aegis-red/10 border-aegis-red/30 text-aegis-red',
      investigating: 'bg-aegis-blue/10 border-aegis-blue/30 text-aegis-blue animate-pulse',
      root_cause_found: 'bg-aegis-cyan/10 border-aegis-cyan/30 text-aegis-cyan',
      resolved: 'bg-aegis-green/10 border-aegis-green/30 text-aegis-green',
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aegis-border pb-4">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide">
            Incident Repository
          </h2>
          <p className="text-xs text-aegis-gray mt-1">
            Browse and query the history of detected anomalies, investigations, and fixes.
          </p>
        </div>
      </div>

      {/* ── Controls: Search & Tabs ──────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-[320px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-aegis-gray" />
          <input
            type="text"
            placeholder="Search by ID, title, service, root cause..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-aegis-darker border border-aegis-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-aegis-cyan/50 font-sans text-white placeholder-aegis-gray transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-aegis-darker border border-aegis-border p-1 rounded-lg">
          {['all', 'active', 'resolved'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilter(tab);
                setVisibleCount(10);
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                filter === tab
                  ? 'bg-aegis-cyan/15 text-aegis-cyan shadow'
                  : 'text-aegis-gray hover:text-white'
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
          <div className="p-12 text-center text-aegis-gray space-y-2">
            <Shield className="w-10 h-10 text-aegis-cyan mx-auto opacity-30" />
            <p className="font-semibold text-sm">No incidents match search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-aegis-border bg-aegis-darker/60 text-xs font-semibold text-aegis-gray uppercase tracking-wider">
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
              <tbody className="divide-y divide-aegis-border/40 text-sm">
                {filteredIncidents.slice(0, visibleCount).map((inc) => (
                  <tr
                    key={inc.incident_id}
                    onClick={() => navigate(`/incidents/${inc.incident_id}`)}
                    className="hover:bg-white/[0.01] cursor-pointer transition-colors group"
                  >
                    {/* ID */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-aegis-cyan">
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
                    <td className="px-6 py-4 font-mono text-xs text-aegis-gray">
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
                    <td className="px-6 py-4 font-mono text-xs text-aegis-gray">
                      {calculateDuration(inc)}
                    </td>

                    {/* Arrow */}
                    <td className="px-6 py-4 text-right">
                      <ArrowRight className="w-4 h-4 text-aegis-gray group-hover:text-aegis-cyan group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {filteredIncidents.length > visibleCount && (
          <div className="p-4 border-t border-aegis-border text-center">
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
