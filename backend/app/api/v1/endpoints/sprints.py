from fastapi import APIRouter, Depends, Query
from app.core.jira_client import JiraClient, get_jira_client
from app.schemas.metrics import SprintInfo

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
