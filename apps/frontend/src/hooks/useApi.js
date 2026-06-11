import { useCallback } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const SHOPSTREAM = import.meta.env.VITE_SHOPSTREAM_URL || 'http://localhost:9090';

async function safeFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export default function useApi() {
  const fetchIncidents = useCallback(async () => {
    try {
      return await safeFetch(`${BACKEND}/incidents`);
    } catch (err) {
      console.error('fetchIncidents failed:', err);
      return [];
    }
  }, []);

  const fetchIncident = useCallback(async (id) => {
    try {
      return await safeFetch(`${BACKEND}/incidents/${id}`);
    } catch (err) {
      console.error('fetchIncident failed:', err);
      return null;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      return await safeFetch(`${BACKEND}/stats`);
    } catch (err) {
      console.error('fetchStats failed:', err);
      return null;
    }
  }, []);

  const triggerTestIncident = useCallback(async (service = 'payment-service', severity = 'P1') => {
    try {
      return await safeFetch(`${BACKEND}/webhook/test`, {
        method: 'POST',
        body: JSON.stringify({ service_name: service, severity }),
      });
    } catch (err) {
      console.error('triggerTestIncident failed:', err);
      return null;
    }
  }, []);

  const approveFix = useCallback(async (incidentId) => {
    try {
      return await safeFetch(`${BACKEND}/incidents/${incidentId}/approve-fix`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('approveFix failed:', err);
      return null;
    }
  }, []);

  const injectChaos = useCallback(async (errorRate = 50, durationSeconds = 120) => {
    try {
      return await safeFetch(`${SHOPSTREAM}/admin/inject-errors`, {
        method: 'POST',
        body: JSON.stringify({ error_rate: errorRate, duration_seconds: durationSeconds }),
      });
    } catch (err) {
      console.error('injectChaos failed:', err);
      return null;
    }
  }, []);

  const stopChaos = useCallback(async () => {
    try {
      return await safeFetch(`${SHOPSTREAM}/admin/stop-injection`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('stopChaos failed:', err);
      return null;
    }
  }, []);

  const fetchShopStatus = useCallback(async () => {
    try {
      return await safeFetch(`${SHOPSTREAM}/admin/status`);
    } catch (err) {
      console.error('fetchShopStatus failed:', err);
      return null;
    }
  }, []);

  const resetIncidents = useCallback(async () => {
    try {
      return await safeFetch(`${BACKEND}/admin/reset`, { method: 'POST' });
    } catch (err) {
      console.error('resetIncidents failed:', err);
      return null;
    }
  }, []);

  const seedDemoData = useCallback(async () => {
    try {
      return await safeFetch(`${BACKEND}/admin/seed`, { method: 'POST' });
    } catch (err) {
      console.error('seedDemoData failed:', err);
      return null;
    }
  }, []);

  return {
    fetchIncidents,
    fetchIncident,
    fetchStats,
    triggerTestIncident,
    approveFix,
    injectChaos,
    stopChaos,
    fetchShopStatus,
    resetIncidents,
    seedDemoData,
  };
}
