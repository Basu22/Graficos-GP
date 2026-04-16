from app.core.jira_client import JiraClient
from app.schemas.metrics import PredictabilityPoint, PredictabilityResponse
from app.services.sprint_helpers import get_sprint_label, get_story_points


async def get_predictability(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> PredictabilityResponse:
    points = []

    for sprint in sprints_info:
        if sprint["id"] not in sprint_ids:
            continue

        label = get_sprint_label(sprint)
        
        # Consumir métricas globales ya hidratadas en metrics.py
        committed = sprint.get("committed", 0.0)
        delivered = sprint.get("delivered", 0.0)

        pct = round((delivered / committed * 100), 1) if committed > 0 else 0.0

        points.append(PredictabilityPoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=label,
            predictability=pct,
        ))

    if not points:
        return PredictabilityResponse(data=[], average=0)

    avg = round(sum(p.predictability for p in points) / len(points), 1)
    return PredictabilityResponse(data=points, average=avg)