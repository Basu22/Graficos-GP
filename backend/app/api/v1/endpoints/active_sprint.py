from fastapi import APIRouter, Depends, Query
from app.core.jira_client import JiraClient, get_jira_client
from app.services.active_sprint_service import get_active_sprint_data

router = APIRouter(prefix="/active-sprint", tags=["active-sprint"])


@router.get("/")
async def active_sprint(
    team: str = Query(..., description="Equipo, ej: 'Back'"),
    client: JiraClient = Depends(get_jira_client),
):
    board_id = await client.get_board_id()
    return await get_active_sprint_data(client, board_id, team)
