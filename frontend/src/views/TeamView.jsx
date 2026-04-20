import { useState, useEffect } from "react";
import { API, THEMES, JIRA_BASE } from "../constants";

const TEAMS = ["Back", "Datos"];
const ROLES = ["Developer", "Tech Lead", "Scrum Master", "QA", "Data Engineer", "Data Analyst", "Product Owner", "DevOps", "Otro"];
const ABSENCE_TYPES = {
  vacation: { label: "Vacaciones", color: "#22C55E", icon: "🏖️" },
  medical:  { label: "Lic. Médica", color: "#EF4444", icon: "🏥" },
  exam:     { label: "Lic. Examen", color: "#8B5CF6", icon: "📝" },
  study:    { label: "Lic. Estudio", color: "#06B6D4", icon: "📚" },
  other:    { label: "Otro", color: "#64748B", icon: "📌" },
};
const TYPE_COLOR = { Historia: "#3B82F6", Bug: "#EF4444", Tarea: "#8B5CF6", "Sub-tarea": "#94A3B8" };
const STATUS_COLOR = { done: "#22C55E", indeterminate: "#F59E0B", new: "#64748B" };
const STATUS_LABEL = { done: "✅ Listo", indeterminate: "🔄 En progreso", new: "⬜ Por hacer" };

// ── PersonDetail (panel lateral) ───────────────────────────────────────────────
function PersonDetail({ person, T, onClose, onSaved }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, textFaint: faint, bg, input } = theme;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("sprint");
  const [jiraName, setJiraName] = useState(person.jira_name || "");
  const [jiraUsers, setJiraUsers] = useState([]);
  const [savingName, setSavingName] = useState(false);
  const [period, setPeriod] = useState("last_3");
  const [openSprints, setOpenSprints] = useState({});

  const cardS = { background: card, borderRadius: 12, padding: "16px 20px", border: `1px solid ${border}` };
  const inp = { padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" };

  useEffect(() => {
    loadJiraUsers();
  }, []);

  useEffect(() => {
    if (person.jira_name) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [person.id, person.jira_name, period]);

  async function loadJiraUsers() {
    try {
      const data = await fetch(`${API}/people/jira-users?team=${person.team}`).then(r => r.json());
      setJiraUsers(Array.isArray(data) ? data : []);
    } catch (e) {}
  }
  async function loadStats() {
    setLoading(true);
    let url = `${API}/people/${person.id}/stats?team=${person.team}`;
    if (period === "last_3") url += "&last_n=3";
    else if (period.startsWith("Q")) {
      const q = period.substring(1, 2);
      const y = period.split(" ")[1];
      url += `&quarter=${q}&year=${y}`;
    }
    try {
      const data = await fetch(url).then(r => r.json());
      setStats(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  async function saveJiraName() {
    if (!jiraName) return;
    setSavingName(true);
    try {
      await fetch(`${API}/people/${person.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...person, jira_name: jiraName }) });
      person.jira_name = jiraName;
      if (onSaved) onSaved(person);
      // El useEffect se disparará automáticamente porque person.jira_name cambió
    } catch (e) {}
    setSavingName(false);
  }

  const teamColor = person.team === "Back" ? "#8B5CF6" : "#06B6D4";

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: card, border: `1px solid ${border}`, borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "24px 28px 0", borderBottom: `1px solid ${border}`, paddingBottom: 16, background: card, position: "sticky", top: 0, zIndex: 10, borderRadius: "12px 12px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: teamColor + "20", border: `2px solid ${teamColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: teamColor }}>
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: text }}>{person.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: teamColor + "20", color: teamColor }}>{person.team}</span>
                <span style={{ fontSize: 11, color: muted }}>{person.role}</span>
                {person.birthday && <span style={{ fontSize: 11, color: "#EC4899" }}>🎂 {person.birthday}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: muted, fontWeight: 600, whiteSpace: "nowrap" }}>Usuario Jira:</span>
            {jiraUsers.length > 0 ? (
              <select value={jiraName} onChange={(e) => setJiraName(e.target.value)} style={{ ...inp, width: "auto", flex: 1, minWidth: 180 }}>
                <option value="">— seleccioná el usuario —</option>
                {jiraUsers.map((u) => <option key={u.displayName} value={u.displayName}>{u.displayName}</option>)}
              </select>
            ) : (
              <input value={jiraName} onChange={(e) => setJiraName(e.target.value)} placeholder="Nombre exacto en Jira..." style={{ ...inp, flex: 1, minWidth: 180 }} />
            )}
            <button onClick={saveJiraName} disabled={!jiraName || savingName}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: jiraName ? "#3B82F6" : "#94A3B8", color: "#fff", fontSize: 12, fontWeight: 600, cursor: jiraName ? "pointer" : "default", whiteSpace: "nowrap" }}>
              {savingName ? "Cargando..." : "🔗 Vincular"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {[["sprint", "🟢 Sprint Activo"], ["history", "📋 Historial"], ["metrics", "📊 Métricas"]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)}
                style={{ padding: "7px 14px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === v ? bg : "transparent", color: tab === v ? text : muted, borderBottom: tab === v ? "2px solid #3B82F6" : "2px solid transparent" }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 28px", flex: 1 }}>
          {loading && <div style={{ textAlign: "center", padding: 60, color: muted }}>⏳ Cargando datos de Jira...</div>}
          {!loading && !stats && (
            <div style={{ textAlign: "center", padding: 60, color: muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 8 }}>Vinculá esta persona con su usuario de Jira</div>
              <div style={{ fontSize: 12 }}>Seleccioná el usuario de Jira arriba y hacé clic en "Vincular".</div>
            </div>
          )}

          {!loading && stats && (
            <>
              {tab === "sprint" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text }}>{stats.active_sprint?.name || "Sin sprint activo"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                    {[
                      { label: "SP asignados", val: stats.active_sprint?.sp_total, color: "#3B82F6" },
                      { label: "SP efectivos", val: stats.active_sprint?.sp_done, color: "#22C55E" },
                      { label: "Completado", val: `${stats.active_sprint?.completion}%`, color: "#8B5CF6" },
                      { label: "Cycle time prom", val: stats.avg_cycle_time ? `${stats.avg_cycle_time}d` : "—", color: "#F59E0B" },
                    ].map((k, i) => (
                      <div key={i} style={{ ...cardS, textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
                        <div style={{ fontSize: 10, color: muted, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.active_sprint?.tickets?.map((t, i) => (
                      <div key={i} style={{ ...cardS, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <a href={`${JIRA_BASE}/browse/${t.key}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textDecoration: "none" }}>{t.key}</a>
                        <span style={{ flex: 1, fontSize: 12, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[t.status_cat] || muted }}>{STATUS_LABEL[t.status_cat] || t.status}</span>
                        {t.sp > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#8B5CF6", background: "#8B5CF620", padding: "2px 6px", borderRadius: 4 }}>
                            {t.total_sp > 0 && t.sp !== t.total_sp 
                              ? `Esfuerzo: ${t.sp}/${t.total_sp} SP | ${Math.round((t.sp / t.total_sp) * 100)}%` 
                              : `${t.sp} SP`}
                          </span>
                        )}
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {t.cycle_time && <span style={{ fontSize: 10, color: t.cycle_time < 5 ? "#22C55E" : t.cycle_time < 10 ? "#F59E0B" : "#EF4444", fontWeight: 700 }}>⏳ CT: {t.cycle_time}d</span>}
                          {t.lead_time && <span style={{ fontSize: 10, color: muted }}>📅 LT: {t.lead_time}d</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: muted }}>Sprints: <strong style={{ color: text }}>{stats.sprints_analyzed?.join(", ") || "—"}</strong></div>
                    <select 
                      value={period} 
                      onChange={(e) => setPeriod(e.target.value)} 
                      style={{ ...inp, width: "auto", padding: "4px 8px", background: card, fontWeight: 600 }}
                    >
                      <option value="last_3">Últimos 3 sprints</option>
                      <option value="Q1 2026">Q1 2026</option>
                      <option value="Q2 2026">Q2 2026</option>
                      <option value="Q3 2026">Q3 2026</option>
                      <option value="Q4 2026">Q4 2026</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {Object.entries(stats.velocity_by_sprint || {}).map(([spName, v], i) => {
                      const pct = v.committed > 0 ? (v.delivered / v.committed) * 100 : 0;
                      const isOpen = openSprints[spName] !== false; // Abierto por defecto
                      const sprintTickets = stats.history_tickets?.filter((t) => t.sprint === spName && t.status_cat === "done") || [];
                      
                      return (
                        <div key={i} style={cardS}>
                          <div 
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: isOpen ? 12 : 0 }}
                            onClick={() => setOpenSprints(prev => ({ ...prev, [spName]: !isOpen }))}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: text }}>
                              {isOpen ? "▼" : "▶"} {spName}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: text }}>
                              {v.delivered} / {v.committed} SP
                            </div>
                          </div>
                          
                          {isOpen && (
                            <>
                              <div style={{ height: 6, borderRadius: 3, background: border, overflow: "hidden", marginBottom: 16 }}>
                                <div style={{ height: "100%", borderRadius: 3, background: pct >= 85 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444", width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {sprintTickets.length === 0 ? (
                                  <div style={{ fontSize: 11, color: muted, fontStyle: "italic" }}>No hay tickets con esfuerzo registrado en este sprint.</div>
                                ) : (
                                  sprintTickets.map((t, j) => (
                                    <div key={j} style={{ padding: "8px 12px", border: `1px solid ${border}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: bg }}>
                                      <a href={`${JIRA_BASE}/browse/${t.key}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textDecoration: "none" }}>{t.key}</a>
                                      <span style={{ flex: 1, fontSize: 11, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</span>
                                      {t.sp > 0 && (
                                        <span style={{ fontSize: 10, fontWeight: 800, color: "#8B5CF6", background: "#8B5CF620", padding: "2px 6px", borderRadius: 4 }}>
                                          {t.total_sp > 0 && t.sp !== t.total_sp 
                                            ? `Esfuerzo: ${t.sp}/${t.total_sp} SP` 
                                            : `${t.sp} SP`}
                                        </span>
                                      )}
                                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        {t.cycle_time && <span style={{ fontSize: 10, color: t.cycle_time < 5 ? "#22C55E" : t.cycle_time < 10 ? "#F59E0B" : "#EF4444", fontWeight: 700 }}>⏳ CT: {t.cycle_time}d</span>}
                                        {t.lead_time && <span style={{ fontSize: 10, color: muted }}>📅 LT: {t.lead_time}d</span>}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "metrics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -4 }}>
                    <select 
                      value={period} 
                      onChange={(e) => setPeriod(e.target.value)} 
                      style={{ ...inp, width: "auto", padding: "4px 8px", background: card, fontWeight: 600 }}
                    >
                      <option value="last_3">Últimos 3 sprints</option>
                      <option value="Q1 2026">Q1 2026</option>
                      <option value="Q2 2026">Q2 2026</option>
                      <option value="Q3 2026">Q3 2026</option>
                      <option value="Q4 2026">Q4 2026</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[
                      { label: "Velocidad promedio", val: `${stats.avg_velocity} SP`, icon: "⚡", color: "#3B82F6" },
                      { label: "Predictibilidad", val: `${stats.predictability_pct || 0}%`, icon: "🎯", color: "#22C55E" },
                      { label: "Cycle time promedio", val: stats.avg_cycle_time ? `${stats.avg_cycle_time} días` : "—", icon: "⏳", color: "#F59E0B" },
                      { label: "Total SP entregados", val: `${stats.total_sp_delivered || 0} SP`, icon: "🏆", color: "#8B5CF6" },
                      { label: "Tickets completados", val: stats.history_tickets?.filter(t => t.status_cat === 'done').length || 0, icon: "🎫", color: "#06B6D4" },
                      { label: "Bugs abiertos", val: stats.bugs_in_progress || 0, icon: "🐛", color: "#EF4444" },
                    ].map((k, i) => (
                      <div key={i} style={{ ...cardS, textAlign: "center", padding: "20px 16px" }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text, marginTop: 4 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {Object.keys(stats.type_distribution || {}).length > 0 && (
                    <div style={{ ...cardS, marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 12 }}>Distribución de Trabajo (Tipos)</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {Object.entries(stats.type_distribution).map(([t, count], i) => (
                          <div key={i} style={{ padding: "6px 12px", background: bg, borderRadius: 8, border: `1px solid ${border}`, fontSize: 11, fontWeight: 600 }}>
                            <span style={{ color: TYPE_COLOR[t] || muted, marginRight: 6 }}>●</span>
                            <span style={{ color: text }}>{t}:</span> <span style={{ color: muted }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}

// ── TeamView ───────────────────────────────────────────────────────────────────
export function TeamView({ T }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, bg, input } = theme;

  const [people, setPeople] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filterTeam, setFilterTeam] = useState("Todos");
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [editAbsencePerson, setEditAbsencePerson] = useState(null);
  const [personForm, setPersonForm] = useState({ name: "", team: "Back", role: "Developer", birthday: "" });
  const [absenceForm, setAbsenceForm] = useState({ type: "vacation", start_date: "", end_date: "", notes: "" });

  const today = new Date().toISOString().slice(0, 10);
  const inp = { padding: "8px 10px", borderRadius: 6, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 12, boxSizing: "border-box", outline: "none", width: "100%" };
  const cardStyle = { background: card, borderRadius: 12, padding: "20px 24px", border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" };

  useEffect(() => { loadPeople(); }, []);

  async function loadPeople() {
    try {
      const data = await fetch(`${API}/people/`).then(r => r.json());
      setPeople(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }

  async function savePerson() {
    if (!personForm.name) return;
    try {
      if (editPerson) {
        await fetch(`${API}/people/${editPerson.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...personForm, absences: editPerson.absences || [], jira_name: editPerson.jira_name }) });
      } else {
        await fetch(`${API}/people/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(personForm) });
      }
      setShowPersonModal(false); setEditPerson(null);
      setPersonForm({ name: "", team: "Back", role: "Developer", birthday: "" });
      await loadPeople();
    } catch (e) { console.error(e); }
  }

  async function deletePerson(id) {
    if (!confirm("¿Eliminar esta persona?")) return;
    await fetch(`${API}/people/${id}`, { method: "DELETE" });
    await loadPeople();
  }

  async function saveAbsence() {
    if (!absenceForm.start_date || !editAbsencePerson) return;
    try {
      await fetch(`${API}/people/${editAbsencePerson.id}/absences`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(absenceForm) });
      setShowAbsenceModal(false);
      setAbsenceForm({ type: "vacation", start_date: "", end_date: "", notes: "" });
      await loadPeople();
    } catch (e) { console.error(e); }
  }

  async function deleteAbsence(personId, absenceId) {
    await fetch(`${API}/people/${personId}/absences/${absenceId}`, { method: "DELETE" });
    await loadPeople();
  }

  const absentToday = people.filter(p => p.absences?.some(a => a.start_date <= today && today <= a.end_date));
  const filteredPeople = people.filter(p => {
    if (filterTeam === "Todos") return true;
    if (filterTeam === "Back") return p.team === "Back";
    if (filterTeam === "Datos") return p.team === "Datos";
    if (filterTeam === "Ausentes") return p.absences?.some(a => a.start_date <= today && today <= a.end_date);
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs como Filtros */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { id: "Todos", label: "Total personas", value: people.length, color: "#3B82F6", icon: "👥" },
          { id: "Back", label: "Equipo Back", value: people.filter(p => p.team === "Back").length, color: "#8B5CF6", icon: "⚙️" },
          { id: "Datos", label: "Equipo Datos", value: people.filter(p => p.team === "Datos").length, color: "#06B6D4", icon: "📊" },
          { id: "Ausentes", label: "Ausentes hoy", value: absentToday.length, color: absentToday.length > 0 ? "#EF4444" : "#22C55E", icon: "🏖️" },
        ].map((k, i) => (
          <div key={i} onClick={() => setFilterTeam(k.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, cursor: "pointer", border: filterTeam === k.id ? `2px solid ${k.color}` : `1px solid ${border}`, background: filterTeam === k.id ? k.color + "11" : card, transition: "all 0.2s" }}>
            <div style={{ fontSize: 28 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <button onClick={() => { setEditPerson(null); setPersonForm({ name: "", team: "Back", role: "Developer", birthday: "" }); setShowPersonModal(true); }}
          style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Persona
        </button>
      </div>

      {/* Main Layout: Lista y Panel Lateral */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative" }}>
        
        {/* Columna Izquierda: Lista personas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: selectedPerson ? "0 0 calc(100% - 600px)" : 1, transition: "flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)", minWidth: 0 }}>
          {filteredPeople.length === 0 && <div style={{ ...cardStyle, textAlign: "center", padding: 48, color: muted }}>No hay personas cargadas aún.</div>}
          {filteredPeople.map(person => {
            const absentNow = person.absences?.find(a => a.start_date <= today && today <= a.end_date);
            const teamColor = person.team === "Back" ? "#8B5CF6" : "#06B6D4";
            return (
              <div key={person.id} style={{ ...cardStyle, cursor: "pointer", border: selectedPerson?.id === person.id ? `2px solid ${teamColor}` : `1px solid ${border}` }} onClick={() => setSelectedPerson(person)}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: teamColor + "20", border: `2px solid ${teamColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: teamColor }}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{person.name}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: teamColor + "20", color: teamColor }}>{person.team}</span>
                      <span style={{ fontSize: 10, color: muted }}>{person.role}</span>
                      {person.birthday && <span style={{ fontSize: 10, color: "#EC4899" }}>🎂 {person.birthday}</span>}
                      {absentNow && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: ABSENCE_TYPES[absentNow.type]?.color + "20", color: ABSENCE_TYPES[absentNow.type]?.color }}>
                          {ABSENCE_TYPES[absentNow.type]?.icon} Ausente hoy
                        </span>
                      )}
                    </div>
                    {person.absences?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {person.absences.map(ab => {
                          const atype = ABSENCE_TYPES[ab.type] || ABSENCE_TYPES.other;
                          const isPast = ab.end_date < today;
                          return (
                            <div key={ab.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 8px", borderRadius: 6, background: atype.color + (isPast ? "15" : "25"), border: `1px solid ${atype.color + (isPast ? "40" : "80")}`, color: atype.color, opacity: isPast ? 0.6 : 1 }}>
                              {atype.icon} {ab.start_date} → {ab.end_date}
                              <button onClick={(e) => { e.stopPropagation(); deleteAbsence(person.id, ab.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: atype.color, fontSize: 10, padding: "0 2px" }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditAbsencePerson(person); setAbsenceForm({ type: "vacation", start_date: "", end_date: "", notes: "" }); setShowAbsenceModal(true); }} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>+ Ausencia</button>
                    <button onClick={(e) => { e.stopPropagation(); setEditPerson(person); setPersonForm({ name: person.name, team: person.team, role: person.role, birthday: person.birthday || "" }); setShowPersonModal(true); }} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); deletePerson(person.id); }} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#FEE2E2", color: "#EF4444", fontSize: 11, cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Columna Derecha: Panel Fijo */}
      <div style={{ 
        width: selectedPerson ? 580 : 0, 
        opacity: selectedPerson ? 1 : 0, 
        overflow: "hidden", 
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "sticky",
        top: 20,
        maxHeight: "calc(100vh - 40px)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0
      }}>
        {selectedPerson && <PersonDetail person={selectedPerson} T={T} onClose={() => setSelectedPerson(null)} onSaved={loadPeople} />}
      </div>
    </div>

      {/* Modal Persona */}
      {showPersonModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowPersonModal(false)}>
          <div style={{ background: card, borderRadius: 16, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `1px solid ${border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 20 }}>{editPerson ? "✏️ Editar persona" : "➕ Nueva persona"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Nombre *</label><input value={personForm.name} onChange={(e) => setPersonForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="Nombre completo" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Equipo</label><select value={personForm.team} onChange={(e) => setPersonForm(f => ({ ...f, team: e.target.value }))} style={inp}>{TEAMS.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Rol</label><select value={personForm.role} onChange={(e) => setPersonForm(f => ({ ...f, role: e.target.value }))} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
              </div>
              <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Cumpleaños</label><input type="date" value={personForm.birthday} onChange={(e) => setPersonForm(f => ({ ...f, birthday: e.target.value }))} style={inp} /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setShowPersonModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                <button onClick={savePerson} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ausencia */}
      {showAbsenceModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowAbsenceModal(false)}>
          <div style={{ background: card, borderRadius: 16, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `1px solid ${border}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 4 }}>🏖️ Nueva ausencia</div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 20 }}>{editAbsencePerson?.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Tipo</label>
                <select value={absenceForm.type} onChange={(e) => setAbsenceForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {Object.entries(ABSENCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Desde *</label><input type="date" value={absenceForm.start_date} onChange={(e) => setAbsenceForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Hasta</label><input type="date" value={absenceForm.end_date} onChange={(e) => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))} style={inp} /></div>
              </div>
              <div><label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Notas</label><input value={absenceForm.notes} onChange={(e) => setAbsenceForm(f => ({ ...f, notes: e.target.value }))} style={inp} placeholder="Opcional..." /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setShowAbsenceModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                <button onClick={saveAbsence} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
