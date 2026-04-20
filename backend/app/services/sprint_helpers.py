from datetime import datetime
from dateutil import parser as dateparser
from typing import Optional

# customfield_10006 confirmado para esta instancia de Jira Server
STORY_POINTS_FIELDS = ["customfield_10006", "story_points", "customfield_10016", "customfield_10028"]


def get_story_points(issue: dict) -> float:
    fields = issue.get("fields", {})
    for field in STORY_POINTS_FIELDS:
        val = fields.get(field)
        if val is not None:
            try:
                return float(val)
            except (ValueError, TypeError):
                continue
    return 0.0


def get_sprint_label(sprint: dict) -> str:
    name = sprint.get("name", "")
    parts = name.split("-")
    number = ""
    for part in parts:
        p = part.strip()
        # Buscar "Sprint N" al final
        if "sprint" in p.lower():
            tokens = p.split()
            for t in tokens:
                if t.isdigit():
                    number = f"S{t}"
                    break
        if number:
            break
    if not number:
        number = name[:4]

    start = sprint.get("startDate", "")
    end = sprint.get("endDate", "") or sprint.get("completeDate", "")

    def fmt(date_str: str) -> str:
        if not date_str:
            return "?"
        try:
            dt = dateparser.parse(date_str)
            return dt.strftime("%d/%m")
        except Exception:
            return "?"

    return f"{number}\n{fmt(start)}-{fmt(end)}"


def get_transition_date(issue: dict, to_status_category: str) -> Optional[datetime]:
    changelog = issue.get("changelog", {})
    histories = changelog.get("histories", [])
    for history in sorted(histories, key=lambda h: h.get("created", "")):
        for item in history.get("items", []):
            if item.get("field") == "status":
                to_string = item.get("toString", "").lower()
                if to_status_category.lower() in to_string:
                    try:
                        return dateparser.parse(history["created"])
                    except Exception:
                        pass
    return None


def calc_lead_time_days(issue: dict) -> Optional[float]:
    fields = issue.get("fields", {})
    created_str = fields.get("created")
    resolved_str = fields.get("resolutiondate")
    if not created_str or not resolved_str:
        return None
    try:
        created = dateparser.parse(created_str)
        resolved = dateparser.parse(resolved_str)
        delta = (resolved - created).total_seconds() / 86400
        return round(delta, 2) if delta >= 0 else None
    except Exception:
        return None


def parse_sprint_history(sprint_list: list[str]) -> list[dict]:
    """
    Parsea el formato horrible de JPA de Jira:
    'com.atlassian.greenhopper.service.sprint.Sprint@...[id=1628,name=Sprint 51,...]'
    """
    import re
    parsed = []
    for s_str in (sprint_list or []):
        try:
            sid_match = re.search(r"id=(\d+)", s_str)
            name_match = re.search(r"name=([^,\]]+)", s_str)
            if sid_match and name_match:
                parsed.append({
                    "id": int(sid_match.group(1)),
                    "name": name_match.group(1).strip()
                })
        except Exception:
            continue
    return parsed
