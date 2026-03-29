import { THEMES } from "../constants";

export function KPICard({ value, label, sub, color, T }) {
  const theme = T || THEMES.light;
  return (
    <div style={{
      background: theme.card, borderRadius: 12, padding: "18px 22px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", flex: "1 1 130px", minWidth: 0,
      border: `1px solid ${theme.cardBorder}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || theme.text, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function ChartCard({ title, children, height = 280, badge, T }) {
  const theme = T || THEMES.light;
  return (
    <div style={{
      background: theme.card, borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", minWidth: 0,
      border: `1px solid ${theme.cardBorder}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
        {badge && <div style={{ fontSize: 12, fontWeight: 700, color: badge.color || "#EF4444" }}>{badge.text}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13 }}>
      Cargando...
    </div>
  );
}

export function EmptyState({ msg = "Sin datos para este período" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13 }}>
      📭 {msg}
    </div>
  );
}
