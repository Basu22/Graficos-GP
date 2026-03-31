import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { API, THEMES, COLORS, buildQuery } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { KPICard, ChartCard, Spinner } from "../components/ui";

const CustomTick = (props) => {
  const { x, y, payload, T } = props;
  if (!payload || !payload.value) return null;
  const val = String(payload.value);
  const parts = val.split(/\s+/);
  const sprint = parts[0];
  const dates = parts.slice(1).join(" ");
  
  const fullLabel = dates ? `Sprint ${sprint.replace('S', '')}, fechas ${dates}` : sprint;

  return (
    <g transform={`translate(${x},${y})`} cursor="help">
      <title>{fullLabel}</title>
      <text x={0} y={0} dy={32} textAnchor="middle" fill={T?.text || "#1e293b"} fontSize={10} fontWeight={700}>
        {sprint}
      </text>
    </g>
  );
};

const CustomLabel = (props) => {
  const { x, y, width, value, fill, T, isBar, shift = 0 } = props;
  if (value === undefined || value === null) return null;
  
  const isZero = Number(value) === 0;
  
  if (isBar) {
    if (isZero) return null;
    return (
      <text 
        x={x + width / 2} 
        y={y} 
        dy={15} 
        fill="#fff" 
        fontSize={11} 
        fontWeight={700} 
        textAnchor="middle"
      >
        {value}
      </text>
    );
  }

  // Gráficos de línea
  const color = fill || T?.text || "#1e293b";
  const verticalOffset = isZero ? 15 : (-8 - shift);

  return (
    <text 
      x={x} 
      y={y} 
      dy={verticalOffset} 
      fill={color} 
      fontSize={10} 
      fontWeight={700} 
      textAnchor="middle"
    >
      {value}
    </text>
  );
};

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

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs Grid */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KPICard T={T} value={kpis.closed_points} label="Puntos Cerrados" sub={`De ${kpis.total_points} totales`} color="#3B82F6" />
        <KPICard T={T} value={`${kpis.predictability_avg}%`} label="Predictibilidad" sub="Métrica Say/Do" color="#22C55E" />
        <KPICard T={T} value={`${kpis.lead_time_avg}d`} label="Lead Time Medio" sub="Eficiencia de Flujo" color="#F97316" />
        <KPICard T={T} value={`+${kpis.scope_creep_total} pts`} label="Scope Creep" sub="Cambios de Alcance" color="#EF4444" />
        {kpis.efficiency_improvement_pct && (
          <KPICard T={T} value={`${kpis.efficiency_improvement_pct}%`} label="Mejora Eficiencia" sub="Lead Time trend" color="#8B5CF6" />
        )}
      </div>

      {/* Volumen vs Predictibilidad */}
      <ChartCard T={T} title="Volumen vs Predictibilidad" height={360}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 35, right: isMobile ? 10 : 40, left: -20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
            <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 105]} tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} hide={isMobile} />
            <Tooltip contentStyle={{ background: T?.card || "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600 }} />
            <Legend verticalAlign="top" height={45} wrapperStyle={{ fontSize: 11, paddingBottom: 15 }} />
            
            <Bar yAxisId="left" dataKey="committed" name="Say (Plan)" fill={T?.bg === "#0F172A" ? "#475569" : "#cbd5e1"} radius={[3, 3, 0, 0]}
              label={<CustomLabel T={T} isBar={true} />} />
            <Bar yAxisId="left" dataKey="delivered" name="Do (Entregado)" fill={COLORS.delivered} radius={[3, 3, 0, 0]}
              label={<CustomLabel T={T} isBar={true} />} />
            
            <Line yAxisId="right" type="monotone" dataKey="predictability" name="Pred %"
              stroke="#F59E0B" strokeWidth={3} dot={{ r: 5, fill: "#F59E0B", stroke: T?.card || "#fff", strokeWidth: 2 }}
              label={<CustomLabel T={T} isBar={false} shift={28} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tendencia de Lead Time */}
      <ChartCard T={T} title="Tendencia de Lead Time (Eficiencia)" height={260}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={lead_time.data} margin={{ top: 30, right: 20, left: -20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
            <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
            <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <Tooltip formatter={(v) => `${v}d`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="avg_lead_time_days" fill="#FEF3C7" stroke="none" fillOpacity={0.6} />
            <Line type="monotone" dataKey="avg_lead_time_days" name="Lead Time"
              stroke={COLORS.leadTime} strokeWidth={3} dot={{ r: 5, fill: COLORS.leadTime, stroke: T?.card || "#fff", strokeWidth: 2 }}
              label={<CustomLabel T={T} isBar={false} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* IA Synthesis */}
      <div style={{ background: theme.healthMuted, borderRadius: 12, padding: "20px 24px", borderLeft: `6px solid ${theme.cardBorder || "#e2e8f0"}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme.textMuted, textTransform: "uppercase", marginBottom: 16 }}>
          Síntesis Estratégica (Análisis IA)
        </div>
        {strategic_synthesis.map((point, i) => {
          const pointEmoji = point.type === "green" ? "🟢" : point.type === "yellow" ? "🟡" : "🔴";
          return (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 13, lineHeight: 1.5, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14 }}>{pointEmoji}</span>
              <span style={{ color: theme.text }}>{point.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
