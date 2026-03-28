import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
  ComposedChart, Area
} from "recharts";

const API = "https://graficosagiles.site/api/v1";

const COLORS = {
  committed: "#3B82F6",
  delivered: "#22C55E",
  predictability: "#3B82F6",
  carryOver: "#F87171",
  scopeChange: "#FB923C",
  leadTime: "#F97316",
  avg: "#EF4444",
};

const PRED_ZONES = [
  { min: 85, max: 100, color: "#CCFBF1", label: "Excelencia (85-100%)" },
  { min: 70, max: 85, color: "#DCFCE7", label: "Aceptable (70-85%)" },
  { min: 50, max: 70, color: "#FEF9C3", label: "Atención (50-70%)" },
  { min: 0, max: 50, color: "#FEE2E2", label: "Crítico (0-50%)" },
];

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, [url]);
  return { data, loading, error };
}

function KPICard({ value, label, sub, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: color || "#1e293b", letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, height = 280 }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function LoadingSpinner() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 14 }}>Cargando datos...</div>;
}

// ── Dashboard de Performance ──────────────────────────────────────────────────

function DashboardPerformance({ team, lastN }) {
  const q = `?team=${team}&last_n=${lastN}`;
  const { data: vel } = useFetch(`${API}/metrics/velocity${q}`);
  const { data: pred } = useFetch(`${API}/metrics/predictability${q}`);
  const { data: scope } = useFetch(`${API}/metrics/scope-change${q}`);
  const { data: carry } = useFetch(`${API}/metrics/carry-over${q}`);

  const velData = vel?.data || [];
  const predData = pred?.data || [];
  const scopeData = scope?.data || [];
  const carryData = carry?.data || [];

  const CustomBarLabel = ({ x, y, width, value }) => value > 0 ? (
    <text x={x + width / 2} y={y - 4} fill="#475569" textAnchor="middle" fontSize={11} fontWeight={600}>{value}</text>
  ) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* Velocidad */}
      <ChartCard title="Velocidad (Story Points)">
        {velData.length === 0 ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={velData} margin={{ top: 20, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={vel.average_committed} stroke={COLORS.avg} strokeDasharray="5 5"
                label={{ value: `${vel.average_committed}`, position: "right", fontSize: 11, fill: COLORS.avg }} />
              <Bar dataKey="committed" name="Comprometido" fill={COLORS.committed} radius={[3, 3, 0, 0]}>
                <CustomBarLabel />
              </Bar>
              <Bar dataKey="delivered" name="Entregado" fill={COLORS.delivered} radius={[3, 3, 0, 0]}>
                <CustomBarLabel />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Predictibilidad */}
      <ChartCard title="Predictibilidad (%)">
        {predData.length === 0 ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={predData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              {PRED_ZONES.map(z => (
                <Area key={z.label} type="monotone" dataKey={() => z.max}
                  fill={z.color} stroke="none" legendType="none" />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <ReferenceLine y={pred.average} stroke={COLORS.avg} strokeDasharray="5 5"
                label={{ value: `${pred.average}%`, position: "right", fontSize: 11, fill: COLORS.avg }} />
              <Line type="monotone" dataKey="predictability" name="Predictibilidad"
                stroke={COLORS.predictability} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.predictability }}
                label={{ fontSize: 10, fill: "#475569", position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Cambio de Alcance */}
      <ChartCard title="Cambio de Alcance">
        {scopeData.length === 0 ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scopeData} margin={{ top: 20, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="committed_initial" name="Comprometido Inicial" fill={COLORS.committed} radius={[3, 3, 0, 0]} />
              <Bar dataKey="scope_change" name="Cambio de Alcance" fill={COLORS.scopeChange} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Carry Over */}
      <ChartCard title="Tendencia de Carry Over">
        {carryData.length === 0 ? <LoadingSpinner /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={carryData} margin={{ top: 20, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip />
              <Area type="monotone" dataKey="carry_over_points" fill="#FEE2E2" stroke="none" />
              <Line type="monotone" dataKey="carry_over_points" name="Carry Over"
                stroke={COLORS.carryOver} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.carryOver }}
                label={{ fontSize: 10, fill: "#475569", position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

    </div>
  );
}

// ── Reporte Ejecutivo ─────────────────────────────────────────────────────────

function ReporteEjecutivo({ team, lastN }) {
  const q = `?team=${team}&last_n=${lastN}`;
  const { data: report, loading } = useFetch(`${API}/metrics/executive-report${q}`);

  if (loading || !report) return <LoadingSpinner />;

  const { kpis, velocity, predictability, lead_time, strategic_synthesis } = report;
  const quarter = new Date().getFullYear();

  // Combinar velocity + predictability para el gráfico combinado
  const combinedData = velocity.data.map(v => {
    const p = predictability.data.find(p => p.sprint_id === v.sprint_id);
    return { ...v, predictability: p?.predictability || 0 };
  });

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Reporte Ejecutivo Integral</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", letterSpacing: -0.5 }}>Q1 {quarter} — Equipo {team}</div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <KPICard value={kpis.closed_points} label="Puntos Cerrados" sub={`De ${kpis.total_points} totales`} color="#3B82F6" />
        <KPICard value={`${kpis.predictability_avg}%`} label="Predictibilidad" sub="Métrica Say/Do" color="#22C55E" />
        <KPICard value={`${kpis.lead_time_avg}d`} label="Lead Time Medio" sub="Eficiencia de Flujo" color="#F97316" />
        <KPICard value={`+${kpis.scope_creep_total} pts`} label="Scope Creep" sub="Cambios de Alcance" color="#EF4444" />
        {kpis.efficiency_improvement_pct && (
          <KPICard value={`${kpis.efficiency_improvement_pct}%`} label="Mejora Eficiencia" sub="Lead Time trend" color="#8B5CF6" />
        )}
      </div>

      {/* Volumen vs Predictibilidad */}
      <div style={{ marginBottom: 20 }}>
        <ChartCard title="Volumen vs Predictibilidad" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedData} margin={{ top: 10, right: 40, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "Pts Historia", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "% Predictibilidad", angle: 90, position: "insideRight", fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="committed" name="Alcance Total (Say)" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="delivered" name="Pts Entregados (Do)" fill={COLORS.delivered} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="predictability" name="Predictibilidad %"
                stroke="#1e293b" strokeWidth={2.5} dot={{ r: 5, fill: "#1e293b" }}
                label={{ fontSize: 10, fill: "#475569", position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Lead Time */}
      <div style={{ marginBottom: 28 }}>
        <ChartCard title="Tendencia de Eficiencia: Lead Time" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={lead_time.data} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "Días Promedio", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip formatter={(v) => `${v}d`} />
              <Area type="monotone" dataKey="avg_lead_time_days" fill="#FEF3C7" stroke="none" />
              <Line type="monotone" dataKey="avg_lead_time_days" name="Lead Time"
                stroke={COLORS.leadTime} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.leadTime }}
                label={{ fontSize: 10, fill: COLORS.leadTime, position: "top", formatter: v => `${v}d` }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Síntesis Estratégica */}
      <div style={{ background: "#f8fafc", borderRadius: 12, padding: "20px 24px", borderLeft: "4px solid #3B82F6" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Síntesis Estratégica</div>
        {strategic_synthesis.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
            <span style={{ color: i === strategic_synthesis.length - 1 ? "#F97316" : "#3B82F6", fontWeight: 700, marginTop: 1 }}>•</span>
            <span style={{ color: i === strategic_synthesis.length - 1 ? "#F97316" : "#475569" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── App Principal ─────────────────────────────────────────────────────────────

export default function App() {
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState("");
  const [lastN, setLastN] = useState(6);
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    fetch(`${API}/sprints/teams`)
      .then(r => r.json())
      .then(t => { setTeams(t); setTeam(t[0] || ""); });
  }, []);

  const btnStyle = (active) => ({
    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: active ? "#3B82F6" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16 }}>⚡</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Agility Dashboard</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Selector equipo */}
            <select value={team} onChange={e => setTeam(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: "#475569", background: "#fff", cursor: "pointer" }}>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Selector sprints */}
            <select value={lastN} onChange={e => setLastN(Number(e.target.value))}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, color: "#475569", background: "#fff", cursor: "pointer" }}>
              {[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>Últimos {n} sprints</option>)}
            </select>

            {/* Toggle vistas */}
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
              <button style={btnStyle(view === "dashboard")} onClick={() => setView("dashboard")}>Performance</button>
              <button style={btnStyle(view === "executive")} onClick={() => setView("executive")}>Ejecutivo</button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            {view === "dashboard" ? `Dashboard de Performance — Equipo ${team}` : `Reporte Ejecutivo — Equipo ${team}`}
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>
            Datos en tiempo real desde Jira · Últimos {lastN} sprints
          </p>
        </div>

        {team && view === "dashboard" && <DashboardPerformance team={team} lastN={lastN} />}
        {team && view === "executive" && <ReporteEjecutivo team={team} lastN={lastN} />}
      </div>
    </div>
  );
}
