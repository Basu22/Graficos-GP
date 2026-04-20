"""
Servicio para obtener estadísticas de una persona desde Jira.
Cruza el nombre/displayName del assignee con los tickets del sprint activo
y los últimos 3 sprints cerrados.
"""
from datetime import datetime, timezone
from typing import Optional


def get_story_points(issue: dict) -> float:
    return float(issue["fields"].get("customfield_10006") or 0)


from app.services.sprint_helpers import calc_lead_time_days, calc_cycle_time_days


async def _get_enriched_issues_for_person(jira_client, sprint_id, assignee_name, sprint_name="", sprint_start="", sprint_end=""):
    from app.services.subtask_effort import distribute_sp_by_subtasks, distribute_sp_by_sprint_subtasks
    
    all_issues = await jira_client.get_issues_for_sprint(
        sprint_id,
        fields=["summary", "status", "assignee", "customfield_10006",
                "issuetype", "created", "resolutiondate", "subtasks", "priority", "customfield_10002"],
        expand="changelog"
    )
    
    # 1. Recolectar todas las keys de subtareas
    subtask_keys = []
    for i in all_issues:
        for st in i["fields"].get("subtasks", []):
            subtask_keys.append(st["key"])
            
    # 2. Batch fetch de subtareas
    subtasks_data = await jira_client.get_issues_by_keys(subtask_keys, fields=["assignee", "resolutiondate"])
    subtasks_map = {}
    for st in subtasks_data:
        assignee = (st["fields"].get("assignee") or {}).get("displayName", "")
        res_date = st["fields"].get("resolutiondate")
        subtasks_map[st["key"]] = {"assignee": assignee, "resolutiondate": res_date}
        
    # 3. Filtrar y enriquecer issues para la persona
    person_issues = []
    bugs_in_progress = 0
    
    for i in all_issues:
        t_name = i["fields"].get("issuetype", {}).get("name", "").lower()
        if t_name in ("subtarea", "sub-task", "subtask"):
            continue
            
        sp = get_story_points(i)
        main_assignee = (i["fields"].get("assignee") or {}).get("displayName", "")
        
        st_data = []
        for st in i["fields"].get("subtasks", []):
            st_data.append(subtasks_map.get(st["key"], {}))
            
        person_sp = 0
        is_participant = False
        
        if not st_data:
            # Si no hay subtareas, el esfuerzo va al assignee principal.
            # Verificamos si la historia se completó en este sprint para no duplicar esfuerzo en carry-overs.
            # Si no tiene fecha de resolución, asume que está activa en el sprint actual.
            res_date = i["fields"].get("resolutiondate")
            if main_assignee.lower() == assignee_name.lower():
                if not res_date or not sprint_start or not sprint_end:
                    person_sp = sp
                    is_participant = True
                else:
                    from dateutil import parser as dateparser
                    try:
                        rd = dateparser.parse(res_date)
                        sd = dateparser.parse(sprint_start)
                        ed = dateparser.parse(sprint_end)
                        if sd <= rd <= ed:
                            person_sp = sp
                            is_participant = True
                        else:
                            # Fue resuelta en otro sprint, aparece aquí como carry over sin esfuerzo
                            is_participant = True
                            person_sp = 0
                    except:
                        person_sp = sp
                        is_participant = True
        else:
            # Si tiene subtareas, calculamos su aporte real en este sprint
            efforts = distribute_sp_by_sprint_subtasks(sp, st_data, sprint_start, sprint_end)
            for p_name, p_effort in efforts.items():
                if p_name.lower() == assignee_name.lower():
                    person_sp = p_effort
                    if p_effort > 0:
                        is_participant = True
                    break
            
            # Si no tuvo esfuerzo en este sprint, pero participa globalmente y la historia no está cerrada o se cerró aquí
            if not is_participant and main_assignee.lower() == assignee_name.lower():
                is_participant = True

        if is_participant:
            i["_person_sp"] = person_sp
            i["_sprint_name"] = sprint_name
            i["_sprint_id"] = sprint_id
            person_issues.append(i)
            
            # Contar bugs en progreso
            if "bug" in t_name or "incidencia" in t_name:
                cat = i["fields"]["status"]["statusCategory"]["key"]
                if cat != "done":
                    bugs_in_progress += 1
                    
    return person_issues, bugs_in_progress


async def get_person_stats(
    jira_client,
    assignee_name: str,
    team: str,
    last_n: Optional[int] = None,
    quarter: Optional[int] = None,
    year: Optional[int] = None
) -> dict:
    """
    Obtiene stats de una persona para el sprint activo + historial según período.
    assignee_name: displayName del usuario en Jira (ej: "Juan Pérez")
    """
    board_id = await jira_client.get_board_id()

    # ── Sprint activo ────────────────────────────────────────────────────────
    active_issues = []
    active_sprint_name = ""
    bugs_in_progress = 0
    try:
        sprints_active = await jira_client.get_sprints(board_id, state="active", team=team)
        if sprints_active:
            sp = sprints_active[0]
            active_sprint_name = sp.get("name", "")
            active_issues, bugs_in_progress = await _get_enriched_issues_for_person(
                jira_client, sp["id"], assignee_name, active_sprint_name, sp.get("startDate", ""), sp.get("endDate", "")
            )
    except Exception as e:
        print(f"Error active sprint: {e}")

    # ── Historial de sprints ─────────────────────────────────────────────────
    from app.api.v1.endpoints.metrics import _resolve_sprints
    
    closed_sprints = []
    history_issues = []
    try:
        # Reutilizamos la lógica de filtrado del dashboard para asegurar consistencia
        # Pedimos los sprints que coincidan con los parámetros
        # Si no hay parámetros, asumimos last_n = 3 por defecto
        if not any([last_n, quarter, year]):
            last_n = 3
            
        _, _, sprints_info = await _resolve_sprints(
            jira_client, sprint_ids=None, last_n=last_n, team=team, quarter=quarter, year=year
        )
        # _resolve_sprints devuelve la lista ordenada (más viejos primero), así que la invertimos 
        # si queremos ver los más recientes primero, o la dejamos para gráficos cronológicos.
        closed_sprints = sprints_info

        for sp in closed_sprints:
            issues, _ = await _get_enriched_issues_for_person(
                jira_client, sp["id"], assignee_name, sp.get("name", ""), sp.get("startDate", ""), sp.get("endDate", "")
            )
            history_issues.extend(issues)
    except Exception as e:
        print(f"Error closed sprints: {e}")

    # ── Métricas sprint activo ───────────────────────────────────────────────
    active_done  = [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "done"]
    active_inprog= [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "indeterminate"]
    active_todo  = [i for i in active_issues if i["fields"]["status"]["statusCategory"]["key"] == "new"]

    active_sp_total = sum(i.get("_person_sp", 0) for i in active_issues)
    active_sp_done  = sum(i.get("_person_sp", 0) for i in active_done)

    # ── Velocidad por sprint (historial) ─────────────────────────────────────
    velocity_by_sprint = {}
    total_sp_delivered = 0
    total_sp_committed = 0
    for sp in closed_sprints:
        sp_name = sp.get("name","")
        # Asegurarnos de que el nombre del sprint entre al dict aunque sea 0,
        # para que el gráfico no saltee sprints sin tickets
        sp_issues = [i for i in history_issues if i.get("_sprint_id") == sp["id"]]
        done_issues = [i for i in sp_issues if i["fields"]["status"]["statusCategory"]["key"] == "done"]
        
        committed = sum(i.get("_person_sp", 0) for i in sp_issues)
        delivered = sum(i.get("_person_sp", 0) for i in done_issues)
        
        velocity_by_sprint[sp_name] = {
            "committed": committed,
            "delivered": delivered,
            "tickets": len(done_issues),
        }
        total_sp_committed += committed
        total_sp_delivered += delivered

    # ── Cycle time promedio ───────────────────────────────────────────────────
    cycle_times = [ct for i in history_issues if (ct := calc_cycle_time_days(i)) is not None]
    avg_cycle_time = round(sum(cycle_times) / len(cycle_times), 1) if cycle_times else None

    # ── Distribución por tipo ────────────────────────────────────────────────
    all_issues = active_issues + history_issues
    type_dist = {}
    for i in all_issues:
        t = i["fields"].get("issuetype", {}).get("name", "Otro")
        type_dist[t] = type_dist.get(t, 0) + 1

    # ── Predictibilidad ──────────────────────────────────────────────────────
    predictability_pct = 0
    if total_sp_committed > 0:
        predictability_pct = round((total_sp_delivered / total_sp_committed) * 100, 1)

    # ── Tickets activos detallados ────────────────────────────────────────────
    def fmt_issue(i):
        return {
            "key":       i["key"],
            "summary":   i["fields"]["summary"],
            "status":    i["fields"]["status"]["name"],
            "status_cat":i["fields"]["status"]["statusCategory"]["key"],
            "type":      i["fields"].get("issuetype", {}).get("name", ""),
            "sp":        i.get("_person_sp", 0),
            "total_sp":  get_story_points(i),
            "lead_time": calc_lead_time_days(i),
            "cycle_time": calc_cycle_time_days(i),
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
            total_sp_delivered / len(velocity_by_sprint), 1
        ) if velocity_by_sprint else 0,
        "avg_cycle_time": avg_cycle_time,
        "type_distribution": type_dist,
        "history_tickets": [fmt_issue(i) for i in history_issues],
        "sprints_analyzed": [sp.get("name","") for sp in closed_sprints],
        "predictability_pct": predictability_pct,
        "total_sp_delivered": total_sp_delivered,
        "bugs_in_progress": bugs_in_progress
    }

