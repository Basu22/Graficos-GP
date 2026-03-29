import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { API, JIRA_BASE, THEMES, COLORS, KANBAN_COLUMNS, STATUS_COLUMN, TYPE_COLOR, PRIORITY_ICON } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { KPICard, ChartCard, Spinner, EmptyState } from "../components/ui";

// ── TicketCard ────────────────────────────────────────────────────────────────
function TicketCard({ ticket, T }) {
  const theme = T || THEMES.light;
  const subtasks = ticket.subtasks || [];
  const totalSub = subtasks.length;
  const doneSub = subtasks.filter((s) => s.status_category === "done").length;
  const pct = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : null;
  const typeColor = TYPE_COLOR[ticket.issue_type] || "#64748B";
  const prioIcon = PRIORITY_ICON[ticket.priority] || "🟠";

  return (
    <div
      style={{ background: theme.card, borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", border: `1px solid ${theme.cardBorder}`, marginBottom: 10, cursor: "pointer", transition: "box-shadow 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = theme.tableHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = theme.card)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: theme?.bg === "#0F172A" ? `${typeColor}33` : `${typeColor}18`, padding: "1px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
          {ticket.issue_type}
        </span>
        <a href={`${JIRA_BASE}/browse/${ticket.key}`} target="_blank" rel="noreferrer"
          style={{ fontSize: 11, fontWeight: 700, color: "#0052CC", textDecoration: "none", flex: 1 }}
          onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.target.style.textDecoration = "none")}>
          {ticket.key}
        </a>
        <span title={ticket.priority} style={{ fontSize: 13 }}>{prioIcon}</span>
        {ticket.story_points > 0 && (
          <span style={{ background: "#EAF2FF", color: "#0052CC", borderRadius: 10, padding: "1px 8px", fontWeight: 700, fontSize: 11 }}>
            {ticket.story_points} SP
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.4, marginBottom: 10, fontWeight: 500 }}>{ticket.summary}</div>

      {ticket.epic_link && (
        <div style={{ marginBottom: 8 }}>
          <a href={`${JIRA_BASE}/browse/${ticket.epic_link}`} target="_blank" rel="noreferrer"
            style={{ background: theme?.bg === "#0F172A" ? "#2D1F6E" : "#EAE6FF", color: theme?.bg === "#0F172A" ? "#C4B5FD" : "#5243AA", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, textDecoration: "none" }}>
            {ticket.epic_link}
          </a>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: ticket.status_category === "done" ? (theme?.bg === "#0F172A" ? "#14532D" : "#DCFCE7") : ticket.status_category === "indeterminate" ? (theme?.bg === "#0F172A" ? "#1E3A5F" : "#DBEAFE") : (theme?.tagBg || "#F1F5F9"),
          color: ticket.status_category === "done" ? "#4ADE80" : ticket.status_category === "indeterminate" ? "#60A5FA" : (theme?.textMuted || "#64748B"),
          border: `1px solid ${ticket.status_category === "done" ? "#166534" : ticket.status_category === "indeterminate" ? "#1D4ED8" : (theme?.cardBorder || "#E2E8F0")}`,
        }}>
          {ticket.status}
        </span>
      </div>

      <div style={{ fontSize: 11, color: theme?.textMuted || "#64748B", marginBottom: totalSub > 0 ? 10 : 0 }}>
        👤 {ticket.assignee}
        {ticket.lead_time_days && <span style={{ marginLeft: 8, color: "#F97316" }}>⏱ {ticket.lead_time_days}d</span>}
      </div>

      {totalSub > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 5, background: theme?.cardBorder || "#E2E8F0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 10, transition: "width 0.4s", background: pct === 100 ? "#22C55E" : pct > 50 ? "#3B82F6" : "#F97316", width: `${pct}%` }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", minWidth: 28 }}>{pct}%</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {subtasks.map((s, i) => (
              <div key={i} title={`${s.key}: ${s.summary}`}
                style={{ width: 12, height: 12, borderRadius: "50%", cursor: "default", background: s.status_category === "done" ? "#22C55E" : "transparent", border: `2px solid ${s.status_category === "done" ? "#22C55E" : s.status_category === "indeterminate" ? "#3B82F6" : "#CBD5E1"}`, transition: "transform 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            ))}
            <span style={{ fontSize: 10, color: theme?.textFaint || "#94A3B8", marginLeft: 2, alignSelf: "center" }}>{doneSub}/{totalSub}</span>
          </div>
        </div>
      )}

      {ticket.issue_links?.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ticket.issue_links.map((l, i) => (
            <span key={i} style={{ fontSize: 10, color: l.type === "blocked_by" ? "#EF4444" : "#7C3AED" }}>
              {l.type === "blocked_by" ? "⛔" : "🔗"}{" "}
              <a href={`${JIRA_BASE}/browse/${l.key}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>{l.key}</a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";

// ── KanbanBoard ───────────────────────────────────────────────────────────────
function KanbanBoard({ tickets, T }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expanded, setExpanded] = useState({}); // { [colKey]: boolean }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const getColumn = (ticket) => STATUS_COLUMN[ticket.status.toLowerCase().trim()] || "todo";
  const columns = {};
  KANBAN_COLUMNS.forEach((c) => (columns[c.key] = []));
  tickets.forEach((t) => columns[getColumn(t)].push(t));

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {KANBAN_COLUMNS.map((col) => {
          const isExp = expanded[col.key] || false;
          const colTickets = columns[col.key];
          return (
            <div key={col.key} style={{ border: `1px solid ${col.border}`, borderRadius: 10, overflow: "hidden", background: T.card }}>
              {/* Header Acordeón */}
              <div 
                onClick={() => toggle(col.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer", background: isExp ? col.bg : T.card, transition: "background 0.2s" }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: isExp ? col.color : T.text }}>{col.label}</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted }}>{colTickets.length}</span>
                  <span style={{ fontSize: 14, color: T.textMuted, transform: isExp ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                </div>
              </div>

              {/* Contenido */}
              {isExp && (
                <div style={{ padding: "8px 12px", background: T.bg === "#0F172A" ? "#1E293B" : "#F8FAFC", borderTop: `1px solid ${col.border}` }}>
                  {colTickets.length === 0
                    ? <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8", fontSize: 12 }}>Sin tickets</div>
                    : colTickets.map((t) => <TicketCard key={t.key} ticket={t} T={T} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="responsive-grid-5">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.key}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: col.bg, border: `1px solid ${col.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ background: col.color, color: "#fff", borderRadius: 10, padding: "0px 7px", fontSize: 11, fontWeight: 700 }}>{columns[col.key].length}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{columns[col.key].reduce((sum, t) => sum + (t.story_points || 0), 0)} SP</span>
            </div>
          </div>
          <div style={{ minHeight: 80 }}>
            {columns[col.key].length === 0
              ? <div style={{ textAlign: "center", padding: "20px 0", color: "#CBD5E1", fontSize: 12 }}>Sin tickets</div>
              : columns[col.key].map((t) => <TicketCard key={t.key} ticket={t} T={T} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SprintEnCurso ─────────────────────────────────────────────────────────────
export function SprintEnCurso({ team, T }) {
  const theme = T || THEMES.light;
  const { data, loading, lastUpdated, refresh } = useFetch(`${API}/active-sprint/?team=${team}`, 5 * 60 * 1000);

  if (loading) return <Spinner />;
  if (!data || data.error) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>
      {data?.error || "No hay sprint activo"}
    </div>
  );

  const { sprint, kpis, tickets, health } = data;
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

      {/* Salud + Burndown */}
      <div className="responsive-grid-2">
        {health && (
          <div style={{ background: theme?.card || "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${theme?.cardBorder || "#e2e8f0"}` }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme?.textMuted || "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Salud del Sprint</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { val: health.days_remaining, label: "días hábiles\nrestantes", color: health.days_remaining <= 2 ? "#EF4444" : "#1D4ED8", bg: theme?.bg === "#0F172A" ? "#1E3A5F" : "#EFF6FF" },
                  { val: health.weekend_days, label: "días de\nfin de semana", color: "#64748B", bg: theme?.healthMuted || "#F8FAFC" },
                  { val: health.holiday_days, label: "feriados\nnacionales", color: health.holiday_days > 0 ? "#F97316" : "#94A3B8", bg: health.holiday_days > 0 ? (theme?.bg === "#0F172A" ? "#431407" : "#FFF7ED") : (theme?.healthMuted || "#F8FAFC") },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, background: m.bg, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.val}</div>
                    <div style={{ fontSize: 9, color: theme?.textMuted || "#64748b", marginTop: 1, lineHeight: 1.3 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28, marginBottom: 6 }}>
                <div style={{ width: `${health.work_pct}%`, background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", transition: "width 0.5s" }}>
                  {health.work_pct > 8 && `${health.done_points} pts`}
                </div>
                <div style={{ flex: 1, background: "#93C5FD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#1D4ED8" }}>
                  {health.remaining_points > 0 && `${health.remaining_points} pts`}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "Tiempo transcurrido", value: `${health.time_pct}%`, color: health.time_pct > health.work_pct + 20 ? "#EF4444" : "#22C55E" },
                { label: "Trabajo terminado", value: `${health.work_pct}%`, color: health.work_pct >= health.time_pct ? "#22C55E" : "#F97316" },
                { label: "Cambio de alcance", value: `${health.scope_change_pct > 0 ? "+" : ""}${health.scope_change_pct}%`, color: health.scope_change_pct > 10 ? "#EF4444" : health.scope_change_pct > 0 ? "#F97316" : "#22C55E" },
              ].map((m, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color, letterSpacing: -1 }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: theme?.textFaint || "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: "12px 14px", background: theme?.healthMuted || "#F8FAFC", borderRadius: 8, borderLeft: "3px solid #3B82F6" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Velocidad Proyectada</div>
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

        <ChartCard T={T} title="Burndown Chart" height={260}>
          {burndown.length === 0 ? <EmptyState msg="Sin datos de burndown" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burndown} margin={{ top: 10, right: 20, left: -15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} vertical={false} />
                <XAxis dataKey="idx" type="number" domain={[0, burndown.length - 1]}
                  ticks={burndown.map((d) => d.idx)} tickFormatter={(i) => burndown[i]?.day || ""}
                  tick={{ fontSize: 9, fill: T?.textFaint || "#94a3b8" }}
                  interval={Math.max(Math.floor(burndown.length / 10) - 1, 0)}
                  tickLine={false} axisLine={{ stroke: T?.cardBorder || "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 9, fill: T?.textFaint || "#94a3b8" }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(val, name) => [val === null ? "—" : `${val} pts`, name]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
                {burndown.map((d, i) => d.weekend ? (
                  <ReferenceArea key={i} x1={d.idx} x2={d.idx} fill="#E2E8F0" fillOpacity={0.9} stroke="none" ifOverflow="visible" />
                ) : null)}
                <Line type="stepAfter" dataKey="ideal" name="Ideal" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                <Line type="stepAfter" dataKey="real" name="Real" stroke="#EF4444" strokeWidth={2} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

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
