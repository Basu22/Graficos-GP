import { useState, useEffect, useRef } from "react";
import { THEMES, API } from "./constants";
import { PeriodSelector } from "./components/PeriodSelector";
import { DashboardPerformance } from "./views/DashboardPerformance";
import { ReporteEjecutivo } from "./views/ReporteEjecutivo";
import { SprintEnCurso } from "./views/SprintEnCurso";
import { CalendarView } from "./views/CalendarView";
import { TeamView } from "./views/TeamView";

export default function App() {
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState("");
  const [filter, setFilter] = useState({ type: "last_n", n: 3 });
  const [view, setView] = useState("dashboard");
  const [pdfLoading, setPdfLoading] = useState(false);
  const contentRef = useRef(null);

  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const [darkMode, setDarkMode] = useState(systemDark);
  const T = THEMES[darkMode ? "dark" : "light"];

  useEffect(() => {
    fetch(`${API}/sprints/teams`)
      .then((r) => r.json())
      .then((t) => {
        const arr = Array.isArray(t) ? t : [];
        setTeams(arr);
        setTeam(arr[0] || "");
      });
  }, []);

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
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
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 1.5, canvas.height / 1.5],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 1.5, canvas.height / 1.5);
      const viewNames = { dashboard: "Performance", executive: "Ejecutivo", sprint: "Sprint" };
      pdf.save(`agility-${viewNames[view]}-${team}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
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

  const filterLabel =
    filter.type === "last_n" ? "Últimos 3 sprints" : `Q${filter.quarter} ${filter.year}`;
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
            <select value={team} onChange={(e) => setTeam(e.target.value)} style={selectStyle}>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {view !== "sprint" && view !== "calendar" && (
              <PeriodSelector filter={filter} onChange={setFilter} T={T} />
            )}

            <div style={{ display: "flex", background: darkMode ? "#0F172A" : "#F1F5F9", borderRadius: 10, padding: 3 }}>
              <button style={btnStyle(view === "dashboard")} onClick={() => setView("dashboard")}>Performance</button>
              <button style={btnStyle(view === "executive")} onClick={() => setView("executive")}>Ejecutivo</button>
              <button style={btnStyle(view === "sprint")} onClick={() => setView("sprint")}>🟢 Sprint Actual</button>
              <button style={btnStyle(view === "calendar")} onClick={() => setView("calendar")}>📅 Calendario</button>
              <button style={btnStyle(view === "team")} onClick={() => setView("team")}>👥 Equipo</button>
            </div>

            <button
              onClick={() => setDarkMode((d) => !d)}
              style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.inputBorder}`, background: T.input, color: T.text, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              title={darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={pdfLoading}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: pdfLoading ? "#94A3B8" : "#3B82F6", color: "#fff", cursor: pdfLoading ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}
            >
              {pdfLoading ? "Generando..." : "📄 PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
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