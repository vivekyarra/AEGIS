import os
import uuid
import httpx
import time
import logging
from datetime import datetime
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.sdk.trace.export import ConsoleSpanExporter

logger = logging.getLogger("arize-service")

class ArizeService:
    def __init__(self):
        self.api_key = os.getenv("ARIZE_API_KEY", "")
        self.space_id = os.getenv("ARIZE_SPACE_ID", "")
        self.endpoint = "https://app.phoenix.arize.com"
        self.project_name = "aegis"
        self.is_configured = bool(self.api_key and "REPLACE_ME" not in self.api_key and self.space_id and "REPLACE_ME" not in self.space_id)
        self.tracer = None
        self._setup_tracer()

    def _setup_tracer(self):
        try:
            # Set up OpenTelemetry tracer
            provider = TracerProvider()
            
            if self.is_configured:
                # In real code, if arize-phoenix-otel is installed, we can register it:
                # import phoenix.otel as phoenix_otel
                # phoenix_otel.register(project_name=self.project_name, endpoint=f"{self.endpoint}/v1/traces")
                # But here, we will register a simple exporter to app.phoenix.arize.com:
                from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "space-id": self.space_id
                }
                otlp_exporter = OTLPSpanExporter(
                    endpoint=f"{self.endpoint}/v1/traces",
                    headers=headers
                )
                provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
                logger.info("Arize Phoenix OpenTelemetry tracing provider configured.")
            else:
                logger.warning("Arize Phoenix API key or Space ID missing. Initializing console-only local tracer.")
                console_exporter = ConsoleSpanExporter()
                provider.add_span_processor(SimpleSpanProcessor(console_exporter))

            trace.set_tracer_provider(provider)
            self.tracer = trace.get_tracer(self.project_name)
        except Exception as e:
            logger.error(f"Failed to setup OpenTelemetry tracer: {e}. Running without tracer.")
            # Fallback mock tracer
            self.tracer = None

    async def log_agent_decision(
        self,
        incident_id: str,
        problem_summary: str,
        root_cause: str,
        tools_used: list,
        total_latency_ms: int,
        confidence: float,
        steps_count: int,
        agent_steps: list
    ) -> str:
        trace_id = str(uuid.uuid4())
        
        # If tracer failed to initialize, return trace string
        if not self.tracer:
            logger.info(f"Mock Arize decision logged for incident {incident_id} (Trace ID: {trace_id})")
            return f"trace-{trace_id[:8]}"

        try:
            # Create root investigation span
            with self.tracer.start_as_current_span("aegis-investigation") as root_span:
                # Set span attributes
                root_span.set_attribute("incident.id", incident_id)
                root_span.set_attribute("incident.problem", problem_summary)
                root_span.set_attribute("agent.tools_used", ", ".join(tools_used))
                root_span.set_attribute("agent.latency_ms", total_latency_ms)
                root_span.set_attribute("agent.confidence", confidence)
                root_span.set_attribute("agent.steps_count", steps_count)
                root_span.set_attribute("output.root_cause", root_cause)
                root_span.set_attribute("model.name", "gemini-2.0-flash")

                # Create child spans for each tool execution step
                for step in agent_steps:
                    step_name = f"tool.{step.get('tool_name')}"
                    start_time_secs = time.time() - (step.get("latency_ms", 100) / 1000.0)
                    
                    # Create child context manual span representation
                    with self.tracer.start_span(
                        step_name, 
                        context=trace.set_span_in_context(root_span)
                    ) as child_span:
                        child_span.set_attribute("step.number", step.get("step_number"))
                        child_span.set_attribute("tool.input", str(step.get("tool_input")))
                        child_span.set_attribute("tool.output", str(step.get("tool_output")))
                        child_span.set_attribute("tool.latency_ms", step.get("latency_ms"))
                        child_span.set_attribute("tool.success", step.get("success"))
            
            # Force flush telemetry exporter
            trace.get_tracer_provider().force_flush()
            
            # Also attempt direct POST to Phoenix REST API for robust fallback
            if self.is_configured:
                await self._post_to_phoenix_api(incident_id, problem_summary, root_cause, trace_id, total_latency_ms)

            return trace_id
        except Exception as e:
            logger.error(f"Error logging agent decision to Arize: {e}")
            return f"trace-{trace_id[:8]}"

    async def _post_to_phoenix_api(self, incident_id: str, problem: str, root_cause: str, trace_id: str, latency: int):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                url = f"{self.endpoint}/v1/traces"
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "space-id": self.space_id,
                    "Content-Type": "application/json"
                }
                body = {
                    "project_name": self.project_name,
                    "trace_id": trace_id,
                    "metadata": {
                        "incident_id": incident_id,
                        "problem": problem,
                        "root_cause": root_cause,
                        "latency_ms": str(latency)
                    }
                }
                await client.post(url, headers=headers, json=body)
        except Exception as e:
            logger.debug(f"Direct post to Phoenix endpoint failed (this is non-critical): {e}")
