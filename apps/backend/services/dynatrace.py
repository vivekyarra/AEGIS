import httpx
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("dynatrace-service")

class DynatraceService:
    def __init__(self):
        self.base_url = os.getenv("DYNATRACE_URL", "").rstrip("/")
        self.token = os.getenv("DYNATRACE_TOKEN", "")
        self.headers = {
            "Authorization": f"Api-Token {self.token}",
            "Content-Type": "application/json"
        }
        # Check if real service is configured
        self.is_configured = bool(self.base_url and "REPLACE_ME" not in self.base_url and self.token and "REPLACE_ME" not in self.token)
        if not self.is_configured:
            logger.warning("Dynatrace credentials not fully set. Running in demo fallback mode.")

    async def get_problem_details(self, problem_id: str) -> dict:
        if not self.is_configured:
            return {
                "problemId": problem_id,
                "title": "Database connection pool exhausted",
                "severityLevel": "AVAILABILITY",
                "status": "OPEN",
                "startTime": int((datetime.utcnow() - timedelta(minutes=10)).timestamp() * 1000),
                "endTime": -1,
                "affectedEntities": [{"entityId": "SERVICE-A12B34C", "name": "checkout-service"}],
                "impactLevel": "SERVICE",
                "rootCauseEntity": {"entityId": "SERVICE-A12B34C", "name": "checkout-service"}
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/problems/{problem_id}"
                response = await client.get(url, headers=self.headers)
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Dynatrace API returned status {response.status_code}: {response.text}")
                    return {"error": f"Dynatrace status {response.status_code}", "problem_id": problem_id}
        except Exception as e:
            logger.error(f"Failed to fetch Dynatrace problem details: {e}")
            return {"error": str(e), "problem_id": problem_id}

    async def get_affected_entities(self, problem_id: str) -> list:
        if not self.is_configured:
            return ["checkout-service", "shopstream"]

        try:
            problem = await self.get_problem_details(problem_id)
            if "error" in problem:
                return ["checkout-service"]
            
            entities = []
            for entity in problem.get("affectedEntities", []):
                entities.append(entity.get("name", "unknown"))
            
            return entities if entities else ["checkout-service"]
        except Exception as e:
            logger.error(f"Failed to extract affected entities: {e}")
            return ["checkout-service"]

    async def get_events(self, entity_id: str, hours_back: int = 2) -> list:
        if not self.is_configured:
            return [
                {
                    "eventId": "EV-10293",
                    "eventType": "ERROR_EVENT",
                    "title": "High Error Rate",
                    "entityId": entity_id,
                    "startTime": int((datetime.utcnow() - timedelta(minutes=12)).timestamp() * 1000)
                }
            ]

        try:
            from_time = f"now()-{hours_back}h"
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/events"
                params = {"from": from_time, "entityId": entity_id}
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    return response.json().get("events", [])
                return []
        except Exception as e:
            logger.error(f"Failed to fetch Dynatrace events: {e}")
            return []

    async def get_metrics(self, metric_selector: str, hours_back: int = 1) -> dict:
        if not self.is_configured:
            # Return realistic mock response
            now = datetime.utcnow()
            timestamps = [int((now - timedelta(minutes=m)).timestamp() * 1000) for m in range(0, 30, 2)]
            values = [0.05, 0.04, 0.06, 0.88, 0.92, 0.94, 0.95, 0.05, 0.04, 0.03, 0.05, 0.04, 0.03, 0.02, 0.02]
            return {
                "totalCount": 1,
                "result": [
                    {
                        "metricId": metric_selector,
                        "data": [
                            {
                                "dimensions": [],
                                "dimensionMap": {},
                                "timestamps": timestamps[:len(values)],
                                "values": values
                            }
                        ]
                    }
                ]
            }

        try:
            from_time = f"now()-{hours_back}h"
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/metrics/query"
                params = {"metricSelector": metric_selector, "from": from_time}
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    return response.json()
                return {}
        except Exception as e:
            logger.error(f"Failed to fetch Dynatrace metrics: {e}")
            return {}

    async def get_logs(self, service_name: str, hours_back: int = 1) -> list:
        if not self.is_configured:
            # Return realistic error logs for checkout-service
            now = datetime.utcnow()
            return [
                {
                    "timestamp": (now - timedelta(minutes=5)).isoformat(),
                    "content": "Error: ECONNREFUSED - Connection refused to billing-db-primary:27017",
                    "severity": "ERROR"
                },
                {
                    "timestamp": (now - timedelta(minutes=6)).isoformat(),
                    "content": "Database connection pool exhausted - checkout-service failed to allocate connection in 5000ms",
                    "severity": "CRITICAL"
                },
                {
                    "timestamp": (now - timedelta(minutes=7)).isoformat(),
                    "content": "POST /checkout failed - 500 Internal Server Error - Trace: ConnectionTimeoutException",
                    "severity": "ERROR"
                }
            ]

        try:
            from_time = f"now()-{hours_back}h"
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/logs/search"
                params = {
                    "from": from_time,
                    "query": f'log.source:"{service_name}" AND (error OR exception OR 500)'
                }
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    logs = response.json().get("results", [])
                    formatted_logs = []
                    for log in logs[:20]:
                        formatted_logs.append({
                            "timestamp": log.get("timestamp"),
                            "content": log.get("content"),
                            "severity": log.get("severity", "ERROR")
                        })
                    return formatted_logs
                return []
        except Exception as e:
            logger.error(f"Failed to search Dynatrace logs: {e}")
            # Fallback mock
            now = datetime.utcnow()
            return [
                {
                    "timestamp": (now - timedelta(minutes=2)).isoformat(),
                    "content": f"Mock Log: Connection timeout occurred on service {service_name} due to socket pool limits.",
                    "severity": "ERROR"
                }
            ]

    async def get_service_topology(self, service_name: str) -> dict:
        if not self.is_configured:
            return {
                "entities": [
                    {
                        "entityId": "SERVICE-A12B34C",
                        "displayName": service_name,
                        "type": "SERVICE",
                        "properties": {"serviceType": "Node.js Express", "port": 8080}
                    }
                ]
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/entities"
                params = {
                    "entitySelector": f'type(SERVICE),entityName("{service_name}")'
                }
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    return response.json()
                return {}
        except Exception as e:
            logger.error(f"Failed to fetch topology: {e}")
            return {}

    async def push_resolution_event(self, entity_name: str, incident_id: str, resolution: str):
        if not self.is_configured:
            logger.info(f"Mock Dynatrace Annotation: Resolution event pushed for {incident_id} on {entity_name}")
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v2/events/ingest"
                body = {
                    "eventType": "CUSTOM_ANNOTATION",
                    "title": f"AEGIS Resolved: {incident_id}",
                    "entitySelector": f'entityName("{entity_name}")',
                    "properties": {"resolution": resolution, "agent": "AEGIS"}
                }
                response = await client.post(url, headers=self.headers, json=body)
                if response.status_code != 201:
                    logger.error(f"Failed to post resolution annotation: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Failed to push resolution event to Dynatrace: {e}")
