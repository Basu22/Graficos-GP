from app.core.jira_client import JiraClient
from app.schemas.metrics import CarryOverPoint, CarryOverResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_carry_over(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> CarryOverResponse:
    """
    Carry Over = story points de issues que NO se completaron en el sprint
    (estado != done al cierre).
    """
    points = []
    sorted_sprints = [s for s in sprints_info if s["id"] in sprint_ids]

    for sprint in sorted_sprints:
        issues = await client.get_issues_for_sprint(sprint["id"])
        label = get_sprint_label(sprint)

        carry = sum(
            get_story_points(i) for i in issues
            if i["fields"]["status"]["statusCategory"]["key"] != "done"
        )

        points.append(CarryOverPoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=label,
            carry_over_points=carry,
        ))

    return CarryOverResponse(data=points)
