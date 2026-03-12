from app.core.jira_client import JiraClient
from app.services.sprint_helpers import get_story_points, calc_lead_time_days, get_sprint_label
from dateutil import parser as dateparser
from datetime import datetime, timezone


def _status_category(issue: dict) -> str:
    return issue["fields"].get("status", {}).get("statusCategory", {}).get("key", "")


def _status_name(issue: dict) -> str:
    return issue["fields"].get("status", {}).get("name", "")


def _assignee(issue: dict) -> str:
    assignee = issue["fields"].get("assignee")
    if not assignee:
        return "Sin asignar"
    return assignee.get("displayName", "Sin asignar")


def _issue_type(issue: dict) -> str:
    return issue["fields"].get("issuetype", {}).get("name", "")


def _priority(issue: dict) -> str:
    priority = issue["fields"].get("priority")
    if not priority:
        return "Media"
    return priority.get("name", "Media")


def _epic_link(issue: dict) -> str | None:
    return issue["fields"].get("customfield_10002")


def _parent_key(issue: dict) -> str | None:
    """Retorna la key del padre si es subtarea."""
    parent = issue["fields"].get("parent")
    if parent:
        return parent.get("key")
    return None


def _issue_links(issue: dict) -> list[dict]:
    links = []
    for link in issue["fields"].get("issuelinks", []):
        link_type = link.get("type", {}).get("name", "")
        if "block" in link_type.lower():
            if "outwardIssue" in link:
                links.append({"type": "blocks", "key": link["outwardIssue"]["key"]})
            if "inwardIssue" in link:
                links.append({"type": "blocked_by", "key": link["inwardIssue"]["key"]})
    return links


def _days_in_progress(issue: dict) -> float | None:
    histories = issue.get("changelog", {}).get("histories", [])
    in_progress_date = None
    for history in sorted(histories, key=lambda h: h.get("created", "")):
        for item in history.get("items", []):
            if item.get("field") == "status":
                cat = item.get("toString", "").lower()
                if any(x in cat for x in ["progreso", "progress", "doing", "en curso"]):
                    try:
                        in_progress_date = dateparser.parse(history["created"])
                    except Exception:
                        pass
    if not in_progress_date:
        return None
    now = datetime.now(timezone.utc)
    return round((now - in_progress_date).total_seconds() / 86400, 1)


def _build_burndown(issues: list, sprint: dict) -> list:
    from datetime import timedelta
    start_str = sprint.get("startDate", "")
    end_str = sprint.get("endDate", "")
    if not start_str or not end_str:
        return []
    try:
        start = dateparser.parse(start_str).replace(tzinfo=timezone.utc)
        end = dateparser.parse(end_str).replace(tzinfo=timezone.utc)
    except Exception:
        return []

    now = datetime.now(timezone.utc)
    total_points = sum(get_story_points(i) for i in issues)

    # Solo contar días hábiles para la línea ideal
    workdays = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # lunes a viernes
            workdays.append(cur.date())
        cur += timedelta(days=1)
    total_workdays = max(len(workdays) - 1, 1)

    # Puntos completados por fecha
    completions = []
    for issue in issues:
        sp = get_story_points(issue)
        if sp == 0:
            continue
        resolved = issue["fields"].get("resolutiondate")
        if resolved:
            try:
                rd = dateparser.parse(resolved).replace(tzinfo=timezone.utc)
                if start <= rd <= now:
                    completions.append((rd.date(), sp))
            except Exception:
                pass
    completions.sort(key=lambda x: x[0])

    # Generar puntos día a día (todos los días, incluido finde)
    result = []
    remaining = total_points
    comp_idx = 0
    current = start
    workday_idx = 0

    while current.date() <= min(now.date(), end.date()):
        is_weekend = current.weekday() >= 5

        # Acumular completados hasta este día
        while comp_idx < len(completions) and completions[comp_idx][0] <= current.date():
            remaining -= completions[comp_idx][1]
            comp_idx += 1

        # Ideal solo baja en días hábiles
        if not is_weekend and current.date() in workdays:
            ideal = round(max(total_points - (total_points / total_workdays) * workday_idx, 0), 1)
            workday_idx += 1
        else:
            # Finde: ideal se queda en el mismo valor
            ideal = round(max(total_points - (total_points / total_workdays) * workday_idx, 0), 1)

        result.append({
            "day": current.strftime("%d/%m"),
            "ideal": ideal,
            "real": round(max(remaining, 0), 1) if current.date() <= now.date() else None,
            "weekend": is_weekend,
        })
        current += timedelta(days=1)

    return result


# Tipos que mostramos como cards principales
MAIN_TYPES = {"historia", "historia tecnica", "tarea", "task", "story"}


async def get_active_sprint_data(client: JiraClient, board_id: int, team: str) -> dict:
    sprints = await client.get_sprints(board_id, state="active", team=team)
    if not sprints:
        return {"error": f"No hay sprint activo para el equipo {team}"}

    sprint = sprints[0]
    sprint_id = sprint["id"]

    issues = await client.get_issues_for_sprint(
        sprint_id,
        fields=["summary", "status", "assignee", "customfield_10006",
                "issuetype", "created", "resolutiondate", "priority",
                "customfield_10002", "issuelinks", "parent", "subtasks"]
    )

    # Separar principales y subtareas
    main_tickets = []
    subtasks_map = {}  # parent_key -> [subtask, ...]

    for issue in issues:
        itype = _issue_type(issue).lower()
        if itype == "subtarea" or itype == "sub-task" or itype == "subtask":
            parent = _parent_key(issue)
            if parent:
                subtasks_map.setdefault(parent, []).append({
                    "key": issue["key"],
                    "summary": issue["fields"].get("summary", "")[:60],
                    "status_category": _status_category(issue),
                    "status": _status_name(issue),
                    "assignee": _assignee(issue),
                })
        elif any(t in itype for t in MAIN_TYPES):
            sp = get_story_points(issue)
            status_cat = _status_category(issue)
            lt = calc_lead_time_days(issue) if status_cat == "done" else _days_in_progress(issue)
            main_tickets.append({
                "key": issue["key"],
                "summary": issue["fields"].get("summary", "")[:80],
                "assignee": _assignee(issue),
                "story_points": sp,
                "status": _status_name(issue),
                "status_category": status_cat,
                "issue_type": _issue_type(issue),
                "priority": _priority(issue),
                "epic_link": _epic_link(issue),
                "issue_links": _issue_links(issue),
                "lead_time_days": lt,
                "subtasks": [],  # se llena abajo
            })

    # Asignar subtareas a su padre
    for ticket in main_tickets:
        ticket["subtasks"] = subtasks_map.get(ticket["key"], [])

    # KPIs (sobre todos los issues)
    all_main = [i for i in issues if any(t in _issue_type(i).lower() for t in MAIN_TYPES)]
    total_sp = sum(get_story_points(i) for i in all_main)
    done_sp = sum(get_story_points(i) for i in all_main if _status_category(i) == "done")
    in_progress_sp = sum(get_story_points(i) for i in all_main if _status_category(i) == "indeterminate")
    todo_sp = total_sp - done_sp - in_progress_sp

    lead_times = [t["lead_time_days"] for t in main_tickets if t["status_category"] == "done" and t["lead_time_days"]]
    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None

    all_sprints = await client.get_sprints(board_id, state="closed", team=team)
    all_sprints_sorted = sorted(all_sprints, key=lambda s: s.get("startDate", ""))
    carry_over_pts = 0
    if all_sprints_sorted:
        prev_sprint = all_sprints_sorted[-1]
        prev_issues = await client.get_issues_for_sprint(prev_sprint["id"])
        carry_over_pts = sum(
            get_story_points(i) for i in prev_issues
            if _status_category(i) != "done"
        )

    burndown = _build_burndown(issues, sprint)

    # ── Salud del Sprint ──────────────────────────────────────────────────────
    from datetime import timedelta, date as date_type
    import httpx as _httpx
    health = {}
    try:
        sprint_start = dateparser.parse(sprint.get("startDate", "")).replace(tzinfo=timezone.utc)
        sprint_end   = dateparser.parse(sprint.get("endDate", "")).replace(tzinfo=timezone.utc)
        now_utc      = datetime.now(timezone.utc)

        # Obtener feriados AR para el/los años involucrados
        ar_holidays: set = set()
        years_needed = set()
        cur_y = sprint_start
        while cur_y.date() <= sprint_end.date():
            years_needed.add(cur_y.year)
            cur_y += timedelta(days=32)
            cur_y = cur_y.replace(day=1)
        years_needed.add(sprint_end.year)

        for yr in years_needed:
            try:
                async with _httpx.AsyncClient(timeout=5) as hclient:
                    resp = await hclient.get(f"https://nolaborables.com.ar/api/v2/feriados/{yr}")
                    if resp.status_code == 200:
                        for f in resp.json():
                            try:
                                ar_holidays.add(date_type(yr, int(f["mes"]), int(f["dia"])))
                            except Exception:
                                pass
            except Exception:
                pass  # Si falla la API, continuamos sin feriados

        # Clasificar cada día del sprint
        total_days = 0
        workdays_total = 0
        weekend_days = 0
        holiday_days = 0
        workdays_remaining = 0
        workdays_elapsed = 0

        cur = sprint_start
        while cur.date() <= sprint_end.date():
            total_days += 1
            is_weekend = cur.weekday() >= 5
            is_holiday = cur.date() in ar_holidays
            is_future  = cur.date() > now_utc.date()

            if is_weekend:
                weekend_days += 1
            elif is_holiday:
                holiday_days += 1
                # feriado cuenta como no laborable pero lo separamos
            else:
                workdays_total += 1
                if is_future or cur.date() == now_utc.date():
                    workdays_remaining += 1
                else:
                    workdays_elapsed += 1

            cur += timedelta(days=1)

        # Holidays dentro del sprint (solo los que caen en días hábiles)
        holidays_in_sprint = [
            d.strftime("%d/%m") for d in sorted(ar_holidays)
            if sprint_start.date() <= d <= sprint_end.date() and d.weekday() < 5
        ]

        total_secs   = (sprint_end - sprint_start).total_seconds()
        elapsed_secs = (now_utc - sprint_start).total_seconds()
        time_pct     = round(min(elapsed_secs / total_secs * 100, 100), 1) if total_secs > 0 else 0

        work_pct = round(done_sp / total_sp * 100, 1) if total_sp > 0 else 0

        # Cambio de alcance
        from dateutil import parser as dp
        initial_sp = sum(
            get_story_points(i) for i in issues
            if dp.parse(i["fields"].get("created", sprint.get("startDate", ""))).replace(tzinfo=timezone.utc) <= sprint_start + timedelta(hours=24)
        )
        scope_change_pct = round((total_sp - initial_sp) / initial_sp * 100, 1) if initial_sp > 0 else 0

        # Velocidad proyectada
        velocity_projected = round(done_sp / workdays_elapsed * workdays_total, 1) if workdays_elapsed > 0 else 0

        health = {
            "time_pct":             time_pct,
            "work_pct":             work_pct,
            "scope_change_pct":     scope_change_pct,
            "days_remaining":       workdays_remaining,
            "total_workdays":       workdays_total,
            "weekend_days":         weekend_days,
            "holiday_days":         holiday_days,
            "holidays_in_sprint":   holidays_in_sprint,
            "done_points":          done_sp,
            "total_points":         total_sp,
            "remaining_points":     round(total_sp - done_sp, 1),
            "velocity_projected":   velocity_projected,
        }
    except Exception as e:
        health = {}

    return {
        "sprint": {
            "id": sprint_id,
            "name": sprint["name"],
            "label": get_sprint_label(sprint),
            "start_date": sprint.get("startDate"),
            "end_date": sprint.get("endDate"),
        },
        "kpis": {
            "total_points": total_sp,
            "done_points": done_sp,
            "in_progress_points": in_progress_sp,
            "todo_points": todo_sp,
            "completion_pct": round(done_sp / total_sp * 100, 1) if total_sp else 0,
            "avg_lead_time_days": avg_lead_time,
            "carry_over_from_prev": carry_over_pts,
        },
        "tickets": main_tickets,
        "burndown": burndown,
        "health": health,
    }