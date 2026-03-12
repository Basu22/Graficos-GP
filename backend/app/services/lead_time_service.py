from app.core.jira_client import JiraClient
from app.schemas.metrics import LeadTimePoint, LeadTimeResponse
from app.services.sprint_helpers import get_sprint_label, calc_lead_time_days


async def get_lead_time(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> LeadTimeResponse:
    points = []

    for sprint in sprints_info:
        if sprint["id"] not in sprint_ids:
            continue

        issues = await client.get_issues_for_sprint(sprint["id"])
        label = get_sprint_label(sprint)

        lead_times = [
            lt for i in issues
            if (lt := calc_lead_time_days(i)) is not None
        ]

        avg_lt = round(sum(lead_times) / len(lead_times), 2) if lead_times else 0.0

        points.append(LeadTimePoint(
            sprint_id=sprint["id"],
            sprint_name=sprint["name"],
            sprint_label=label,
            avg_lead_time_days=avg_lt,
        ))

    if not points:
        return LeadTimeResponse(data=[], overall_average=0, improvement_pct=None)

    overall = round(sum(p.avg_lead_time_days for p in points) / len(points), 2)

    improvement_pct = None
    if len(points) >= 2 and points[0].avg_lead_time_days > 0:
        first, last = points[0].avg_lead_time_days, points[-1].avg_lead_time_days
        improvement_pct = round((first - last) / first * 100, 1)

    return LeadTimeResponse(data=points, overall_average=overall, improvement_pct=improvement_pct)
