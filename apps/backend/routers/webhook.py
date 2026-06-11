import logging
import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.incident import DynatraceWebhook, TestWebhook, IncidentStatus, IncidentSeverity
from services import mongodb_service, agent_service
from routers.websocket import manager
from routers.incidents import format_incident_for_frontend

logger = logging.getLogger("webhook-router")
router = APIRouter()

def parse_affected_services(entities_str: str) -> list:
    if not entities_str:
        return ["checkout-service"]
    
    # Extract service names from brackets or comma separated strings
    clean_str = entities_str.replace("[", "").replace("]", "").replace('"', '').replace("'", "")
    services = []
    for part in clean_str.split(","):
        svc = part.strip()
        if svc:
            # Check for standard services or common substrings
            services.append(svc)
            
    return services if services else ["checkout-service"]

def map_severity(severity_str: str) -> str:
    if not severity_str:
        return "P2"
    sev = severity_str.upper()
    if "AVAILABILITY" in sev or "CRITICAL" in sev or "P1" in sev:
        return "P1"
    if "ERROR" in sev or "PERFORMANCE" in sev or "P2" in sev:
        return "P2"
    if "P3" in sev or "WARN" in sev:
        return "P3"
    return "P4"

async def run_agent_investigation_task(incident_id: str):
    # Wait a moment to allow initial alerts to settle/broadcast
    await asyncio.sleep(1)
    
    # 1. Fetch current incident
    incident = await mongodb_service.get_incident(incident_id)
    if not incident:
        logger.error(f"Background Task: Incident {incident_id} not found in database.")
        return
        
    # 2. Update status to 'investigating'
    await mongodb_service.update_incident(incident_id, {
        "status": "investigating",
        "investigation_started_at": datetime.utcnow()
    })
    
    # 3. Broadcast status update to frontend
    await manager.broadcast({
        "type": "status_update",
        "data": {
            "incident_id": incident_id,
            "status": "investigating"
        }
    })
    
    # 4. Define callback to broadcast agent steps in real-time
    async def ws_step_callback(step_payload):
        if step_payload.get("type") == "agent_step":
            await manager.broadcast({
                "type": "agent_step",
                "data": {
                    "incident_id": step_payload["incident_id"],
                    **step_payload["step"]
                }
            })
            
    # 5. Run the actual agent loop (Gemini or Fallback)
    logger.info(f"Background Task: Launching Gemini agent for incident {incident_id}...")
    try:
        updated_incident = await mongodb_service.get_incident(incident_id)
        results = await agent_service.investigate_incident(updated_incident, ws_step_callback)
        
        # Save complete investigation details back to database
        results["investigation_completed_at"] = datetime.utcnow()
        await mongodb_service.update_incident(incident_id, results)
        
        # 6. Fetch final state and broadcast completion
        final_incident = await mongodb_service.get_incident(incident_id)
        formatted = format_incident_for_frontend(final_incident)
        
        await manager.broadcast({
            "type": "investigation_complete",
            "data": formatted
        })
        logger.info(f"Background Task: Agent investigation completed for incident {incident_id}.")
        
    except Exception as e:
        logger.error(f"Background Task: Agent investigation failed for {incident_id}: {e}")
        # Revert to resolved or keep in error state
        await mongodb_service.update_incident(incident_id, {
            "status": "detected",
            "root_cause": f"Agent investigation error: {str(e)}"
        })

@router.post("/webhook/dynatrace")
async def dynatrace_webhook(payload: DynatraceWebhook, background_tasks: BackgroundTasks):
    logger.info(f"Received Dynatrace Webhook: {payload.ProblemID} ({payload.State})")
    
    # Handle problem resolution webhook
    if payload.State.upper() == "RESOLVED":
        # Find matching active incident in DB
        incidents = await mongodb_service.get_all_incidents(limit=10)
        matching_incident = None
        for inc in incidents:
            if inc.get("dynatrace_problem_id") == payload.ProblemID:
                matching_incident = inc
                break
                
        if matching_incident and matching_incident.get("status") != "resolved":
            incident_id = matching_incident["id"]
            now_str = datetime.utcnow().isoformat()
            await mongodb_service.update_incident(incident_id, {
                "status": "resolved",
                "resolved_at": now_str
            })
            
            updated = await mongodb_service.get_incident(incident_id)
            formatted = format_incident_for_frontend(updated)
            
            await manager.broadcast({
                "type": "incident_resolved",
                "data": formatted
            })
            logger.info(f"Incident {incident_id} marked as resolved via webhook.")
            return {"status": "resolved", "incident_id": incident_id}
            
        return {"status": "ignored", "reason": "No active incident found for resolved problem"}
        
    # Handle problem open webhook
    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow()
    
    services = parse_affected_services(payload.ImpactedEntities)
    severity = map_severity(payload.ProblemSeverity)
    
    incident_data = {
        "id": incident_id,
        "dynatrace_problem_id": payload.ProblemID,
        "title": payload.ProblemTitle,
        "severity": severity,
        "status": "detected",
        "affected_services": services,
        "started_at": now.isoformat(),
        "detected_at": now.isoformat(),
        "resolved_at": None,
        "root_cause": None,
        "root_cause_confidence": None,
        "culprit_commit": None,
        "similar_past_incidents": [],
        "recommended_fix": None,
        "impact_summary": None,
        "agent_steps": [],
        "gitlab_issue": None,
        "arize_trace_id": None,
        "investigation_started_at": None,
        "investigation_completed_at": None,
        "total_investigation_ms": None
    }
    
    # Save to database
    await mongodb_service.store_incident(incident_data)
    formatted = format_incident_for_frontend(incident_data)
    
    # Broadcast incident detection event
    await manager.broadcast({
        "type": "incident_detected",
        "data": formatted
    })
    
    # Spin up background agent thread/task
    background_tasks.add_task(run_agent_investigation_task, incident_id=incident_id)
    
    return {"status": "triggered", "incident_id": incident_id}

@router.post("/webhook/test")
async def test_webhook(payload: TestWebhook, background_tasks: BackgroundTasks):
    logger.info(f"Triggering manual Test Webhook for service: {payload.service_name}")
    
    # Create fake Dynatrace Webhook payload
    fake_pid = f"P-{uuid.uuid4().hex[:6].upper()}"
    fake_payload = DynatraceWebhook(
        ProblemID=fake_pid,
        ProblemTitle=f"High error rate detected on {payload.service_name}",
        State="OPEN",
        ProblemSeverity=payload.severity,
        ImpactedEntities=payload.service_name,
        ProblemURL=f"https://dynatrace.com/problem/{fake_pid}",
        Tags="hackathon,test",
        ProblemDetailsText=payload.error_message
    )
    
    # Route through standard webhook handler
    result = await dynatrace_webhook(fake_payload, background_tasks)
    return result
