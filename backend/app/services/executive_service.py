from app.core.jira_client import JiraClient
from app.schemas.metrics import ExecutiveReport, ExecutiveKPIs
from app.services.velocity_service import get_velocity
from app.services.predictability_service import get_predictability
from app.services.lead_time_service import get_lead_time
from app.services.scope_service import get_scope_change
from app.services.carry_over_service import get_carry_over


def _build_synthesis(kpis: ExecutiveKPIs, lt_improvement: float | None) -> list[str]:
    lines = []

    if lt_improvement and lt_improvement > 0:
        lines.append(
            f"Mejora en la Eficiencia: El Lead Time se redujo {lt_improvement}%, indicando un flujo de trabajo más ágil."
        )

    if kpis.scope_creep_total > 0:
        lines.append(
            f"Visibilidad de Alcance: Se gestionaron {kpis.scope_creep_total} pts de cambio de alcance "
            f"manteniendo la predictibilidad media en {kpis.predictability_avg}%."
        )

    if kpis.predictability_avg >= 80:
        lines.append(
            f"Estabilidad Say/Do: El equipo cumple consistentemente con el ~{kpis.predictability_avg}% de lo prometido."
        )
    else:
        lines.append(
            f"Atención Say/Do: La predictibilidad de {kpis.predictability_avg}% está por debajo del umbral aceptable (80%)."
        )

    lines.append(
        "Recomendación: Continuar fragmentando tareas complejas para mantener la tendencia de reducción del Lead Time."
    )

    return lines


async def get_executive_report(client: JiraClient, board_id: int, sprint_ids: list[int], sprints_info: list) -> ExecutiveReport:
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
