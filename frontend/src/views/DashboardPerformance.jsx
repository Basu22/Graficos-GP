import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart, Area, Line,
} from "recharts";
import { API, COLORS, THEMES, buildQuery } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { ChartCard, Spinner, EmptyState } from "../components/ui";

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
  const { x, y, width, value, fill, T, isBar } = props;
  if (value === undefined || value === null) return null;
  
  const isZero = Number(value) === 0;
  
  if (isBar) {
    if (isZero) return null; // No mostrar ceros dentro de barras para no ensuciar
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
  const verticalOffset = isZero ? 15 : -8;

  return (
    <text 
      x={x} 
      y={y} 
      dy={verticalOffset} 
      fill={color} 
      fontSize={11} 
      fontWeight={700} 
      textAnchor="middle"
    >
      {value}
    </text>
  );
};

export function DashboardPerformance({ team, filter, T }) {
  const theme = T || THEMES.light;
  const q = buildQuery(team, filter);
  const { data: vel } = useFetch(`${API}/metrics/velocity${q}`);
  const { data: pred } = useFetch(`${API}/metrics/predictability${q}`);
  const { data: scope } = useFetch(`${API}/metrics/scope-change${q}`);
  const { data: carry } = useFetch(`${API}/metrics/carry-over${q}`);

  return (
    <div className="responsive-grid-2">
      <ChartCard T={T} title="Velocidad (Story Points)"
        badge={vel ? { text: `Promedio: ${vel.average_committed} pts`, color: "#EF4444" } : null}>
        {!vel ? <Spinner /> : (vel.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vel.data} margin={{ top: 20, right: 20, left: -15, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <ReferenceLine y={vel.average_committed} stroke={COLORS.avg} strokeDasharray="5 5" />
              <Bar dataKey="committed" name="Comprometido" fill={COLORS.committed} radius={[3, 3, 0, 0]}
                label={<CustomLabel T={T} isBar={true} />} />
              <Bar dataKey="delivered" name="Entregado" fill={COLORS.delivered} radius={[3, 3, 0, 0]}
                label={<CustomLabel T={T} isBar={true} />} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Predictibilidad (%)"
        badge={pred ? { text: `Promedio: ${pred.average}%`, color: "#EF4444" } : null}>
        {!pred ? <Spinner /> : (pred.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pred.data} margin={{ top: 20, right: 20, left: -15, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
              <YAxis domain={[0, 105]} tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: T?.card || "#fff", borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={pred.average} stroke={COLORS.avg} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="predictability" name="Predictibilidad"
                stroke="#3B82F6" strokeWidth={3} dot={{ r: 5, fill: "#3B82F6", stroke: T?.card || "#fff", strokeWidth: 2 }}
                label={<CustomLabel T={T} isBar={false} />} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Cambio de Alcance">
        {!scope ? <Spinner /> : (scope.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scope.data} margin={{ top: 20, right: 20, left: -15, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ background: T?.card || "#fff", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar dataKey="committed_initial" name="Inicial" fill={COLORS.committed} radius={[3, 3, 0, 0]}
                label={<CustomLabel T={T} isBar={true} />} />
              <Bar dataKey="scope_change" name="Cambio" fill={COLORS.scopeChange} radius={[3, 3, 0, 0]}
                label={<CustomLabel T={T} isBar={true} />} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard T={T} title="Tendencia de Carry Over">
        {!carry ? <Spinner /> : (carry.data || []).length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={carry.data} margin={{ top: 20, right: 20, left: -15, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T?.chartGrid || "#f1f5f9"} />
              <XAxis dataKey="sprint_label" tick={(p) => <CustomTick {...p} T={T} />} interval={0} height={55} />
              <YAxis tick={{ fontSize: 10, fill: T?.textMuted || "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="carry_over_points" fill="#FEE2E2" stroke="none" fillOpacity={0.5} />
              <Line type="monotone" dataKey="carry_over_points" name="Carry Over"
                stroke={COLORS.carryOver} strokeWidth={3} dot={{ r: 5, fill: COLORS.carryOver, stroke: T?.card || "#fff", strokeWidth: 2 }}
                label={<CustomLabel T={T} isBar={false} />} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
