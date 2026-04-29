from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/config", tags=["config"])

CONFIG_FILE = Path(__file__).parent.parent.parent.parent / "data" / "config.json"

def _load():
    if not CONFIG_FILE.exists():
        default = {
            "roles": [
                "Developer", "Tech Lead", "Scrum Master", "QA", 
                "Data Engineer", "Data Analyst", "Product Owner", 
                "DevOps", "Analista Funcional", "Otro"
            ]
        }
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(default, ensure_ascii=False, indent=2))
    try:
        return json.loads(CONFIG_FILE.read_text())
    except:
        return {"roles": []}

def _save(data):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

class RolesUpdate(BaseModel):
    roles: List[str]

@router.get("/roles")
async def get_roles():
    return _load().get("roles", [])

@router.post("/roles")
async def update_roles(update: RolesUpdate):
    config = _load()
    config["roles"] = update.roles
    _save(config)
    return config["roles"]
