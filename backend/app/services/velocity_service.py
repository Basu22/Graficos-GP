from app.core.jira_client import JiraClient
from app.schemas.metrics import VelocityPoint, VelocityResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_velocity(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> VelocityResponse:
    points = []

    for sprint in sprints_info:
        if sprint["id"] not in sprint_ids:
            continue

        # Usar API v2 que devuelve todos los customfields incluyendo customfield_10006
        issues = await client.get_issues_for_sprint(sprint["id"])
        label = get_sprint_label(sprint)

        committed = sum(get_story_points(i) for i in issues)
        delivered = sum(
            get_story_points(i) for i in issues
            if i["fields"].get("status", {}).get("statusCategory", {}).get("key") == "done"
        )

        points.append(VelocityPoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=label,
            committed=committed,
            delivered=delivered,
        ))

    if not points:
        return VelocityResponse(data=[], average_committed=0, average_delivered=0)

    avg_committed = round(sum(p.committed for p in points) / len(points), 1)
    avg_delivered = round(sum(p.delivered for p in points) / len(points), 1)

    return VelocityResponse(data=points, average_committed=avg_committed, average_delivered=avg_delivered)
