import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
import httpx

router = APIRouter(prefix="/calendar", tags=["calendar"])

from app.utils.storage import load_json, save_json

def _load_events() -> list:
    return load_json("calendar_events.json")

def _save_events(events: list):
    save_json("calendar_events.json", events)


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
    impact: Optional[float] = 0.0   # Impacto en capacidad (0.0 a 1.0)


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
    """Devuelve una lista vacía para ignorar Jira y usar solo sprints manuales."""
    return []


# Endpoints de personas movidos a people.py
