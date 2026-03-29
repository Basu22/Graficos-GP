import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { API, THEMES, COLORS, buildQuery } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { KPICard, ChartCard, Spinner } from "../components/ui";

export function ReporteEjecutivo({ team, filter, T }) {
  const theme = T || THEMES.light;
  const q = buildQuery(team, filter);
  const { data: report, loading } = useFetch(`${API}/metrics/executive-report${q}`);

  if (loading || !report) return <Spinner />;

  const { kpis, velocity, predictability, lead_time, strategic_synthesis } = report;
  const combinedData = velocity.data.map((v) => {
    const p = predictability.data.find((p) => p.sprint_id === v.sprint_id);
    return { ...v, predictability: p?.predictability || 0 };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KPICard T={T} value={kpis.closed_points} label="Puntos Cerrados" sub={`De ${kpis.total_points} totales`} color="#3B82F6" />
        <KPICard T={T} value={`${kpis.predictability_avg}%`} label="Predictibilidad" sub="Métrica Say/Do" color="#22C55E" />
        <KPICard T={T} value={`${kpis.lead_time_avg}d`} label="Lead Time Medio" sub="Eficiencia de Flujo" color="#F97316" />
        <KPICard T={T} value={`+${kpis.scope_creep_total} pts`} label="Scope Creep" sub="Cambios de Alcance" color="#EF4444" />
        {kpis.efficiency_improvement_pct && (
          <KPICard T={T} value={`${kpis.efficiency_improvement_pct}%`} label="Mejora Eficiencia" sub="Lead Time trend" color="#8B5CF6" />
        )}
      </div>

      <ChartCard T={T} title="Volumen vs Predictibilidad" height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 10, right: 50, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
            <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
            <Bar yAxisId="left" dataKey="committed" name="Alcance Total (Say)" fill={T?.bg === "#0F172A" ? "#475569" : "#cbd5e1"} radius={[3, 3, 0, 0]}
              label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            <Bar yAxisId="left" dataKey="delivered" name="Pts Entregados (Do)" fill={COLORS.delivered} radius={[3, 3, 0, 0]}
              label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            <Line yAxisId="right" type="monotone" dataKey="predictability" name="Predictibilidad %"
              stroke="#F59E0B" strokeWidth={3} dot={{ r: 5, fill: "#F59E0B", strokeWidth: 2, stroke: T?.card || "#fff" }}
              label={{ fontSize: 10, fill: "#F59E0B", position: "top", fontWeight: 700 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard T={T} title="Tendencia de Eficiencia: Lead Time" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={lead_time.data} margin={{ top: 10, right: 20, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
            <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <Tooltip formatter={(v) => `${v}d`} />
            <Area type="monotone" dataKey="avg_lead_time_days" fill="#FEF3C7" stroke="none" />
            <Line type="monotone" dataKey="avg_lead_time_days" name="Lead Time"
              stroke={COLORS.leadTime} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.leadTime }}
              label={{ fontSize: 10, fill: COLORS.leadTime, position: "top", formatter: (v) => `${v}d` }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ background: theme.healthMuted, borderRadius: 12, padding: "20px 24px", borderLeft: "4px solid #3B82F6" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme.textMuted, textTransform: "uppercase", marginBottom: 12 }}>
          Síntesis Estratégica
        </div>
        {strategic_synthesis.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: i === strategic_synthesis.length - 1 ? "#F97316" : "#3B82F6", fontWeight: 700, flexShrink: 0 }}>•</span>
            <span style={{ color: i === strategic_synthesis.length - 1 ? "#F97316" : (theme?.textMuted || "#475569") }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
