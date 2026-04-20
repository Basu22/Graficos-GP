from app.core.jira_client import JiraClient
from app.schemas.metrics import ScopeChangePoint, ScopeChangeResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_scope_change(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> ScopeChangeResponse:
    """
    Scope Change simplificado: reutiliza el cálculo del motor de hidratación central (metrics.py).
    Esto garantiza consistencia absoluta entre todos los gráficos.
    """
    from app.services.sprint_helpers import get_sprint_label

    points = []
    # Filtrar solo los sprints solicitados y ordenarlos por fecha de inicio
    target_sprints = sorted(
        [s for s in sprints_info if s["id"] in sprint_ids], 
        key=lambda s: s.get("startDate", "")
    )

    for sprint in target_sprints:
        points.append(ScopeChangePoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=get_sprint_label(sprint),
            committed_initial=sprint.get("committed", 0.0),
            scope_change=sprint.get("scope_change", 0.0),
        ))

    total_creep = round(sum(p.scope_change for p in points), 1)
    return ScopeChangeResponse(data=points, total_scope_creep=total_creep)
