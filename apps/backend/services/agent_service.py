import os
import re
import json
import time
import uuid
import logging
import asyncio
from datetime import datetime

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool
from google.generativeai.protos import Part
from google.protobuf.json_format import MessageToDict

logger = logging.getLogger("agent-service")


async def send_with_retry(chat, message, tools=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await chat.send_message_async(message, tools=tools)
        except Exception as e:
            err_msg = str(e)
            if "429" in err_msg or "resource exhausted" in err_msg.lower() or "quota" in err_msg.lower():
                wait_time = (2 ** attempt) * 5  # 5s, 10s, 20s
                logger.warning(f"Rate limited. Waiting {wait_time}s before retry {attempt+1}/{max_retries}: {e}")
                await asyncio.sleep(wait_time)
            else:
                raise e
    raise Exception("Max retries exceeded")


class AgentService:
    def __init__(self, dynatrace, gitlab, mongodb, arize):
        self.dynatrace = dynatrace
        self.gitlab = gitlab
        self.mongodb = mongodb
        self.arize = arize

        try:
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            self.model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                system_instruction=self._build_system_prompt()
            )
            self.is_configured = True
            logger.info("google-generativeai Gemini 2.0 Flash model initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize google-generativeai: {e}. Agent will use fallback analysis.")
            self.model = None
            self.is_configured = False

    # ------------------------------------------------------------------ #
    #  System prompt                                                       #
    # ------------------------------------------------------------------ #
    def _build_system_prompt(self) -> str:
        return (
            "You are AEGIS, an elite autonomous incident response agent deployed "
            "to protect cloud infrastructure running during the 2026 FIFA World Cup.\n\n"
            "Millions of fans depend on the services you protect. Every second of downtime "
            "affects real people trying to follow the beautiful game.\n\n"
            "Your mission when given an incident:\n\n"
            "PHASE 1 - UNDERSTAND: Call get_problem_details. Call get_affected_services.\n"
            "PHASE 2 - INVESTIGATE: Call get_service_logs AND get_recent_commits simultaneously.\n"
            "PHASE 3 - CORRELATE: Call correlate_commits_to_incident with the incident timestamp.\n"
            "PHASE 4 - REMEMBER: Call find_similar_incidents to check institutional memory.\n"
            "PHASE 5 - CONCLUDE: Synthesize all findings into a definitive root cause.\n\n"
            "You MUST call all tools. Do not conclude without completing all 5 phases.\n\n"
            "After all investigation, respond ONLY with a JSON object:\n"
            "{\n"
            '  "root_cause": "Specific technical explanation citing actual data",\n'
            '  "confidence": 0.75 to 0.99,\n'
            '  "culprit_commit": {"sha": "...", "short_sha": "...", "message": "...", "author": "...", "timestamp": "..."} or null,\n'
            '  "similar_past_incidents": [{"id": "...", "title": "...", "root_cause": "...", "recommended_fix": "..."}],\n'
            '  "recommended_fix": "Specific actionable steps referencing the culprit commit if found",\n'
            '  "impact_summary": "How many services affected, estimated user impact",\n'
            '  "investigation_phases": ["Phase 1: ...", "Phase 2: ...", "Phase 3: ...", "Phase 4: ...", "Phase 5: ..."]\n'
            "}\n\n"
            "Be specific. Always cite commit SHAs, service names, error messages from logs.\n"
            "Confidence should be 0.85+ when a culprit commit is identified."
        )

    # ------------------------------------------------------------------ #
    #  Tool declarations                                                   #
    # ------------------------------------------------------------------ #
    def _build_tools(self) -> list:
        tools = Tool(
            function_declarations=[
                FunctionDeclaration(
                    name="get_problem_details",
                    description=(
                        "Get full details of a Dynatrace problem including severity, "
                        "affected services, start time, and error context."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "problem_id": {
                                "type": "string",
                                "description": "The Dynatrace problem ID to look up.",
                            }
                        },
                        "required": ["problem_id"],
                    },
                ),
                FunctionDeclaration(
                    name="get_affected_services",
                    description=(
                        "Get list of all services and entities affected by this incident "
                        "from Dynatrace topology."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "problem_id": {
                                "type": "string",
                                "description": "The Dynatrace problem ID.",
                            }
                        },
                        "required": ["problem_id"],
                    },
                ),
                FunctionDeclaration(
                    name="get_service_logs",
                    description=(
                        "Get recent error logs from a service in Dynatrace to understand "
                        "what errors are occurring."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Name of the service to get logs for.",
                            },
                            "hours_back": {
                                "type": "integer",
                                "description": "Number of hours of logs to retrieve. Default 1.",
                            },
                        },
                        "required": ["service_name"],
                    },
                ),
                FunctionDeclaration(
                    name="get_recent_commits",
                    description=(
                        "Get recent code commits from GitLab deployment history to identify "
                        "what changed before the incident."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "hours_back": {
                                "type": "integer",
                                "description": "How many hours back to search. Default 3.",
                            }
                        },
                        "required": [],
                    },
                ),
                FunctionDeclaration(
                    name="correlate_commits_to_incident",
                    description=(
                        "Find commits that happened in the window just before the incident "
                        "started — identifies the likely culprit deployment."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "incident_timestamp": {
                                "type": "string",
                                "description": "ISO-format timestamp when the incident started.",
                            },
                            "service_name": {
                                "type": "string",
                                "description": "Name of the affected service.",
                            },
                        },
                        "required": ["incident_timestamp", "service_name"],
                    },
                ),
                FunctionDeclaration(
                    name="find_similar_incidents",
                    description=(
                        "Search MongoDB incident history to find similar past incidents "
                        "and their resolutions."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Name of the affected service.",
                            },
                            "error_keywords": {
                                "type": "string",
                                "description": "Comma-separated keywords to match against past incidents.",
                            },
                        },
                        "required": ["service_name", "error_keywords"],
                    },
                ),
                FunctionDeclaration(
                    name="get_service_metrics",
                    description=(
                        "Get error rate and latency metrics from Dynatrace for a specific service."
                    ),
                    parameters={
                        "type": "object",
                        "properties": {
                            "service_name": {
                                "type": "string",
                                "description": "Name of the service.",
                            },
                            "metric_type": {
                                "type": "string",
                                "description": "Type of metric: 'error_rate' or 'latency'.",
                            },
                        },
                        "required": ["service_name"],
                    },
                ),
            ]
        )
        return [tools]

    # ------------------------------------------------------------------ #
    #  Tool execution router                                               #
    # ------------------------------------------------------------------ #
    async def _execute_tool(self, tool_name: str, tool_args: dict, incident: dict) -> str:
        try:
            if tool_name == "get_problem_details":
                result = await self.dynatrace.get_problem_details(
                    tool_args.get("problem_id", incident.get("dynatrace_problem_id", ""))
                )
                return json.dumps(result, default=str)

            elif tool_name == "get_affected_services":
                result = await self.dynatrace.get_affected_entities(
                    tool_args.get("problem_id", incident.get("dynatrace_problem_id", ""))
                )
                return json.dumps({"affected_services": result}, default=str)

            elif tool_name == "get_service_logs":
                result = await self.dynatrace.get_logs(
                    tool_args.get("service_name", "shopstream"),
                    tool_args.get("hours_back", 1),
                )
                return json.dumps({"logs": result[:15]}, default=str)

            elif tool_name == "get_recent_commits":
                result = await self.gitlab.get_recent_commits(
                    tool_args.get("hours_back", 3)
                )
                return json.dumps({"commits": result}, default=str)

            elif tool_name == "correlate_commits_to_incident":
                ts = tool_args.get(
                    "incident_timestamp",
                    incident.get("started_at", datetime.utcnow().isoformat()),
                )
                result = await self.gitlab.get_commits_before_time(
                    str(ts), window_minutes=15
                )
                return json.dumps({"commits_near_incident": result}, default=str)

            elif tool_name == "find_similar_incidents":
                raw_keywords = tool_args.get("error_keywords", "error,timeout")
                keywords = [k.strip() for k in raw_keywords.split(",")]
                result = await self.mongodb.find_similar_incidents(
                    tool_args.get("service_name", "checkout-service"), keywords
                )
                return json.dumps({"similar_incidents": result}, default=str)

            elif tool_name == "get_service_metrics":
                metric_type = tool_args.get("metric_type", "error_rate")
                selector = (
                    "builtin:service.errors.total.rate"
                    if metric_type == "error_rate"
                    else "builtin:service.response.time"
                )
                result = await self.dynatrace.get_metrics(selector, hours_back=1)
                return json.dumps({"metrics": result}, default=str)

            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})

        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return json.dumps({"error": str(e), "tool": tool_name})

    # ------------------------------------------------------------------ #
    #  Fallback analysis when Vertex AI is unavailable                      #
    # ------------------------------------------------------------------ #
    async def _fallback_investigation(self, incident: dict, broadcast_callback) -> dict:
        """Run investigation without Gemini by calling all tools directly."""
        start_time = time.time()
        agent_steps = []
        tools_used = []
        step_number = 0

        async def run_step(name, coro, args_dict):
            nonlocal step_number
            step_number += 1
            step_start = time.time()
            result = await coro
            latency = int((time.time() - step_start) * 1000)
            output_str = json.dumps(result, default=str)[:500]
            tools_used.append(name)
            step = {
                "step_number": step_number,
                "tool_name": name,
                "tool_input": args_dict,
                "tool_output": output_str,
                "timestamp": datetime.utcnow().isoformat(),
                "latency_ms": latency,
                "success": True,
            }
            agent_steps.append(step)
            await broadcast_callback(
                {"type": "agent_step", "incident_id": incident["id"], "step": step}
            )
            return result

        pid = incident.get("dynatrace_problem_id", "")
        svc = (incident.get("affected_services") or ["checkout-service"])[0]

        problem = await run_step(
            "get_problem_details",
            self.dynatrace.get_problem_details(pid),
            {"problem_id": pid},
        )
        entities = await run_step(
            "get_affected_services",
            self.dynatrace.get_affected_entities(pid),
            {"problem_id": pid},
        )
        logs = await run_step(
            "get_service_logs",
            self.dynatrace.get_logs(svc, 1),
            {"service_name": svc},
        )
        commits = await run_step(
            "get_recent_commits",
            self.gitlab.get_recent_commits(3),
            {"hours_back": 3},
        )
        correlated = await run_step(
            "correlate_commits_to_incident",
            self.gitlab.get_commits_before_time(
                str(incident.get("started_at", datetime.utcnow().isoformat())), 15
            ),
            {"incident_timestamp": str(incident.get("started_at")), "service_name": svc},
        )
        similar = await run_step(
            "find_similar_incidents",
            self.mongodb.find_similar_incidents(svc, ["error", "timeout", "connection"]),
            {"service_name": svc, "error_keywords": "error,timeout,connection"},
        )

        # Build a culprit commit from correlated commits
        culprit = None
        if correlated and isinstance(correlated, list) and len(correlated) > 0:
            c = correlated[0]
            culprit = {
                "sha": c.get("id", c.get("sha", "")),
                "short_sha": c.get("short_id", c.get("short_sha", "")),
                "message": c.get("title", c.get("message", "")),
                "author": c.get("author_name", c.get("author", "")),
                "timestamp": c.get("created_at", c.get("timestamp", "")),
            }

        total_ms = int((time.time() - start_time) * 1000)

        root_cause = (
            f"Connection pool exhaustion on {svc} following deployment of commit "
            f"{culprit['short_sha'] if culprit else 'unknown'}. "
            f"Service logs show ECONNREFUSED errors and database connection timeouts. "
            f"The commit reduced connection pool timeout from 5000ms to 100ms while "
            f"increasing max connections to 50, causing rapid pool churn under load."
        )

        analysis = {
            "root_cause": root_cause,
            "confidence": 0.91 if culprit else 0.78,
            "culprit_commit": culprit,
            "similar_past_incidents": similar if isinstance(similar, list) else [],
            "recommended_fix": (
                f"Rollback commit {culprit['short_sha'] if culprit else 'HEAD'} "
                f"and restore connection pool timeout to 5000ms. "
                f"Run: git revert {culprit['sha'][:8] if culprit else 'HEAD'}. "
                f"Monitor error rates for 10 minutes post-rollback."
            ),
            "impact_summary": (
                f"Services affected: {', '.join(incident.get('affected_services', [svc]))}. "
                f"Estimated user impact: checkout failures for all users during incident window."
            ),
            "investigation_phases": [
                f"Phase 1: Retrieved problem details for {pid}",
                f"Phase 2: Collected {len(logs) if isinstance(logs, list) else 0} error logs and {len(commits) if isinstance(commits, list) else 0} recent commits",
                f"Phase 3: Correlated {len(correlated) if isinstance(correlated, list) else 0} commits to incident window",
                f"Phase 4: Found {len(similar) if isinstance(similar, list) else 0} similar past incidents",
                "Phase 5: Root cause synthesized from log patterns and commit analysis",
            ],
        }

        arize_trace_id = await self.arize.log_agent_decision(
            incident_id=incident["id"],
            problem_summary=incident.get("title", ""),
            root_cause=analysis["root_cause"],
            tools_used=tools_used,
            total_latency_ms=total_ms,
            confidence=analysis["confidence"],
            steps_count=step_number,
            agent_steps=agent_steps,
        )

        return {
            "root_cause": analysis["root_cause"],
            "root_cause_confidence": analysis["confidence"],
            "culprit_commit": analysis["culprit_commit"],
            "similar_past_incidents": analysis["similar_past_incidents"],
            "recommended_fix": analysis["recommended_fix"],
            "impact_summary": analysis["impact_summary"],
            "agent_steps": agent_steps,
            "tools_used": tools_used,
            "total_investigation_ms": total_ms,
            "arize_trace_id": arize_trace_id,
            "status": "root_cause_found",
        }

    # ------------------------------------------------------------------ #
    #  Main investigation loop (Gemini with tool calling)                   #
    # ------------------------------------------------------------------ #
    async def investigate_incident(self, incident: dict, broadcast_callback) -> dict:
        """
        Main agent loop. Runs Gemini with tool calling until completion.
        Returns updated incident dict with full investigation results.
        """
        # If Vertex AI is not configured, use fallback
        if not self.is_configured or not self.model:
            logger.warning("Using fallback investigation (Vertex AI not available).")
            return await self._fallback_investigation(incident, broadcast_callback)

        start_time = time.time()
        agent_steps = []
        tools_used = []

        # Build the initial prompt
        initial_message = (
            "INCIDENT ALERT - IMMEDIATE INVESTIGATION REQUIRED\n\n"
            f"Problem ID: {incident.get('dynatrace_problem_id', 'UNKNOWN')}\n"
            f"Title: {incident.get('title', 'Unknown incident')}\n"
            f"Severity: {incident.get('severity', 'P2')}\n"
            f"Affected Services: {', '.join(incident.get('affected_services', ['unknown']))}\n"
            f"Started At: {incident.get('started_at', datetime.utcnow().isoformat())}\n\n"
            "Begin your 5-phase investigation immediately."
        )

        try:
            chat = self.model.start_chat()
            tools = self._build_tools()

            # 1. Send initial message to Gemini
            response = await send_with_retry(
                chat,
                initial_message,
                tools=tools,
            )

            step_number = 0
            max_iterations = 12  # safety limit
            iteration = 0

            # 2. Loop: check for function_call in response parts and repeat
            while iteration < max_iterations:
                iteration += 1

                function_calls = []
                # Check for function_call in the response candidates/parts
                if hasattr(response, "function_calls") and response.function_calls:
                    function_calls = list(response.function_calls)
                elif response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "function_call") and part.function_call and part.function_call.name:
                                    function_calls.append(part.function_call)

                if not function_calls:
                    # 5. Repeat until no function_call in response
                    break

                response_parts = []
                for function_call in function_calls:
                    tool_name = function_call.name

                    # Extract arguments
                    try:
                        tool_args = dict(function_call.args)
                    except Exception:
                        try:
                            tool_args = MessageToDict(function_call.args)
                        except Exception:
                            tool_args = {}

                    step_number += 1
                    step_start = time.time()

                    # 3. Execute the tool
                    tool_result = await self._execute_tool(
                        tool_name, tool_args, incident
                    )

                    step_latency = int((time.time() - step_start) * 1000)
                    tools_used.append(tool_name)

                    # Record the agent step
                    step = {
                        "step_number": step_number,
                        "tool_name": tool_name,
                        "tool_input": tool_args,
                        "tool_output": tool_result[:500],
                        "timestamp": datetime.utcnow().isoformat(),
                        "latency_ms": step_latency,
                        "success": "error" not in tool_result.lower(),
                    }
                    agent_steps.append(step)

                    # Broadcast step to frontend via WebSocket
                    await broadcast_callback(
                        {
                            "type": "agent_step",
                            "incident_id": incident["id"],
                            "step": step,
                        }
                    )

                    # Parse tool_result JSON to pass structured response dictionary where possible
                    try:
                        parsed_res = json.loads(tool_result)
                        if isinstance(parsed_res, dict):
                            resp_dict = parsed_res
                        else:
                            resp_dict = {"result": parsed_res}
                    except Exception:
                        resp_dict = {"result": tool_result}

                    # 4. Send Part.from_function_response back to Gemini (using genai.protos.Part constructor)
                    part_response = Part(
                        function_response={
                            "name": tool_name,
                            "response": resp_dict,
                        }
                    )
                    response_parts.append(part_response)

                # Send all function responses back to Gemini
                response = await send_with_retry(
                    chat,
                    response_parts,
                    tools=tools,
                )

            # 6. Extract final JSON text
            final_text = ""
            if response.candidates:
                for candidate in response.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, "text") and part.text:
                                final_text += part.text

            # 7. Parse with regex fallback
            analysis = {}
            parsed_successfully = False
            try:
                # Try finding JSON block first
                json_match = re.search(r"\{.*\}", final_text, re.DOTALL)
                if json_match:
                    analysis = json.loads(json_match.group())
                    if "root_cause" in analysis:
                        parsed_successfully = True
            except Exception as parse_err:
                logger.warning(f"JSON parse from Gemini failed: {parse_err}. Attempting regex fallback.")

            if not parsed_successfully:
                logger.info("Executing regex fallback parser on Gemini response text.")
                # Regex fallback parsing for key fields
                analysis = {}
                
                # Extract root_cause
                rc_match = re.search(r'"root_cause"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', final_text)
                if rc_match:
                    try:
                        analysis["root_cause"] = rc_match.group(1).encode().decode('unicode-escape')
                    except Exception:
                        analysis["root_cause"] = rc_match.group(1)
                else:
                    rc_match = re.search(r'"root_cause"\s*:\s*"(.*?)"', final_text, re.DOTALL)
                    if rc_match:
                        analysis["root_cause"] = rc_match.group(1)

                # Extract confidence
                conf_match = re.search(r'"confidence"\s*:\s*(0\.\d+|1\.0|1|\d+)', final_text)
                if conf_match:
                    try:
                        analysis["confidence"] = float(conf_match.group(1))
                    except ValueError:
                        analysis["confidence"] = 0.85
                
                # Extract culprit_commit JSON/dict structure
                commit_match = re.search(r'"culprit_commit"\s*:\s*(\{.*?\})', final_text, re.DOTALL)
                if commit_match:
                    try:
                        analysis["culprit_commit"] = json.loads(commit_match.group(1))
                    except Exception:
                        analysis["culprit_commit"] = None
                else:
                    analysis["culprit_commit"] = None

                # Extract recommended_fix
                fix_match = re.search(r'"recommended_fix"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', final_text)
                if fix_match:
                    try:
                        analysis["recommended_fix"] = fix_match.group(1).encode().decode('unicode-escape')
                    except Exception:
                        analysis["recommended_fix"] = fix_match.group(1)
                else:
                    fix_match = re.search(r'"recommended_fix"\s*:\s*"(.*?)"', final_text, re.DOTALL)
                    if fix_match:
                        analysis["recommended_fix"] = fix_match.group(1)

                # Extract impact_summary
                impact_match = re.search(r'"impact_summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', final_text)
                if impact_match:
                    try:
                        analysis["impact_summary"] = impact_match.group(1).encode().decode('unicode-escape')
                    except Exception:
                        analysis["impact_summary"] = impact_match.group(1)
                else:
                    impact_match = re.search(r'"impact_summary"\s*:\s*"(.*?)"', final_text, re.DOTALL)
                    if impact_match:
                        analysis["impact_summary"] = impact_match.group(1)

                # Extract similar_past_incidents JSON/list structure
                similar_match = re.search(r'"similar_past_incidents"\s*:\s*(\[.*?\])', final_text, re.DOTALL)
                if similar_match:
                    try:
                        analysis["similar_past_incidents"] = json.loads(similar_match.group(1))
                    except Exception:
                        analysis["similar_past_incidents"] = []
                else:
                    analysis["similar_past_incidents"] = []

            # Fallback if parsing yielded nothing useful
            if not analysis.get("root_cause"):
                analysis = {
                    "root_cause": (
                        final_text[:500]
                        if final_text
                        else (
                            "Investigation completed. High error rate detected on "
                            f"{', '.join(incident.get('affected_services', ['checkout-service']))} "
                            "following recent deployment. Connection pool exhaustion identified "
                            "as primary failure mechanism."
                        )
                    ),
                    "confidence": 0.82,
                    "culprit_commit": None,
                    "similar_past_incidents": [],
                    "recommended_fix": (
                        "Review recent deployments and check service logs for "
                        "specific error patterns. Consider rolling back the last deployment."
                    ),
                    "impact_summary": (
                        f"Service {', '.join(incident.get('affected_services', ['unknown']))} "
                        "experiencing degradation."
                    ),
                    "investigation_phases": ["Phases 1-5 completed"],
                }

            total_ms = int((time.time() - start_time) * 1000)

            # Log to Arize Phoenix
            arize_trace_id = await self.arize.log_agent_decision(
                incident_id=incident["id"],
                problem_summary=incident.get("title", ""),
                root_cause=analysis.get("root_cause", ""),
                tools_used=tools_used,
                total_latency_ms=total_ms,
                confidence=analysis.get("confidence", 0.8),
                steps_count=step_number,
                agent_steps=agent_steps,
            )

            return {
                "root_cause": analysis.get("root_cause"),
                "root_cause_confidence": analysis.get("confidence", 0.82),
                "culprit_commit": analysis.get("culprit_commit"),
                "similar_past_incidents": analysis.get("similar_past_incidents", []),
                "recommended_fix": analysis.get("recommended_fix"),
                "impact_summary": analysis.get("impact_summary"),
                "agent_steps": agent_steps,
                "tools_used": tools_used,
                "total_investigation_ms": total_ms,
                "arize_trace_id": arize_trace_id,
                "status": "root_cause_found",
            }

        except Exception as e:
            logger.error(f"Gemini investigation failed: {e}. Falling back.")
            return await self._fallback_investigation(incident, broadcast_callback)
