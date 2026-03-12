import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/people", tags=["people"])

PEOPLE_FILE = Path(__file__).parent.parent.parent.parent / "data" / "people.json"

def _load() -> list:
    if not PEOPLE_FILE.exists():
        PEOPLE_FILE.parent.mkdir(parents=True, exist_ok=True)
        PEOPLE_FILE.write_text("[]")
    try:
        return json.loads(PEOPLE_FILE.read_text())
    except:
        return []

def _save(data: list):
    PEOPLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PEOPLE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

class Absence(BaseModel):
    id: Optional[str] = None
    type: str  # vacation | medical | exam | study | other
    start_date: str
    end_date: str
    notes: Optional[str] = ""

class PersonIn(BaseModel):
    id: Optional[str] = None
    name: str
    team: str       # Back | Datos
    role: str
    birthday: Optional[str] = None
    absences: Optional[list] = []

@router.get("/")
async def get_people(team: Optional[str] = None):
    people = _load()
    if team:
        people = [p for p in people if p.get("team","").lower() == team.lower()]
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
        people = [p for p in people if p.get("team","").lower() == team.lower()]

    result = []
    cur = date.fromisoformat(start)
    end_d = date.fromisoformat(end)

    while cur <= end_d:
        ds = cur.isoformat()
        unavailable = []
        for p in people:
            for ab in p.get("absences", []):
                if ab["start_date"] <= ds <= ab["end_date"]:
                    unavailable.append({"name": p["name"], "role": p["role"], "type": ab["type"]})
                    break
        result.append({
            "date": ds,
            "available": len(people) - len(unavailable),
            "total": len(people),
            "unavailable": unavailable,
        })
        cur += timedelta(days=1)
    return result


# ── Endpoint de stats por persona desde Jira ─────────────────────────────────

@router.get("/{person_id}/stats")
async def get_person_stats_endpoint(person_id: str, team: Optional[str] = None):
    """Stats de Jira para una persona: sprint activo + últimos 3 cerrados."""
    people = _load()
    person = next((p for p in people if p["id"] == person_id), None)
    if not person:
        raise HTTPException(404, "Person not found")

    jira_name = person.get("jira_name") or person.get("name")
    team_name = team or person.get("team", "")

    try:
        from app.core.jira_client import JiraClient
        from app.services.person_stats_service import get_person_stats
        client = JiraClient()
        return await get_person_stats(client, jira_name, team_name)
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
