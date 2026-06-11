import logging
import os
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("aegis-backend")

from services import mongodb_service
from routers import websocket, incidents, webhook

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB and seed initial historical incidents
    logger.info("Starting up AEGIS Backend...")
    try:
        await mongodb_service.initialize()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database during startup: {e}")
    yield
    # Shutdown
    logger.info("Shutting down AEGIS Backend...")

app = FastAPI(
    title="AEGIS Backend",
    description="Autonomous Cloud Incident Response Agent Backend Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend application
frontend_url = os.getenv("FRONTEND_URL", "*")
origins = [
    "http://localhost:5173",  # Local Vite dev server
    "http://localhost:3000",
    "http://localhost:8080",
]
if frontend_url and frontend_url != "*":
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if frontend_url == "*" else origins,
    allow_credentials=True if frontend_url != "*" else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(websocket.router)
app.include_router(incidents.router)
app.include_router(webhook.router)

@app.get("/")
def read_root():
    return {
        "name": "AEGIS",
        "description": "Autonomous Cloud Incident Response Agent",
        "version": "1.0.0",
        "status": "online",
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected" if not mongodb_service.use_fallback else "fallback-memory",
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    logger.info(f"Running FastAPI on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
