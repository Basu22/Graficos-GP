from typing import List, Optional, Tuple
from dateutil import parser as dateparser
from app.core.jira_client import JiraClient

QUARTER_MONTHS = {
    1: (1, 3), 2: (4, 6), 3: (7, 9), 4: (10, 12)
}

def _sprint_closed_in_quarter(sprint: dict, q: int, year: int) -> bool:
    close_str = sprint.get("completeDate") or sprint.get("endDate")
    if not close_str:
        return False
    try:
        close = dateparser.parse(close_str)
        start_month, end_month = QUARTER_MONTHS[q]
        return close.year == year and start_month <= close.month <= end_month
    except Exception:
        return False

async def resolve_sprints_simple(
    client: JiraClient,
    sprint_ids: Optional[List[int]] = None,
    last_n: Optional[int] = None,
    team: Optional[str] = None,
    quarter: Optional[int] = None,
    year: Optional[int] = None,
) -> Tuple[int, List[int], List[dict]]:
    """Resuelve la lista de sprints sin realizar hidratación pesada de métricas."""
    board_id = await client.get_board_id()
    sprints = await client.get_sprints(board_id, state="closed", team=team)
    sprints_sorted = sorted(sprints, key=lambda s: s.get("startDate", ""))

    if sprint_ids:
        filtered = [s for s in sprints_sorted if s["id"] in sprint_ids]
    elif quarter and year:
        filtered = [s for s in sprints_sorted if _sprint_closed_in_quarter(s, quarter, year)]
    else:
        n = last_n or 3
        filtered = sprints_sorted[-n:]

    ids = [s["id"] for s in filtered]
    return board_id, ids, filtered
