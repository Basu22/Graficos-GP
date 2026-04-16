from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from app.core.jira_client import JiraClient, get_jira_client
from app.schemas.metrics import (
    VelocityResponse, PredictabilityResponse, LeadTimeResponse,
    ScopeChangeResponse, CarryOverResponse, ExecutiveReport,
)
from app.services.velocity_service import get_velocity
from app.services.predictability_service import get_predictability
from app.services.lead_time_service import get_lead_time
from app.services.scope_service import get_scope_change
from app.services.carry_over_service import get_carry_over
from app.services.executive_service import get_executive_report
from dateutil import parser as dateparser

router = APIRouter(prefix="/metrics", tags=["metrics"])

QUARTER_MONTHS = {
    1: (1, 3), 2: (4, 6), 3: (7, 9), 4: (10, 12)
}


def _sprint_closed_in_quarter(sprint: dict, q: int, year: int) -> bool:
    """Devuelve True si el sprint cerró dentro del quarter dado."""
    close_str = sprint.get("completeDate") or sprint.get("endDate")
    if not close_str:
        return False
    try:
        close = dateparser.parse(close_str)
        start_month, end_month = QUARTER_MONTHS[q]
        return close.year == year and start_month <= close.month <= end_month
    except Exception:
        return False


import asyncio

async def _resolve_sprints(
    client: JiraClient,
    sprint_ids: list[int] | None,
    last_n: int | None,
    team: str | None,
    quarter: int | None,
    year: int | None,
):
    board_id = await client.get_board_id()
    sprints = await client.get_sprints(board_id, state="closed", team=team)
    sprints_sorted = sorted(sprints, key=lambda s: s.get("startDate", ""))

    if sprint_ids:
        filtered = [s for s in sprints_sorted if s["id"] in sprint_ids]
    elif quarter and year:
        filtered = [s for s in sprints_sorted if _sprint_closed_in_quarter(s, quarter, year)]
    else:
        n = last_n or 3
        filtered = sprints_sorted[-n:]

    ids = [s["id"] for s in filtered]

    # Pre-carga e Hidratación Híbrida de Velocity
    velocity_chart = await client.get_velocity_chart(board_id)
    
    def get_sum_value(stat_dict):
        if not stat_dict: return 0.0
        # Estos sumadores globales vienen directamente con "value" (ej: {'value': 25.0, 'text': '25.0'})
        try: return float(stat_dict.get("value", 0) or 0)
        except (ValueError, TypeError): return 0.0

    async def hydrate_sprint(sprint):
        sprint_str_id = str(sprint["id"])
        
        if sprint_str_id in velocity_chart:
            v_data = velocity_chart[sprint_str_id]
            sprint["committed"] = float(v_data.get("estimated", {}).get("value", 0) or 0)
            sprint["delivered"] = float(v_data.get("completed", {}).get("value", 0) or 0)
        else:
            # Rescate histórico para Sprints que Jira expulsó del gráfico de velocidad
            try:
                rep = await client.get_sprint_report(board_id, sprint["id"])
                contents = rep.get("contents", {})
                sprint["committed"] = get_sum_value(contents.get("allIssuesEstimateSum"))
                sprint["delivered"] = get_sum_value(contents.get("completedIssuesEstimateSum"))
            except Exception:
                sprint["committed"] = 0.0
                sprint["delivered"] = 0.0
        return sprint

    populated_filtered = await asyncio.gather(*(hydrate_sprint(s) for s in filtered))

    return board_id, ids, populated_filtered


@router.get("/velocity", response_model=VelocityResponse)
async def velocity(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_velocity(client, board_id, ids, sprints)


@router.get("/predictability", response_model=PredictabilityResponse)
async def predictability(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_predictability(client, board_id, ids, sprints)


@router.get("/lead-time", response_model=LeadTimeResponse)
async def lead_time(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_lead_time(client, board_id, ids, sprints)


@router.get("/scope-change", response_model=ScopeChangeResponse)
async def scope_change(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_scope_change(client, board_id, ids, sprints)


@router.get("/carry-over", response_model=CarryOverResponse)
async def carry_over(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_carry_over(client, board_id, ids, sprints)


@router.get("/executive-report", response_model=ExecutiveReport)
async def executive_report(
    sprint_ids: list[int] = Query(default=None),
    last_n: int = Query(default=None),
    team: str = Query(default=None),
    quarter: int = Query(default=None, ge=1, le=4),
    year: int = Query(default=None),
    client: JiraClient = Depends(get_jira_client),
):
    board_id, ids, sprints = await _resolve_sprints(client, sprint_ids, last_n, team, quarter, year)
    return await get_executive_report(client, board_id, ids, sprints, team=team)
