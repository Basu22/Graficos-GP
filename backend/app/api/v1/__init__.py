from fastapi import APIRouter
from app.api.v1.endpoints import sprints, metrics, active_sprint, calendar_events, people, midia

api_router = APIRouter()
api_router.include_router(sprints.router)
api_router.include_router(metrics.router)
api_router.include_router(active_sprint.router)
api_router.include_router(calendar_events.router)
api_router.include_router(people.router)
api_router.include_router(midia.router)
