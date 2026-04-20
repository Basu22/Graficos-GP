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
        try: return float(stat_dict.get("value", 0) or 0)
        except (ValueError, TypeError): return 0.0

    def get_current_points(issue):
        # Ayudante para la foto actual
        stat = issue.get("currentEstimateStatistic")
        if not stat: return 0.0
        val = stat.get("statFieldValue")
        if not val: return 0.0
        try: return float(val.get("value", 0) or 0)
        except (ValueError, TypeError): return 0.0

    def get_initial_points(issue):
        # Ayudante para la foto inicial real del sprint
        stat = issue.get("estimateStatistic")
        if not stat: return 0.0
        val = stat.get("statFieldValue")
        if not val: return 0.0
        try: return float(val.get("value", 0) or 0)
        except (ValueError, TypeError): return 0.0

    async def hydrate_sprint(sprint):
        try:
            # Para las métricas de Velocity/Predictibilidad, siempre usamos el cálculo granular
            # basado en la "Fórmula de Oro" (Completos+Pendientes+Eliminados - Deltas)
            rep = await client.get_sprint_report(board_id, sprint["id"])
            contents = rep.get("contents", {})
            added_keys = contents.get("issueKeysAddedDuringSprint", {})

            # 1. Mapear issues para calcular deltas
            completed = contents.get("completedIssues", [])
            pending = contents.get("issuesNotCompletedInCurrentSprint", [])
            punted = contents.get("puntedIssues", [])

            def calculate_scope_creep(issue_list):
                creep = 0.0
                for i in issue_list:
                    key = i.get("key", "")
                    curr = get_current_points(i)
                    # Si es agregado o no tiene foto inicial, asumimos 0 inicial
                    init = 0.0 if added_keys.get(key) else get_initial_points(i)
                    creep += max(0, curr - init)
                return creep

            # 2. Totales Finales
            comp_pts = get_sum_value(contents.get("completedIssuesEstimateSum"))
            pend_pts = get_sum_value(contents.get("issuesNotCompletedEstimateSum"))
            punted_pts = get_sum_value(contents.get("puntedIssuesEstimateSum"))
            
            # 3. Scope Creep Total
            total_creep = calculate_scope_creep(completed) + calculate_scope_creep(pending)
            
            # 4. Formula de Oro
            sprint["committed"] = max(0, (comp_pts + pend_pts + punted_pts) - total_creep)
            sprint["delivered"] = comp_pts
            sprint["scope_change"] = total_creep
            
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
