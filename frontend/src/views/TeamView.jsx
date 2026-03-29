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
function PersonDetail({ person, T, onClose }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, textFaint: faint, bg, input } = theme;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("sprint");
  const [jiraName, setJiraName] = useState(person.jira_name || "");
  const [jiraUsers, setJiraUsers] = useState([]);
  const [savingName, setSavingName] = useState(false);

  const cardS = { background: card, borderRadius: 12, padding: "16px 20px", border: `1px solid ${border}` };
  const inp = { padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" };

  useEffect(() => {
    loadJiraUsers();
    if (person.jira_name) loadStats();
    else setLoading(false);
  }, []);

  async function loadJiraUsers() {
    try {
      const data = await fetch(`${API}/people/jira-users?team=${person.team}`).then(r => r.json());
      setJiraUsers(Array.isArray(data) ? data : []);
    } catch (e) {}
  }
  async function loadStats() {
    setLoading(true);
    try {
      const data = await fetch(`${API}/people/${person.id}/stats?team=${person.team}`).then(r => r.json());
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
      await loadStats();
    } catch (e) {}
    setSavingName(false);
  }

  const teamColor = person.team === "Back" ? "#8B5CF6" : "#06B6D4";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 720, maxWidth: "95vw", height: "100vh", overflowY: "auto", background: bg, borderLeft: `1px solid ${border}`, boxShadow: "-20px 0 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0", borderBottom: `1px solid ${border}`, paddingBottom: 16, background: card, position: "sticky", top: 0, zIndex: 10 }}>
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
                      { label: "SP entregados", val: stats.active_sprint?.sp_done, color: "#22C55E" },
                      { label: "Completado", val: `${stats.active_sprint?.completion}%`, color: "#8B5CF6" },
                      { label: "Lead time prom", val: stats.avg_lead_time ? `${stats.avg_lead_time}d` : "—", color: "#F59E0B" },
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
                        {t.sp > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#8B5CF6" }}>{t.sp} SP</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 12, color: muted }}>Sprints: <strong style={{ color: text }}>{stats.sprints_analyzed?.join(", ") || "—"}</strong></div>
                  <div style={cardS}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 12 }}>Velocidad por sprint</div>
                    {Object.entries(stats.velocity_by_sprint || {}).map(([spName, v], i) => {
                      const pct = v.committed > 0 ? (v.delivered / v.committed) * 100 : 0;
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: muted }}>{spName}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: text }}>{v.delivered} / {v.committed} SP</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: border, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 3, background: pct >= 85 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444", width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.history_tickets?.filter((t) => t.status_cat === "done").map((t, i) => (
                      <div key={i} style={{ ...cardS, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <a href={`${JIRA_BASE}/browse/${t.key}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textDecoration: "none" }}>{t.key}</a>
                        <span style={{ flex: 1, fontSize: 12, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</span>
                        {t.sp > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#8B5CF6" }}>{t.sp} SP</span>}
                        {t.lead_time && <span style={{ fontSize: 10, color: muted }}>⏱ {t.lead_time}d</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "metrics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {[
                      { label: "Velocidad promedio", val: `${stats.avg_velocity} SP`, icon: "⚡", color: "#3B82F6" },
                      { label: "Lead time promedio", val: stats.avg_lead_time ? `${stats.avg_lead_time} días` : "—", icon: "⏱", color: "#F59E0B" },
                      { label: "Total tickets", val: stats.history_tickets?.length, icon: "🎫", color: "#8B5CF6" },
                    ].map((k, i) => (
                      <div key={i} style={{ ...cardS, textAlign: "center", padding: "20px 16px" }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>{k.icon}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: text, marginTop: 4 }}>{k.label}</div>
                      </div>
                    ))}
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
  const [activeTab, setActiveTab] = useState("people");
  const [availRange, setAvailRange] = useState({ start: "", end: "", team: "Todos" });
  const [availability, setAvailability] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

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
        await fetch(`${API}/people/${editPerson.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...personForm, absences: editPerson.absences || [] }) });
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

  async function loadAvailability() {
    if (!availRange.start || !availRange.end) return;
    setLoadingAvail(true);
    try {
      const teamParam = availRange.team === "Todos" ? "" : availRange.team;
      const data = await fetch(`${API}/people/availability?start=${availRange.start}&end=${availRange.end}${teamParam ? `&team=${teamParam}` : ""}`).then(r => r.json());
      setAvailability(data);
    } catch (e) { console.error(e); }
    setLoadingAvail(false);
  }

  const filteredPeople = filterTeam === "Todos" ? people : people.filter(p => p.team === filterTeam);
  const absentToday = people.filter(p => p.absences?.some(a => a.start_date <= today && today <= a.end_date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { label: "Total personas", value: people.length, color: "#3B82F6", icon: "👥" },
          { label: "Equipo Back", value: people.filter(p => p.team === "Back").length, color: "#8B5CF6", icon: "⚙️" },
          { label: "Equipo Datos", value: people.filter(p => p.team === "Datos").length, color: "#06B6D4", icon: "📊" },
          { label: "Ausentes hoy", value: absentToday.length, color: absentToday.length > 0 ? "#EF4444" : "#22C55E", icon: "🏖️" },
        ].map((k, i) => (
          <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 28 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", background: bg, borderRadius: 8, padding: 3 }}>
          {[["people", "👥 Personas"], ["availability", "📅 Disponibilidad"]].map(([v, l]) => (
            <button key={v} onClick={() => setActiveTab(v)} style={{ padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: activeTab === v ? "#3B82F6" : "transparent", color: activeTab === v ? "#fff" : muted }}>{l}</button>
          ))}
        </div>
        {activeTab === "people" && (
          <>
            <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
              {["Todos", ...TEAMS].map(t => (
                <button key={t} onClick={() => setFilterTeam(t)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterTeam === t ? "#3B82F6" : border}`, background: filterTeam === t ? "#3B82F6" : "transparent", color: filterTeam === t ? "#fff" : muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t}</button>
              ))}
            </div>
            <button onClick={() => { setEditPerson(null); setPersonForm({ name: "", team: "Back", role: "Developer", birthday: "" }); setShowPersonModal(true); }}
              style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Persona
            </button>
          </>
        )}
      </div>

      {/* Lista personas */}
      {activeTab === "people" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredPeople.length === 0 && <div style={{ ...cardStyle, textAlign: "center", padding: 48, color: muted }}>No hay personas cargadas aún.</div>}
          {filteredPeople.map(person => {
            const absentNow = person.absences?.find(a => a.start_date <= today && today <= a.end_date);
            const teamColor = person.team === "Back" ? "#8B5CF6" : "#06B6D4";
            return (
              <div key={person.id} style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setSelectedPerson(person)}>
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
      )}

      {/* Disponibilidad */}
      {activeTab === "availability" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            {[["Desde", "start"], ["Hasta", "end"]].map(([label, key]) => (
              <div key={key} style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
                <input type="date" value={availRange[key]} onChange={(e) => setAvailRange(r => ({ ...r, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: muted, fontWeight: 600, display: "block", marginBottom: 4 }}>Equipo</label>
              <select value={availRange.team} onChange={(e) => setAvailRange(r => ({ ...r, team: e.target.value }))} style={inp}>
                {["Todos", ...TEAMS].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={loadAvailability} disabled={loadingAvail} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: loadingAvail ? 0.7 : 1 }}>
              {loadingAvail ? "Cargando..." : "Ver disponibilidad"}
            </button>
          </div>
          {availability.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
              {availability.map((day, i) => {
                const pct = day.total > 0 ? day.available / day.total : 1;
                const color = pct >= 0.8 ? "#22C55E" : pct >= 0.5 ? "#F97316" : "#EF4444";
                const isWknd = [0, 6].includes(new Date(day.date + "T12:00:00").getDay());
                return (
                  <div key={i} style={{ background: card, border: `1px solid ${isWknd ? border : color + "60"}`, borderRadius: 8, padding: "8px 10px", opacity: isWknd ? 0.5 : 1 }}>
                    <div style={{ fontSize: 9, color: muted, fontWeight: 600 }}>{new Date(day.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short" })}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: text }}>{new Date(day.date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</div>
                    {!isWknd && (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{day.available}<span style={{ fontSize: 10, color: muted }}>/{day.total}</span></div>
                        {day.unavailable?.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {day.unavailable.map((u, ui) => (
                              <div key={ui} style={{ fontSize: 8, color: "#EF4444", fontWeight: 600 }}>{ABSENCE_TYPES[u.type]?.icon} {u.name}</div>
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

      {/* PersonDetail */}
      {selectedPerson && <PersonDetail person={selectedPerson} T={T} onClose={() => setSelectedPerson(null)} />}

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
