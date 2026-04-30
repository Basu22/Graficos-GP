import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/people", tags=["people"])

from app.utils.storage import load_json, save_json

def _load() -> list:
    return load_json("people.json")

def _save(data: list):
    save_json("people.json", data)

class Absence(BaseModel):
    id: Optional[str] = None
    type: str  # vacation | medical | exam | study | other
    start_date: str
    end_date: str
    notes: Optional[str] = ""

class PersonIn(BaseModel):
    id: Optional[str] = None
    name: str
    teams: list[str]       # ["Back", "Datos"]
    capacity_by_team: dict # {"Back": 0.7, "Datos": 0.3}
    role: str
    birthday: Optional[str] = None
    absences: Optional[list] = []
    jira_name: Optional[str] = None

@router.get("/")
async def get_people(team: Optional[str] = None):
    people = _load()
    if team:
        people = [p for p in people if team.lower() in [t.lower() for t in p.get("teams", [])]]
    return people

@router.post("/")
async def create_person(person: PersonIn):
    people = _load()
    new = person.dict()
    new["id"] = str(uuid.uuid4())
    new["absences"] = new.get("absences") or []
    people.append(new)
    _save(people)
    return new

@router.put("/{person_id}")
async def update_person(person_id: str, person: PersonIn):
    people = _load()
    for i, p in enumerate(people):
        if p["id"] == person_id:
            updated = person.dict()
            updated["id"] = person_id
            people[i] = updated
            _save(people)
            return updated
    raise HTTPException(404, "Person not found")

@router.delete("/{person_id}")
async def delete_person(person_id: str):
    people = _load()
    people = [p for p in people if p["id"] != person_id]
    _save(people)
    return {"deleted": person_id}

@router.post("/{person_id}/absences")
async def add_absence(person_id: str, absence: Absence):
    people = _load()
    for p in people:
        if p["id"] == person_id:
            ab = absence.dict()
            ab["id"] = str(uuid.uuid4())
            p.setdefault("absences", []).append(ab)
            _save(people)
            return ab
    raise HTTPException(404, "Person not found")

@router.delete("/{person_id}/absences/{absence_id}")
async def delete_absence(person_id: str, absence_id: str):
    people = _load()
    for p in people:
        if p["id"] == person_id:
            p["absences"] = [a for a in p.get("absences", []) if a["id"] != absence_id]
            _save(people)
            return {"deleted": absence_id}
    raise HTTPException(404, "Person not found")

@router.get("/availability")
async def get_availability(start: str, end: str, team: Optional[str] = None):
    """Disponibilidad día a día entre dos fechas."""
    from datetime import date, timedelta
    people = _load()
    if team:
        # Filtrar personas que pertenecen al equipo solicitado
        people = [p for p in people if team.lower() in [t.lower() for t in p.get("teams", [])]]

    result = []
    cur = date.fromisoformat(start)
    end_d = date.fromisoformat(end)

    events = load_json("calendar_events.json")

    while cur <= end_d:
        ds = cur.isoformat()
        
        # Calcular impacto de eventos generales del calendario y separar los personales
        day_event_impact = 0.0
        person_events = []
        for e in events:
            # Si el evento coincide con la fecha
            if e.get("start_date") <= ds <= (e.get("end_date") or e.get("start_date")):
                if e.get("person"):
                    # Es un evento asignado a un colaborador específico
                    person_events.append(e)
                elif not e.get("team") or (team and e.get("team").lower() == team.lower()):
                    # Es un evento global o de equipo
                    day_event_impact += e.get("impact") or 0.0

        unavailable_count = 0.0
        unavailable_details = []
        
        present_names = []
        absent_names = []
        
        total_capacity = 0.0
        for p in people:
            # Si se filtró por equipo, sumamos solo la capacidad asignada a ese equipo
            p_cap = 1.0
            if team:
                # Buscamos la capacidad específica en el dict (case insensitive)
                teams_dict = {t.lower(): v for t, v in p.get("capacity_by_team", {}).items()}
                p_cap = teams_dict.get(team.lower(), 1.0)
            
            total_capacity += p_cap
            
            is_absent = False
            
            # 1. Revisar ausencias fijas (people.json)
            for ab in p.get("absences", []):
                if ab["start_date"] <= ds <= ab["end_date"]:
                    unavailable_count += p_cap
                    unavailable_details.append({"name": p["name"], "role": p["role"], "type": ab["type"]})
                    absent_names.append(p["name"])
                    is_absent = True
                    break
            
            # 2. Revisar eventos dinámicos asignados a la persona (calendar_events.json)
            if not is_absent:
                for pe in person_events:
                    if pe.get("person") == p["name"]:
                        impact = float(pe.get("impact") or 0.0)
                        if impact > 0:
                            unavailable_count += (p_cap * impact)
                            # Lo agregamos con un flag para que el frontend no lo duplique visualmente en la grilla
                            unavailable_details.append({"name": p["name"], "role": p["role"], "type": pe.get("type"), "is_dynamic": True})
                            if impact >= 1.0:
                                absent_names.append(p["name"])
                                is_absent = True
                                break
            
            if not is_absent:
                present_names.append(p["name"])
                    
        result.append({
            "date": ds,
            "available": max(0.0, round(total_capacity - unavailable_count - (total_capacity * day_event_impact), 2)),
            "total": round(total_capacity, 2),
            "unavailable": unavailable_details,
            "present": present_names,
            "absent": absent_names,
            "event_impact": round(day_event_impact, 2)
        })
        cur += timedelta(days=1)
    return result


# ── Endpoint de stats por persona desde Jira ─────────────────────────────────

@router.get("/{person_id}/stats")
async def get_person_stats_endpoint(
    person_id: str,
    team: Optional[str] = None,
    last_n: Optional[int] = None,
    quarter: Optional[int] = None,
    year: Optional[int] = None,
):
    """Stats de Jira para una persona: sprint activo + historial según período."""
    people = _load()
    person = next((p for p in people if p["id"] == person_id), None)
    if not person:
        raise HTTPException(404, "Person not found")

    jira_name = person.get("jira_name") or person.get("name")
    
    # Si no se pasa team, tomamos el primero de la lista
    team_name = team
    if not team_name:
        teams = person.get("teams", [])
        team_name = teams[0] if teams else ""

    try:
        from app.core.jira_client import JiraClient
        from app.services.person_stats_service import get_person_stats
        client = JiraClient()
        return await get_person_stats(client, jira_name, team_name, last_n=last_n, quarter=quarter, year=year)
    except Exception as e:
        raise HTTPException(500, f"Error fetching Jira stats: {str(e)}")


@router.get("/jira-users")
async def get_jira_users(team: Optional[str] = None):
    """Lista assignees únicos del sprint activo para mapear con personas."""
    try:
        from app.core.jira_client import JiraClient
        client = JiraClient()
        board_id = await client.get_board_id()
        sprints = await client.get_sprints(board_id, state="active", team=team)
        if not sprints:
            return []
        issues = await client.get_issues_for_sprint(sprints[0]["id"])
        users = {}
        for i in issues:
            a = i["fields"].get("assignee")
            if a:
                users[a["displayName"]] = {
                    "displayName": a["displayName"],
                    "accountId":   a.get("accountId",""),
                    "avatar":      a.get("avatarUrls",{}).get("48x48",""),
                }
        return list(users.values())
    except Exception as e:
        raise HTTPException(500, str(e))
