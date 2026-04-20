from app.core.jira_client import JiraClient
from app.schemas.metrics import CarryOverPoint, CarryOverResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_carry_over(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> CarryOverResponse:
    """
    Carry Over = story points de issues que NO se completaron en el sprint
    (estado != done al cierre).
    """
async def get_carry_over(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> CarryOverResponse:
    from app.services.sprint_helpers import parse_sprint_history, get_sprint_label, get_story_points
    
    points = []
    # Nos interesan específicamente estos sprints en orden
    target_sprints = sorted([s for s in sprints_info if s["id"] in sprint_ids], key=lambda s: s.get("startDate", ""))

    for sprint in target_sprints:
        sid = sprint["id"]
        # Pedimos el campo sprint (customfield_10001) para ver la historia
        issues = await client.get_issues_for_sprint(sid, fields=["customfield_10001", "customfield_10006"])
        
        sum_carry = 0.0
        for issue in issues:
            history_raw = issue["fields"].get("customfield_10001") or []
            history = parse_sprint_history(history_raw)
            
            if history:
                try:
                    # Buscamos nuestra posición en el tiempo
                    idx = next(i for i, s in enumerate(history) if s["id"] == sid)
                    # Si no somos el primer sprint del ticket, entonces somos Carry Over
                    if idx > 0:
                        sum_carry += get_story_points(issue)
                except StopIteration:
                    pass

        points.append(CarryOverPoint(
            sprint_id=sid,
            sprint_name=sprint["name"],
            sprint_label=get_sprint_label(sprint),
            carry_over_points=sum_carry,
        ))

    return CarryOverResponse(data=points)
