from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class IncidentStatus(str, Enum):
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    ROOT_CAUSE_FOUND = "root_cause_found"
    REMEDIATION_PENDING = "remediation_pending"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"

class IncidentSeverity(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"

class AgentStep(BaseModel):
    step_number: int
    tool_name: str
    tool_input: dict
    tool_output: str
    timestamp: datetime
    latency_ms: int
    success: bool

class CommitInfo(BaseModel):
    sha: str
    short_sha: str
    message: str
    author: str
    timestamp: str
    url: Optional[str] = None

class SimilarIncident(BaseModel):
    id: str
    title: str
    root_cause: str
    recommended_fix: str
    resolved_at: Optional[str] = None
    resolution_time_minutes: Optional[int] = None

class GitLabIssue(BaseModel):
    id: int
    iid: int
    url: str
    title: str

class Incident(BaseModel):
    id: str
    dynatrace_problem_id: str
    title: str
    severity: IncidentSeverity
    status: IncidentStatus
    affected_services: List[str]
    started_at: datetime
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    root_cause: Optional[str] = None
    root_cause_confidence: Optional[float] = None
    culprit_commit: Optional[CommitInfo] = None
    similar_past_incidents: List[SimilarIncident] = []
    recommended_fix: Optional[str] = None
    impact_summary: Optional[str] = None
    agent_steps: List[AgentStep] = []
    gitlab_issue: Optional[GitLabIssue] = None
    arize_trace_id: Optional[str] = None
    investigation_started_at: Optional[datetime] = None
    investigation_completed_at: Optional[datetime] = None
    total_investigation_ms: Optional[int] = None

class DynatraceWebhook(BaseModel):
    ProblemID: str
    ProblemTitle: str
    State: str  # OPEN or RESOLVED
    ProblemSeverity: Optional[str] = "AVAILABILITY"
    ImpactedEntities: Optional[str] = ""
    ProblemURL: Optional[str] = ""
    Tags: Optional[str] = ""
    ProblemDetailsText: Optional[str] = ""

class TestWebhook(BaseModel):
    service_name: str = "checkout-service"
    error_message: str = "High error rate detected"
    severity: str = "P1"
