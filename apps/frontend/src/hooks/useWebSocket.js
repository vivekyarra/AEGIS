import { useState, useEffect, useRef, useCallback } from 'react';

// Tiny base64-encoded beep sound (100ms 440Hz sine wave)
const BEEP_DATA =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZicoaCbkIB0aGJkaHKAj5yosbi+wL25saaakIWAdXRxcHN4gIiQl52ho6OhnpiSi4R+eXZ1dXd6f4SJjpKWmJmZmJaUkY6LiIaDgYB/f4CAgoOFh4mLjI2Ojo6OjY2MjIuLioqKiomJiYmJiYmJiYqKioqKi4uLi4yMjI2NjY2Ojo6Ojo+Pj4+QkA==';

function getStepId(step) {
  return [
    step.incident_id || 'unknown',
    step.step_number || 'step',
    step.tool_name || 'tool',
    step.timestamp || '',
  ].join(':');
}

export default function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [agentSteps, setAgentSteps] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const playBeep = useCallback(() => {
    try {
      const audio = new Audio(BEEP_DATA);
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
      // Audio not supported
    }
  }, []);

  const connect = useCallback(() => {
    const wsUrl =
      import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected to', wsUrl);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);

          switch (data.type) {
            case 'incident_detected': {
              playBeep();
              setIncidents((prev) => {
                const exists = prev.find(
                  (i) => i.incident_id === data.data?.incident_id
                );
                if (exists) return prev;
                return [
                  {
                    incident_id: data.data?.incident_id || crypto.randomUUID(),
                    title: data.data?.title || 'New Incident',
                    severity: data.data?.severity || 'P2',
                    status: 'detected',
                    services: data.data?.services || [],
                    detected_at: data.data?.detected_at || new Date().toISOString(),
                    ...data.data,
                  },
                  ...prev,
                ];
              });
              break;
            }

            case 'status_update': {
              setIncidents((prev) =>
                prev.map((inc) =>
                  inc.incident_id === data.data?.incident_id
                    ? { ...inc, status: data.data?.status, ...data.data }
                    : inc
                )
              );
              break;
            }

            case 'agent_step': {
              const step = {
                timestamp: new Date().toISOString(),
                ...data.data,
              };
              step.id = getStepId(step);

              setAgentSteps((prev) => {
                if (prev.some((existing) => existing.id === step.id)) return prev;
                return [...prev.slice(-99), step];
              });
              break;
            }

            case 'investigation_complete': {
              setIncidents((prev) =>
                prev.map((inc) =>
                  inc.incident_id === data.data?.incident_id
                    ? {
                        ...inc,
                        status: 'root_cause_found',
                        root_cause: data.data?.root_cause,
                        confidence: data.data?.confidence,
                        culprit_commit: data.data?.culprit_commit,
                        recommended_fix: data.data?.recommended_fix,
                        similar_incidents: data.data?.similar_incidents,
                        agent_trace: data.data?.agent_trace,
                        ...data.data,
                      }
                    : inc
                )
              );
              break;
            }

            case 'incident_resolved': {
              setIncidents((prev) =>
                prev.map((inc) =>
                  inc.incident_id === data.data?.incident_id
                    ? {
                        ...inc,
                        status: 'resolved',
                        resolved_at: data.data?.resolved_at || new Date().toISOString(),
                        ...data.data,
                      }
                    : inc
                )
              );
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.warn('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected. Reconnecting in 3s...');
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      reconnectRef.current = setTimeout(connect, 3000);
    }
  }, [playBeep]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { connected, incidents, setIncidents, lastEvent, agentSteps, setAgentSteps };
}
