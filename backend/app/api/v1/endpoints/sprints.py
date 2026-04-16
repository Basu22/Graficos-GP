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
        val = stat_dict.get("statFieldValue")
        if not val:
            return 0.0
        try:
            return float(val.get("value", 0) or 0)
        except (ValueError, TypeError):
            return 0.0

    def map_issue(i):
        return SprintIssue(
            key=i.get("key", ""),
            summary=i.get("summary", ""),
            type=i.get("typeName", ""),
            priority=i.get("priorityName", ""),
            status=i.get("statusName", ""),
            status_category=i.get("statusCategoryKey", "todo"),
            points=get_points(i.get("currentEstimateStatistic"))
        )

    contents = raw.get("contents", {})
    
    return SprintReportResponse(
        sprint=sprint_info,
        completed_issues=[map_issue(i) for i in contents.get("completedIssues", [])],
        not_completed_issues=[map_issue(i) for i in contents.get("issuesNotCompletedInCurrentSprint", [])],
        punted_issues=[map_issue(i) for i in contents.get("puntedIssues", [])],
        completed_points=get_points(contents.get("completedIssuesEstimateSum")),
        not_completed_points=get_points(contents.get("issuesNotCompletedEstimateSum")),
        burn_data=raw.get("contents", {}).get("completedIssuesEstimateSum")
    )
