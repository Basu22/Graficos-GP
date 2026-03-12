import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, Area, Line, LineChart
} from "recharts";

const API = "http://localhost:8000/api/v1";
const JIRA_BASE = "https://jira.gbsj.com.ar";

// ── Tema dark/light ───────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg: "#F1F5F9", card: "#FFFFFF", cardBorder: "#E2E8F0",
    text: "#1E293B", textMuted: "#64748B", textFaint: "#94A3B8",
    header: "#FFFFFF", headerBorder: "#E2E8F0",
    input: "#FFFFFF", inputBorder: "#E2E8F0",
    tableBg: "#FAFBFC", tableHover: "#EAF2FF",
    chartGrid: "#F1F5F9", kanbanBg: "#F8FAFC",
    btnActive: "#3B82F6", btnActiveTxt: "#FFFFFF",
    btnInactive: "transparent", btnInactiveTxt: "#64748B",
    tagBg: "#F1F5F9", healthMuted: "#F8FAFC",
  },
  dark: {
    bg: "#0F172A", card: "#1E293B", cardBorder: "#334155",
    text: "#F1F5F9", textMuted: "#94A3B8", textFaint: "#64748B",
    header: "#1E293B", headerBorder: "#334155",
    input: "#0F172A", inputBorder: "#334155",
    tableBg: "#172033", tableHover: "#1D3251",
    chartGrid: "#1E293B", kanbanBg: "#172033",
    btnActive: "#3B82F6", btnActiveTxt: "#FFFFFF",
    btnInactive: "transparent", btnInactiveTxt: "#94A3B8",
    tagBg: "#334155", healthMuted: "#1E293B",
  },
};

const COLORS = {
  committed: "#3B82F6", delivered: "#22C55E", carryOver: "#F87171",
  scopeChange: "#FB923C", leadTime: "#F97316", avg: "#EF4444",
};

const PRIORITY_ICON = {
  Highest: "⬆️", High: "🔴", Media: "🟠", Medium: "🟠", Low: "🔵", Lowest: "⬇️",
};

const TYPE_COLOR = {
  Historia: "#36B37E", "Historia Tecnica": "#8B5CF6",
  "Historia Técnica": "#8B5CF6", Tarea: "#0052CC", Task: "#0052CC", Story: "#36B37E",
};

const CURRENT_YEAR = new Date().getFullYear();
const QUARTERS = [
  { label: `Q1 ${CURRENT_YEAR}`, value: "q1", quarter: 1, year: CURRENT_YEAR },
  { label: `Q2 ${CURRENT_YEAR}`, value: "q2", quarter: 2, year: CURRENT_YEAR },
  { label: `Q3 ${CURRENT_YEAR}`, value: "q3", quarter: 3, year: CURRENT_YEAR },
  { label: `Q4 ${CURRENT_YEAR}`, value: "q4", quarter: 4, year: CURRENT_YEAR },
];

// Columnas del kanban en orden
const KANBAN_COLUMNS = [
  { key: "fuera",   label: "Fuera de Sprint", color: "#94A3B8", bg: "#F8FAFC", border: "#E2E8F0" },
  { key: "blocked", label: "Bloqueadas",      color: "#EF4444", bg: "#FFF5F5", border: "#FECACA" },
  { key: "todo",    label: "Por Hacer",       color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
  { key: "inprog",  label: "En Progreso",     color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  { key: "done",    label: "Listo",           color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
];

const STATUS_COLUMN = {
  // Fuera de Sprint
  "candidata a refinamiento": "fuera",
  "ok para refinamiento":     "fuera",
  "en refinamiento":          "fuera",
  // Bloqueadas
  "esperando respuesta de producto": "blocked",
  // Por Hacer
  "to do":        "todo",
  "por hacer":    "todo",
  "ok para sprint": "todo",
  // En Progreso
  "en progreso":  "inprog",
  "in progress":  "inprog",
  // Listo
  "done":         "done",
  "listo":        "done",
  "archivado":    "done",
};

function buildQuery(team, filter) {
  const base = `?team=${team}`;
  if (filter.type === "last_n") return `${base}&last_n=${filter.n}`;
  return `${base}&quarter=${filter.quarter}&year=${filter.year}`;
}

function useFetch(url, refreshInterval = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const doFetch = useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setLastUpdated(new Date()); })
      .catch(() => setLoading(false));
  }, [url]);
  useEffect(() => { doFetch(); }, [doFetch]);
  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(doFetch, refreshInterval);
    return () => clearInterval(id);
  }, [doFetch, refreshInterval]);
  return { data, loading, lastUpdated, refresh: doFetch };
}

function KPICard({ value, label, sub, color, T }) {
  const theme = T || THEMES.light;
  return (
    <div style={{ background: theme.card, borderRadius: 12, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flex: "1 1 130px", minWidth: 0, border: `1px solid ${theme.cardBorder}` }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || theme.text, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, height = 280, badge, T }) {
  const theme = T || THEMES.light;
  return (
    <div style={{ background: theme.card, borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", minWidth: 0, border: `1px solid ${theme.cardBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
        {badge && <div style={{ fontSize: 12, fontWeight: 700, color: badge.color || "#EF4444" }}>{badge.text}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13 }}>Cargando...</div>;
}

function EmptyState({ msg = "Sin datos para este período" }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13 }}>📭 {msg}</div>;
}

// ── Ticket Card ───────────────────────────────────────────────────────────────

function TicketCard({ ticket, T }) {
  const theme = T || THEMES.light;
  const subtasks = ticket.subtasks || [];
  const totalSub = subtasks.length;
  const doneSub = subtasks.filter(s => s.status_category === "done").length;
  const pct = totalSub > 0 ? Math.round(doneSub / totalSub * 100) : null;
  const typeColor = TYPE_COLOR[ticket.issue_type] || "#64748B";
  const prioIcon = PRIORITY_ICON[ticket.priority] || "🟠";

  return (
    <div style={{
      background: theme.card, borderRadius: 10, padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)", border: `1px solid ${theme.cardBorder}`,
      marginBottom: 10, cursor: "pointer", transition: "box-shadow 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = theme.tableHover}
      onMouseLeave={e => e.currentTarget.style.background = theme.card}
    >
      {/* Header: tipo + key + prioridad */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: theme?.bg === "#0F172A" ? `${typeColor}33` : `${typeColor}18`,
          padding: "1px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
          {ticket.issue_type}
        </span>
        <a href={`${JIRA_BASE}/browse/${ticket.key}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 11, fontWeight: 700, color: "#0052CC", textDecoration: "none", flex: 1 }}
          onMouseEnter={e => e.target.style.textDecoration = "underline"}
          onMouseLeave={e => e.target.style.textDecoration = "none"}>
          {ticket.key}
        </a>
        <span title={ticket.priority} style={{ fontSize: 13 }}>{prioIcon}</span>
        {ticket.story_points > 0 && (
          <span style={{ background: "#EAF2FF", color: "#0052CC", borderRadius: 10,
            padding: "1px 8px", fontWeight: 700, fontSize: 11 }}>
            {ticket.story_points} SP
          </span>
        )}
      </div>

      {/* Summary */}
      <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.4, marginBottom: 10, fontWeight: 500 }}>
        {ticket.summary}
      </div>

      {/* Epic */}
      {ticket.epic_link && (
        <div style={{ marginBottom: 8 }}>
          <a href={`${JIRA_BASE}/browse/${ticket.epic_link}`} target="_blank" rel="noreferrer"
            style={{ background: theme?.bg === "#0F172A" ? "#2D1F6E" : "#EAE6FF", color: theme?.bg === "#0F172A" ? "#C4B5FD" : "#5243AA", borderRadius: 4,
              padding: "2px 8px", fontSize: 10, fontWeight: 600, textDecoration: "none" }}>
            {ticket.epic_link}
          </a>
        </div>
      )}

      {/* Estado badge */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: ticket.status_category === "done"
            ? (theme?.bg === "#0F172A" ? "#14532D" : "#DCFCE7")
            : ticket.status_category === "indeterminate"
            ? (theme?.bg === "#0F172A" ? "#1E3A5F" : "#DBEAFE")
            : (theme?.tagBg || "#F1F5F9"),
          color: ticket.status_category === "done" ? "#4ADE80"
            : ticket.status_category === "indeterminate" ? "#60A5FA" : (theme?.textMuted || "#64748B"),
          border: `1px solid ${ticket.status_category === "done" ? "#166534"
            : ticket.status_category === "indeterminate" ? "#1D4ED8" : (theme?.cardBorder || "#E2E8F0")}`,
        }}>
          {ticket.status}
        </span>
      </div>

      {/* Assignee */}
      <div style={{ fontSize: 11, color: theme?.textMuted || "#64748B", marginBottom: totalSub > 0 ? 10 : 0 }}>
        👤 {ticket.assignee}
        {ticket.lead_time_days && (
          <span style={{ marginLeft: 8, color: "#F97316" }}>⏱ {ticket.lead_time_days}d</span>
        )}
      </div>

      {/* Barra de progreso de subtareas */}
      {totalSub > 0 && (
        <div style={{ marginTop: 8 }}>
          {/* Barra */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 5, background: theme?.cardBorder || "#E2E8F0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 10, transition: "width 0.4s",
                background: pct === 100 ? "#22C55E" : pct > 50 ? "#3B82F6" : "#F97316",
                width: `${pct}%`,
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", minWidth: 28 }}>
              {pct}%
            </span>
          </div>

          {/* Círculos por subtarea */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {subtasks.map((s, i) => (
              <div key={i} title={`${s.key}: ${s.summary}`}
                style={{
                  width: 12, height: 12, borderRadius: "50%", cursor: "default",
                  background: s.status_category === "done" ? "#22C55E" : "transparent",
                  border: `2px solid ${s.status_category === "done" ? "#22C55E" : s.status_category === "indeterminate" ? "#3B82F6" : "#CBD5E1"}`,
                  transition: "transform 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              />
            ))}
            <span style={{ fontSize: 10, color: theme?.textFaint || "#94A3B8", marginLeft: 2, alignSelf: "center" }}>
              {doneSub}/{totalSub}
            </span>
          </div>
        </div>
      )}

      {/* Issue links */}
      {ticket.issue_links && ticket.issue_links.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ticket.issue_links.map((l, i) => (
            <span key={i} style={{ fontSize: 10, color: l.type === "blocked_by" ? "#EF4444" : "#7C3AED" }}>
              {l.type === "blocked_by" ? "⛔" : "🔗"}{" "}
              <a href={`${JIRA_BASE}/browse/${l.key}`} target="_blank" rel="noreferrer"
                style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                {l.key}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanBoard({ tickets, T }) {
  const theme = T || THEMES.light;
  // Mapear status a columna kanban por nombre exacto
  const getColumn = (ticket) => {
    const status = ticket.status.toLowerCase().trim();
    return STATUS_COLUMN[status] || "todo";
  };

  const columns = {};
  KANBAN_COLUMNS.forEach(c => columns[c.key] = []);
  tickets.forEach(t => {
    const col = getColumn(t);
    columns[col].push(t);
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, alignItems: "start" }}>
      {KANBAN_COLUMNS.map(col => (
        <div key={col.key}>
          {/* Header columna */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            padding: "8px 12px", borderRadius: 8,
            background: col.bg, border: `1px solid ${col.border}`,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ background: col.color, color: "#fff",
                borderRadius: 10, padding: "0px 7px", fontSize: 11, fontWeight: 700 }}>
                {columns[col.key].length}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>
                {columns[col.key].reduce((sum, t) => sum + (t.story_points || 0), 0)} SP
              </span>
            </div>
          </div>

          {/* Cards */}
          <div style={{ minHeight: 80 }}>
            {columns[col.key].length === 0
              ? <div style={{ textAlign: "center", padding: "20px 0", color: "#CBD5E1", fontSize: 12 }}>Sin tickets</div>
              : columns[col.key].map(t => <TicketCard key={t.key} ticket={t} T={T} />)
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard Performance ─────────────────────────────────────────────────────

function DashboardPerformance({ team, filter, T }) {
  const theme = T || THEMES.light;
  const q = buildQuery(team, filter);
  const { data: vel } = useFetch(`${API}/metrics/velocity${q}`);
  const { data: pred } = useFetch(`${API}/metrics/predictability${q}`);
  const { data: scope } = useFetch(`${API}/metrics/scope-change${q}`);
  const { data: carry } = useFetch(`${API}/metrics/carry-over${q}`);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <ChartCard T={T} title="Velocidad (Story Points)"
        badge={vel ? { text: `Velocidad Promedio ${vel.average_delivered ?? vel.average_committed} pts`, color: "#EF4444" } : null}>
        {!vel ? <Spinner /> : (vel.data||[]).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vel.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
              <ReferenceLine y={vel.average_committed} stroke={COLORS.avg} strokeDasharray="5 5" />
              <Bar dataKey="committed" name="Comprometido" fill={COLORS.committed} radius={[3,3,0,0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
              <Bar dataKey="delivered" name="Entregado" fill={COLORS.delivered} radius={[3,3,0,0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Predictibilidad (%)"
        badge={pred ? { text: `Predictibilidad Promedio ${pred.average}%`, color: "#EF4444" } : null}>
        {!pred ? <Spinner /> : (pred.data||[]).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pred.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} />
              <ReferenceLine y={pred.average} stroke={COLORS.avg} strokeDasharray="5 5" />
              <ReferenceLine y={85} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="predictability" name="Predictibilidad"
                stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 5, fill: "#3B82F6" }}
                label={{ fontSize: 10, fill: T?.textMuted || "#475569", position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Cambio de Alcance">
        {!scope ? <Spinner /> : (scope.data||[]).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scope.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
              <Bar dataKey="committed_initial" name="Comprometido Inicial" fill={COLORS.committed} radius={[3,3,0,0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
              <Bar dataKey="scope_change" name="Cambio de Alcance" fill={COLORS.scopeChange} radius={[3,3,0,0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Tendencia de Carry Over">
        {!carry ? <Spinner /> : (carry.data||[]).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={carry.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip />
              <Area type="monotone" dataKey="carry_over_points" fill="#FEE2E2" stroke="none" />
              <Line type="monotone" dataKey="carry_over_points" name="Carry Over"
                stroke={COLORS.carryOver} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.carryOver }}
                label={{ fontSize: 10, fill: T?.textMuted || "#475569", position: "top" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ── Reporte Ejecutivo ─────────────────────────────────────────────────────────

function ReporteEjecutivo({ team, filter, T }) {
  const theme = T || THEMES.light;
  const q = buildQuery(team, filter);
  const { data: report, loading } = useFetch(`${API}/metrics/executive-report${q}`);
  if (loading || !report) return <Spinner />;
  const { kpis, velocity, predictability, lead_time, strategic_synthesis } = report;
  const combinedData = velocity.data.map(v => {
    const p = predictability.data.find(p => p.sprint_id === v.sprint_id);
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
            <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
            <Bar yAxisId="left" dataKey="committed" name="Alcance Total (Say)" fill={T?.bg === "#0F172A" ? "#475569" : "#cbd5e1"} radius={[3,3,0,0]}
              label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            <Bar yAxisId="left" dataKey="delivered" name="Pts Entregados (Do)" fill={COLORS.delivered} radius={[3,3,0,0]}
              label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            <Line yAxisId="right" type="monotone" dataKey="predictability" name="Predictibilidad %"
              stroke="#1e293b" strokeWidth={2.5} dot={{ r: 5, fill: "#1e293b" }}
              label={{ fontSize: 10, fill: T?.textMuted || "#475569", position: "top" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard T={T} title="Tendencia de Eficiencia: Lead Time" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={lead_time.data} margin={{ top: 10, right: 20, left: -10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
            <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
            <Tooltip formatter={v => `${v}d`} />
            <Area type="monotone" dataKey="avg_lead_time_days" fill="#FEF3C7" stroke="none" />
            <Line type="monotone" dataKey="avg_lead_time_days" name="Lead Time"
              stroke={COLORS.leadTime} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.leadTime }}
              label={{ fontSize: 10, fill: COLORS.leadTime, position: "top", formatter: v => `${v}d` }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ background: theme.healthMuted, borderRadius: 12, padding: "20px 24px", borderLeft: "4px solid #3B82F6" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: theme.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Síntesis Estratégica</div>
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

// ── Sprint en Curso ───────────────────────────────────────────────────────────

function SprintEnCurso({ team, T }) {
  const theme = T || THEMES.light;
  const { data, loading, lastUpdated, refresh } = useFetch(
    `${API}/active-sprint/?team=${team}`, 5 * 60 * 1000
  );

  if (loading) return <Spinner />;
  if (!data || data.error) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>
      {data?.error || "No hay sprint activo"}
    </div>
  );

  const { sprint, kpis, tickets, health } = data;
  // Agregar índice numérico para ReferenceArea de fines de semana
  const burndown = (data.burndown || []).map((d, i) => ({ ...d, idx: i }));
  const daysLeft = sprint.end_date
    ? Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: theme.textFaint, textTransform: "uppercase", letterSpacing: 0.5 }}>Sprint Activo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{sprint.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {daysLeft !== null && (
            <div style={{ background: daysLeft <= 2 ? "#FEE2E2" : "#DBEAFE", color: daysLeft <= 2 ? "#DC2626" : "#1D4ED8", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {daysLeft > 0 ? `${daysLeft} días restantes` : "Sprint vencido"}
            </div>
          )}
          <button onClick={refresh} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${theme?.cardBorder || "#e2e8f0"}`, background: theme?.card || "#fff", fontSize: 12, color: theme?.textMuted || "#64748b", cursor: "pointer" }}>
            🔄 Actualizar
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KPICard T={T} value={`${kpis.completion_pct}%`} label="Completado" sub={`${kpis.done_points} / ${kpis.total_points} pts`} color="#22C55E" />
        <KPICard T={T} value={kpis.in_progress_points} label="En Progreso" sub="Story points" color="#3B82F6" />
        <KPICard T={T} value={kpis.todo_points} label="Por Hacer" sub="Story points" color="#94A3B8" />
        <KPICard T={T} value={kpis.avg_lead_time_days ? `${kpis.avg_lead_time_days}d` : "—"} label="Lead Time" sub="Issues cerrados" color="#F97316" />
        <KPICard T={T} value={kpis.carry_over_from_prev} label="Carry Over" sub="Del sprint anterior" color="#EF4444" />
      </div>

      {/* Burndown + Salud 50/50 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

      {/* Salud del Sprint */}
      {health && (
        <div style={{ background: theme?.card || "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${theme?.cardBorder || "#e2e8f0"}` }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme?.textMuted || "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
              Salud del Sprint
            </div>
            {/* Contadores de días */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, background: theme?.bg === "#0F172A" ? "#1E3A5F" : "#EFF6FF", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: health.days_remaining <= 2 ? "#EF4444" : "#1D4ED8" }}>
                  {health.days_remaining}
                </div>
                <div style={{ fontSize: 9, color: theme?.textMuted || "#64748b", marginTop: 1, lineHeight: 1.3 }}>días hábiles<br/>restantes</div>
              </div>
              <div style={{ flex: 1, background: theme?.healthMuted || "#F8FAFC", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#64748B" }}>
                  {health.weekend_days}
                </div>
                <div style={{ fontSize: 9, color: theme?.textMuted || "#64748b", marginTop: 1, lineHeight: 1.3 }}>días de<br/>fin de semana</div>
              </div>
              <div style={{ flex: 1, background: health.holiday_days > 0 ? (theme?.bg === "#0F172A" ? "#431407" : "#FFF7ED") : (theme?.healthMuted || "#F8FAFC"), borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: health.holiday_days > 0 ? "#F97316" : "#94A3B8" }}>
                  {health.holiday_days}
                </div>
                <div style={{ fontSize: 9, color: theme?.textMuted || "#64748b", marginTop: 1, lineHeight: 1.3 }}>feriados<br/>nacionales</div>
                {health.holidays_in_sprint?.length > 0 && (
                  <div style={{ fontSize: 8, color: "#F97316", marginTop: 2 }}>
                    {health.holidays_in_sprint.join(", ")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra done vs remaining */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28, marginBottom: 6 }}>
              <div style={{
                width: `${health.work_pct}%`, background: "#1D4ED8",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", minWidth: health.work_pct > 5 ? 0 : 0,
                transition: "width 0.5s"
              }}>
                {health.work_pct > 8 && `${health.done_points} pts`}
              </div>
              <div style={{
                flex: 1, background: "#93C5FD",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#1D4ED8"
              }}>
                {health.remaining_points > 0 && `${health.remaining_points} pts`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#64748b" }}>
              <span style={{ color: theme?.textMuted || "#64748b" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#1D4ED8", marginRight: 4 }}/>Completado</span>
              <span style={{ color: theme?.textMuted || "#64748b" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#93C5FD", marginRight: 4 }}/>Restante</span>
            </div>
          </div>

          {/* Métricas en grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Tiempo transcurrido", value: `${health.time_pct}%`,
                color: health.time_pct > health.work_pct + 20 ? "#EF4444" : "#22C55E",
                bar: health.time_pct, barColor: "#F97316" },
              { label: "Trabajo terminado", value: `${health.work_pct}%`,
                color: health.work_pct >= health.time_pct ? "#22C55E" : "#F97316",
                bar: health.work_pct, barColor: "#22C55E" },
              { label: "Cambio de alcance", value: `${health.scope_change_pct > 0 ? "+" : ""}${health.scope_change_pct}%`,
                color: health.scope_change_pct > 10 ? "#EF4444" : health.scope_change_pct > 0 ? "#F97316" : "#22C55E",
                bar: null },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color, letterSpacing: -1 }}>{m.value}</div>
                <div style={{ fontSize: 10, color: theme?.textFaint || "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>{m.label}</div>
                {m.bar !== null && (
                  <div style={{ marginTop: 6, height: 3, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.bar}%`, background: m.barColor, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Velocidad proyectada */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: theme?.healthMuted || "#F8FAFC", borderRadius: 8, borderLeft: "3px solid #3B82F6" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Velocidad Proyectada
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: theme?.text || "#1e293b" }}>{health.velocity_projected}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>pts estimados al cierre</span>
            </div>
            <div style={{ fontSize: 11, color: health.velocity_projected >= health.total_points ? "#22C55E" : "#F97316", marginTop: 2 }}>
              {health.velocity_projected >= health.total_points
                ? "✅ En camino a completar el sprint"
                : `⚠️ Faltan ${Math.round(health.total_points - health.velocity_projected)} pts para el objetivo`}
            </div>
          </div>
        </div>
      )}

      {/* Burndown */}
      <ChartCard T={T} title="Burndown Chart" height={260}>
        {burndown.length === 0 ? <EmptyState msg="Sin datos de burndown" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={burndown} margin={{ top: 10, right: 20, left: -15, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} vertical={false} />
              <XAxis
                dataKey="idx"
                type="number"
                domain={[0, burndown.length - 1]}
                ticks={burndown.map(d => d.idx)}
                tickFormatter={i => burndown[i]?.day || ""}
                tick={{ fontSize: 9, fill: T?.textFaint || "#94a3b8" }}
                interval={Math.max(Math.floor(burndown.length / 10) - 1, 0)}
                tickLine={false}
                axisLine={{ stroke: T?.cardBorder || "#e2e8f0" }}
              />
              <YAxis tick={{ fontSize: 9, fill: T?.textFaint || "#94a3b8" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                formatter={(val, name) => [val === null ? "—" : `${val} pts`, name]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
              {/* Bloques grises de fin de semana — usar índice numérico */}
              {burndown.map((d, i) => d.weekend ? (
                <ReferenceArea key={i} x1={d.idx} x2={d.idx}
                  fill="#E2E8F0" fillOpacity={0.9} stroke="none" ifOverflow="visible" />
              ) : null)}
              <Line type="stepAfter" dataKey="ideal" name="Ideal"
                stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3"
                dot={false} connectNulls />
              <Line type="stepAfter" dataKey="real" name="Real"
                stroke="#EF4444" strokeWidth={2} dot={false}
                connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      </div>{/* fin grid 50/50 */}

      {/* Kanban */}
      <div style={{ background: theme?.card || "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${theme?.cardBorder || "#e2e8f0"}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme?.textMuted || "#475569", marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Tickets del Sprint ({tickets.length})
        </div>
        <KanbanBoard tickets={tickets} T={T} />
      </div>
    </div>
  );
}

// ── Period Selector ───────────────────────────────────────────────────────────

function PeriodSelector({ filter, onChange, T }) {
  const theme = T || THEMES.light;
  const options = [
    { label: "Últimos 3 sprints", value: "last_3", filter: { type: "last_n", n: 3 } },
    ...QUARTERS.map(q => ({ label: q.label, value: q.value, filter: { type: "quarter", quarter: q.quarter, year: q.year } })),
  ];
  const current = options.find(o => {
    if (filter.type === "last_n" && o.filter.type === "last_n") return true;
    if (filter.type === "quarter" && o.filter.type === "quarter") return o.filter.quarter === filter.quarter;
    return false;
  });
  return (
    <select value={current?.value || "last_3"} onChange={e => {
      const opt = options.find(o => o.value === e.target.value);
      if (opt) onChange(opt.filter);
    }} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`, fontSize: 13, color: theme.text, background: theme.input, cursor: "pointer", outline: "none" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

const EVENT_TYPES = {
  sprint:   { label: "Sprint",             color: "#3B82F6", icon: "⚡" },
  holiday:  { label: "Feriado Nacional",   color: "#F97316", icon: "🇦🇷" },
  birthday: { label: "Cumpleaños",         color: "#EC4899", icon: "🎂" },
  vacation: { label: "Vacaciones",         color: "#22C55E", icon: "🏖️" },
  medical:  { label: "Licencia Médica",    color: "#EF4444", icon: "🏥" },
  exam:     { label: "Licencia Examen",    color: "#8B5CF6", icon: "📝" },
  study:    { label: "Licencia Estudio",   color: "#06B6D4", icon: "📚" },
  custom:   { label: "Otro",              color: "#64748B", icon: "📌" },
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
function isoDate(year, month, day) {
  return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function dateInRange(dateStr, startStr, endStr) {
  return dateStr >= startStr && dateStr <= (endStr || startStr);
}

function CalendarView({ T, team }) {
  const theme = T || {};
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(today.getMonth() / 3));
  const [selectedSprintIdx, setSelectedSprintIdx] = useState(0);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [sprintEvents, setSprintEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterTypes, setFilterTypes] = useState(new Set(Object.keys(EVENT_TYPES)));
  const [form, setForm] = useState({ title:"", type:"vacation", person:"", start_date:"", end_date:"", notes:"", color:"" });

  const allEvents = [
    ...events.filter(e => filterTypes.has(e.type)),
    ...holidays.filter(() => filterTypes.has("holiday")),
    ...sprintEvents.filter(() => filterTypes.has("sprint")),
  ];

  useEffect(() => { loadAll(); }, [year, team]);

  async function loadAll() {
    try {
      const [evRes, holRes, sprRes] = await Promise.all([
        fetch(`${API}/calendar/events?year=${year}${team ? `&team=${team}` : ""}`),
        fetch(`${API}/calendar/holidays/${year}`),
        fetch(`${API}/calendar/sprints-for-calendar?year=${year}${team ? `&team=${team}` : ""}`),
      ]);
      const evData = await evRes.json();
      const holData = await holRes.json();
      const sprData = await sprRes.json();
      setEvents(Array.isArray(evData) ? evData : []);
      setHolidays(Array.isArray(holData) ? holData : []);
      setSprintEvents(Array.isArray(sprData) ? sprData : []);
    } catch(e) { console.error("loadAll error:", e); }
  }

  function eventsForDay(dateStr) {
    return allEvents.filter(e => dateInRange(dateStr, e.start_date, e.end_date || e.start_date));
  }

  function getEventStyle(e) {
    const info = EVENT_TYPES[e.type] || EVENT_TYPES.custom;
    const color = e.color || info.color;
    return { background: color + "22", borderLeft: `3px solid ${color}`, color: color };
  }

  async function handleSave() {
    if (!form.title || !form.start_date) return;
    try {
      if (selectedEvent?.id && !selectedEvent.id.startsWith("holiday-") && !selectedEvent.id.startsWith("sprint-")) {
        await fetch(`${API}/calendar/events/${selectedEvent.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, team }),
        });
      } else {
        await fetch(`${API}/calendar/events`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, team }),
        });
      }
      setShowModal(false); setSelectedEvent(null);
      setForm({ title:"", type:"vacation", person:"", start_date:"", end_date:"", notes:"", color:"" });
      await loadAll();
    } catch(e) { console.error(e); }
  }

  async function handleDelete(id) {
    if (!id || id.startsWith("holiday-") || id.startsWith("sprint-")) return;
    await fetch(`${API}/calendar/events/${id}`, { method: "DELETE" });
    setShowModal(false); setSelectedEvent(null);
    await loadAll();
  }

  function openNewEvent(dateStr) {
    setSelectedEvent(null);
    setForm({ title:"", type:"vacation", person:"", start_date: dateStr, end_date: dateStr, notes:"", color:"" });
    setShowModal(true);
  }

  function openEditEvent(e) {
    setSelectedEvent(e);
    setForm({ title: e.title, type: e.type, person: e.person||"", start_date: e.start_date, end_date: e.end_date||e.start_date, notes: e.notes||"", color: e.color||"" });
    setShowModal(true);
  }

  const c = (base, dark) => theme.bg === "#0F172A" ? dark : base;
  const cardBg = theme.card || "#fff";
  const textColor = theme.text || "#1e293b";
  const mutedColor = theme.textMuted || "#64748b";
  const borderColor = theme.cardBorder || "#e2e8f0";
  const bgColor = theme.bg || "#f1f5f9";

  // ── Color degradé de sprint según progreso ──────────────────────────────
  function getSprintDayColor(dateStr) {
    // Buscar si el día pertenece a algún sprint
    const sprint = sprintEvents.find(s =>
      dateStr >= s.start_date && dateStr <= (s.end_date || s.start_date)
    );
    if (!sprint) return null;

    const start = new Date(sprint.start_date + "T12:00:00");
    const end   = new Date(sprint.end_date   + "T12:00:00");
    const cur   = new Date(dateStr           + "T12:00:00");

    const total    = end - start;
    const elapsed  = cur - start;
    const progress = Math.min(Math.max(elapsed / total, 0), 1); // 0 → 1

    // Degradé: verde → amarillo → rojo
    let r, g, b;
    if (progress < 0.5) {
      // Verde (#22C55E) → Amarillo (#EAB308)
      const t = progress / 0.5;
      r = Math.round(34  + (234 - 34)  * t);
      g = Math.round(197 + (179 - 197) * t);
      b = Math.round(94  + (8   - 94)  * t);
    } else {
      // Amarillo (#EAB308) → Rojo (#EF4444)
      const t = (progress - 0.5) / 0.5;
      r = Math.round(234 + (239 - 234) * t);
      g = Math.round(179 + (68  - 179) * t);
      b = Math.round(8   + (68  - 8)   * t);
    }
    return { color: `rgb(${r},${g},${b})`, progress, sprint };
  }

  // ── Vista Quarter ────────────────────────────────────────────────────────────
  function QuarterView() {
    const qStart = selectedQuarter * 3;   // mes inicial del Q (0-based)
    const months = [qStart, qStart + 1, qStart + 2];
    const todayStr = today.toISOString().slice(0, 10);

    // Determina el color de la pastilla de sprint según si es inicio, fin o medio
    function sprintPillColor(ev, dateStr) {
      if (ev.type !== "sprint") return null;
      const isStart = dateStr === ev.start_date;
      const isEnd   = dateStr === (ev.end_date || ev.start_date);
      if (isStart && isEnd) return "#3B82F6"; // sprint de 1 día
      if (isStart) return "#22C55E";           // verde: inicio
      if (isEnd)   return "#EF4444";           // rojo: cierre
      // Medio: degradé según progreso
      const sd = getSprintDayColor(dateStr);
      return sd ? sd.color : "#3B82F6";
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Tabs Q1-Q4 */}
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2,3].map(q => {
            const qMonths = ["Ene–Mar","Abr–Jun","Jul–Sep","Oct–Dic"];
            const isActive = q === selectedQuarter;
            const isCurrent = q === Math.floor(today.getMonth() / 3) && year === today.getFullYear();
            return (
              <button key={q} onClick={() => setSelectedQuarter(q)} style={{
                padding: "6px 18px", borderRadius: 8, border: `2px solid ${isActive ? "#3B82F6" : borderColor}`,
                background: isActive ? "#3B82F6" : cardBg,
                color: isActive ? "#fff" : isCurrent ? "#3B82F6" : mutedColor,
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>
                Q{q+1} <span style={{ fontSize: 10, opacity: 0.8 }}>{qMonths[q]}</span>
                {isCurrent && !isActive && <span style={{ fontSize: 8, marginLeft: 4, color: "#3B82F6" }}>●</span>}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 12, color: mutedColor, alignSelf: "center" }}>
            {year}
          </span>
        </div>

        {/* 3 meses del Q — uno por fila, 100% ancho */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {months.map(m => {
            const daysInM = getDaysInMonth(year, m);
            const firstDay = getFirstDayOfMonth(year, m);
            const cells = [];
            const prevDays = getDaysInMonth(year, m - 1 < 0 ? 11 : m - 1);
            for (let i = firstDay - 1; i >= 0; i--)
              cells.push({ day: prevDays - i, cur: false });
            for (let d = 1; d <= daysInM; d++)
              cells.push({ day: d, cur: true });
            while (cells.length < 35) cells.push({ day: cells.length - daysInM - firstDay + 2, cur: false });

            const isCurMonth = m === today.getMonth() && year === today.getFullYear();

            return (
              <div key={m} style={{
                background: cardBg, borderRadius: 12, padding: "16px 20px",
                border: `1px solid ${isCurMonth ? "#3B82F6" : borderColor}`,
                boxShadow: isCurMonth ? "0 0 0 1px #3B82F620" : "none",
              }}>
                {/* Header del mes */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: textColor }}>
                    {MONTHS[m]}
                  </div>
                  {isCurMonth && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
                      background: "#DBEAFE", color: "#1D4ED8", fontWeight: 700 }}>
                      Mes actual
                    </span>
                  )}
                  {/* Resumen de eventos del mes */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(EVENT_TYPES).map(([key, info]) => {
                      const count = cells.filter(cell => {
                        if (!cell.cur) return false;
                        const ds = isoDate(year, m, cell.day);
                        return eventsForDay(ds).some(e => e.type === key);
                      }).length;
                      if (count === 0) return null;
                      return (
                        <span key={key} style={{ fontSize: 10, color: info.color, fontWeight: 700 }}>
                          {info.icon} {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Cabecera días */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                  {DAYS_SHORT.map(d => (
                    <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700,
                      color: d === "Dom" || d === "Sáb" ? "#F97316" : mutedColor, padding: "4px 0" }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grilla de días */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {cells.map((cell, ci) => {
                    const dateStr = cell.cur ? isoDate(year, m, cell.day) : "";
                    const dayEvs = dateStr ? eventsForDay(dateStr) : [];
                    const isToday = dateStr === todayStr;
                    const isWeekend = [0,6].includes(new Date((dateStr || isoDate(year, m, 1)) + "T12:00:00").getDay());
                    const hasHoliday = dayEvs.some(e => e.type === "holiday");

                    const cellBg = !cell.cur ? "transparent"
                      : isToday ? c("#EFF6FF","#1E3A5F")
                      : hasHoliday ? c("#FFF7ED","#431407")
                      : isWeekend ? c("#F8FAFC","#131F35")
                      : theme.bg === "#0F172A" ? "#0F172A" : "#F8FAFC";

                    return (
                      <div key={ci} onClick={() => cell.cur && openNewEvent(dateStr)}
                        style={{
                          minHeight: 80, padding: "6px 8px", borderRadius: 6,
                          background: cellBg,
                          border: `1px solid ${isToday ? "#3B82F6" : cell.cur ? borderColor : "transparent"}`,
                          opacity: cell.cur ? 1 : 0,
                          cursor: cell.cur ? "pointer" : "default",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => cell.cur && (e.currentTarget.style.background = c("#EAF2FF","#1a2f50"))}
                        onMouseLeave={e => cell.cur && (e.currentTarget.style.background = cellBg)}>

                        {/* Número del día */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{
                            fontSize: 13, fontWeight: isToday ? 800 : 500,
                            background: isToday ? "#3B82F6" : "transparent",
                            color: isToday ? "#fff" : isWeekend ? "#F97316" : textColor,
                            width: 22, height: 22, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{cell.cur ? cell.day : ""}</span>
                        </div>

                        {/* Feriado — siempre primero y con nombre */}
                        {(() => {
                          const holidayEv = dayEvs.find(e => e.type === "holiday");
                          const nonHolidayEvs = dayEvs.filter(e => e.type !== "holiday" && !(e.type === "sprint" && (isWeekend || !!holidayEv)));
                          const sprintEvs = dayEvs.filter(e => e.type === "sprint" && !isWeekend && !holidayEv);
                          const visibleEvs = [...sprintEvs, ...nonHolidayEvs];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {holidayEv && (
                                <div style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3,
                                  background: "#F97316", color: "#fff",
                                  fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                  title={holidayEv.title}>
                                  🇦🇷 {holidayEv.title}
                                </div>
                              )}
                              {visibleEvs.slice(0, holidayEv ? 2 : 3).map((ev, ei) => {
                                const info = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
                                const pillColor = sprintPillColor(ev, dateStr) || (ev.color || info.color);
                                const isSprint = ev.type === "sprint";
                                return (
                                  <div key={ei} onClick={e => { e.stopPropagation(); openEditEvent(ev); }}
                                    title={ev.title}
                                    style={{
                                      fontSize: 9, padding: "2px 5px", borderRadius: 3, cursor: "pointer",
                                      background: isSprint ? pillColor : (ev.color || info.color) + "25",
                                      borderLeft: !isSprint ? `2px solid ${ev.color || info.color}` : "none",
                                      color: isSprint ? "#fff" : (ev.color || info.color),
                                      fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                    }}>
                                    {info.icon} {ev.title}
                                  </div>
                                );
                              })}
                              {visibleEvs.length > (holidayEv ? 2 : 3) && (
                                <div style={{ fontSize: 9, color: mutedColor }}>+{visibleEvs.length - (holidayEv ? 2 : 3)} más</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Vista Sprint ─────────────────────────────────────────────────────────────
  function SprintView() {
    // Sprints del año ordenados por fecha
    const sortedSprints = [...sprintEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (sortedSprints.length === 0) return (
      <div style={{ textAlign: "center", padding: 60, color: mutedColor, fontSize: 13 }}>
        No hay sprints cargados para {year}
      </div>
    );

    const idx = Math.min(Math.max(selectedSprintIdx, 0), sortedSprints.length - 1);
    const sprint = sortedSprints[idx];
    const sprintStart = new Date(sprint.start_date + "T12:00:00");
    const sprintEnd   = new Date((sprint.end_date || sprint.start_date) + "T12:00:00");
    const todayStr = today.toISOString().slice(0, 10);

    // Generar todos los días del sprint
    const sprintDays = [];
    const cur = new Date(sprintStart);
    while (cur <= sprintEnd) {
      sprintDays.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    // Agrupar por semanas
    const weeks = [];
    let week = [];
    // Rellenar días anteriores al lunes inicial
    const firstDow = sprintStart.getDay(); // 0=Dom
    const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
    for (let p = 0; p < mondayOffset; p++) week.push(null);
    sprintDays.forEach(d => {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    });
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    // Progreso general del sprint
    const totalDays = sprintDays.length;
    const elapsedDays = sprintDays.filter(d => d <= todayStr).length;
    const progressPct = totalDays > 0 ? Math.round(elapsedDays / totalDays * 100) : 0;
    const sprintColor = getSprintDayColor(todayStr)?.color || "#3B82F6";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Selector de sprint */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedSprintIdx(i => Math.max(i-1, 0))} style={navBtn} disabled={idx === 0}>◀</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <select value={idx} onChange={e => setSelectedSprintIdx(Number(e.target.value))}
              style={{ width: "100%", padding: "7px 12px", borderRadius: 8,
                border: `1px solid ${borderColor}`, background: cardBg, color: textColor,
                fontSize: 13, fontWeight: 700, cursor: "pointer", outline: "none" }}>
              {sortedSprints.map((s, i) => (
                <option key={i} value={i}>{s.title || s.name || `Sprint ${i+1}`}
                  {s.state === "active" ? " 🟢" : s.state === "future" ? " 🔵" : " ✓"}
                </option>
              ))}
            </select>
          </div>
          <button onClick={() => setSelectedSprintIdx(i => Math.min(i+1, sortedSprints.length-1))} style={navBtn} disabled={idx === sortedSprints.length-1}>▶</button>
          {/* Ir al sprint activo */}
          {sortedSprints.findIndex(s => s.state === "active") >= 0 && (
            <button onClick={() => setSelectedSprintIdx(sortedSprints.findIndex(s => s.state === "active"))}
              style={{ ...navBtn, color: "#22C55E", borderColor: "#22C55E", fontWeight: 700 }}>
              🟢 Activo
            </button>
          )}
        </div>

        {/* Info del sprint + barra de progreso */}
        <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: textColor }}>
                {sprint.title || sprint.name}
                <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10,
                  background: sprint.state === "active" ? "#DCFCE7" : sprint.state === "future" ? "#DBEAFE" : "#F1F5F9",
                  color: sprint.state === "active" ? "#16A34A" : sprint.state === "future" ? "#1D4ED8" : "#64748B" }}>
                  {sprint.state === "active" ? "🟢 Activo" : sprint.state === "future" ? "🔵 Próximo" : "✓ Cerrado"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: mutedColor, marginTop: 3 }}>
                {new Date(sprint.start_date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"})}
                {" → "}
                {new Date((sprint.end_date||sprint.start_date)+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}
                {" · "}{totalDays} días totales
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: sprintColor }}>{progressPct}%</div>
              <div style={{ fontSize: 10, color: mutedColor }}>transcurrido</div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: borderColor, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: sprintColor,
              borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>

        {/* Grilla del sprint */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Header días */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700,
                color: d === "Dom" || d === "Sáb" ? "#F97316" : mutedColor, padding: "4px 0" }}>
                {d}
              </div>
            ))}
          </div>
          {weeks.map((wk, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {wk.map((dateStr, di) => {
                if (!dateStr) return <div key={di} />;
                const dayEvs = eventsForDay(dateStr).filter(e => e.type !== "sprint");
                const isToday = dateStr === todayStr;
                const isWeekend = [0,6].includes(new Date(dateStr+"T12:00:00").getDay());
                const hasHoliday = eventsForDay(dateStr).some(e => e.type === "holiday");
                const sd = getSprintDayColor(dateStr);
                const isFirst = dateStr === sprint.start_date;
                const isLast  = dateStr === (sprint.end_date || sprint.start_date);

                const cellBg = isToday ? c("#EFF6FF","#1E3A5F")
                  : hasHoliday ? c("#FFF7ED","#431407")
                  : isWeekend ? c("#F8FAFC","#131F35")
                  : cardBg;

                return (
                  <div key={di} onClick={() => openNewEvent(dateStr)}
                    style={{ minHeight: 80, padding: "4px 6px", borderRadius: 8, cursor: "pointer",
                      background: cellBg,
                      border: `2px solid ${isToday ? "#3B82F6" : isFirst ? "#22C55E" : isLast ? "#EF4444" : borderColor}`,
                      position: "relative" }}>
                    {/* Badge inicio/fin */}
                    {(isFirst || isLast) && (
                      <div style={{ position: "absolute", top: -1, right: -1,
                        fontSize: 7, fontWeight: 800, padding: "1px 4px", borderRadius: "0 6px 0 4px",
                        background: isFirst ? "#22C55E" : "#EF4444", color: "#fff" }}>
                        {isFirst ? "INICIO" : "FIN"}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: isToday ? 800 : 500,
                        background: isToday ? "#3B82F6" : "transparent",
                        color: isToday ? "#fff" : isWeekend ? "#F97316" : textColor,
                        width: isToday ? 22 : "auto", height: isToday ? 22 : "auto",
                        borderRadius: isToday ? "50%" : 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {new Date(dateStr+"T12:00:00").getDate()}
                      </span>
                      {/* Punto de color de progreso */}
                      {sd && !isWeekend && !hasHoliday && (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sd.color }} />
                      )}
                    </div>
                    {/* Eventos del día (sin el sprint) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {hasHoliday && (
                        <div style={{ fontSize: 8, color: "#F97316", fontWeight: 700 }}>🇦🇷 Feriado</div>
                      )}
                      {dayEvs.slice(0, 3).map((ev, ei) => {
                        const info = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
                        const color = ev.color || info.color;
                        return (
                          <div key={ei} onClick={e => { e.stopPropagation(); openEditEvent(ev); }}
                            style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, cursor: "pointer",
                              background: color + "25", borderLeft: `2px solid ${color}`,
                              color, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {info.icon} {ev.person || ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length > 3 && <div style={{ fontSize: 7, color: mutedColor }}>+{dayEvs.length-3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const navBtn = {
    padding: "5px 10px", borderRadius: 6, border: `1px solid ${borderColor}`,
    background: cardBg, color: mutedColor, cursor: "pointer", fontSize: 11,
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${borderColor}`,
    background: theme.input || "#fff", color: textColor, fontSize: 12, boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header del calendario */}
      <div style={{ background: cardBg, borderRadius: 12, padding: "16px 24px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {/* Navegación año */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setYear(y => y-1)} style={navBtn}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: textColor, minWidth: 60, textAlign: "center" }}>
              {year}
            </span>
            <button onClick={() => setYear(y => y+1)} style={navBtn}>▶</button>
            <button onClick={() => {
              setYear(today.getFullYear());
              setSelectedQuarter(Math.floor(today.getMonth() / 3));
              setSelectedSprintIdx(0);
            }} style={{ ...navBtn, color: "#3B82F6", fontWeight: 600 }}>Hoy</button>
          </div>

          {/* Toggle Q/Sprint */}
          <div style={{ display: "flex", background: bgColor, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setViewMode("quarter")} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: viewMode === "quarter" ? "#3B82F6" : "transparent",
              color: viewMode === "quarter" ? "#fff" : mutedColor,
            }}>📊 Quarter</button>
            <button onClick={() => setViewMode("sprint")} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: viewMode === "sprint" ? "#3B82F6" : "transparent",
              color: viewMode === "sprint" ? "#fff" : mutedColor,
            }}>⚡ Sprint</button>
          </div>

          {/* Botón nuevo evento */}
          <button onClick={() => openNewEvent(today.toISOString().slice(0,10))} style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>+ Nuevo evento</button>
        </div>

        {/* Filtros por tipo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {Object.entries(EVENT_TYPES).map(([key, info]) => {
            const active = filterTypes.has(key);
            return (
              <button key={key} onClick={() => {
                setFilterTypes(prev => {
                  const next = new Set(prev);
                  active ? next.delete(key) : next.add(key);
                  return next;
                });
              }} style={{
                padding: "3px 10px", borderRadius: 20, border: `1px solid ${active ? info.color : borderColor}`,
                background: active ? info.color + "20" : "transparent",
                color: active ? info.color : mutedColor,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                {info.icon} {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vista */}
      <div style={{ background: cardBg, borderRadius: 12, padding: "16px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
        {viewMode === "quarter" ? <QuarterView /> : <SprintView />}
      </div>

      {/* Modal nuevo/editar evento */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: cardBg, borderRadius: 16, padding: 28, width: 460,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `1px solid ${borderColor}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 20 }}>
              {selectedEvent && !selectedEvent.id?.startsWith("holiday-") && !selectedEvent.id?.startsWith("sprint-")
                ? "✏️ Editar evento" : "➕ Nuevo evento"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  style={inputStyle} placeholder="Ej: Vacaciones Juan" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} style={inputStyle}>
                    {Object.entries(EVENT_TYPES).filter(([k]) => !["holiday","sprint"].includes(k)).map(([k,v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Persona</label>
                  <input value={form.person} onChange={e => setForm(f => ({...f, person: e.target.value}))}
                    style={inputStyle} placeholder="Nombre" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Fecha inicio *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  style={{ ...inputStyle, height: 60, resize: "vertical" }} placeholder="Notas opcionales..." />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                {selectedEvent && !selectedEvent.id?.startsWith("holiday-") && !selectedEvent.id?.startsWith("sprint-") && (
                  <button onClick={() => handleDelete(selectedEvent.id)} style={{
                    padding: "8px 16px", borderRadius: 8, border: "none",
                    background: "#FEE2E2", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>🗑 Eliminar</button>
                )}
                <button onClick={() => setShowModal(false)} style={{
                  padding: "8px 16px", borderRadius: 8, border: `1px solid ${borderColor}`,
                  background: "transparent", color: mutedColor, fontSize: 12, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={handleSave} style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PersonDetail Component ────────────────────────────────────────────────────
function PersonDetail({ person, T, onClose }) {
  const theme = T || THEMES.light;
  const card = theme.card, border = theme.cardBorder, text = theme.text;
  const muted = theme.textMuted, faint = theme.textFaint, bg = theme.bg;
  const isDark = theme.bg === "#0F172A";

  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("sprint"); // sprint | history | metrics
  const [jiraName, setJiraName] = useState(person.jira_name || "");
  const [jiraUsers, setJiraUsers] = useState([]);
  const [savingName, setSavingName] = useState(false);

  const cardS = { background:card, borderRadius:12, padding:"16px 20px", border:`1px solid ${border}` };
  const inp = { padding:"7px 10px", borderRadius:6, border:`1px solid ${border}`,
    background:theme.input||bg, color:text, fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" };

  useEffect(() => {
    loadJiraUsers();
    if (person.jira_name) loadStats();
    else setLoading(false);
  }, []);

  async function loadJiraUsers() {
    try {
      const r = await fetch(`${API}/people/jira-users?team=${person.team}`);
      const data = await r.json();
      setJiraUsers(Array.isArray(data) ? data : []);
    } catch(e) {}
  }

  async function loadStats() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/people/${person.id}/stats?team=${person.team}`);
      const data = await r.json();
      setStats(data);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function saveJiraName() {
    if (!jiraName) return;
    setSavingName(true);
    try {
      await fetch(`${API}/people/${person.id}`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({...person, jira_name: jiraName}),
      });
      person.jira_name = jiraName;
      await loadStats();
    } catch(e) {}
    setSavingName(false);
  }

  const STATUS_COLOR = { done:"#22C55E", indeterminate:"#F59E0B", new:"#64748B" };
  const STATUS_LABEL = { done:"✅ Listo", indeterminate:"🔄 En progreso", new:"⬜ Por hacer" };
  const TYPE_COLOR   = { "Historia":"#3B82F6","Bug":"#EF4444","Tarea":"#8B5CF6","Sub-tarea":"#94A3B8" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:2000,display:"flex",
      alignItems:"flex-start",justifyContent:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>

      {/* Panel lateral */}
      <div style={{width:720,maxWidth:"95vw",height:"100vh",overflowY:"auto",
        background:bg, borderLeft:`1px solid ${border}`,
        boxShadow:"-20px 0 60px rgba(0,0,0,0.3)",
        display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{padding:"24px 28px 0",borderBottom:`1px solid ${border}`,paddingBottom:16,
          background:card, position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
            <div style={{
              width:52,height:52,borderRadius:"50%",flexShrink:0,
              background:person.team==="Back"?"#8B5CF620":"#06B6D420",
              border:`2px solid ${person.team==="Back"?"#8B5CF6":"#06B6D4"}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:22,fontWeight:800,color:person.team==="Back"?"#8B5CF6":"#06B6D4",
            }}>{person.name.charAt(0).toUpperCase()}</div>

            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:800,color:text}}>{person.name}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:700,
                  background:person.team==="Back"?"#8B5CF620":"#06B6D420",
                  color:person.team==="Back"?"#8B5CF6":"#06B6D4"}}>{person.team}</span>
                <span style={{fontSize:11,color:muted}}>{person.role}</span>
                {person.birthday && <span style={{fontSize:11,color:"#EC4899"}}>🎂 {person.birthday}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${border}`,
              background:"transparent",color:muted,cursor:"pointer",fontSize:16,lineHeight:1}}>✕</button>
          </div>

          {/* Mapeo Jira */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:muted,fontWeight:600,whiteSpace:"nowrap"}}>Usuario Jira:</span>
            {jiraUsers.length > 0 ? (
              <select value={jiraName} onChange={e=>setJiraName(e.target.value)}
                style={{...inp,width:"auto",flex:1,minWidth:180}}>
                <option value="">— seleccioná el usuario —</option>
                {jiraUsers.map(u=><option key={u.displayName} value={u.displayName}>{u.displayName}</option>)}
              </select>
            ) : (
              <input value={jiraName} onChange={e=>setJiraName(e.target.value)}
                placeholder="Nombre exacto en Jira..." style={{...inp,flex:1,minWidth:180}} />
            )}
            <button onClick={saveJiraName} disabled={!jiraName||savingName} style={{
              padding:"7px 14px",borderRadius:8,border:"none",
              background:jiraName?"#3B82F6":"#94A3B8",color:"#fff",
              fontSize:12,fontWeight:600,cursor:jiraName?"pointer":"default",whiteSpace:"nowrap",
            }}>{savingName?"Cargando...":"🔗 Vincular"}</button>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:4}}>
            {[["sprint","🟢 Sprint Activo"],["history","📋 Historial"],["metrics","📊 Métricas"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} style={{
                padding:"7px 14px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",
                fontSize:12,fontWeight:600,
                background:tab===v?bg:"transparent",
                color:tab===v?text:muted,
                borderBottom:tab===v?`2px solid #3B82F6`:"2px solid transparent",
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{padding:"20px 28px",flex:1}}>

          {loading && (
            <div style={{textAlign:"center",padding:60,color:muted}}>
              <div style={{fontSize:32,marginBottom:12}}>⏳</div>
              Cargando datos de Jira...
            </div>
          )}

          {!loading && !stats && (
            <div style={{textAlign:"center",padding:60,color:muted}}>
              <div style={{fontSize:40,marginBottom:12}}>🔗</div>
              <div style={{fontSize:14,fontWeight:700,color:text,marginBottom:8}}>
                Vinculá esta persona con su usuario de Jira
              </div>
              <div style={{fontSize:12}}>
                Seleccioná el usuario de Jira arriba y hacé clic en "Vincular" para ver sus métricas.
              </div>
            </div>
          )}

          {!loading && stats && (
            <>
              {/* ── TAB SPRINT ACTIVO ─────────────────────────────────────── */}
              {tab === "sprint" && (
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:text}}>
                    {stats.active_sprint.name || "Sin sprint activo"}
                  </div>

                  {/* KPIs */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                    {[
                      {label:"SP asignados",  val:stats.active_sprint.sp_total,   color:"#3B82F6"},
                      {label:"SP entregados", val:stats.active_sprint.sp_done,    color:"#22C55E"},
                      {label:"Completado",    val:`${stats.active_sprint.completion}%`, color:"#8B5CF6"},
                      {label:"Lead time prom",val:stats.avg_lead_time?`${stats.avg_lead_time}d`:"—", color:"#F59E0B"},
                    ].map((k,i)=>(
                      <div key={i} style={{...cardS,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
                        <div style={{fontSize:10,color:muted,fontWeight:600,marginTop:2}}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barra progreso */}
                  <div style={cardS}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,color:muted}}>Progreso del sprint</span>
                      <span style={{fontSize:12,fontWeight:700,color:text}}>{stats.active_sprint.sp_done} / {stats.active_sprint.sp_total} SP</span>
                    </div>
                    <div style={{height:8,borderRadius:4,background:border,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,background:"#22C55E",
                        width:`${stats.active_sprint.completion}%`,transition:"width 0.5s"}}/>
                    </div>
                    <div style={{display:"flex",gap:16,marginTop:10}}>
                      {[
                        {label:`✅ Listo (${stats.active_sprint.count_done})`, color:"#22C55E"},
                        {label:`🔄 En progreso (${stats.active_sprint.count_prog})`, color:"#F59E0B"},
                        {label:`⬜ Por hacer (${stats.active_sprint.count_todo})`, color:"#64748B"},
                      ].map((s,i)=>(
                        <span key={i} style={{fontSize:11,color:s.color,fontWeight:600}}>{s.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* Tickets */}
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {stats.active_sprint.tickets.length === 0 && (
                      <div style={{color:muted,fontSize:12,textAlign:"center",padding:24}}>Sin tickets asignados en el sprint activo</div>
                    )}
                    {stats.active_sprint.tickets.map((t,i)=>(
                      <div key={i} style={{...cardS,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <a href={`${API.replace('/api/v1','')}/browse/${t.key}`} target="_blank" rel="noreferrer"
                          style={{fontSize:11,fontWeight:700,color:"#3B82F6",textDecoration:"none",whiteSpace:"nowrap"}}>{t.key}</a>
                        <span style={{flex:1,fontSize:12,color:text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.summary}</span>
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:700,whiteSpace:"nowrap",
                          background:(TYPE_COLOR[t.type]||"#94A3B8")+"20",color:TYPE_COLOR[t.type]||"#94A3B8"}}>{t.type}</span>
                        <span style={{fontSize:10,fontWeight:700,color:STATUS_COLOR[t.status_cat]||muted,whiteSpace:"nowrap"}}>{STATUS_LABEL[t.status_cat]||t.status}</span>
                        {t.sp>0 && <span style={{fontSize:11,fontWeight:800,color:"#8B5CF6",whiteSpace:"nowrap"}}>{t.sp} SP</span>}
                        {t.lead_time && <span style={{fontSize:10,color:muted,whiteSpace:"nowrap"}}>⏱ {t.lead_time}d</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB HISTORIAL ─────────────────────────────────────────── */}
              {tab === "history" && (
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{fontSize:12,color:muted}}>
                    Sprints analizados: <strong style={{color:text}}>{stats.sprints_analyzed.join(", ") || "—"}</strong>
                  </div>

                  {/* Velocidad por sprint */}
                  <div style={cardS}>
                    <div style={{fontSize:12,fontWeight:700,color:text,marginBottom:12}}>Velocidad por sprint</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {Object.entries(stats.velocity_by_sprint).map(([spName, v],i)=>{
                        const pct = v.committed > 0 ? v.delivered/v.committed*100 : 0;
                        return (
                          <div key={i}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontSize:11,color:muted,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{spName}</span>
                              <span style={{fontSize:11,fontWeight:700,color:text}}>{v.delivered} / {v.committed} SP ({v.tickets} tickets)</span>
                            </div>
                            <div style={{height:6,borderRadius:3,background:border,overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:3,
                                background:pct>=85?"#22C55E":pct>=70?"#F59E0B":"#EF4444",
                                width:`${Math.min(pct,100)}%`}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tickets historial */}
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{fontSize:12,fontWeight:700,color:text,marginBottom:4}}>Tickets cerrados</div>
                    {stats.history_tickets.filter(t=>t.status_cat==="done").map((t,i)=>(
                      <div key={i} style={{...cardS,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <a href={`https://jira.gbsj.com.ar/browse/${t.key}`} target="_blank" rel="noreferrer"
                          style={{fontSize:11,fontWeight:700,color:"#3B82F6",textDecoration:"none",whiteSpace:"nowrap"}}>{t.key}</a>
                        <span style={{flex:1,fontSize:12,color:text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.summary}</span>
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:700,
                          background:(TYPE_COLOR[t.type]||"#94A3B8")+"20",color:TYPE_COLOR[t.type]||"#94A3B8"}}>{t.type}</span>
                        {t.sp>0 && <span style={{fontSize:11,fontWeight:800,color:"#8B5CF6",whiteSpace:"nowrap"}}>{t.sp} SP</span>}
                        {t.lead_time && <span style={{fontSize:10,color:muted,whiteSpace:"nowrap"}}>⏱ {t.lead_time}d</span>}
                        <span style={{fontSize:9,color:faint,whiteSpace:"nowrap"}}>{t.sprint.split(" - ").pop()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB MÉTRICAS ──────────────────────────────────────────── */}
              {tab === "metrics" && (
                <div style={{display:"flex",flexDirection:"column",gap:16}}>

                  {/* KPIs resumen */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {[
                      {label:"Velocidad promedio", val:`${stats.avg_velocity} SP`, icon:"⚡", color:"#3B82F6", sub:"por sprint (últ. 3)"},
                      {label:"Lead time promedio", val:stats.avg_lead_time?`${stats.avg_lead_time} días`:"—", icon:"⏱", color:"#F59E0B", sub:"desde creación a cierre"},
                      {label:"Total tickets (historial)", val:stats.history_tickets.length, icon:"🎫", color:"#8B5CF6", sub:"últimos 3 sprints"},
                    ].map((k,i)=>(
                      <div key={i} style={{...cardS,textAlign:"center",padding:"20px 16px"}}>
                        <div style={{fontSize:28,marginBottom:6}}>{k.icon}</div>
                        <div style={{fontSize:24,fontWeight:800,color:k.color}}>{k.val}</div>
                        <div style={{fontSize:11,fontWeight:700,color:text,marginTop:4}}>{k.label}</div>
                        <div style={{fontSize:10,color:muted,marginTop:2}}>{k.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Distribución por tipo */}
                  <div style={cardS}>
                    <div style={{fontSize:12,fontWeight:700,color:text,marginBottom:14}}>Distribución por tipo de ticket</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {Object.entries(stats.type_distribution)
                        .sort((a,b)=>b[1]-a[1])
                        .map(([type,count],i)=>{
                          const total = Object.values(stats.type_distribution).reduce((a,b)=>a+b,0);
                          const pct = total > 0 ? count/total*100 : 0;
                          const color = TYPE_COLOR[type] || "#64748B";
                          return (
                            <div key={i}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                                <span style={{fontSize:11,color:text,fontWeight:600}}>{type}</span>
                                <span style={{fontSize:11,color:muted}}>{count} ({pct.toFixed(0)}%)</span>
                              </div>
                              <div style={{height:6,borderRadius:3,background:border,overflow:"hidden"}}>
                                <div style={{height:"100%",borderRadius:3,background:color,width:`${pct}%`}}/>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Carga vs capacidad */}
                  <div style={cardS}>
                    <div style={{fontSize:12,fontWeight:700,color:text,marginBottom:14}}>Carga actual vs capacidad estimada</div>
                    {(() => {
                      const sprintSP = stats.active_sprint.sp_total;
                      const avgSP    = stats.avg_velocity || 0;
                      const pct      = avgSP > 0 ? sprintSP/avgSP*100 : 0;
                      const color    = pct > 110 ? "#EF4444" : pct > 90 ? "#F59E0B" : "#22C55E";
                      const label    = pct > 110 ? "⚠️ Sobrecargado" : pct > 90 ? "👌 Carga alta" : "✅ Carga normal";
                      return (
                        <>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                            <span style={{fontSize:12,color:muted}}>Sprint actual: <strong style={{color:text}}>{sprintSP} SP</strong></span>
                            <span style={{fontSize:12,color:muted}}>Velocidad prom: <strong style={{color:text}}>{avgSP} SP</strong></span>
                            <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
                          </div>
                          <div style={{height:12,borderRadius:6,background:border,overflow:"hidden",position:"relative"}}>
                            <div style={{height:"100%",borderRadius:6,background:color,
                              width:`${Math.min(pct,100)}%`,transition:"width 0.5s"}}/>
                            {/* Línea de capacidad */}
                            <div style={{position:"absolute",top:0,bottom:0,left:"90.9%",width:2,background:text,opacity:0.3}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                            <span style={{fontSize:10,color:muted}}>0 SP</span>
                            <span style={{fontSize:10,color:muted}}>Capacidad ({avgSP} SP)</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── TeamView Component ────────────────────────────────────────────────────────
function TeamView({ T }) {
  const theme = T || THEMES.light;
  const isDark = theme.bg === "#0F172A";
  const card = theme.card, border = theme.cardBorder, text = theme.text;
  const muted = theme.textMuted, faint = theme.textFaint, bg = theme.bg;

  const TEAMS = ["Back", "Datos"];
  const ROLES = ["Developer", "Tech Lead", "Scrum Master", "QA", "Data Engineer", "Data Analyst", "Product Owner", "DevOps", "Otro"];
  const ABSENCE_TYPES = {
    vacation: { label: "Vacaciones",      color: "#22C55E", icon: "🏖️" },
    medical:  { label: "Lic. Médica",     color: "#EF4444", icon: "🏥" },
    exam:     { label: "Lic. Examen",     color: "#8B5CF6", icon: "📝" },
    study:    { label: "Lic. Estudio",    color: "#06B6D4", icon: "📚" },
    other:    { label: "Otro",            color: "#64748B", icon: "📌" },
  };

  const [people, setPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filterTeam, setFilterTeam] = useState("Todos");
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [editAbsencePerson, setEditAbsencePerson] = useState(null);
  const [personForm, setPersonForm] = useState({ name:"", team:"Back", role:"Developer", birthday:"" });
  const [absenceForm, setAbsenceForm] = useState({ type:"vacation", start_date:"", end_date:"", notes:"" });
  const [activeTab, setActiveTab] = useState("people"); // people | availability
  const [availRange, setAvailRange] = useState({ start:"", end:"", team:"Todos" });
  const [availability, setAvailability] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  useEffect(() => { loadPeople(); }, []);

  async function loadPeople() {
    try {
      const r = await fetch(`${API}/people/`);
      const data = await r.json();
      setPeople(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  }

  async function savePerson() {
    if (!personForm.name) return;
    try {
      if (editPerson) {
        await fetch(`${API}/people/${editPerson.id}`, {
          method: "PUT", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({...personForm, absences: editPerson.absences || []}),
        });
      } else {
        await fetch(`${API}/people/`, {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify(personForm),
        });
      }
      setShowPersonModal(false); setEditPerson(null);
      setPersonForm({ name:"", team:"Back", role:"Developer", birthday:"" });
      await loadPeople();
    } catch(e) { console.error(e); }
  }

  async function deletePerson(id) {
    if (!confirm("¿Eliminar esta persona?")) return;
    await fetch(`${API}/people/${id}`, { method: "DELETE" });
    await loadPeople();
  }

  async function saveAbsence() {
    if (!absenceForm.start_date || !editAbsencePerson) return;
    try {
      await fetch(`${API}/people/${editAbsencePerson.id}/absences`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(absenceForm),
      });
      setShowAbsenceModal(false);
      setAbsenceForm({ type:"vacation", start_date:"", end_date:"", notes:"" });
      await loadPeople();
    } catch(e) { console.error(e); }
  }

  async function deleteAbsence(personId, absenceId) {
    await fetch(`${API}/people/${personId}/absences/${absenceId}`, { method: "DELETE" });
    await loadPeople();
  }

  async function loadAvailability() {
    if (!availRange.start || !availRange.end) return;
    setLoadingAvail(true);
    try {
      const team = availRange.team === "Todos" ? "" : availRange.team;
      const r = await fetch(`${API}/people/availability?start=${availRange.start}&end=${availRange.end}${team ? `&team=${team}` : ""}`);
      setAvailability(await r.json());
    } catch(e) { console.error(e); }
    setLoadingAvail(false);
  }

  const filteredPeople = filterTeam === "Todos" ? people : people.filter(p => p.team === filterTeam);
  const today = new Date().toISOString().slice(0,10);

  const inp = {
    padding:"8px 10px", borderRadius:6, border:`1px solid ${border}`,
    background: theme.input||bg, color:text, fontSize:12, boxSizing:"border-box", outline:"none", width:"100%",
  };
  const cardStyle = { background:card, borderRadius:12, padding:"20px 24px", border:`1px solid ${border}`, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" };

  // Quién está ausente hoy
  const absentToday = people.filter(p =>
    p.absences?.some(a => a.start_date <= today && today <= a.end_date)
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* KPIs rápidos */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {[
          { label:"Total personas", value: people.length, color:"#3B82F6", icon:"👥" },
          { label:"Equipo Back",    value: people.filter(p=>p.team==="Back").length, color:"#8B5CF6", icon:"⚙️" },
          { label:"Equipo Datos",   value: people.filter(p=>p.team==="Datos").length, color:"#06B6D4", icon:"📊" },
          { label:"Ausentes hoy",   value: absentToday.length, color: absentToday.length>0?"#EF4444":"#22C55E", icon:"🏖️" },
        ].map((k,i) => (
          <div key={i} style={{...cardStyle, display:"flex", alignItems:"center", gap:16}}>
            <div style={{fontSize:28}}>{k.icon}</div>
            <div>
              <div style={{fontSize:26, fontWeight:800, color:k.color, letterSpacing:-1}}>{k.value}</div>
              <div style={{fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5}}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <div style={{ display:"flex", background:bg, borderRadius:8, padding:3 }}>
          {[["people","👥 Personas"],["availability","📅 Disponibilidad"]].map(([v,l]) => (
            <button key={v} onClick={() => setActiveTab(v)} style={{
              padding:"7px 16px", borderRadius:6, border:"none", cursor:"pointer",
              fontSize:12, fontWeight:600,
              background: activeTab===v ? "#3B82F6" : "transparent",
              color: activeTab===v ? "#fff" : muted,
            }}>{l}</button>
          ))}
        </div>
        {activeTab === "people" && (
          <>
            <div style={{display:"flex", gap:6, marginLeft:8}}>
              {["Todos",...TEAMS].map(t => (
                <button key={t} onClick={() => setFilterTeam(t)} style={{
                  padding:"5px 12px", borderRadius:20, border:`1px solid ${filterTeam===t?"#3B82F6":border}`,
                  background: filterTeam===t?"#3B82F6":"transparent",
                  color: filterTeam===t?"#fff":muted, fontSize:11, fontWeight:600, cursor:"pointer",
                }}>{t}</button>
              ))}
            </div>
            <button onClick={() => { setEditPerson(null); setPersonForm({name:"",team:"Back",role:"Developer",birthday:""}); setShowPersonModal(true); }}
              style={{ marginLeft:"auto", padding:"7px 16px", borderRadius:8, border:"none",
                background:"#3B82F6", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              + Persona
            </button>
          </>
        )}
      </div>

      {/* Vista Personas */}
      {activeTab === "people" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filteredPeople.length === 0 && (
            <div style={{...cardStyle, textAlign:"center", padding:48, color:muted}}>
              No hay personas cargadas aún. ¡Agregá la primera!
            </div>
          )}
          {filteredPeople.map(person => {
            const absentNow = person.absences?.find(a => a.start_date <= today && today <= a.end_date);
            return (
              <div key={person.id} style={{...cardStyle, cursor:"pointer"}} onClick={() => setSelectedPerson(person)}>
                <div style={{display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
                  {/* Avatar */}
                  <div style={{
                    width:44, height:44, borderRadius:"50%", flexShrink:0,
                    background: person.team==="Back" ? "#8B5CF620" : "#06B6D420",
                    border: `2px solid ${person.team==="Back"?"#8B5CF6":"#06B6D4"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:18, fontWeight:800, color:person.team==="Back"?"#8B5CF6":"#06B6D4",
                  }}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                      <span style={{fontSize:14, fontWeight:700, color:text}}>{person.name}</span>
                      <span style={{fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700,
                        background: person.team==="Back"?"#8B5CF620":"#06B6D420",
                        color: person.team==="Back"?"#8B5CF6":"#06B6D4"}}>
                        {person.team}
                      </span>
                      <span style={{fontSize:10, color:muted}}>{person.role}</span>
                      {person.birthday && <span style={{fontSize:10, color:"#EC4899"}}>🎂 {person.birthday}</span>}
                      {absentNow && (
                        <span style={{fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700,
                          background: ABSENCE_TYPES[absentNow.type]?.color+"20",
                          color: ABSENCE_TYPES[absentNow.type]?.color}}>
                          {ABSENCE_TYPES[absentNow.type]?.icon} Ausente hoy
                        </span>
                      )}
                    </div>

                    {/* Ausencias */}
                    {person.absences?.length > 0 && (
                      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:8}}>
                        {person.absences.map(ab => {
                          const atype = ABSENCE_TYPES[ab.type] || ABSENCE_TYPES.other;
                          const isPast = ab.end_date < today;
                          return (
                            <div key={ab.id} style={{
                              display:"flex", alignItems:"center", gap:4,
                              fontSize:10, padding:"2px 8px", borderRadius:6,
                              background: atype.color+(isPast?"15":"25"),
                              border:`1px solid ${atype.color+(isPast?"40":"80")}`,
                              color: atype.color, opacity: isPast ? 0.6 : 1,
                            }}>
                              {atype.icon} {ab.start_date} → {ab.end_date}
                              <button onClick={() => deleteAbsence(person.id, ab.id)}
                                style={{background:"none",border:"none",cursor:"pointer",color:atype.color,fontSize:10,padding:"0 2px",lineHeight:1}}>
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{display:"flex", gap:6, flexShrink:0}}>
                    <button onClick={() => { setEditAbsencePerson(person); setAbsenceForm({type:"vacation",start_date:"",end_date:"",notes:""}); setShowAbsenceModal(true); }}
                      style={{padding:"5px 10px", borderRadius:6, border:`1px solid ${border}`,
                        background:"transparent", color:muted, fontSize:11, cursor:"pointer"}}>
                      + Ausencia
                    </button>
                    <button onClick={() => { setEditPerson(person); setPersonForm({name:person.name,team:person.team,role:person.role,birthday:person.birthday||""}); setShowPersonModal(true); }}
                      style={{padding:"5px 10px", borderRadius:6, border:`1px solid ${border}`,
                        background:"transparent", color:muted, fontSize:11, cursor:"pointer"}}>
                      ✏️
                    </button>
                    <button onClick={() => deletePerson(person.id)}
                      style={{padding:"5px 10px", borderRadius:6, border:"none",
                        background:"#FEE2E2", color:"#EF4444", fontSize:11, cursor:"pointer"}}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista Disponibilidad */}
      {activeTab === "availability" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{...cardStyle, display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap"}}>
            <div style={{flex:1, minWidth:120}}>
              <label style={{fontSize:11,color:muted,fontWeight:600,display:"block",marginBottom:4}}>Desde</label>
              <input type="date" value={availRange.start} onChange={e=>setAvailRange(r=>({...r,start:e.target.value}))} style={inp} />
            </div>
            <div style={{flex:1, minWidth:120}}>
              <label style={{fontSize:11,color:muted,fontWeight:600,display:"block",marginBottom:4}}>Hasta</label>
              <input type="date" value={availRange.end} onChange={e=>setAvailRange(r=>({...r,end:e.target.value}))} style={inp} />
            </div>
            <div style={{flex:1, minWidth:120}}>
              <label style={{fontSize:11,color:muted,fontWeight:600,display:"block",marginBottom:4}}>Equipo</label>
              <select value={availRange.team} onChange={e=>setAvailRange(r=>({...r,team:e.target.value}))} style={inp}>
                {["Todos",...TEAMS].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={loadAvailability} disabled={loadingAvail} style={{
              padding:"8px 20px", borderRadius:8, border:"none",
              background:"#3B82F6", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer",
              opacity: loadingAvail ? 0.7 : 1,
            }}>{loadingAvail ? "Cargando..." : "Ver disponibilidad"}</button>
          </div>

          {availability.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
              {availability.map((day, i) => {
                const pct = day.total > 0 ? day.available / day.total : 1;
                const color = pct >= 0.8 ? "#22C55E" : pct >= 0.5 ? "#F97316" : "#EF4444";
                const isWknd = [0,6].includes(new Date(day.date+"T12:00:00").getDay());
                return (
                  <div key={i} style={{
                    background: isWknd ? (isDark?"#131F35":theme.kanbanBg) : card,
                    border:`1px solid ${isWknd?border:color+"60"}`,
                    borderRadius:8, padding:"8px 10px", opacity: isWknd ? 0.5 : 1,
                  }}>
                    <div style={{fontSize:9,color:muted,fontWeight:600}}>
                      {new Date(day.date+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short"})}
                    </div>
                    <div style={{fontSize:12,fontWeight:800,color:text}}>
                      {new Date(day.date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"})}
                    </div>
                    {!isWknd && (
                      <>
                        <div style={{fontSize:18,fontWeight:800,color,marginTop:4}}>{day.available}<span style={{fontSize:10,color:muted}}>/{day.total}</span></div>
                        <div style={{height:3,borderRadius:2,background:border,overflow:"hidden",marginTop:4}}>
                          <div style={{height:"100%",width:`${pct*100}%`,background:color,borderRadius:2}}/>
                        </div>
                        {day.unavailable?.length > 0 && (
                          <div style={{marginTop:4,display:"flex",flexDirection:"column",gap:1}}>
                            {day.unavailable.map((u,ui)=>(
                              <div key={ui} style={{fontSize:8,color:"#EF4444",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                {ABSENCE_TYPES[u.type]?.icon} {u.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Persona */}
      {showPersonModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>e.target===e.currentTarget&&setShowPersonModal(false)}>
          <div style={{background:card,borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${border}`}}>
            <div style={{fontSize:15,fontWeight:700,color:text,marginBottom:20}}>
              {editPerson ? "✏️ Editar persona" : "➕ Nueva persona"}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={{fontSize:11,color:muted,fontWeight:600}}>Nombre *</label>
                <input value={personForm.name} onChange={e=>setPersonForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo" />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,color:muted,fontWeight:600}}>Equipo</label>
                  <select value={personForm.team} onChange={e=>setPersonForm(f=>({...f,team:e.target.value}))} style={inp}>
                    {TEAMS.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,color:muted,fontWeight:600}}>Rol</label>
                  <select value={personForm.role} onChange={e=>setPersonForm(f=>({...f,role:e.target.value}))} style={inp}>
                    {ROLES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,color:muted,fontWeight:600}}>Cumpleaños</label>
                <input type="date" value={personForm.birthday} onChange={e=>setPersonForm(f=>({...f,birthday:e.target.value}))} style={inp} />
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
                <button onClick={()=>setShowPersonModal(false)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${border}`,background:"transparent",color:muted,fontSize:12,cursor:"pointer"}}>Cancelar</button>
                <button onClick={savePerson} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#3B82F6",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PersonDetail Panel */}
      {selectedPerson && (
        <PersonDetail
          person={selectedPerson}
          T={T}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {/* Modal Ausencia */}
      {showAbsenceModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>e.target===e.currentTarget&&setShowAbsenceModal(false)}>
          <div style={{background:card,borderRadius:16,padding:28,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${border}`}}>
            <div style={{fontSize:15,fontWeight:700,color:text,marginBottom:4}}>
              🏖️ Nueva ausencia
            </div>
            <div style={{fontSize:12,color:muted,marginBottom:20}}>{editAbsencePerson?.name}</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={{fontSize:11,color:muted,fontWeight:600}}>Tipo</label>
                <select value={absenceForm.type} onChange={e=>setAbsenceForm(f=>({...f,type:e.target.value}))} style={inp}>
                  {Object.entries(ABSENCE_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,color:muted,fontWeight:600}}>Desde *</label>
                  <input type="date" value={absenceForm.start_date} onChange={e=>setAbsenceForm(f=>({...f,start_date:e.target.value}))} style={inp} />
                </div>
                <div>
                  <label style={{fontSize:11,color:muted,fontWeight:600}}>Hasta</label>
                  <input type="date" value={absenceForm.end_date} onChange={e=>setAbsenceForm(f=>({...f,end_date:e.target.value||absenceForm.start_date}))} style={inp} />
                </div>
              </div>
              <div>
                <label style={{fontSize:11,color:muted,fontWeight:600}}>Notas</label>
                <input value={absenceForm.notes} onChange={e=>setAbsenceForm(f=>({...f,notes:e.target.value}))} style={inp} placeholder="Opcional..." />
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
                <button onClick={()=>setShowAbsenceModal(false)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${border}`,background:"transparent",color:muted,fontSize:12,cursor:"pointer"}}>Cancelar</button>
                <button onClick={saveAbsence} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#3B82F6",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState("");
  const [filter, setFilter] = useState({ type: "last_n", n: 3 });
  const [view, setView] = useState("dashboard");
  const [pdfLoading, setPdfLoading] = useState(false);
  const contentRef = useRef(null);

  // Dark mode: sistema por defecto, con override manual
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const [darkMode, setDarkMode] = useState(systemDark);
  const T = THEMES[darkMode ? "dark" : "light"];

  useEffect(() => {
    fetch(`${API}/sprints/teams`)
      .then(r => r.json())
      .then(t => { const arr = Array.isArray(t) ? t : []; setTeams(arr); setTeam(arr[0] || ""); });
  }, []);

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      const el = contentRef.current;
      const canvas = await window.html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: T.bg });
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 1.5, canvas.height / 1.5] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 1.5, canvas.height / 1.5);
      const viewNames = { dashboard: "Performance", executive: "Ejecutivo", sprint: "Sprint" };
      pdf.save(`agility-${viewNames[view]}-${team}-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch(e) {
      alert("Error al generar PDF: " + e.message);
    }
    setPdfLoading(false);
  };

  const selectStyle = {
    padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.inputBorder}`,
    fontSize: 13, color: T.text, background: T.input, cursor: "pointer", outline: "none",
  };
  const btnStyle = (active) => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600, transition: "all 0.15s",
    background: active ? T.btnActive : T.btnInactive,
    color: active ? T.btnActiveTxt : T.btnInactiveTxt,
  });
  const filterLabel = filter.type === "last_n" ? "Últimos 3 sprints" : `Q${filter.quarter} ${filter.year}`;
  const titles = {
    dashboard: `Dashboard de Performance — Equipo ${team}`,
    executive: `Reporte Ejecutivo — Equipo ${team}`,
    sprint: `Sprint en Curso — Equipo ${team}`,
    calendar: `Calendario de Planificación — Equipo ${team}`,
    team: "Gestión del Equipo",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      {/* Header */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.headerBorder}`, position: "sticky", top: 0, zIndex: 100, transition: "background 0.3s" }}>
        <div style={{ width: "100%", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, boxSizing: "border-box", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 15 }}>⚡</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Agility Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <select value={team} onChange={e => setTeam(e.target.value)} style={selectStyle}>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {view !== "sprint" && view !== "calendar" && <PeriodSelector filter={filter} onChange={setFilter} T={T} />}
            <div style={{ display: "flex", background: darkMode ? "#0F172A" : "#F1F5F9", borderRadius: 10, padding: 3 }}>
              <button style={btnStyle(view === "dashboard")} onClick={() => setView("dashboard")}>Performance</button>
              <button style={btnStyle(view === "executive")} onClick={() => setView("executive")}>Ejecutivo</button>
              <button style={btnStyle(view === "sprint")} onClick={() => setView("sprint")}>🟢 Sprint Actual</button>
              <button style={btnStyle(view === "calendar")} onClick={() => setView("calendar")}>📅 Calendario</button>
              <button style={btnStyle(view === "team")} onClick={() => setView("team")}>👥 Equipo</button>
            </div>
            {/* Dark mode toggle */}
            <button onClick={() => setDarkMode(d => !d)} style={{
              padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.inputBorder}`,
              background: T.input, color: T.text, cursor: "pointer", fontSize: 16, lineHeight: 1,
            }} title={darkMode ? "Modo claro" : "Modo oscuro"}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            {/* PDF export */}
            <button onClick={handleExportPDF} disabled={pdfLoading} style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: pdfLoading ? "#94A3B8" : "#3B82F6", color: "#fff",
              cursor: pdfLoading ? "default" : "pointer", fontSize: 12, fontWeight: 600,
            }}>
              {pdfLoading ? "Generando..." : "📄 PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Contenido exportable */}
      <div ref={contentRef} style={{ width: "100%", padding: "24px", boxSizing: "border-box", background: T.bg }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>{titles[view]}</h1>
          <p style={{ fontSize: 12, color: T.textFaint, margin: "4px 0 0" }}>
            {view === "sprint" ? "Datos en vivo · Auto-refresh cada 5 minutos" : `Datos desde Jira · ${filterLabel}`}
          </p>
        </div>
        {team && view === "dashboard" && <DashboardPerformance team={team} filter={filter} T={T} />}
        {team && view === "executive" && <ReporteEjecutivo team={team} filter={filter} T={T} />}
        {team && view === "sprint" && <SprintEnCurso team={team} T={T} />}
        {team && view === "calendar" && <CalendarView team={team} T={T} />}
        {view === "team" && <TeamView T={T} />}
      </div>
    </div>
  );
}