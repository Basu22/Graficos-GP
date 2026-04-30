from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/config", tags=["config"])

CONFIG_FILE = Path(__file__).parent.parent.parent.parent / "data" / "config.json"

DEFAULT_EVENT_TYPES = {
    "vacation":      { "label": "Vacaciones",         "color": "#22C55E", "icon": "🏖️" },
    "medical":       { "label": "Licencia Médica",    "color": "#EF4444", "icon": "🏥" },
    "exam":          { "label": "Licencia Examen",    "color": "#8B5CF6", "icon": "📝" },
    "study":         { "label": "Licencia Estudio",   "color": "#06B6D4", "icon": "📚" },
    "birthday":      { "label": "Cumpleaños",         "color": "#EC4899", "icon": "🎂" },
    "manual_sprint": { "label": "Sprint Manual",      "color": "#3B82F6", "icon": "🚀" },
    "custom":        { "label": "Otro",              "color": "#64748B", "icon": "📌" },
    "holiday":       { "label": "Feriado Nacional",   "color": "#F97316", "icon": "🇦🇷" },
    "sprint":        { "label": "Sprint Jira",        "color": "#3B82F6", "icon": "⚡" }
}

def _load():
    if not CONFIG_FILE.exists():
        default = {
            "roles": [
                "Developer", "Tech Lead", "Scrum Master", "QA", 
                "Data Engineer", "Data Analyst", "Product Owner", 
                "DevOps", "Analista Funcional", "Otro"
            ],
            "event_types": DEFAULT_EVENT_TYPES
        }
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(default, ensure_ascii=False, indent=2))
    
    try:
        data = json.loads(CONFIG_FILE.read_text())
        # Asegurar que existan los campos
        if "roles" not in data: data["roles"] = []
        if "event_types" not in data: data["event_types"] = DEFAULT_EVENT_TYPES
        return data
    except:
        return {"roles": [], "event_types": DEFAULT_EVENT_TYPES}

def _save(data):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

class RolesUpdate(BaseModel):
    roles: List[str]

class EventTypesUpdate(BaseModel):
    event_types: dict

@router.get("/roles")
async def get_roles():
    return _load().get("roles", [])

@router.post("/roles")
async def update_roles(update: RolesUpdate):
    config = _load()
    config["roles"] = update.roles
    _save(config)
    return config["roles"]

@router.get("/event-types")
async def get_event_types():
    return _load().get("event_types", DEFAULT_EVENT_TYPES)

@router.post("/event-types")
async def update_event_types(update: EventTypesUpdate):
    config = _load()
    config["event_types"] = update.event_types
    _save(config)
    return config["event_types"]
