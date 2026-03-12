from pydantic import BaseModel
from typing import Optional


# ── Sprint base ──────────────────────────────────────────────────────────────

class SprintInfo(BaseModel):
    id: int
    name: str
    state: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    complete_date: Optional[str] = None


# ── Velocity ─────────────────────────────────────────────────────────────────

class VelocityPoint(BaseModel):
    sprint_id: int
    sprint_name: str
    sprint_label: str          # "S52\n08/01-22/01"
    committed: float
    delivered: float


class VelocityResponse(BaseModel):
    data: list[VelocityPoint]
    average_committed: float
    average_delivered: float


# ── Predictability ───────────────────────────────────────────────────────────

class PredictabilityPoint(BaseModel):
    sprint_id: int
    sprint_name: str
    sprint_label: str
    predictability: float      # % say/do


class PredictabilityResponse(BaseModel):
    data: list[PredictabilityPoint]
    average: float


# ── Scope Change ─────────────────────────────────────────────────────────────

class ScopeChangePoint(BaseModel):
    sprint_id: int
    sprint_name: str
    sprint_label: str
    committed_initial: float
    scope_change: float        # puede ser negativo


class ScopeChangeResponse(BaseModel):
    data: list[ScopeChangePoint]
    total_scope_creep: float


# ── Carry Over ───────────────────────────────────────────────────────────────

class CarryOverPoint(BaseModel):
    sprint_id: int
    sprint_name: str
    sprint_label: str
    carry_over_points: float


class CarryOverResponse(BaseModel):
    data: list[CarryOverPoint]


# ── Lead Time ────────────────────────────────────────────────────────────────

class LeadTimePoint(BaseModel):
    sprint_id: int
    sprint_name: str
    sprint_label: str
    avg_lead_time_days: float


class LeadTimeResponse(BaseModel):
    data: list[LeadTimePoint]
    overall_average: float
    improvement_pct: Optional[float] = None   # % mejora primer vs último sprint


# ── KPIs Ejecutivos ──────────────────────────────────────────────────────────

class ExecutiveKPIs(BaseModel):
    closed_points: int
    total_points: int
    predictability_avg: float
    lead_time_avg: float
    scope_creep_total: float
    efficiency_improvement_pct: Optional[float] = None


# ── Reporte Ejecutivo completo ───────────────────────────────────────────────

class ExecutiveReport(BaseModel):
    kpis: ExecutiveKPIs
    velocity: VelocityResponse
    predictability: PredictabilityResponse
    lead_time: LeadTimeResponse
    scope_change: ScopeChangeResponse
    carry_over: CarryOverResponse
    strategic_synthesis: list[str]
