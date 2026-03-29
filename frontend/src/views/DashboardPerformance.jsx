import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart, Area, Line,
} from "recharts";
import { API, COLORS, THEMES, buildQuery } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { ChartCard, Spinner, EmptyState } from "../components/ui";

export function DashboardPerformance({ team, filter, T }) {
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
        {!vel ? <Spinner /> : (vel.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vel.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
              <ReferenceLine y={vel.average_committed} stroke={COLORS.avg} strokeDasharray="5 5" />
              <Bar dataKey="committed" name="Comprometido" fill={COLORS.committed} radius={[3, 3, 0, 0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
              <Bar dataKey="delivered" name="Entregado" fill={COLORS.delivered} radius={[3, 3, 0, 0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Predictibilidad (%)"
        badge={pred ? { text: `Predictibilidad Promedio ${pred.average}%`, color: "#EF4444" } : null}>
        {!pred ? <Spinner /> : (pred.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pred.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} />
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
        {!scope ? <Spinner /> : (scope.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scope.data} margin={{ top: 20, right: 20, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={{ fontSize: 9, fill: T?.textMuted || "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", border: `1px solid ${T?.cardBorder || "#e2e8f0"}`, color: T?.text || "#1e293b", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: T?.textMuted || "#64748b" }} />
              <Bar dataKey="committed_initial" name="Comprometido Inicial" fill={COLORS.committed} radius={[3, 3, 0, 0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
              <Bar dataKey="scope_change" name="Cambio de Alcance" fill={COLORS.scopeChange} radius={[3, 3, 0, 0]}
                label={{ position: "top", fontSize: 10, fill: T?.textMuted || "#475569" }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Tendencia de Carry Over">
        {!carry ? <Spinner /> : (carry.data || []).length === 0 ? <EmptyState /> : (
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
