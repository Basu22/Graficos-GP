from fastapi import APIRouter, Depends, Query
from app.core.jira_client import JiraClient, get_jira_client
from app.schemas.metrics import SprintInfo, SprintReportResponse, SprintIssue


router = APIRouter(prefix="/sprints", tags=["sprints"])


@router.get("/teams", response_model=list[str])
async def list_teams(client: JiraClient = Depends(get_jira_client)):
    """Devuelve los equipos detectados automáticamente desde los nombres de sprint."""
    board_id = await client.get_board_id()
    return await client.get_teams(board_id)


@router.get("/", response_model=list[SprintInfo])
async def list_sprints(
    state: str = "closed,active",
    team: str = Query(default=None, description="Filtrar por equipo, ej: 'Back'"),
    client: JiraClient = Depends(get_jira_client),
):
    board_id = await client.get_board_id()
    sprints = await client.get_sprints(board_id, state=state, team=team)
    return [
        SprintInfo(
            id=s["id"],
            name=s["name"],
            state=s["state"],
            start_date=s.get("startDate"),
            end_date=s.get("endDate"),
            complete_date=s.get("completeDate"),
        )
        for s in sprints
    ]


@router.get("/{sprint_id}/report", response_model=SprintReportResponse)
async def get_sprint_report(
    sprint_id: int,
    client: JiraClient = Depends(get_jira_client),
):
    """Devuelve el reporte detallado de un sprint (nativa Greenhopper mapping)."""
    board_id = await client.get_board_id()
    raw = await client.get_sprint_report(board_id, sprint_id)
    
    # Extraer metadatos del sprint
    s = raw.get("sprint", {})
    sprint_info = SprintInfo(
        id=s.get("id", sprint_id),
        name=s.get("name", "Sprint"),
        state=s.get("state", ""),
        start_date=s.get("startDate"),
        end_date=s.get("endDate"),
        complete_date=s.get("completeDate")
    )

    def get_points(stat_dict):
        if not stat_dict:
            return 0.0
        # Intentar primero el formato de suma de reporte (directo)
        if "value" in stat_dict and "statFieldValue" not in stat_dict:
            try:
                return float(stat_dict.get("value", 0) or 0)
            except (ValueError, TypeError):
                pass
        
        # Formato de incidencia individual
        val = stat_dict.get("statFieldValue")
        if not val:
            return 0.0
        try:
            return float(val.get("value", 0) or 0)
        except (ValueError, TypeError):
            return 0.0

    contents = raw.get("contents", {})
    added_keys = contents.get("issueKeysAddedDuringSprint", {})

    # ── NUEVO: Trazabilidad de Carry Over y Metadatos Históricos ─────────────
    # Usamos JQL SOLO para la historia de sprints (Carry Over).
    # Para Tipo, Prioridad y Estado usamos los IDs de Greenhopper + Mapas Globales
    # Esto garantiza precisión HISTÓRICA (la foto al cierre del sprint).
    
    jql_issues_task = client.get_issues_for_sprint(sprint_id, fields=["customfield_10001"])
    statuses_task = client.get_statuses_map()
    priorities_task = client.get_priorities_map()
    types_task = client.get_issuetypes_map()

    import asyncio
    jql_issues, statuses_map, priorities_map, types_map = await asyncio.gather(
        jql_issues_task, statuses_task, priorities_task, types_task
    )
    
    sprint_history_map = {
        i["key"]: i["fields"].get("customfield_10001") or [] 
        for i in jql_issues
    }

    from app.services.sprint_helpers import parse_sprint_history, get_sprint_label

    def map_issue(i):
        issue_key = i.get("key", "")
        is_added = added_keys.get(issue_key, False)
        
        # Datos base de Greenhopper
        current_pts = get_points(i.get("currentEstimateStatistic"))
        initial_pts = 0.0 if is_added else get_points(i.get("estimateStatistic"))

        # Resolución Histórica de Metadatos
        s_id = i.get("statusId")
        p_id = i.get("priorityId")
        t_id = i.get("typeId")
        
        status_info = statuses_map.get(s_id, {})
        status_name = status_info.get("name") or i.get("statusName", "")
        status_category = status_info.get("category") or i.get("statusCategoryKey", "todo")
        
        priority_name = priorities_map.get(p_id) or i.get("priorityName", "")
        type_name = types_map.get(t_id) or i.get("typeName", "")

        # Determinar Carry Over (vía JQL history)
        history_raw = sprint_history_map.get(issue_key, [])
        history = parse_sprint_history(history_raw)
        
        is_carry = False
        origin = None
        if history:
            try:
                current_idx = next(idx for idx, s in enumerate(history) if s["id"] == sprint_id)
                if current_idx > 0:
                    is_carry = True
                    origin_data = history[current_idx - 1]
                    origin = origin_data["name"].split("-")[-1].strip() if "-" in origin_data["name"] else origin_data["name"]
            except StopIteration:
                pass

        return SprintIssue(
            key=issue_key,
            summary=i.get("summary", ""),
            type=type_name,
            priority=priority_name,
            status=status_name,
            status_category=status_category,
            points=current_pts,
            initial_points=initial_pts,
            added_during_sprint=is_added,
            is_carry_over=is_carry,
            origin_sprint=origin
        )

    completed = [map_issue(i) for i in contents.get("completedIssues", [])]
    not_completed = [map_issue(i) for i in contents.get("issuesNotCompletedInCurrentSprint", [])]
    punted = [map_issue(i) for i in contents.get("puntedIssues", [])]
    completed_outside = [map_issue(i) for i in contents.get("issuesCompletedInAnotherSprint", [])]
    
    # Cálculos dinámicos basados en la "Fórmula de Oro"
    # Scope Creep = Delta de puntos de TODO lo gestionado hoy (completado + no completado)
    all_current = completed + not_completed
    scope_change = sum(max(0, i.points - i.initial_points) for i in all_current)
    
    # Puntos finales por categorías
    completed_points = sum(i.points for i in completed)
    not_completed_points = sum(i.points for i in not_completed)
    punted_points = sum(i.points for i in punted)
    
    # Carry Over Total (Informativo)
    # Sumamos los puntos de absolutamente todas las tareas que vienen de otro sprint
    all_report_issues = completed + not_completed + punted + completed_outside
    total_carry_over = sum(i.points for i in all_report_issues if i.is_carry_over)

    # Formula de Oro: (Comp+NoComp+Elim) - ScopeChange = Comprometido Inicial Verdadero
    # Nota: El Comprometido inicial NO incluye SCOPE CREEP.
    initial_committed = (completed_points + not_completed_points + punted_points) - scope_change

    return SprintReportResponse(
        sprint=sprint_info,
        completed_issues=completed,
        not_completed_issues=not_completed,
        punted_issues=punted,
        completed_outside_issues=completed_outside,
        completed_points=completed_points,
        not_completed_points=not_completed_points,
        punted_points=punted_points,
        initial_committed_points=max(0, initial_committed),
        scope_change_points=scope_change,
        total_carry_over_points=total_carry_over,
        burn_data=contents 
    )
