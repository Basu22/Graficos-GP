import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
import httpx

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Archivo JSON para persistir eventos
EVENTS_FILE = Path(__file__).parent.parent.parent.parent / "data" / "calendar_events.json"


def _load_events() -> list:
    if not EVENTS_FILE.exists():
        EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        EVENTS_FILE.write_text("[]")
    try:
        return json.loads(EVENTS_FILE.read_text())
    except Exception:
        return []


def _save_events(events: list):
    EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    EVENTS_FILE.write_text(json.dumps(events, ensure_ascii=False, indent=2))


class EventIn(BaseModel):
    id: Optional[str] = None
    title: str
    start_date: str          # YYYY-MM-DD
    end_date: Optional[str] = None  # YYYY-MM-DD
    type: str                # birthday | vacation | medical | exam | study | custom | sprint_start | sprint_end | holiday
    person: Optional[str] = None
    team: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None


@router.get("/events")
async def get_events(year: int, month: Optional[int] = None, team: Optional[str] = None):
    events = _load_events()

    # Filtrar por año y opcionalmente mes
    filtered = []
    for e in events:
        try:
            start = date.fromisoformat(e["start_date"])
            end_str = e.get("end_date") or e["start_date"]
            end = date.fromisoformat(end_str)
            # Incluir si cae en el año/mes solicitado
            if end.year < year or start.year > year:
                continue
            if month:
                if end.month < month and end.year == year:
                    continue
                if start.month > month and start.year == year:
                    continue
            if team and e.get("team") and e["team"] != team:
                continue
            filtered.append(e)
        except Exception:
            continue

    return filtered


@router.post("/events")
async def create_event(event: EventIn):
    events = _load_events()
    import uuid
    new_event = event.dict()
    new_event["id"] = str(uuid.uuid4())
    events.append(new_event)
    _save_events(events)
    return new_event


@router.put("/events/{event_id}")
async def update_event(event_id: str, event: EventIn):
    events = _load_events()
    for i, e in enumerate(events):
        if e["id"] == event_id:
            updated = event.dict()
            updated["id"] = event_id
            events[i] = updated
            _save_events(events)
            return updated
    raise HTTPException(status_code=404, detail="Event not found")


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    events = _load_events()
    events = [e for e in events if e["id"] != event_id]
    _save_events(events)
    return {"deleted": event_id}


# Cache de feriados en memoria
_holidays_cache: dict = {}

@router.get("/holidays/{year}")
async def get_holidays(year: int):
    """Feriados nacionales AR desde nolaborables.com.ar con cache"""
    global _holidays_cache
    if year in _holidays_cache:
        return _holidays_cache[year]

    holidays = []
    try:
        async with httpx.AsyncClient(timeout=8, verify=False) as client:
            resp = await client.get(
                f"https://nolaborables.com.ar/api/v2/feriados/{year}",
                headers={"Accept": "application/json", "User-Agent": "AgilityDashboard/1.0"}
            )
            if resp.status_code == 200:
                for h in resp.json():
                    try:
                        d = date(year, int(h["mes"]), int(h["dia"]))
                        holidays.append({
                            "id": f"holiday-{d.isoformat()}",
                            "title": h.get("nombre", "Feriado"),
                            "start_date": d.isoformat(),
                            "end_date": d.isoformat(),
                            "type": "holiday",
                            "color": "#F97316",
                        })
                    except Exception:
                        pass
    except Exception as e:
        # Fallback: feriados fijos inamovibles de Argentina
        fixed = [
            (1, 1, "Año Nuevo"), (3, 24, "Día de la Memoria"), (4, 2, "Día del Veterano"),
            (5, 1, "Día del Trabajador"), (5, 25, "Revolución de Mayo"), (6, 20, "Paso a la Inmortalidad de Belgrano"),
            (7, 9, "Día de la Independencia"), (12, 8, "Inmaculada Concepción"), (12, 25, "Navidad"),
        ]
        for mes, dia, nombre in fixed:
            try:
                d = date(year, mes, dia)
                holidays.append({
                    "id": f"holiday-{d.isoformat()}",
                    "title": nombre,
                    "start_date": d.isoformat(),
                    "end_date": d.isoformat(),
                    "type": "holiday",
                    "color": "#F97316",
                })
            except Exception:
                pass

    if holidays:
        _holidays_cache[year] = holidays
    return holidays


@router.get("/sprints-for-calendar")
async def get_sprints_for_calendar(year: int, team: Optional[str] = None):
    """Devuelve sprints del año como eventos de calendario"""
    from app.core.jira_client import JiraClient
    from app.core.config import get_settings
    settings = get_settings()
    client = JiraClient()
    try:
        board_id = await client.get_board_id()
        sprints = await client.get_sprints(board_id, state="closed,active,future", team=team)
        events = []
        from dateutil import parser as dp
        for s in sprints:
            try:
                start = dp.parse(s["startDate"]).date()
                end = dp.parse(s.get("completeDate") or s.get("endDate")).date()
                if start.year != year and end.year != year:
                    continue
                events.append({
                    "id": f"sprint-{s['id']}",
                    "title": s["name"],
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                    "type": "sprint",
                    "color": "#3B82F6",
                    "state": s.get("state", "closed"),
                })
            except Exception:
                pass
        return events
    except Exception:
        return []


# ── Endpoints de personas y disponibilidad desde Confluence ──────────────────

@router.get("/team-people")
async def get_team_people_endpoint(team: Optional[str] = None):
    """Personas del equipo desde Confluence con vacaciones y cumpleaños."""
    from app.services.confluence_service import get_team_people
    people = await get_team_people()
    if team:
        people = [p for p in people if team.lower() in p.get("team","").lower()]
    return people


@router.get("/availability")
async def get_availability(date: str, team: Optional[str] = None):
    """Disponibilidad del equipo para una fecha dada (YYYY-MM-DD)."""
    from app.services.confluence_service import get_availability_by_date
    return await get_availability_by_date(date, team)


@router.get("/availability-range")
async def get_availability_range(start: str, end: str, team: Optional[str] = None):
    """Disponibilidad día a día entre dos fechas."""
    from app.services.confluence_service import get_team_people
    from datetime import date as date_type, timedelta

    people = await get_team_people()
    if team:
        people = [p for p in people if team.lower() in p.get("team","").lower()]

    result = []
    cur = date_type.fromisoformat(start)
    end_d = date_type.fromisoformat(end)

    while cur <= end_d:
        ds = cur.isoformat()
        unavailable = [
            p["name"] for p in people
            if any(v["start"] <= ds <= v["end"] for v in p["vacations"])
        ]
        result.append({
            "date": ds,
            "available": len(people) - len(unavailable),
            "total": len(people),
            "unavailable_names": unavailable,
        })
        cur += timedelta(days=1)

    return result
