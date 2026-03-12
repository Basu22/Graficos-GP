"""
Servicio para obtener estadísticas de una persona desde Jira.
Cruza el nombre/displayName del assignee con los tickets del sprint activo
y los últimos 3 sprints cerrados.
"""
from datetime import datetime, timezone
from typing import Optional


def get_story_points(issue: dict) -> float:
    return float(issue["fields"].get("customfield_10006") or 0)


def get_lead_time(issue: dict) -> Optional[float]:
    created = issue["fields"].get("created")
    resolved = issue["fields"].get("resolutiondate")
    if not created or not resolved:
        return None
    try:
        from dateutil import parser as dp
        c = dp.parse(created)
        r = dp.parse(resolved)
        return round((r - c).total_seconds() / 86400, 1)
    except Exception:
        return None


async def get_person_stats(jira_client, assignee_name: str, team: str) -> dict:
    """
    Obtiene stats de una persona para el sprint activo + últimos 3 cerrados.
    assignee_name: displayName del usuario en Jira (ej: "Juan Pérez")
    """
    from app.core.jira_client import JiraClient

    board_id = await jira_client.get_board_id()

    # ── Sprint activo ────────────────────────────────────────────────────────
    active_issues = []
    active_sprint_name = ""
    try:
        sprints_active = await jira_client.get_sprints(board_id, state="active", team=team)
        if sprints_active:
            sp = sprints_active[0]
            active_sprint_name = sp.get("name", "")
            all_issues = await jira_client.get_issues_for_sprint(sp["id"])
            active_issues = [
                i for i in all_issues
                if (i["fields"].get("assignee") or {}).get("displayName", "").lower() == assignee_name.lower()
                and i["fields"].get("issuetype", {}).get("name", "").lower()
                   not in ("subtarea", "sub-task")
            ]
    except Exception as e:
        print(f"Error active sprint: {e}")

    # ── Últimos 3 sprints cerrados ───────────────────────────────────────────
    closed_sprints = []
    history_issues = []
    try:
        all_closed = await jira_client.get_sprints(board_id, state="closed", team=team)
        closed_sprints = sorted(
            all_closed,
            key=lambda s: s.get("completeDate") or s.get("endDate") or "",
            reverse=True
        )[:3]

        for sp in closed_sprints:
            issues = await jira_client.get_issues_for_sprint(sp["id"])
            for i in issues:
                assignee = (i["fields"].get("assignee") or {}).get("displayName", "")
                if assignee.lower() == assignee_name.lower():
                    i["_sprint_name"] = sp.get("name", "")
                    i["_sprint_id"]   = sp["id"]
                    history_issues.append(i)
    except Exception as e:
        print(f"Error closed sprints: {e}")

    # ── Métricas sprint activo ───────────────────────────────────────────────
    active_done  = [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "done"]
    active_inprog= [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "indeterminate"]
    active_todo  = [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "new"]

    active_sp_total = sum(get_story_points(i) for i in active_issues)
    active_sp_done  = sum(get_story_points(i) for i in active_done)

    # ── Velocidad por sprint (historial) ─────────────────────────────────────
    velocity_by_sprint = {}
    for sp in closed_sprints:
        sp_issues = [i for i in history_issues if i.get("_sprint_id") == sp["id"]]
        done_issues = [i for i in sp_issues if i["fields"]["status"]["statusCategory"]["key"] == "done"]
        velocity_by_sprint[sp.get("name","")] = {
            "committed": sum(get_story_points(i) for i in sp_issues),
            "delivered":  sum(get_story_points(i) for i in done_issues),
            "tickets":    len(done_issues),
        }

    # ── Lead time promedio ───────────────────────────────────────────────────
    lead_times = [lt for i in history_issues if (lt := get_lead_time(i)) is not None]
    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None

    # ── Distribución por tipo ────────────────────────────────────────────────
    all_issues = active_issues + history_issues
    type_dist = {}
    for i in all_issues:
        t = i["fields"].get("issuetype", {}).get("name", "Otro")
        type_dist[t] = type_dist.get(t, 0) + 1

    # ── Tickets activos detallados ────────────────────────────────────────────
    def fmt_issue(i):
        return {
            "key":       i["key"],
            "summary":   i["fields"]["summary"],
            "status":    i["fields"]["status"]["name"],
            "status_cat":i["fields"]["status"]["statusCategory"]["key"],
            "type":      i["fields"].get("issuetype", {}).get("name", ""),
            "sp":        get_story_points(i),
            "lead_time": get_lead_time(i),
            "sprint":    i.get("_sprint_name", active_sprint_name),
            "epic":      (i["fields"].get("customfield_10002") or ""),
            "priority":  (i["fields"].get("priority") or {}).get("name", ""),
        }

    return {
        "assignee_name": assignee_name,
        "active_sprint": {
            "name":       active_sprint_name,
            "tickets":    [fmt_issue(i) for i in active_issues],
            "sp_total":   active_sp_total,
            "sp_done":    active_sp_done,
            "completion": round(active_sp_done / active_sp_total * 100, 1) if active_sp_total else 0,
            "count_done": len(active_done),
            "count_prog": len(active_inprog),
            "count_todo": len(active_todo),
        },
        "velocity_by_sprint": velocity_by_sprint,
        "avg_velocity": round(
            sum(v["delivered"] for v in velocity_by_sprint.values()) / len(velocity_by_sprint), 1
        ) if velocity_by_sprint else 0,
        "avg_lead_time": avg_lead_time,
        "type_distribution": type_dist,
        "history_tickets": [fmt_issue(i) for i in history_issues],
        "sprints_analyzed": [sp.get("name","") for sp in closed_sprints],
    }
