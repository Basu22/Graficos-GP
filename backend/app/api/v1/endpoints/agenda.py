from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
import json
import uuid

router = APIRouter(prefix="/agenda", tags=["agenda"])

from app.utils.storage import load_json, save_json

def _load() -> list:
    return load_json("agenda.json")

def _save(data: list):
    save_json("agenda.json", data)

class AgendaContact(BaseModel):
    id: Optional[str] = None
    nombre: str
    apellido: str
    jira_account_id: str  # Usaremos el nombre o ID que viene de Jira
    email: str
    tribu: Optional[str] = None
    celulas: Optional[list[str]] = []

@router.get("/")
async def get_agenda():
    return _load()

@router.post("/")
async def create_contact(contact: AgendaContact):
    agenda = _load()
    new_contact = contact.dict()
    new_contact["id"] = str(uuid.uuid4())
    agenda.append(new_contact)
    _save(agenda)
    return new_contact

@router.put("/{contact_id}")
async def update_contact(contact_id: str, contact: AgendaContact):
    agenda = _load()
    for i, c in enumerate(agenda):
        if c["id"] == contact_id:
            updated = contact.dict()
            updated["id"] = contact_id
            agenda[i] = updated
            _save(agenda)
            return updated
    raise HTTPException(404, "Contact not found")

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    agenda = _load()
    agenda = [c for c in agenda if c["id"] != contact_id]
    _save(agenda)
    return {"deleted": contact_id}

@router.post("/sync-jira")
async def sync_with_jira():
    from app.core.jira_client import JiraClient
    from app.core.config import get_settings
    
    client = JiraClient()
    settings = get_settings()
    jira_users = await client.get_all_project_users(settings.jira_project_key)
    
    agenda = _load()
    
    # Mapeo rápido de contactos existentes por su ID de Jira
    existing_map = {c["jira_account_id"]: c for c in agenda}
    
    changes = {"added": 0, "updated": 0}
    
    for ju in jira_users:
        # En Jira Server puede venir 'name', en Cloud 'accountId'. Como fallback, usamos displayName.
        identifier = ju.get("accountId") or ju.get("name") or ju.get("displayName")
        display_name = ju.get("displayName", "")
        email = ju.get("emailAddress", "")
        
        # Intento básico de separar nombre y apellido
        parts = display_name.split(" ", 1)
        nombre = parts[0] if parts else ""
        apellido = parts[1] if len(parts) > 1 else ""
        
        if identifier in existing_map:
            c = existing_map[identifier]
            # Si el usuario ya existe, actualizamos sus datos básicos pero RESPETAMOS Tribu y Célula
            if c["nombre"] != nombre or c["apellido"] != apellido or c["email"] != email:
                c["nombre"] = nombre
                c["apellido"] = apellido
                c["email"] = email
                changes["updated"] += 1
        else:
            # Si no existe, lo creamos de cero
            new_contact = {
                "id": str(uuid.uuid4()),
                "nombre": nombre,
                "apellido": apellido,
                "jira_account_id": identifier,
                "email": email,
                "tribu": "",
                "celulas": []
            }
            agenda.append(new_contact)
            existing_map[identifier] = new_contact
            changes["added"] += 1
            
    _save(agenda)
    return {"status": "ok", "changes": changes, "total_users": len(agenda)}
