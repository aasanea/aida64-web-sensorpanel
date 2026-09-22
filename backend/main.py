"""
FastAPI Backend Server for AIDA64 Glassmorphism 2.0 Dashboard.
Provides REST endpoints (/health, /api/sensors) and real-time WebSocket streaming (/ws).
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from core.config import settings
from services.weather_service import WeatherService
from services.sonar_service import SonarService
from services.matches_service import MatchesService
from api.routes import router, build_aggregated_sensor_data
from api.websocket import manager

# ---------------------------------------------------------
# Logger Configuration
# ---------------------------------------------------------
logger.remove()
if sys.stdout is not None:
    logger.add(
        sys.stdout,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    )
# Also log to file for headless / pythonw.exe execution
log_dir = Path(__file__).resolve().parent.parent / "logs"
log_dir.mkdir(parents=True, exist_ok=True)
logger.add(
    str(log_dir / "backend.log"),
    rotation="10 MB",
    retention="5 days",
    level=settings.log_level,
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
)

broadcast_task: Optional[asyncio.Task] = None

# ---------------------------------------------------------
# Background Streaming Worker
# ---------------------------------------------------------
async def stream_sensors_worker() -> None:
    """Background loop polling AIDA64 every poll_interval_ms and broadcasting to clients."""
    logger.info(f"Starting sensor broadcast worker (interval: {settings.poll_interval_ms}ms)")
    poll_sec = max(0.05, settings.poll_interval_ms / 1000.0)

    while True:
        try:
            if manager.count > 0:
                sensor_data = await asyncio.to_thread(build_aggregated_sensor_data, settings.fallback_registry)
                await manager.broadcast_json(sensor_data.model_dump())
            await asyncio.sleep(poll_sec)
        except asyncio.CancelledError:
            logger.info("Sensor streaming worker cancelled for shutdown.")
            break
        except Exception as e:
            logger.error(f"Error in sensor streaming loop: {e}")
            await asyncio.sleep(poll_sec)


# ---------------------------------------------------------
# Application Lifespan Handler
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and graceful shutdown."""
    global broadcast_task
    logger.info(
        f"Initializing AIDA64 Backend on {settings.host}:{settings.port} "
        f"(poll: {settings.poll_interval_ms}ms)"
    )
    weather_service = WeatherService.get_instance()
    await weather_service.start()
    sonar_service = SonarService.get_instance()
    await sonar_service.start()
    matches_service = MatchesService.get_instance()
    await matches_service.start()
    broadcast_task = asyncio.create_task(stream_sensors_worker())
    yield
    logger.info("Initiating graceful shutdown...")
    if broadcast_task:
        broadcast_task.cancel()
        try:
            await broadcast_task
        except asyncio.CancelledError:
            pass
    await weather_service.stop()
    await sonar_service.stop()
    await matches_service.stop()
    logger.info("Shutdown complete.")


# ---------------------------------------------------------
# FastAPI App Setup
# ---------------------------------------------------------
app = FastAPI(
    title="AIDA64 Glassmorphism Dashboard Backend",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8088", "http://localhost:8088"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# ---------------------------------------------------------
# WebSocket Telemetry Endpoint
# ---------------------------------------------------------
@app.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint streaming live sensor data every 500ms.
    Supports ping-pong heartbeat and disconnect cleanup.
    Server-side ping heartbeat interval reference: settings.ping_interval_s (default: 30s).
    """
    await manager.connect(websocket)
    logger.debug(
        f"Client connected to /ws. Heartbeat expected every {settings.ping_interval_s}s."
    )
    try:
        # Immediately push initial state upon connection
        initial_data = build_aggregated_sensor_data(fallback_registry=settings.fallback_registry)
        await websocket.send_json(initial_data.model_dump())

        while True:
            text = await websocket.receive_text()
            stripped = text.strip()
            if stripped.lower() == "ping":
                await websocket.send_text("pong")
            elif stripped.lower() == "pong":
                pass
            else:
                # Echo or ignore unexpected message
                logger.debug(f"Received WS message: {stripped}")
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket connection terminated: {e}")
        await manager.disconnect(websocket)


# ---------------------------------------------------------
# Static Frontend Serving
# ---------------------------------------------------------
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
frontend_dir.mkdir(parents=True, exist_ok=True)

# Mount frontend directory for SPA / Static assets
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level.lower(),
    )
