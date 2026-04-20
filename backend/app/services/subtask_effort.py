import math
from typing import Dict, List

def round_effort(value: float) -> float:
    """
    Regla:
    - Si el decimal es < .50 -> redondea hacia abajo
    - Si el decimal es > .50 -> redondea hacia arriba
    - Si el decimal es == .50 -> mantiene .50
    """
    fractional, integer = math.modf(value)
    
    # Tolerancia para problemas de coma flotante (ej 0.49999999999999994)
    if math.isclose(fractional, 0.5, abs_tol=1e-9):
        return float(integer) + 0.5
    elif fractional < 0.5:
        return float(integer)
    else:
        return float(integer + 1)

def distribute_sp_by_subtasks(story_points: float, subtask_assignees: List[str]) -> Dict[str, float]:
    """
    Recibe los SP de la historia y una lista con el displayName (o key) 
    del asignee de cada subtarea.
    Devuelve un diccionario {assignee: puntos_relativos}.
    """
    if not subtask_assignees:
        return {}

    # Filtrar None o vacíos
    valid_assignees = [a for a in subtask_assignees if a]
    if not valid_assignees:
        return {}

    total_subtasks = len(valid_assignees)
    sp_per_subtask = story_points / total_subtasks

    effort_by_person = {}
    for assignee in valid_assignees:
        if assignee not in effort_by_person:
            effort_by_person[assignee] = 0
        effort_by_person[assignee] += sp_per_subtask

    # Aplicar la regla de redondeo
    for person in effort_by_person:
        effort_by_person[person] = round_effort(effort_by_person[person])

    return effort_by_person


def distribute_sp_by_sprint_subtasks(
    story_points: float,
    all_subtasks: List[dict],
    sprint_start: str,
    sprint_end: str
) -> Dict[str, float]:
    """
    Calcula el esfuerzo de cada persona en una historia para un sprint específico.
    Solo cuenta las subtareas cuya resolutiondate cae dentro del rango del sprint.
    """
    if not all_subtasks or not sprint_start or not sprint_end:
        return {}

    from dateutil import parser as dateparser
    try:
        s_start = dateparser.parse(sprint_start)
        s_end = dateparser.parse(sprint_end)
    except Exception:
        # Fallback al comportamiento global si no hay fechas válidas
        assignees = [s.get("assignee") for s in all_subtasks if s.get("assignee")]
        return distribute_sp_by_subtasks(story_points, assignees)

    # El denominador siempre es el total de subtareas de la historia (para mantener la proporción real)
    total_subtasks_count = len(all_subtasks)
    if total_subtasks_count == 0:
        return {}
        
    sp_per_subtask = story_points / total_subtasks_count

    # Solo sumamos el esfuerzo de las subtareas resueltas en este sprint
    effort_by_person = {}
    for st in all_subtasks:
        assignee = st.get("assignee")
        res_date_str = st.get("resolutiondate")
        
        if not assignee or not res_date_str:
            continue
            
        try:
            res_date = dateparser.parse(res_date_str)
            # Verificar si cae en el rango del sprint
            if s_start <= res_date <= s_end:
                if assignee not in effort_by_person:
                    effort_by_person[assignee] = 0
                effort_by_person[assignee] += sp_per_subtask
        except Exception:
            continue

    # Aplicar la regla de redondeo
    for person in effort_by_person:
        effort_by_person[person] = round_effort(effort_by_person[person])

    return effort_by_person
