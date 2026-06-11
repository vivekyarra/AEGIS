import httpx
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("gitlab-service")

class GitLabService:
    def __init__(self):
        self.base_url = os.getenv("GITLAB_URL", "https://gitlab.com").rstrip("/")
        self.token = os.getenv("GITLAB_TOKEN", "")
        self.project_id = os.getenv("GITLAB_PROJECT_ID", "")
        self.headers = {"PRIVATE-TOKEN": self.token}
        self.is_configured = bool(self.token and "REPLACE_ME" not in self.token and self.project_id and "REPLACE_ME" not in self.project_id)
        if not self.is_configured:
            logger.warning("GitLab credentials not fully configured. Running in demo fallback mode.")

    def _get_mock_commits(self) -> list:
        now = datetime.utcnow()
        return [
            {
                "id": "e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5",
                "short_id": "e4d3c2b1",
                "title": "Refactor database connection pooling in checkout-service",
                "message": "Refactor database connection pooling in checkout-service\n\nIncreased max connections to 50 but reduced checkout connection pool timeout to 100ms. Ref: ticket #8102.",
                "author_name": "Devin Adams",
                "author_email": "devin.adams@shopstream.com",
                "created_at": (now - timedelta(minutes=8)).isoformat(),
                "web_url": "https://gitlab.com/shopstream/checkout-service/-/commit/e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5"
            },
            {
                "id": "b8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9",
                "short_id": "b8f7e6d5",
                "title": "Fix null pointer in payment validation logic",
                "message": "Fix null pointer in payment validation logic\n\nEnsure payment_method is present before verifying bank routing tags.",
                "author_name": "Sarah Chen",
                "author_email": "sarah.chen@shopstream.com",
                "created_at": (now - timedelta(minutes=45)).isoformat(),
                "web_url": "https://gitlab.com/shopstream/payment-service/-/commit/b8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9"
            },
            {
                "id": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
                "short_id": "a1b2c3d4",
                "title": "Add product recommendation slider on landing page",
                "message": "Add product recommendation slider on landing page\n\nFetches recommended items asynchronously via product-service.",
                "author_name": "Marcus Aurelius",
                "author_email": "marcus.aurelius@shopstream.com",
                "created_at": (now - timedelta(hours=1, minutes=30)).isoformat(),
                "web_url": "https://gitlab.com/shopstream/frontend-ui/-/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
            },
            {
                "id": "f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6",
                "short_id": "f5e4d3c2",
                "title": "Update order validation schemas and constraints",
                "message": "Update order validation schemas and constraints\n\nValidated product stock values check in strict bounds.",
                "author_name": "Emma Watson",
                "author_email": "emma.watson@shopstream.com",
                "created_at": (now - timedelta(hours=2)).isoformat(),
                "web_url": "https://gitlab.com/shopstream/order-service/-/commit/f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6"
            },
            {
                "id": "c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0",
                "short_id": "c9b8a7f6",
                "title": "Update checkout flow timeout settings to 15s",
                "message": "Update checkout flow timeout settings to 15s\n\nPrevent premature cancellation on checkout orders during peak traffic.",
                "author_name": "Devin Adams",
                "author_email": "devin.adams@shopstream.com",
                "created_at": (now - timedelta(hours=2, minutes=45)).isoformat(),
                "web_url": "https://gitlab.com/shopstream/checkout-service/-/commit/c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0"
            }
        ]

    async def get_recent_commits(self, hours_back: int = 3) -> list:
        if not self.is_configured:
            return self._get_mock_commits()

        try:
            since_time = (datetime.utcnow() - timedelta(hours=hours_back)).isoformat()
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v4/projects/{self.project_id}/repository/commits"
                params = {"since": since_time}
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    commits = response.json()
                    return [
                        {
                            "id": c.get("id"),
                            "short_id": c.get("short_id"),
                            "title": c.get("title"),
                            "message": c.get("message"),
                            "author_name": c.get("author_name"),
                            "author_email": c.get("author_email"),
                            "created_at": c.get("created_at"),
                            "web_url": c.get("web_url")
                        }
                        for c in commits
                    ]
                logger.error(f"GitLab commits API error {response.status_code}: {response.text}")
                return self._get_mock_commits()
        except Exception as e:
            logger.error(f"GitLab API request failed: {e}")
            return self._get_mock_commits()

    async def get_commits_before_time(self, timestamp_iso: str, window_minutes: int = 15) -> list:
        if not self.is_configured:
            # Match the commit closest to the timestamp
            # In our mock data, Devin Adams' commit (e4d3c2b1) happens 8 mins before the incident
            return [self._get_mock_commits()[0]]

        try:
            # Parse timestamp and establish range
            dt = datetime.fromisoformat(timestamp_iso.replace('Z', '+00:00'))
            since_dt = dt - timedelta(minutes=window_minutes)
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v4/projects/{self.project_id}/repository/commits"
                params = {
                    "since": since_dt.isoformat(),
                    "until": timestamp_iso
                }
                response = await client.get(url, headers=self.headers, params=params)
                if response.status_code == 200:
                    commits = response.json()
                    if commits:
                        return [
                            {
                                "id": c.get("id"),
                                "short_id": c.get("short_id"),
                                "title": c.get("title"),
                                "message": c.get("message"),
                                "author_name": c.get("author_name"),
                                "author_email": c.get("author_email"),
                                "created_at": c.get("created_at"),
                                "web_url": c.get("web_url")
                            }
                            for c in commits
                        ]
                
                # Fallback: get the single most recent commit
                params_fallback = {"per_page": 1}
                res_fallback = await client.get(url, headers=self.headers, params=params_fallback)
                if res_fallback.status_code == 200 and res_fallback.json():
                    c = res_fallback.json()[0]
                    return [{
                        "id": c.get("id"),
                        "short_id": c.get("short_id"),
                        "title": c.get("title"),
                        "message": c.get("message"),
                        "author_name": c.get("author_name"),
                        "author_email": c.get("author_email"),
                        "created_at": c.get("created_at"),
                        "web_url": c.get("web_url")
                    }]
                return [self._get_mock_commits()[0]]
        except Exception as e:
            logger.error(f"GitLab API query before time failed: {e}")
            return [self._get_mock_commits()[0]]

    async def create_issue(self, title: str, description: str, labels: list = None) -> dict:
        if not self.is_configured:
            # Mock success response
            import random
            iid = random.randint(100, 999)
            return {
                "id": random.randint(10000, 99999),
                "iid": iid,
                "web_url": f"https://gitlab.com/shopstream/checkout-service/-/issues/{iid}",
                "title": title
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v4/projects/{self.project_id}/issues"
                body = {
                    "title": title,
                    "description": description,
                    "labels": ",".join(labels or ["incident", "aegis", "automated"])
                }
                response = await client.post(url, headers=self.headers, json=body)
                if response.status_code == 201:
                    res = response.json()
                    return {
                        "id": res.get("id"),
                        "iid": res.get("iid"),
                        "web_url": res.get("web_url"),
                        "title": res.get("title")
                    }
                logger.error(f"Failed to create GitLab issue: {response.text}")
                return {"id": 0, "iid": 0, "web_url": "#", "title": title}
        except Exception as e:
            logger.error(f"GitLab create issue failed: {e}")
            return {"id": 0, "iid": 0, "web_url": "#", "title": title}

    async def get_commit_diff(self, commit_sha: str) -> dict:
        if not self.is_configured:
            # Mock diff summaries
            if commit_sha == "e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5" or commit_sha == "e4d3c2b1":
                return {
                    "files_changed": ["services/checkout-service/config.json", "services/checkout-service/pool.js"],
                    "additions": 14,
                    "deletions": 3,
                    "diffs": [
                        {
                            "new_path": "services/checkout-service/pool.js",
                            "diff": "@@ -12,4 +12,14 @@\n-  connectionTimeout: 5000,\n-  maxConnections: 10\n+  connectionTimeout: 100,\n+  maxConnections: 50"
                        }
                    ]
                }
            return {
                "files_changed": ["config.json"],
                "additions": 2,
                "deletions": 2,
                "diffs": []
            }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"{self.base_url}/api/v4/projects/{self.project_id}/repository/commits/{commit_sha}/diff"
                response = await client.get(url, headers=self.headers)
                if response.status_code == 200:
                    diffs = response.json()
                    files = [d.get("new_path") for d in diffs]
                    # Estimate additions and deletions
                    additions = 0
                    deletions = 0
                    for d in diffs:
                        diff_text = d.get("diff", "")
                        additions += diff_text.count("\n+")
                        deletions += diff_text.count("\n-")
                    return {
                        "files_changed": files,
                        "additions": additions,
                        "deletions": deletions,
                        "diffs": diffs[:3] # Return top 3 diff details
                    }
                return {"files_changed": [], "additions": 0, "deletions": 0, "diffs": []}
        except Exception as e:
            logger.error(f"GitLab commit diff failed: {e}")
            return {"files_changed": [], "additions": 0, "deletions": 0, "diffs": []}

    async def seed_fake_commits(self):
        # Creates 10 fake commits in the GitLab repo via API (if configured)
        if not self.is_configured:
            logger.info("Mock GitLab Seeding: commits database pre-loaded locally.")
            return

        logger.info("Seeding commits to GitLab repository...")
        services = ["payment-service", "checkout-service", "db-service", "product-service", "order-service"]
        commit_messages = [
            "Fix null pointer in payment validation logic",
            "Update checkout flow timeout settings to 15s",
            "Refactor database connection pooling in checkout-service",
            "Add product recommendation slider on landing page",
            "Update order validation schemas and constraints"
        ]
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for i, msg in enumerate(commit_messages):
                    svc = services[i % len(services)]
                    url = f"{self.base_url}/api/v4/projects/{self.project_id}/repository/commits"
                    body = {
                        "branch": "main",
                        "commit_message": msg,
                        "actions": [
                            {
                                "action": "update" if i < 2 else "create",
                                "file_path": f"services/{svc}/config.json",
                                "content": f'{{"service": "{svc}", "version": "1.0.{i}", "updated_at": "{datetime.utcnow().isoformat()}"}}'
                            }
                        ]
                    }
                    response = await client.post(url, headers=self.headers, json=body)
                    if response.status_code == 201:
                        logger.info(f"Seeded commit: {msg}")
                    else:
                        logger.warning(f"Failed to seed commit: {response.text}")
        except Exception as e:
            logger.error(f"GitLab seeding failed: {e}")
