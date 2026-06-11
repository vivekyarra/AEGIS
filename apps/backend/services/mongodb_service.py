import os
import logging
import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logger = logging.getLogger("mongodb-service")

class MongoDBService:
    def __init__(self):
        self.uri = os.getenv("MONGODB_URI", "")
        self.db_name = os.getenv("MONGODB_DB", "aegis")
        self.is_configured = bool(self.uri and "REPLACE_ME" not in self.uri)
        self.client = None
        self.db = None
        self.incidents = None
        self.agent_sessions = None
        
        # In-memory storage fallback for demo
        self.use_fallback = not self.is_configured
        self.fallback_incidents = {}
        self.fallback_sessions = {}

        if self.is_configured:
            try:
                self.client = AsyncIOMotorClient(self.uri, serverSelectionTimeoutMS=2000)
                self.db = self.client[self.db_name]
                self.incidents = self.db["incidents"]
                self.agent_sessions = self.db["agent_sessions"]
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}. Falling back to memory storage.")
                self.use_fallback = True
        else:
            logger.warning("MongoDB URI not provided. Running in memory fallback mode.")

    async def initialize(self):
        if self.use_fallback:
            logger.info("Initializing in-memory incident seed data...")
            await self._seed_fallback_incidents()
            return

        try:
            # Test connection
            await self.client.admin.command('ping')
            
            # Create indexes
            await self.incidents.create_index([("started_at", -1)])
            await self.incidents.create_index([("dynatrace_problem_id", 1)], unique=True)
            await self.incidents.create_index([("status", 1)])
            await self.incidents.create_index([("affected_services", 1)])
            logger.info("MongoDB indexes created successfully.")
            
            await self.seed_sample_incidents()
        except Exception as e:
            logger.error(f"MongoDB initialization failed: {e}. Activating memory fallback.")
            self.use_fallback = True
            await self._seed_fallback_incidents()

    def _generate_past_incidents(self) -> list:
        now = datetime.utcnow()
        return [
            {
                "id": "INC-A92F1C8B",
                "dynatrace_problem_id": "P-910283",
                "title": "High error rate on checkout-service",
                "severity": "P1",
                "status": "resolved",
                "affected_services": ["checkout-service", "payment-service"],
                "started_at": (now - timedelta(days=3)).isoformat(),
                "detected_at": (now - timedelta(days=3)).isoformat(),
                "resolved_at": (now - timedelta(days=3) + timedelta(minutes=23)).isoformat(),
                "root_cause": "Memory leak in payment processor caused connection pool exhaustion after 6 hours of operation. Service began rejecting new connections at 02:14 UTC.",
                "root_cause_confidence": 0.94,
                "recommended_fix": "Restart payment-service pod and apply patch v2.1.4 which fixes the connection pool leak. Monitor memory usage for 30 minutes post-restart.",
                "impact_summary": "Checkout functionality degraded for approximately 1500 users. Payment authorization failed for 342 transactions.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-B08C7E4A",
                "dynatrace_problem_id": "P-920194",
                "title": "Latency spike on product-service",
                "severity": "P2",
                "status": "resolved",
                "affected_services": ["product-service", "search-service"],
                "started_at": (now - timedelta(days=7)).isoformat(),
                "detected_at": (now - timedelta(days=7)).isoformat(),
                "resolved_at": (now - timedelta(days=7) + timedelta(minutes=18)).isoformat(),
                "root_cause": "Database index dropped accidentally during migration script execution. Full table scans causing 8-15 second response times.",
                "root_cause_confidence": 0.88,
                "recommended_fix": "Re-create index: CREATE INDEX idx_product_category ON products(category, price). Estimated rebuild time: 4 minutes.",
                "impact_summary": "Product details page loading slowly, causing a drop in user conversions by 12% over an 18-minute period.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-C81B920A",
                "dynatrace_problem_id": "P-930495",
                "title": "Order service returning 503 errors",
                "severity": "P1",
                "status": "resolved",
                "affected_services": ["order-service"],
                "started_at": (now - timedelta(days=12)).isoformat(),
                "detected_at": (now - timedelta(days=12)).isoformat(),
                "resolved_at": (now - timedelta(days=12) + timedelta(minutes=14)).isoformat(),
                "root_cause": "Deployment commit a3f9c12 introduced a null reference exception in order validation. 100% of POST /orders requests failing.",
                "root_cause_confidence": 0.99,
                "recommended_fix": "Rollback to commit d8e2a01. Root commit identified: a3f9c12 - 'Update order validation schema'. Rollback command: git revert a3f9c12",
                "impact_summary": "Order creations completely disabled. 430 checkout carts abandoned.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-D71B203E",
                "dynatrace_problem_id": "P-940294",
                "title": "Search index service failure",
                "severity": "P2",
                "status": "resolved",
                "affected_services": ["search-service", "product-service"],
                "started_at": (now - timedelta(days=15)).isoformat(),
                "detected_at": (now - timedelta(days=15)).isoformat(),
                "resolved_at": (now - timedelta(days=15) + timedelta(minutes=27)).isoformat(),
                "root_cause": "Out of memory (OOM) on Elasticsearch node 2 due to unoptimized search queries triggering deep pagination.",
                "root_cause_confidence": 0.85,
                "recommended_fix": "Restart elasticsearch container on node 2 and adjust heap sizes. Avoid query deep paging offsets.",
                "impact_summary": "Product searches failed for 890 search queries.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-E82C3D4A",
                "dynatrace_problem_id": "P-950293",
                "title": "Notification delivery service delays",
                "severity": "P3",
                "status": "resolved",
                "affected_services": ["notification-service"],
                "started_at": (now - timedelta(days=18)).isoformat(),
                "detected_at": (now - timedelta(days=18)).isoformat(),
                "resolved_at": (now - timedelta(days=18) + timedelta(minutes=42)).isoformat(),
                "root_cause": "Third-party SMS gateway credentials expired, causing automatic queue backlogs in dispatch pipeline.",
                "root_cause_confidence": 0.91,
                "recommended_fix": "Rotate API secrets in vault for SMS Gateway. Manually flush backed-up message broker queue.",
                "impact_summary": "Delivery confirmation messages delayed for 1200 orders.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-F91A203C",
                "dynatrace_problem_id": "P-960293",
                "title": "Billing verification timeouts",
                "severity": "P1",
                "status": "resolved",
                "affected_services": ["payment-service", "billing-service"],
                "started_at": (now - timedelta(days=22)).isoformat(),
                "detected_at": (now - timedelta(days=22)).isoformat(),
                "resolved_at": (now - timedelta(days=22) + timedelta(minutes=31)).isoformat(),
                "root_cause": "Rate limit exceeded on Stripe processing endpoint due to concurrent webhook retries.",
                "root_cause_confidence": 0.87,
                "recommended_fix": "Increase retry backoff delay variables in stripe integration config. Limit concurrent connection threads to 5.",
                "impact_summary": "Credit card processing failed temporarily for 98 users.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-G02B304D",
                "dynatrace_problem_id": "P-970291",
                "title": "Recommendation model latency",
                "severity": "P3",
                "status": "resolved",
                "affected_services": ["product-service"],
                "started_at": (now - timedelta(days=25)).isoformat(),
                "detected_at": (now - timedelta(days=25)).isoformat(),
                "resolved_at": (now - timedelta(days=25) + timedelta(minutes=45)).isoformat(),
                "root_cause": "Cold start delays on cloud functions serving the PyTorch ML models due to oversized bundle size.",
                "root_cause_confidence": 0.82,
                "recommended_fix": "Configure minimum instance scaling pool of 1 for recommender function to bypass cold starts.",
                "impact_summary": "Product detail pages had recommendation sliders blank out for 10% of users.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-H93D284B",
                "dynatrace_problem_id": "P-980124",
                "title": "Cart checkout socket disconnects",
                "severity": "P2",
                "status": "resolved",
                "affected_services": ["checkout-service"],
                "started_at": (now - timedelta(days=28)).isoformat(),
                "detected_at": (now - timedelta(days=28)).isoformat(),
                "resolved_at": (now - timedelta(days=28) + timedelta(minutes=12)).isoformat(),
                "root_cause": "Socket.io server limits exceeded due to incorrect ping interval configurations.",
                "root_cause_confidence": 0.90,
                "recommended_fix": "Increase socket limits in nginx configuration files. Set pingInterval to 25s, pingTimeout to 60s.",
                "impact_summary": "Active checkout sessions dropped for 54 web clients.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-I03E9281",
                "dynatrace_problem_id": "P-990192",
                "title": "Static assets loading block",
                "severity": "P3",
                "status": "resolved",
                "affected_services": ["shopstream"],
                "started_at": (now - timedelta(days=32)).isoformat(),
                "detected_at": (now - timedelta(days=32)).isoformat(),
                "resolved_at": (now - timedelta(days=32) + timedelta(minutes=9)).isoformat(),
                "root_cause": "CDN edge caching rules expired, forcing cache misses and direct loading of large images from origin bucket.",
                "root_cause_confidence": 0.89,
                "recommended_fix": "Invalidate CDN cache distribution and restore default Cache-Control: max-age=31536000 headers.",
                "impact_summary": "Homepage load latency rose by 2.4s.",
                "similar_past_incidents": [],
                "agent_steps": []
            },
            {
                "id": "INC-J14F0291",
                "dynatrace_problem_id": "P-100293",
                "title": "Inventory stock mismatches",
                "severity": "P2",
                "status": "resolved",
                "affected_services": ["product-service", "order-service"],
                "started_at": (now - timedelta(days=35)).isoformat(),
                "detected_at": (now - timedelta(days=35)).isoformat(),
                "resolved_at": (now - timedelta(days=35) + timedelta(minutes=16)).isoformat(),
                "root_cause": "Race condition in product stock write locks during high concurrent order checkout requests.",
                "root_cause_confidence": 0.92,
                "recommended_fix": "Introduce Redis-based distributed lock for check-and-set stock subtraction operations.",
                "impact_summary": "Sold out items allowed checkouts, causing 14 manual order refund workflows.",
                "similar_past_incidents": [],
                "agent_steps": []
            }
        ]

    async def seed_sample_incidents(self):
        try:
            count = await self.incidents.count_documents({})
            if count < 5:
                logger.info("MongoDB: Seeding sample incidents database...")
                sample_data = self._generate_past_incidents()
                await self.incidents.insert_many(sample_data)
                logger.info(f"MongoDB: Seeded {len(sample_data)} past incidents.")
        except Exception as e:
            logger.error(f"Failed to seed sample incidents to MongoDB: {e}")

    async def _seed_fallback_incidents(self):
        sample_data = self._generate_past_incidents()
        for inc in sample_data:
            self.fallback_incidents[inc["id"]] = inc

    async def store_incident(self, incident_data: dict) -> str:
        if self.use_fallback:
            self.fallback_incidents[incident_data["id"]] = incident_data
            return incident_data["id"]

        try:
            # Map 'id' to '_id' for mongo
            doc = {**incident_data, "_id": incident_data["id"]}
            await self.incidents.insert_one(doc)
            return incident_data["id"]
        except Exception as e:
            logger.error(f"Failed to store incident: {e}. Saving to fallback.")
            self.fallback_incidents[incident_data["id"]] = incident_data
            return incident_data["id"]

    async def update_incident(self, incident_id: str, updates: dict):
        if self.use_fallback:
            if incident_id in self.fallback_incidents:
                self.fallback_incidents[incident_id].update(updates)
            return

        try:
            await self.incidents.update_one({"_id": incident_id}, {"$set": updates})
        except Exception as e:
            logger.error(f"Failed to update incident: {e}")
            if incident_id in self.fallback_incidents:
                self.fallback_incidents[incident_id].update(updates)

    async def get_incident(self, incident_id: str) -> dict:
        if self.use_fallback:
            return self.fallback_incidents.get(incident_id)

        try:
            doc = await self.incidents.find_one({"_id": incident_id})
            if doc:
                doc["id"] = str(doc.pop("_id"))
                return doc
            return self.fallback_incidents.get(incident_id)
        except Exception as e:
            logger.error(f"Failed to get incident: {e}")
            return self.fallback_incidents.get(incident_id)

    async def get_all_incidents(self, limit: int = 50) -> list:
        if self.use_fallback:
            incidents_list = list(self.fallback_incidents.values())
            # Sort by started_at desc
            incidents_list.sort(key=lambda x: x.get("started_at", ""), reverse=True)
            return incidents_list[:limit]

        try:
            cursor = self.incidents.find({}).sort("started_at", -1).limit(limit)
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.pop("_id"))
                results.append(doc)
            return results
        except Exception as e:
            logger.error(f"Failed to retrieve incidents: {e}")
            # Fallback values
            incidents_list = list(self.fallback_incidents.values())
            incidents_list.sort(key=lambda x: x.get("started_at", ""), reverse=True)
            return incidents_list[:limit]

    async def find_similar_incidents(self, service_name: str, keywords: list) -> list:
        # Format similar incident records
        def format_similar(inc):
            # Calculate resolution minutes
            minutes = 15
            if inc.get("resolved_at") and inc.get("started_at"):
                try:
                    start = datetime.fromisoformat(inc["started_at"])
                    end = datetime.fromisoformat(inc["resolved_at"])
                    minutes = int((end - start).total_seconds() / 60)
                except:
                    pass
            return {
                "id": inc["id"],
                "title": inc["title"],
                "root_cause": inc.get("root_cause", ""),
                "recommended_fix": inc.get("recommended_fix", ""),
                "resolved_at": inc.get("resolved_at"),
                "resolution_time_minutes": minutes
            }

        if self.use_fallback:
            all_inc = list(self.fallback_incidents.values())
            matches = []
            for inc in all_inc:
                if inc.get("status") != "resolved":
                    continue
                # Match service or keywords
                is_svc_match = service_name in inc.get("affected_services", [])
                is_keyword_match = any(kw.lower() in inc.get("title", "").lower() or kw.lower() in inc.get("root_cause", "").lower() for kw in keywords)
                
                if is_svc_match or is_keyword_match:
                    matches.append(format_similar(inc))
            
            # Ensure we always return at least 2 records for the demo
            if len(matches) < 2:
                for inc in all_inc:
                    if inc.get("status") == "resolved" and format_similar(inc) not in matches:
                        matches.append(format_similar(inc))
                    if len(matches) >= 3:
                        break
            
            return matches[:3]

        try:
            # Query status resolved and matching conditions
            query = {
                "status": "resolved",
                "$or": [
                    {"affected_services": service_name},
                    {"title": {"$regex": "|".join(keywords), "$options": "i"}},
                    {"root_cause": {"$regex": "|".join(keywords), "$options": "i"}}
                ]
            }
            cursor = self.incidents.find(query).sort("started_at", -1).limit(3)
            results = []
            async for doc in cursor:
                doc["id"] = str(doc.pop("_id"))
                results.append(format_similar(doc))
            
            if len(results) < 2:
                # Add default resolved incidents to guarantee returns
                fallback_cursor = self.incidents.find({"status": "resolved"}).sort("started_at", -1).limit(3)
                fallback_results = []
                async for doc in fallback_cursor:
                    doc["id"] = str(doc.pop("_id"))
                    fallback_results.append(format_similar(doc))
                for f_res in fallback_results:
                    if f_res["id"] not in [r["id"] for r in results]:
                        results.append(f_res)
                    if len(results) >= 3:
                        break

            return results[:3]
        except Exception as e:
            logger.error(f"Failed to find similar incidents: {e}")
            # Memory fallback query
            return await self.find_similar_incidents(service_name, keywords)

    async def get_stats(self) -> dict:
        all_incidents = list(self.fallback_incidents.values()) if self.use_fallback else []
        
        if not self.use_fallback:
            try:
                cursor = self.incidents.find({})
                async for doc in cursor:
                    doc["id"] = str(doc.get("_id"))
                    all_incidents.append(doc)
            except Exception as e:
                logger.error(f"Stats DB read failed: {e}")
                all_incidents = list(self.fallback_incidents.values())

        total = len(all_incidents)
        by_severity = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
        resolved = 0
        total_res_minutes = 0
        services_counts = {}
        last_7_days_count = 0
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)

        for inc in all_incidents:
            sev = inc.get("severity", "P2")
            by_severity[sev] = by_severity.get(sev, 0) + 1

            if inc.get("status") in ["resolved", "resolved_with_remediation"]:
                resolved += 1
                try:
                    start = datetime.fromisoformat(inc["started_at"])
                    end = datetime.fromisoformat(inc["resolved_at"])
                    total_res_minutes += int((end - start).total_seconds() / 60)
                except:
                    total_res_minutes += 15 # default average
            
            # Service counts
            for svc in inc.get("affected_services", []):
                services_counts[svc] = services_counts.get(svc, 0) + 1
            
            # Last 7 days count
            try:
                started = datetime.fromisoformat(inc["started_at"])
                if started > seven_days_ago:
                    last_7_days_count += 1
            except:
                pass

        avg_res = int(total_res_minutes / resolved) if resolved > 0 else 15
        most_affected = max(services_counts, key=services_counts.get) if services_counts else "checkout-service"

        return {
            "total": total,
            "by_severity": by_severity,
            "resolved": resolved,
            "avg_resolution_minutes": avg_res,
            "most_affected_service": most_affected,
            "last_7_days": last_7_days_count
        }

    async def store_agent_session(self, session: dict) -> str:
        session_id = session.get("id") or f"sess-{int(datetime.utcnow().timestamp())}"
        session["id"] = session_id
        
        if self.use_fallback:
            self.fallback_sessions[session_id] = session
            return session_id

        try:
            doc = {**session, "_id": session_id}
            await self.agent_sessions.insert_one(doc)
            return session_id
        except Exception as e:
            logger.error(f"Failed to store agent session: {e}")
            self.fallback_sessions[session_id] = session
            return session_id
