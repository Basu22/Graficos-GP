from app.core.jira_client import JiraClient
from app.schemas.metrics import ScopeChangePoint, ScopeChangeResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_scope_change(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> ScopeChangeResponse:
    """
    Scope Change = diferencia entre puntos comprometidos al inicio del sprint
    vs. puntos totales al cierre (incluyendo issues agregados).
    Aproximación: committed_initial = issues con fecha created <= sprint.startDate
    scope_change = total_committed - committed_initial
    """
    points = []

    for sprint in sprints_info:
        if sprint["id"] not in sprint_ids:
            continue

        issues = await client.get_issues_for_sprint(sprint["id"])
        label = get_sprint_label(sprint)

        start_date = sprint.get("startDate", "")
        total_committed = sum(get_story_points(i) for i in issues)

        # Issues que existían antes o al inicio del sprint
        committed_initial = total_committed  # fallback
        if start_date:
            from dateutil import parser as dp
            try:
                sprint_start = dp.parse(start_date)
                committed_initial = sum(
                    get_story_points(i) for i in issues
                    if dp.parse(i["fields"].get("created", start_date)) <= sprint_start
                )
            except Exception:
                pass

        scope_change = round(total_committed - committed_initial, 1)

        points.append(ScopeChangePoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=label,
            committed_initial=committed_initial,
            scope_change=scope_change,
        ))

    total_creep = round(sum(p.scope_change for p in points if p.scope_change > 0), 1)
    return ScopeChangeResponse(data=points, total_scope_creep=total_creep)
