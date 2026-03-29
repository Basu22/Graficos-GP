from app.core.jira_client import JiraClient
from app.schemas.metrics import ExecutiveReport, ExecutiveKPIs
from app.services.velocity_service import get_velocity
from app.services.predictability_service import get_predictability
from app.services.lead_time_service import get_lead_time
from app.services.scope_service import get_scope_change
from app.services.carry_over_service import get_carry_over

from app.services.gemini_service import generate_synthesis_ai


def _build_synthesis(kpis: ExecutiveKPIs, lt_improvement: float | None) -> list[dict]:
    points = []

    if lt_improvement and lt_improvement > 0:
        points.append({
            "text": f"Eficiencia: El Lead Time se redujo {lt_improvement}%, indicando un flujo de trabajo más ágil.",
            "type": "green"
        })

    if kpis.scope_creep_total > 0:
        points.append({
            "text": f"Alcance: Se gestionaron {kpis.scope_creep_total} pts de cambio de alcance con una predictibilidad del {kpis.predictability_avg}%.",
            "type": "yellow"
        })

    if kpis.predictability_avg >= 80:
        points.append({
            "text": f"Predictibilidad: El equipo cumple con el {kpis.predictability_avg}% de lo prometido (Meta: 80%).",
            "type": "green"
        })
    else:
        points.append({
            "text": f"Alerta: La predictibilidad de {kpis.predictability_avg}% está por debajo del objetivo del 80%.",
            "type": "red"
        })

    return points


async def get_executive_report(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list, team: str = "Equipo") -> ExecutiveReport:
    velocity = await get_velocity(client, board_id, sprint_ids, sprints_info)
    predictability = await get_predictability(client, board_id, sprint_ids, sprints_info)
    lead_time = await get_lead_time(client, board_id, sprint_ids, sprints_info)
    scope = await get_scope_change(client, board_id, sprint_ids, sprints_info)
    carry_over = await get_carry_over(client, board_id, sprint_ids, sprints_info)

    closed_points = int(sum(p.delivered for p in velocity.data))
    total_points = int(sum(p.committed for p in velocity.data))

    kpis = ExecutiveKPIs(
        closed_points=closed_points,
        total_points=total_points,
        predictability_avg=predictability.average,
        lead_time_avg=lead_time.overall_average,
        scope_creep_total=scope.total_scope_creep,
        efficiency_improvement_pct=lead_time.improvement_pct,
    )

    # Intentar síntesis con IA, si no hay key devuelve []
    synthesis = await generate_synthesis_ai(kpis, team)
    
    if not synthesis:
        synthesis = _build_synthesis(kpis, lead_time.improvement_pct)

    return ExecutiveReport(
        kpis=kpis,
        velocity=velocity,
        predictability=predictability,
        lead_time=lead_time,
        scope_change=scope,
        carry_over=carry_over,
        strategic_synthesis=synthesis,
    )
