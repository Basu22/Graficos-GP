import { useState, useEffect } from "react";
import { API, THEMES, EVENT_TYPES, MONTHS, DAYS_SHORT, getDaysInMonth, getFirstDayOfMonth, isoDate, dateInRange } from "../constants";

export function CalendarView({ T, team }) {
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
  const [form, setForm] = useState({ title: "", type: "vacation", person: "", start_date: "", end_date: "", notes: "", color: "" });

  const allEvents = [
    ...events.filter((e) => filterTypes.has(e.type)),
    ...holidays.filter(() => filterTypes.has("holiday")),
    ...sprintEvents.filter(() => filterTypes.has("sprint")),
  ];

  const cardBg = theme.card || "#fff";
  const textColor = theme.text || "#1e293b";
  const mutedColor = theme.textMuted || "#64748b";
  const borderColor = theme.cardBorder || "#e2e8f0";
  const bgColor = theme.bg || "#f1f5f9";
  const c = (base, dark) => theme.bg === "#0F172A" ? dark : base;

  const navBtn = { padding: "5px 10px", borderRadius: 6, border: `1px solid ${borderColor}`, background: cardBg, color: mutedColor, cursor: "pointer", fontSize: 11 };
  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${borderColor}`, background: theme.input || "#fff", color: textColor, fontSize: 12, boxSizing: "border-box", outline: "none" };

  useEffect(() => { loadAll(); }, [year, team]);

  async function loadAll() {
    try {
      const [evRes, holRes, sprRes] = await Promise.all([
        fetch(`${API}/calendar/events?year=${year}${team ? `&team=${team}` : ""}`),
        fetch(`${API}/calendar/holidays/${year}`),
        fetch(`${API}/calendar/sprints-for-calendar?year=${year}${team ? `&team=${team}` : ""}`),
      ]);
      setEvents(Array.isArray(await evRes.json()) ? await evRes.clone().json() : []);
      setHolidays(Array.isArray(await holRes.json()) ? await holRes.clone().json() : []);
      setSprintEvents(Array.isArray(await sprRes.json()) ? await sprRes.clone().json() : []);
    } catch (e) {
      console.error("loadAll error:", e);
    }
  }

  // Re-fetch de manera correcta sin clonar
  async function loadAllCorrect() {
    try {
      const [evData, holData, sprData] = await Promise.all([
        fetch(`${API}/calendar/events?year=${year}${team ? `&team=${team}` : ""}`).then(r => r.json()),
        fetch(`${API}/calendar/holidays/${year}`).then(r => r.json()),
        fetch(`${API}/calendar/sprints-for-calendar?year=${year}${team ? `&team=${team}` : ""}`).then(r => r.json()),
      ]);
      setEvents(Array.isArray(evData) ? evData : []);
      setHolidays(Array.isArray(holData) ? holData : []);
      setSprintEvents(Array.isArray(sprData) ? sprData : []);
    } catch (e) { console.error("loadAll error:", e); }
  }

  useEffect(() => { loadAllCorrect(); }, [year, team]);

  function eventsForDay(dateStr) {
    return allEvents.filter((e) => dateInRange(dateStr, e.start_date, e.end_date || e.start_date));
  }

  function getSprintDayColor(dateStr) {
    const sprint = sprintEvents.find((s) => dateStr >= s.start_date && dateStr <= (s.end_date || s.start_date));
    if (!sprint) return null;
    const start = new Date(sprint.start_date + "T12:00:00");
    const end = new Date(sprint.end_date + "T12:00:00");
    const cur = new Date(dateStr + "T12:00:00");
    const progress = Math.min(Math.max((cur - start) / (end - start), 0), 1);
    let r, g, b;
    if (progress < 0.5) {
      const t = progress / 0.5;
      r = Math.round(34 + (234 - 34) * t); g = Math.round(197 + (179 - 197) * t); b = Math.round(94 + (8 - 94) * t);
    } else {
      const t = (progress - 0.5) / 0.5;
      r = Math.round(234 + (239 - 234) * t); g = Math.round(179 + (68 - 179) * t); b = Math.round(8 + (68 - 8) * t);
    }
    return { color: `rgb(${r},${g},${b})`, progress, sprint };
  }

  async function handleSave() {
    if (!form.title || !form.start_date) return;
    try {
      if (selectedEvent?.id && !selectedEvent.id.startsWith("holiday-") && !selectedEvent.id.startsWith("sprint-")) {
        await fetch(`${API}/calendar/events/${selectedEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, team }) });
      } else {
        await fetch(`${API}/calendar/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, team }) });
      }
      setShowModal(false); setSelectedEvent(null);
      setForm({ title: "", type: "vacation", person: "", start_date: "", end_date: "", notes: "", color: "" });
      await loadAllCorrect();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    if (!id || id.startsWith("holiday-") || id.startsWith("sprint-")) return;
    await fetch(`${API}/calendar/events/${id}`, { method: "DELETE" });
    setShowModal(false); setSelectedEvent(null);
    await loadAllCorrect();
  }

  function openNewEvent(dateStr) {
    setSelectedEvent(null);
    setForm({ title: "", type: "vacation", person: "", start_date: dateStr, end_date: dateStr, notes: "", color: "" });
    setShowModal(true);
  }

  function openEditEvent(e) {
    setSelectedEvent(e);
    setForm({ title: e.title, type: e.type, person: e.person || "", start_date: e.start_date, end_date: e.end_date || e.start_date, notes: e.notes || "", color: e.color || "" });
    setShowModal(true);
  }

  function sprintPillColor(ev, dateStr) {
    if (ev.type !== "sprint") return null;
    if (dateStr === ev.start_date && dateStr === (ev.end_date || ev.start_date)) return "#3B82F6";
    if (dateStr === ev.start_date) return "#22C55E";
    if (dateStr === (ev.end_date || ev.start_date)) return "#EF4444";
    const sd = getSprintDayColor(dateStr);
    return sd ? sd.color : "#3B82F6";
  }

  function QuarterView() {
    const qStart = selectedQuarter * 3;
    const months = [qStart, qStart + 1, qStart + 2];
    const todayStr = today.toISOString().slice(0, 10);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2, 3].map((q) => {
            const qMonths = ["Ene–Mar", "Abr–Jun", "Jul–Sep", "Oct–Dic"];
            const isActive = q === selectedQuarter;
            const isCurrent = q === Math.floor(today.getMonth() / 3) && year === today.getFullYear();
            return (
              <button key={q} onClick={() => setSelectedQuarter(q)} style={{ padding: "6px 18px", borderRadius: 8, border: `2px solid ${isActive ? "#3B82F6" : borderColor}`, background: isActive ? "#3B82F6" : cardBg, color: isActive ? "#fff" : isCurrent ? "#3B82F6" : mutedColor, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Q{q + 1} <span style={{ fontSize: 10, opacity: 0.8 }}>{qMonths[q]}</span>
                {isCurrent && !isActive && <span style={{ fontSize: 8, marginLeft: 4, color: "#3B82F6" }}>●</span>}
              </button>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: 12, color: mutedColor, alignSelf: "center" }}>{year}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {months.map((m) => {
            const daysInM = getDaysInMonth(year, m);
            const firstDay = getFirstDayOfMonth(year, m);
            const cells = [];
            const prevDays = getDaysInMonth(year, m - 1 < 0 ? 11 : m - 1);
            for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, cur: false });
            for (let d = 1; d <= daysInM; d++) cells.push({ day: d, cur: true });
            while (cells.length < 35) cells.push({ day: cells.length - daysInM - firstDay + 2, cur: false });
            const isCurMonth = m === today.getMonth() && year === today.getFullYear();

            return (
              <div key={m} style={{ background: cardBg, borderRadius: 12, padding: "16px 20px", border: `1px solid ${isCurMonth ? "#3B82F6" : borderColor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: textColor }}>{MONTHS[m]}</div>
                  {isCurMonth && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#DBEAFE", color: "#1D4ED8", fontWeight: 700 }}>Mes actual</span>}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(EVENT_TYPES).map(([key, info]) => {
                      const count = cells.filter((cell) => cell.cur && eventsForDay(isoDate(year, m, cell.day)).some((e) => e.type === key)).length;
                      return count === 0 ? null : <span key={key} style={{ fontSize: 10, color: info.color, fontWeight: 700 }}>{info.icon} {count}</span>;
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                  {DAYS_SHORT.map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: d === "Dom" || d === "Sáb" ? "#F97316" : mutedColor, padding: "4px 0" }}>{d}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {cells.map((cell, ci) => {
                    const dateStr = cell.cur ? isoDate(year, m, cell.day) : "";
                    const dayEvs = dateStr ? eventsForDay(dateStr) : [];
                    const isToday = dateStr === todayStr;
                    const isWeekend = [0, 6].includes(new Date((dateStr || isoDate(year, m, 1)) + "T12:00:00").getDay());
                    const hasHoliday = dayEvs.some((e) => e.type === "holiday");
                    const cellBg = !cell.cur ? "transparent" : isToday ? c("#EFF6FF", "#1E3A5F") : hasHoliday ? c("#FFF7ED", "#431407") : isWeekend ? c("#F8FAFC", "#131F35") : theme.bg === "#0F172A" ? "#0F172A" : "#F8FAFC";

                    return (
                      <div key={ci} onClick={() => cell.cur && openNewEvent(dateStr)}
                        style={{ minHeight: 80, padding: "6px 8px", borderRadius: 6, background: cellBg, border: `1px solid ${isToday ? "#3B82F6" : cell.cur ? borderColor : "transparent"}`, opacity: cell.cur ? 1 : 0, cursor: cell.cur ? "pointer" : "default" }}
                        onMouseEnter={(e) => cell.cur && (e.currentTarget.style.background = c("#EAF2FF", "#1a2f50"))}
                        onMouseLeave={(e) => cell.cur && (e.currentTarget.style.background = cellBg)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, background: isToday ? "#3B82F6" : "transparent", color: isToday ? "#fff" : isWeekend ? "#F97316" : textColor, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {cell.cur ? cell.day : ""}
                          </span>
                        </div>
                        {(() => {
                          const holidayEv = dayEvs.find((e) => e.type === "holiday");
                          const sprintEvs = dayEvs.filter((e) => e.type === "sprint" && !isWeekend && !holidayEv);
                          const nonHolidayEvs = dayEvs.filter((e) => e.type !== "holiday" && !(e.type === "sprint" && (isWeekend || !!holidayEv)));
                          const visibleEvs = [...sprintEvs, ...nonHolidayEvs];
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {holidayEv && <div style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, background: "#F97316", color: "#fff", fontWeight: 700 }} title={holidayEv.title}>🇦🇷 {holidayEv.title}</div>}
                              {visibleEvs.slice(0, holidayEv ? 2 : 3).map((ev, ei) => {
                                const info = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
                                const pillColor = sprintPillColor(ev, dateStr) || (ev.color || info.color);
                                const isSprint = ev.type === "sprint";
                                return (
                                  <div key={ei} onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }} title={ev.title}
                                    style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, cursor: "pointer", background: isSprint ? pillColor : (ev.color || info.color) + "25", borderLeft: !isSprint ? `2px solid ${ev.color || info.color}` : "none", color: isSprint ? "#fff" : (ev.color || info.color), fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {info.icon} {ev.title}
                                  </div>
                                );
                              })}
                              {visibleEvs.length > (holidayEv ? 2 : 3) && <div style={{ fontSize: 9, color: mutedColor }}>+{visibleEvs.length - (holidayEv ? 2 : 3)} más</div>}
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: cardBg, borderRadius: 12, padding: "16px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setYear((y) => y - 1)} style={navBtn}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: textColor, minWidth: 60, textAlign: "center" }}>{year}</span>
            <button onClick={() => setYear((y) => y + 1)} style={navBtn}>▶</button>
            <button onClick={() => { setYear(today.getFullYear()); setSelectedQuarter(Math.floor(today.getMonth() / 3)); }} style={{ ...navBtn, color: "#3B82F6", fontWeight: 600 }}>Hoy</button>
          </div>

          <div style={{ display: "flex", background: bgColor, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setViewMode("quarter")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: viewMode === "quarter" ? "#3B82F6" : "transparent", color: viewMode === "quarter" ? "#fff" : mutedColor }}>📊 Quarter</button>
          </div>

          <button onClick={() => openNewEvent(today.toISOString().slice(0, 10))} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Nuevo evento</button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {Object.entries(EVENT_TYPES).map(([key, info]) => {
            const active = filterTypes.has(key);
            return (
              <button key={key} onClick={() => setFilterTypes((prev) => { const next = new Set(prev); active ? next.delete(key) : next.add(key); return next; })}
                style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${active ? info.color : borderColor}`, background: active ? info.color + "20" : "transparent", color: active ? info.color : mutedColor, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {info.icon} {info.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: cardBg, borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
        <QuarterView />
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: cardBg, borderRadius: 16, padding: 28, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `1px solid ${borderColor}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 20 }}>
              {selectedEvent && !selectedEvent.id?.startsWith("holiday-") && !selectedEvent.id?.startsWith("sprint-") ? "✏️ Editar evento" : "➕ Nuevo evento"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Título *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Ej: Vacaciones Juan" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Tipo</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputStyle}>
                    {Object.entries(EVENT_TYPES).filter(([k]) => !["holiday", "sprint"].includes(k)).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Persona</label>
                  <input value={form.person} onChange={(e) => setForm((f) => ({ ...f, person: e.target.value }))} style={inputStyle} placeholder="Nombre" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Fecha inicio *</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, height: 60, resize: "vertical" }} placeholder="Notas opcionales..." />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                {selectedEvent && !selectedEvent.id?.startsWith("holiday-") && !selectedEvent.id?.startsWith("sprint-") && (
                  <button onClick={() => handleDelete(selectedEvent.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#FEE2E2", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑 Eliminar</button>
                )}
                <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${borderColor}`, background: "transparent", color: mutedColor, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
