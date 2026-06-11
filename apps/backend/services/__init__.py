from .dynatrace import DynatraceService
from .gitlab_service import GitLabService
from .mongodb_service import MongoDBService
from .arize_service import ArizeService
from .agent_service import AgentService

# Create singletons
dynatrace_service = DynatraceService()
gitlab_service = GitLabService()
mongodb_service = MongoDBService()
arize_service = ArizeService()
agent_service = AgentService(
    dynatrace=dynatrace_service,
    gitlab=gitlab_service,
    mongodb=mongodb_service,
    arize=arize_service
)
