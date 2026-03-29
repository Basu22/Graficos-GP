// ── URLs ──────────────────────────────────────────────────────────────────────
export const API = import.meta.env.VITE_API_URL;
export const JIRA_BASE = import.meta.env.VITE_JIRA_BASE_URL;

// ── Temas dark/light ──────────────────────────────────────────────────────────
export const THEMES = {
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

// ── Colores de gráficos ───────────────────────────────────────────────────────
export const COLORS = {
  committed: "#3B82F6", delivered: "#22C55E", carryOver: "#F87171",
  scopeChange: "#FB923C", leadTime: "#F97316", avg: "#EF4444",
};

// ── Tipos de issues ───────────────────────────────────────────────────────────
export const PRIORITY_ICON = {
  Highest: "⬆️", High: "🔴", Media: "🟠", Medium: "🟠", Low: "🔵", Lowest: "⬇️",
};

export const TYPE_COLOR = {
  Historia: "#36B37E", "Historia Tecnica": "#8B5CF6",
  "Historia Técnica": "#8B5CF6", Tarea: "#0052CC", Task: "#0052CC", Story: "#36B37E",
};

// ── Quarters ──────────────────────────────────────────────────────────────────
export const CURRENT_YEAR = new Date().getFullYear();
export const QUARTERS = [
  { label: `Q1 ${CURRENT_YEAR}`, value: "q1", quarter: 1, year: CURRENT_YEAR },
  { label: `Q2 ${CURRENT_YEAR}`, value: "q2", quarter: 2, year: CURRENT_YEAR },
  { label: `Q3 ${CURRENT_YEAR}`, value: "q3", quarter: 3, year: CURRENT_YEAR },
  { label: `Q4 ${CURRENT_YEAR}`, value: "q4", quarter: 4, year: CURRENT_YEAR },
];

// ── Kanban ────────────────────────────────────────────────────────────────────
export const KANBAN_COLUMNS = [
  { key: "fuera",   label: "Fuera de Sprint", color: "#94A3B8", bg: "#F8FAFC", border: "#E2E8F0" },
  { key: "blocked", label: "Bloqueadas",      color: "#EF4444", bg: "#FFF5F5", border: "#FECACA" },
  { key: "todo",    label: "Por Hacer",       color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
  { key: "inprog",  label: "En Progreso",     color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  { key: "done",    label: "Listo",           color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
];

export const STATUS_COLUMN = {
  "candidata a refinamiento": "fuera",
  "ok para refinamiento":     "fuera",
  "en refinamiento":          "fuera",
  "esperando respuesta de producto": "blocked",
  "to do":        "todo",
  "por hacer":    "todo",
  "ok para sprint": "todo",
  "en progreso":  "inprog",
  "in progress":  "inprog",
  "done":         "done",
  "listo":        "done",
  "archivado":    "done",
};

// ── Calendario ────────────────────────────────────────────────────────────────
export const EVENT_TYPES = {
  sprint:   { label: "Sprint",             color: "#3B82F6", icon: "⚡" },
  holiday:  { label: "Feriado Nacional",   color: "#F97316", icon: "🇦🇷" },
  birthday: { label: "Cumpleaños",         color: "#EC4899", icon: "🎂" },
  vacation: { label: "Vacaciones",         color: "#22C55E", icon: "🏖️" },
  medical:  { label: "Licencia Médica",    color: "#EF4444", icon: "🏥" },
  exam:     { label: "Licencia Examen",    color: "#8B5CF6", icon: "📝" },
  study:    { label: "Licencia Estudio",   color: "#06B6D4", icon: "📚" },
  custom:   { label: "Otro",              color: "#64748B", icon: "📌" },
};

export const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const DAYS_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ── Helpers de fecha ──────────────────────────────────────────────────────────
export const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
export const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
export const isoDate = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
export const dateInRange = (dateStr, startStr, endStr) =>
  dateStr >= startStr && dateStr <= (endStr || startStr);

// ── Query builder ─────────────────────────────────────────────────────────────
export const buildQuery = (team, filter) => {
  const base = `?team=${team}`;
  if (filter.type === "last_n") return `${base}&last_n=${filter.n}`;
  return `${base}&quarter=${filter.quarter}&year=${filter.year}`;
};
