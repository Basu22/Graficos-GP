import { useState, useEffect } from "react";
import { API, THEMES, EVENT_TYPES, MONTHS, DAYS_SHORT, getDaysInMonth, getFirstDayOfMonth, isoDate, dateInRange } from "../constants";

const TYPE_LABEL = EVENT_TYPES;

const ABSENCE_TYPES = {
  vacation: { label: "Vacaciones", color: "#22C55E", icon: "🏖️" },
  medical: { label: "Lic. Médica", color: "#EF4444", icon: "🏥" },
  exam: { label: "Lic. Examen", color: "#8B5CF6", icon: "📝" },
  study: { label: "Lic. Estudio", color: "#06B6D4", icon: "📚" },
  other: { label: "Otro", color: "#64748B", icon: "📌" },
};

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
  const [form, setForm] = useState({ title: "", type: "vacation", person: "", personSwap: "", start_date: "", end_date: "", notes: "", color: "", impact: 0.0 });
  const [availability, setAvailability] = useState({});
  const [people, setPeople] = useState([]);
  const [eventTypes, setEventTypes] = useState(EVENT_TYPES);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [collapsedRoles, setCollapsedRoles] = useState(new Set());

  const toggleRole = (role) => {
    setCollapsedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const allEvents = (() => {
    const raw = [
      ...events.filter((e) => filterTypes.has(e.type)),
      ...holidays.filter(() => filterTypes.has("holiday")),
      ...sprintEvents.filter((e) => filterTypes.has("sprint")),
    ];
    const seen = new Set();
    return raw.filter(e => {
      // Normalización estricta: título minúscula + fechas YYYY-MM-DD
      const t = (e.title || "").trim().toLowerCase();
      const s = (e.start_date || "").slice(0, 10);
      const en = (e.end_date || e.start_date || "").slice(0, 10);
      const key = `${e.type}-${t}-${s}-${en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const cardBg = theme.card || "#fff";
  const textColor = theme.text || "#1e293b";
  const mutedColor = theme.textMuted || "#64748b";
  const borderColor = theme.cardBorder || "#e2e8f0";
  const bgColor = theme.bg || "#f1f5f9";
  const c = (base, dark) => theme.bg === "#0F172A" ? dark : base;

  const navBtn = { padding: "5px 10px", borderRadius: 6, border: `1px solid ${borderColor}`, background: cardBg, color: mutedColor, cursor: "pointer", fontSize: 11 };
  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${borderColor}`, background: theme.input || "#fff", color: textColor, fontSize: 12, boxSizing: "border-box", outline: "none" };

  async function loadAllCorrect() {
    try {
      const [evs, hols, spr, avail] = await Promise.all([
        fetch(`${API}/calendar/events?year=${year}${team && team !== "Todos" ? `&team=${team}` : ""}`).then(r => r.json()),
        fetch(`${API}/calendar/holidays/${year}`).then(r => r.json()),
        fetch(`${API}/calendar/sprints-for-calendar?year=${year}${team && team !== "Todos" ? `&team=${team}` : ""}`).then(r => r.json()),
        fetch(`${API}/people/availability?start=${year}-01-01&end=${year}-12-31${team && team !== "Todos" ? `&team=${team}` : ""}`).then(r => r.json())
      ]);

      setEvents(Array.isArray(evs) ? evs : []);
      setHolidays(Array.isArray(hols) ? hols : []);
      setSprintEvents(Array.isArray(spr) ? spr : []);
      
      const availMap = {};
      if (Array.isArray(avail)) {
        avail.forEach(d => { availMap[d.date] = d; });
      }
      setAvailability(availMap);
    } catch (e) {
      console.error("Error cargando datos del calendario:", e);
    }
  }

  async function loadPeople() {
    try {
      const url = team && team !== "Todos"
        ? `${API}/people/?team=${team}`
        : `${API}/people/`;
      const data = await fetch(url).then(r => r.json());
      setPeople(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando personas:", e);
      setPeople([]);
    }
  }

  async function loadEventTypes() {
    try {
      const data = await fetch(`${API}/config/event-types`).then(r => r.json());
      if (data && Object.keys(data).length > 0) {
        setEventTypes(data);
        setFilterTypes(prev => {
          const newSet = new Set(prev);
          Object.keys(data).forEach(k => newSet.add(k));
          return newSet;
        });
      }
    } catch (e) {
      console.error("Error cargando categorías dinámicas:", e);
    }
  }

  useEffect(() => { 
    loadAllCorrect();
    loadPeople();
    loadEventTypes();
  }, [year, team, selectedQuarter]);

  function eventsForDay(dateStr) {
    if (!dateStr) return [];
    const evs = allEvents.filter((e) => dateInRange(dateStr, e.start_date, e.end_date || e.start_date));

    // Inyectar ausencias de personas
    const avail = availability[dateStr];
    if (avail && avail.unavailable && filterTypes.has("vacation")) { // We use vacation as a toggle for absences if needed, or always show.
      // We will always show absences, or maybe map them to a filter? Let's just always show them if there are any.
      avail.unavailable.forEach(u => {
        if (u.is_dynamic) return;
        evs.push({
          id: `absence-${dateStr}-${u.name}`,
          type: "absence",
          title: u.name,
          person: u.name,
          start_date: dateStr,
          end_date: dateStr,
          absenceType: u.type
        });
      });
    }

    const unique = [];
    const titles = new Set();
    evs.forEach(e => {
      const isAbsence = e.type === "absence";
      const t = (isAbsence ? `absence-${e.title}` : (e.title || "").trim()).toLowerCase();
      if (!titles.has(t)) {
        titles.add(t);
        unique.push(e);
      }
    });
    // Inyectar ceremonias automáticas de Sprint Manual
    events.forEach(s => {
      if (s.type === "manual_sprint") {
        if (dateStr === s.start_date) {
          unique.push({
            id: `ceremony-plan-${s.id}`,
            title: "📊 Ceremonia: Planificación",
            type: "custom",
            impact: 0.5,
            start_date: s.start_date,
            color: "#3B82F6",
            isVirtual: true
          });
        }
        if (dateStr === s.end_date) {
          unique.push({
            id: `ceremony-review-${s.id}`,
            title: "🏁 Ceremonia: Review + Retro",
            type: "custom",
            impact: 0.5,
            start_date: s.end_date,
            color: "#8B5CF6",
            isVirtual: true
          });
        }
      }
    });

    return unique;
  }

  function getSprintSummary(startDate, endDate) {
    if (!startDate || !endDate) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;

    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    const summary = {
      totalDays: 0, businessDays: 0, weekends: 0, holidays: 0,
      vacations: 0, medical: 0, exam: 0, study: 0, birthdays: 0,
      dailyDetail: []
    };

    let curr = new Date(start);
    let safety = 0;

    while (curr <= end && safety < 100) {
      safety++;
      const dStr = curr.toISOString().slice(0, 10);
      const dayNum = curr.getDay();
      const isWeek = dayNum === 0 || dayNum === 6;
      const dayEvs = eventsForDay(dStr);
      const isHol = dayEvs.some(e => e.type === "holiday");
      const avail = availability[dStr] || { available: 0, total: 0, present: [], absent: [], unavailable: [] };

      summary.totalDays++;
      if (isWeek) summary.weekends++;
      else if (isHol) summary.holidays++;
      else summary.businessDays += (dStr === startDate || dStr === endDate) ? 0.5 : 1.0;

      // Contar tipos de ausencias (por persona/día)
      (avail.unavailable || []).forEach(u => {
        if (u.type === "vacation") summary.vacations++;
        else if (u.type === "medical") summary.medical++;
        else if (u.type === "exam") summary.exam++;
        else if (u.type === "study") summary.study++;
      });

      // Contar cumpleaños
      const curMonthDay = dStr.slice(5, 10); // "MM-DD"
      people.forEach(p => {
        if (p.birthday && p.birthday.slice(5, 10) === curMonthDay) {
          summary.birthdays++;
        }
      });

      summary.dailyDetail.push({ date: dStr, isWeekend: isWeek, isHoliday: isHol, holidayName: dayEvs.find(e => e.type === "holiday")?.title, ...avail });
      curr.setDate(curr.getDate() + 1);
    }
    return summary;
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

  const sprintsMetasMap = {};
  sprintEvents.forEach(s => {
    let businessDays = 0;
    let sprintHolidays = 0;
    let cur = new Date(s.start_date + "T12:00:00");
    const end = new Date(s.end_date + "T12:00:00");
    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const isWeekend = [0, 6].includes(cur.getDay());
      const isHoliday = holidays.some(h => dateInRange(dStr, h.start_date, h.end_date || h.start_date));
      if (!isWeekend && !isHoliday) businessDays++;
      if (isHoliday) sprintHolidays++;
      cur.setDate(cur.getDate() + 1);
    }
    sprintsMetasMap[s.start_date] = { businessDays, holidays: sprintHolidays };
  });

  async function handleSave() {
    if (!form.start_date) return;
    try {
    if (form.type === "rotacion_soporte") {
      if (form.start_date === form.end_date) {
        alert("La rotación debe tener al menos 1 día de duración posterior al inicio.");
        return;
      }
      if (!form.person || !form.personSwap) {
        alert("Debes seleccionar tanto al colaborador que ingresa como al que sale de soporte.");
        return;
      }
      
      const payloadA = { ...form, impact: 1.0, title: `Ingresa a Soporte — ${form.person}`, team };
      delete payloadA.personSwap;
      
      const payloadB = { ...form, person: form.personSwap, impact: 0.0, type: "retorno_sprint", title: `Retorno al Sprint — ${form.personSwap}`, team };
      delete payloadB.personSwap;

      if (selectedEvent?.id && !selectedEvent.id.startsWith("holiday-") && !selectedEvent.id.startsWith("sprint-")) {
        await fetch(`${API}/calendar/events/${selectedEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadA) });
      } else {
        await fetch(`${API}/calendar/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadA) });
        await fetch(`${API}/calendar/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadB) });
      }
    } else {
      const typeInfo = eventTypes[form.type] || eventTypes.custom || { label: "Otro", icon: "📌" };
      // Auto-construir título: Categoria - Persona (excepto para sprints manuales donde el usuario pone el nombre)
      const autoTitle = form.type === "manual_sprint" 
        ? (form.title || "Sprint") 
        : `${typeInfo.label}${form.person ? ` — ${form.person}` : ""}`;

      const payload = { ...form, title: autoTitle };
      if (payload.type === "manual_sprint" && !payload.impact) {
        payload.impact = 0.0;
      }
      // Asegurar impacto 100% si no es sprint manual (mejora brief)
      if (payload.type !== "manual_sprint" && payload.type !== "rotacion_soporte") {
        payload.impact = payload.impact || 1.0;
      }
      delete payload.personSwap;
      
      // Si es sprint manual, lo hacemos global (sin equipo)
      const savePayload = payload.type === "manual_sprint" 
        ? payload 
        : { ...payload, team };

      if (selectedEvent?.id && !selectedEvent.id.startsWith("holiday-") && !selectedEvent.id.startsWith("sprint-")) {
        await fetch(`${API}/calendar/events/${selectedEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(savePayload) });
      } else {
        await fetch(`${API}/calendar/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(savePayload) });
      }
    }
    setShowModal(false); setSelectedEvent(null);
      setForm({ title: "", type: "vacation", person: "", personSwap: "", start_date: "", end_date: "", notes: "", color: "", impact: 0.0 });
      await loadAllCorrect();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    if (!id || id.startsWith("holiday-")) return;
    // Si empieza con sprint- es de Jira, no se borra. Si no, es manual y se puede borrar.
    if (id.startsWith("sprint-")) return;

    // Lógica de borrado en cascada para "Rotación Soporte" (Swap)
    const eventToDelete = allEvents.find(e => e.id === id);
    if (eventToDelete && (eventToDelete.type === "rotacion_soporte" || eventToDelete.type === "retorno_sprint")) {
      const pairType = eventToDelete.type === "rotacion_soporte" ? "retorno_sprint" : "rotacion_soporte";
      const pairEvent = allEvents.find(e => 
        e.type === pairType && 
        e.start_date === eventToDelete.start_date && 
        e.end_date === eventToDelete.end_date
      );
      
      await fetch(`${API}/calendar/events/${id}`, { method: "DELETE" });
      if (pairEvent) {
        await fetch(`${API}/calendar/events/${pairEvent.id}`, { method: "DELETE" });
      }
    } else {
      await fetch(`${API}/calendar/events/${id}`, { method: "DELETE" });
    }
    
    setShowModal(false); setSelectedEvent(null);
    await loadAllCorrect();
  }

  function openNewEvent(dateStr) {
    setSelectedEvent(null);
    setForm({ title: "", type: "vacation", person: "", personSwap: "", start_date: dateStr, end_date: dateStr, notes: "", color: "", impact: 0.0 });
    setShowModal(true);
  }

  function openEditEvent(e) {
    setSelectedEvent(e);
    setForm({ 
      title: e.title, 
      type: e.type, 
      person: e.person || "", 
      start_date: e.start_date, 
      end_date: e.end_date || e.start_date, 
      notes: e.notes || "", 
      color: e.color || "",
      impact: e.impact || 0.0,
      personSwap: ""
    });
    setShowModal(true);
  }

  function handleDayClick(dateStr) {
    if (!dateStr) return;
    setSelectedDay(dateStr);
    
    if (isMobile || viewMode === "annual") {
      setShowDayDetail(true);
    } else {
      openNewEvent(dateStr);
    }
  }

  function sprintPillColor(ev, dateStr) {
    if (ev.type !== "sprint") return null;
    if (dateStr === ev.start_date && dateStr === (ev.end_date || ev.start_date)) return "#3B82F6";
    if (dateStr === ev.start_date) return "#22C55E";
    if (dateStr === (ev.end_date || ev.start_date)) return "#EF4444";
    const sd = getSprintDayColor(dateStr);
    return sd ? sd.color : "#3B82F6";
  }

  function DayCell({ m, cell, isMini = false }) {
    const todayStr = today.toISOString().slice(0, 10);
    const dateStr = cell.cur ? isoDate(year, m, cell.day) : "";
    const dayEvs = dateStr ? eventsForDay(dateStr) : [];
    const isToday = dateStr === todayStr;
    const isWeekend = dateStr ? [0, 6].includes(new Date(dateStr + "T12:00:00").getDay()) : false;
    const hasHoliday = dayEvs.some((e) => e.type === "holiday");
    const meta = cell.cur && sprintsMetasMap[dateStr];

    // Lógica del Sprint Activo (más nuevo si hay solapamiento)
    const daySprints = dayEvs.filter(e => e.type === "sprint" || e.type === "manual_sprint");
    // Sort by start_date descending (newest start date first)
    daySprints.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    const activeSprint = daySprints.length > 0 ? daySprints[0] : null;

    let isSprintStart = false;
    let isSprintEnd = false;

    if (activeSprint && !isMini && !isMobile) {
      const nextDate = new Date(dateStr + "T12:00:00");
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().slice(0, 10);

      isSprintStart = activeSprint.start_date === dateStr;
      if (!isSprintStart) {
        if (activeSprint.end_date === dateStr) {
          isSprintEnd = true;
        } else if (activeSprint.end_date === nextDateStr && sprintEvents.some(s => s.start_date === nextDateStr)) {
          isSprintEnd = true;
        }
      }
    }

    let dynamicBg = theme.bg === "#0F172A" ? "#0F172A" : "#F8FAFC";
    if (isToday) dynamicBg = c("#EFF6FF", "#1E3A5F");
    else if (hasHoliday) dynamicBg = c("#FFF7ED", "#431407");
    else if (isWeekend) dynamicBg = c("#F8FAFC", "#131F35");
    else if (isSprintStart) dynamicBg = c("#F0FDF4", "#064E3B"); // Verde claro / Verde muy oscuro
    else if (isSprintEnd) dynamicBg = c("#FFF1F2", "#450A0A"); // Rojo claro / Rojo muy oscuro

    const cellBg = !cell.cur ? "transparent" : dynamicBg;

    return (
      <div onClick={() => handleDayClick(dateStr)}
        style={{ minHeight: isMini ? 32 : isMobile ? 44 : 80, padding: isMini ? "1px" : isMobile ? "2px" : "6px 8px", borderRadius: 6, background: cellBg, border: `1px solid ${isToday ? "#3B82F6" : cell.cur ? (isMobile || isMini ? "transparent" : borderColor) : "transparent"}`, opacity: cell.cur ? 1 : 0, cursor: cell.cur ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>

        {(!isMini && !isMobile) ? (
          <div style={{ position: "absolute", top: 4, left: 6, display: "flex", pointerEvents: "none" }}>
            <span style={{ fontSize: 16, fontWeight: isToday ? 800 : 700, background: isToday ? "#3B82F6" : "transparent", color: isToday ? "#fff" : isWeekend ? "#F97316" : textColor, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {cell.cur ? cell.day : ""}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: isMini ? 12 : 14, fontWeight: isToday ? 800 : 500, background: isToday ? "#3B82F6" : "transparent", color: isToday ? "#fff" : isWeekend ? "#F97316" : textColor, width: isMini ? 18 : 24, height: isMini ? 18 : 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
            {cell.cur ? cell.day : ""}
          </span>
        )}

        {cell.cur && availability[dateStr] && !isWeekend && !isMini && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: (!isMini && !isMobile) ? 4 : 2, marginBottom: 4 }}>
            {(() => {
              const dayAvail = availability[dateStr];
              const pct = dayAvail.total > 0 ? dayAvail.available / dayAvail.total : 1;
              const color = pct >= 0.8 ? "#22C55E" : pct >= 0.5 ? "#F97316" : "#EF4444";
              return (
                <span style={{ fontSize: 13, fontWeight: 800, color }}>
                  {dayAvail.available}<span style={{ fontSize: 11, opacity: 0.7 }}>/{dayAvail.total}</span>
                </span>
              );
            })()}
          </div>
        )}

        {cell.cur && (!isMini || meta) && !isWeekend && (
          <div style={{ position: "absolute", top: 4, right: 6, display: "flex", gap: 3, alignItems: "center", pointerEvents: "none" }}>
            {activeSprint && !isMini && (
              <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "#3B82F6", padding: "2px 5px", borderRadius: 4, marginRight: 2 }}>
                {(() => {
                  const match = activeSprint.title.match(/\d+/);
                  return match ? `SP${match[0]}` : activeSprint.title;
                })()}
              </span>
            )}
            {meta && !isMini && <span style={{ fontSize: 9, fontWeight: 800, color: "#3B82F6" }}>⚡{meta.businessDays}</span>}
            {meta && !isMini && meta.holidays > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: "#F97316" }}>🇦🇷{meta.holidays}</span>}
          </div>
        )}

        {cell.cur && (
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
            {isMobile || isMini ? (
              Array.from(new Set(dayEvs.map(e => e.type === "absence" ? "absence" : e.type))).map(type => {
                const isAbs = type === "absence";
                const info = isAbs ? { color: "#EF4444" } : (EVENT_TYPES[type] || EVENT_TYPES.custom);
                return <div key={type} style={{ width: isMini ? 3 : 4, height: isMini ? 3 : 4, borderRadius: "50%", background: info.color }} />;
              })
            ) : (
              <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 4, width: "100%", justifyContent: "center" }}>
                {(() => {
                  const holidayEv = dayEvs.find((e) => e.type === "holiday");
                  const visibleEvs = dayEvs.filter((e) => e.type !== "holiday" && e.type !== "sprint");
                  return (
                    <>
                      {holidayEv && <div style={{ fontSize: 12, padding: "2px 5px", borderRadius: 3, background: "#F97316", color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", width: "100%" }} title={holidayEv.title}>🇦🇷 {holidayEv.title}</div>}
                        {visibleEvs.slice(0, holidayEv ? 2 : 6).map((ev, ei) => {
                          const info = eventTypes[ev.type] || ABSENCE_TYPES[ev.type] || { label: "Otro", color: "#64748B", icon: "📌" };
                          const pillColor = ev.type === "manual_sprint" ? "#3B82F6" : (ev.color || info.color);
                          
                          const isEvStart = ev.start_date === dateStr;
                          const isEvEnd = (ev.end_date || ev.start_date) === dateStr;
                          const isSingleDay = ev.start_date === (ev.end_date || ev.start_date);
                          const isManualStart = ev.type === "manual_sprint" && isEvStart;
                          const isManualEnd = ev.type === "manual_sprint" && isEvEnd;

                          let displayText;
                          if (ev.type === "manual_sprint") {
                            if (!isManualStart && !isManualEnd) return null; // Suprimir píldoras de sprint en días medios
                            displayText = isManualStart ? "▶ Apertura " + ev.title : isManualEnd ? "■ Cierre " + ev.title : ev.title;
                          } else {
                            if (isSingleDay) {
                              displayText = info.icon;
                            } else if (isEvStart) {
                              if (ev.type === "rotacion_soporte") {
                                const name = ev.title.split("—")[1] || ev.person || "";
                                displayText = `Inicio Soporte — ${name.trim()}`;
                              } else {
                                displayText = `Inicio ${ev.title}`;
                              }
                            } else if (isEvEnd) {
                              if (ev.type === "rotacion_soporte") {
                                const name = ev.title.split("—")[1] || ev.person || "";
                                displayText = `Fin Soporte — ${name.trim()}`;
                              } else {
                                displayText = `Fin ${ev.title}`;
                              }
                            } else {
                              displayText = info.icon; // días intermedios: SÓLO ICONO
                            }
                          }

                          const onlyIcon = displayText === info.icon;

                          return (
                            <div key={ei} onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }} title={ev.title}
                              style={{
                                fontSize: 12,
                                padding: onlyIcon ? "2px" : "4px 8px",
                                borderRadius: onlyIcon ? "50%" : 6,
                                cursor: "pointer",
                                background: ev.type === "manual_sprint" ? "#3B82F6" : pillColor + "20",
                                color: ev.type === "manual_sprint" ? "#fff" : pillColor,
                                fontWeight: 800,
                                whiteSpace: onlyIcon ? "nowrap" : "normal",
                                wordBreak: "break-word",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                position: (isManualStart || isManualEnd) ? "absolute" : "relative",
                                bottom: (isManualStart || isManualEnd) ? 6 : "auto",
                                left: (isManualStart || isManualEnd) ? 6 : "auto",
                                zIndex: (isManualStart || isManualEnd) ? 10 : 1,
                                maxWidth: (isManualStart || isManualEnd) ? "85%" : (onlyIcon ? "auto" : "100%"),
                                width: (isManualStart || isManualEnd) ? "auto" : (onlyIcon ? 27 : "auto"),
                                height: onlyIcon ? 27 : "auto",
                                textAlign: "center",
                                lineHeight: 1.1
                              }}>
                              {displayText}
                            </div>
                          );
                        })}
                      {isSprintStart && !isMini && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); openNewEvent(dateStr); }}
                          style={{
                            position: "absolute", bottom: 4, right: 4,
                            fontSize: 8, padding: "2px 6px", borderRadius: 6,
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            background: "rgba(34, 197, 94, 0.1)",
                            color: "#16A34A", fontWeight: 800,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                            zIndex: 20
                          }}>
                          📋 Resumen Plan
                        </button>
                      )}
                      {visibleEvs.length > (holidayEv ? 2 : 6) && <div style={{ fontSize: 9, color: mutedColor }}>+{visibleEvs.length - (holidayEv ? 2 : 6)}</div>}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function MonthGrid({ m, isMini = false }) {
    const daysInM = getDaysInMonth(year, m);
    const firstDay = getFirstDayOfMonth(year, m);
    const cells = [];
    const prevDays = getDaysInMonth(year, m - 1 < 0 ? 11 : m - 1);
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, cur: false });
    for (let d = 1; d <= daysInM; d++) cells.push({ day: d, cur: true });
    const maxCells = cells.length > 35 ? 42 : 35;
    while (cells.length < maxCells) cells.push({ day: cells.length - daysInM - firstDay + 2, cur: false });

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMini ? 1 : isMobile ? 1 : 3 }}>
        {cells.map((cell, ci) => <DayCell key={ci} m={m} cell={cell} isMini={isMini} />)}
      </div>
    );
  }

  function QuarterView() {
    const qStart = selectedQuarter * 3;
    const months = [qStart, qStart + 1, qStart + 2];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 16 }}>
        {!isMobile && (
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
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16 }}>
          {months.map((m) => {
            const isCurMonth = m === today.getMonth() && year === today.getFullYear();
            return (
              <div key={m} style={{ background: cardBg, borderRadius: 12, padding: isMobile ? "12px 14px" : "16px 20px", border: `1px solid ${isCurMonth ? "#3B82F6" : borderColor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: textColor }}>{MONTHS[m]}</div>
                  {isCurMonth && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "#DBEAFE", color: "#1D4ED8", fontWeight: 700 }}>Hoy</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                  {DAYS_SHORT.map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: d === "Dom" || d === "Sáb" ? "#F97316" : mutedColor, padding: "4px 0" }}>{d}</div>
                  ))}
                </div>
                <MonthGrid m={m} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function AnnualView() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
        {MONTHS.map((name, m) => {
          const isCurMonth = m === today.getMonth() && year === today.getFullYear();
          return (
            <div key={m} style={{ background: cardBg, borderRadius: 10, padding: 12, border: `1px solid ${isCurMonth ? "#3B82F6" : borderColor}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: textColor, marginBottom: 8, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>{name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
                {DAYS_SHORT.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 8, fontWeight: 700, color: d === "Dom" || d === "Sáb" ? "#F97316" : mutedColor }}>{d[0]}</div>
                ))}
              </div>
              <MonthGrid m={m} isMini={true} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: cardBg, borderRadius: 12, padding: isMobile ? "12px 16px" : "16px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: `1px solid ${borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: isMobile ? "wrap" : "nowrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setYear((y) => y - 1)} style={navBtn}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: textColor, minWidth: 60, textAlign: "center" }}>{year}</span>
            <button onClick={() => setYear((y) => y + 1)} style={navBtn}>▶</button>
            {!isMobile && <button onClick={() => { setYear(today.getFullYear()); setSelectedQuarter(Math.floor(today.getMonth() / 3)); setViewMode("quarter"); }} style={{ ...navBtn, color: "#3B82F6", fontWeight: 700, border: `1px solid #3B82F620`, background: "#3B82F610" }}>Hoy</button>}
          </div>

          <div style={{ display: "flex", background: bgColor, borderRadius: 10, padding: 3, flexShrink: 0 }}>
            <button onClick={() => setViewMode("quarter")} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: viewMode === "quarter" ? "#3B82F6" : "transparent", color: viewMode === "quarter" ? "#fff" : mutedColor, transition: "0.2s" }}>📊 Quarter</button>
            <button onClick={() => setViewMode("annual")} style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: viewMode === "annual" ? "#3B82F6" : "transparent", color: viewMode === "annual" ? "#fff" : mutedColor, transition: "0.2s" }}>📅 Anual</button>
          </div>

          <button onClick={() => openNewEvent(today.toISOString().slice(0, 10))} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)", flexShrink: 0 }}>{isMobile ? "+" : "+ Nuevo"}</button>
        </div>

        {!isMobile && (
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
        )}
      </div>

      <div style={{ background: cardBg, borderRadius: 12, padding: isMobile || viewMode === "annual" ? "0px" : "16px 20px", boxShadow: isMobile || viewMode === "annual" ? "none" : "0 1px 4px rgba(0,0,0,0.08)", border: isMobile || viewMode === "annual" ? "none" : `1px solid ${borderColor}` }}>
        {viewMode === "annual" ? <AnnualView /> : <QuarterView />}
      </div>

      {showDayDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowDayDetail(false)}>
          <div style={{ background: cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, width: "100%", maxWidth: 500, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -4px 20px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: textColor }}>{selectedDay?.split("-").reverse().join("/")}</div>
              <button onClick={() => { setShowDayDetail(false); openNewEvent(selectedDay); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 700 }}>+ Añadir</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(() => {
                const dayEvs = eventsForDay(selectedDay);
                if (dayEvs.length === 0) return <div style={{ textAlign: "center", padding: 40, color: mutedColor, fontSize: 13 }}>No hay eventos para este día</div>;
                return dayEvs.map((ev, i) => {
                  const isAbsence = ev.type === "absence";
                  const info = isAbsence ? (ABSENCE_TYPES[ev.absenceType] || ABSENCE_TYPES.other) : (eventTypes[ev.type] || eventTypes.custom || { label: "Otro", color: "#64748B", icon: "📌" });
                  const isSprint = ev.type === "sprint";
                  const pColor = isSprint ? sprintPillColor(ev, selectedDay) : (ev.color || info.color);
                  return (
                    <div key={i} onClick={() => { if (!isAbsence) { setShowDayDetail(false); openEditEvent(ev); } }}
                      style={{ padding: 16, borderRadius: 12, background: isSprint ? pColor : theme.healthMuted || "#F8FAFC", borderLeft: `5px solid ${pColor}`, cursor: isAbsence ? "default" : "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{info.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSprint ? "#fff" : textColor }}>{ev.title}</div>
                        <div style={{ fontSize: 11, color: isSprint ? "rgba(255,255,255,0.8)" : mutedColor }}>{ev.person || info.label}</div>
                      </div>
                      {!isAbsence && <span style={{ color: isSprint ? "#fff" : mutedColor }}>›</span>}
                    </div>
                  );
                });
              })()}
              <button onClick={() => { setShowDayDetail(false); openNewEvent(selectedDay); }} style={{ padding: 16, borderRadius: 12, border: `2px dashed ${borderColor}`, background: "transparent", color: mutedColor, fontWeight: 600, cursor: "pointer" }}>+ Agregar nuevo evento aquí</button>
            </div>
            <button onClick={() => setShowDayDetail(false)} style={{ width: "100%", padding: 14, marginTop: 24, borderRadius: 12, border: "none", background: theme.bg === "#0F172A" ? "#1E293B" : "#F1F5F9", color: textColor, fontWeight: 700 }}>Cerrar</button>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ 
            background: cardBg, 
            borderRadius: 20, 
            padding: 0, 
            width: "fit-content", 
            maxWidth: "96vw", 
            boxShadow: "0 25px 70px rgba(0,0,0,0.5)", 
            border: `1px solid ${borderColor}`, 
            overflow: "hidden", 
            display: "flex", 
            flexDirection: isMobile ? "column" : "row", 
            maxHeight: "90vh" 
          }}>
            
            {/* SECCIÓN IZQUIERDA: GESTIÓN DE EVENTOS */}
            {(!eventsForDay(form.start_date).some(e => e.type === "manual_sprint" && e.start_date === form.start_date) || showEditPanel || isMobile) && (
              <div style={{ flex: 1, padding: "32px", background: theme.bg === "#0F172A" ? "#1E293B50" : "#F8FAFC", borderRight: `1px solid ${borderColor}`, overflowY: "auto", display: "flex", flexDirection: "column", gap: 32 }}>
              
              {/* Header Día */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ padding: 10, background: "#3B82F615", borderRadius: 12, border: "1px solid #3B82F630" }}>
                    <span style={{ fontSize: 24 }}>📅</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: textColor, letterSpacing: "-0.5px" }}>
                      {new Date(form.start_date + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}
                    </div>
                    <div style={{ fontSize: 12, color: mutedColor, fontWeight: 600 }}>Gestión de actividades</div>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: theme.bg === "#0F172A" ? "#ffffff10" : "#00000005", color: mutedColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, transition: "0.2s" }}>×</button>
              </div>

              {/* Lista de Eventos con Estilo Timeline */}
              {(() => {
                const dayEvs = eventsForDay(form.start_date).filter(e => e.type !== "sprint");
                if (dayEvs.length > 0) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 11, color: mutedColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>Eventos en este día</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {dayEvs.map((ev) => {
                          const info = eventTypes[ev.type] || eventTypes.custom || { label: "Otro", color: "#64748B", icon: "📌" };
                          const isSelected = selectedEvent?.id === ev.id;
                          return (
                            <div key={ev.id} style={{ 
                              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, 
                              background: isSelected ? "#3B82F610" : cardBg, 
                              border: `1px solid ${isSelected ? "#3B82F6" : borderColor}`,
                              boxShadow: isSelected ? "0 4px 12px #3B82F620" : "none",
                              transition: "0.3s ease"
                            }}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: ev.color || info.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                {info.icon}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: textColor }}>
                                  {(() => {
                                    if (ev.type === "rotacion_soporte" || ev.type === "retorno_sprint") {
                                      const isStart = ev.start_date === form.start_date;
                                      const isEnd = (ev.end_date || ev.start_date) === form.start_date;
                                      if (!isStart && !isEnd) {
                                        const name = ev.title.split("—")[1] || ev.person || "";
                                        return `En Soporte — ${name.trim()}`;
                                      }
                                    }
                                    return ev.title;
                                  })()}
                                </div>
                                <div style={{ fontSize: 11, color: mutedColor, fontWeight: 600 }}>{ev.person || info.label}</div>
                                 {ev.notes && (
                                   <div style={{ fontSize: 10, color: mutedColor, marginTop: 4, fontStyle: "italic", display: "flex", alignItems: "start", gap: 4 }}>
                                     <span>💬</span>
                                     <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                       {ev.notes}
                                     </span>
                                   </div>
                                 )}
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => openEditEvent(ev)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "#3B82F615", color: "#3B82F6", cursor: "pointer", transition: "0.2s" }}>✏️</button>
                                {!ev.id?.startsWith("holiday-") && (
                                  <button onClick={() => handleDelete(ev.id)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "#EF444415", color: "#EF4444", cursor: "pointer", transition: "0.2s" }}>🗑</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Formulario Estilo Action Card */}
              <div style={{ 
                background: theme.bg === "#0F172A" ? "#ffffff05" : "#fff", 
                padding: "24px", borderRadius: 20, 
                border: `1px solid ${borderColor}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.05)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 4, height: 16, background: "#3B82F6", borderRadius: 2 }} />
                    <div style={{ fontSize: 15, fontWeight: 800, color: textColor }}>
                      {selectedEvent ? "Editar Actividad" : "Nueva Actividad"}
                    </div>
                  </div>
                  {selectedEvent && (
                    <button onClick={() => { setSelectedEvent(null); setForm({ ...form, title: "", person: "", notes: "", impact: 0.0, type: "vacation" }); }} 
                      style={{ fontSize: 10, padding: "5px 10px", borderRadius: 8, border: "none", background: "#3B82F615", color: "#3B82F6", cursor: "pointer", fontWeight: 800 }}>
                      + Nuevo
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {form.type === "manual_sprint" && (
                    <div style={{ position: "relative" }}>
                      <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Título del Sprint</label>
                      <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ ...inputStyle, padding: "12px 14px", fontSize: 14 }} placeholder="Ej: Sprint 60" />
                    </div>
                  )}
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 8, display: "block" }}>Categoría</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {Object.entries(eventTypes)
                          .filter(([k]) => k !== "sprint" && k !== "holiday")
                          .map(([k, v]) => {
                            const isActive = form.type === k;
                            return (
                              <button 
                                key={k} 
                                onClick={() => setForm({ 
                                  ...form, 
                                  type: k, 
                                  color: v.color,
                                  impact: k === "manual_sprint" ? 0.0 : 1.0
                                })}
                                style={{
                                  padding: "10px 4px", borderRadius: 12, border: `2px solid ${isActive ? v.color : borderColor}`,
                                  background: isActive ? v.color + "15" : cardBg,
                                  color: isActive ? v.color : mutedColor, cursor: "pointer",
                                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                                  fontWeight: isActive ? 800 : 500, fontSize: 10, transition: "0.2s"
                                }}>
                                <span style={{ fontSize: 20 }}>{v.icon}</span>
                                <span style={{ textAlign: "center", lineHeight: 1 }}>{v.label}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                    {form.type === "rotacion_soporte" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, marginBottom: 8, display: "block" }}>Sale del Sprint (Ingresa a Soporte) 🔄</label>
                          <select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} style={{ ...inputStyle, padding: "12px", fontSize: 14, border: "2px solid #EF4444" }}>
                            <option value="">(Seleccionar entrante...)</option>
                            {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#22C55E", fontWeight: 700, marginBottom: 8, display: "block" }}>Vuelve al Sprint (Sale de Soporte) ✅</label>
                          <select value={form.personSwap} onChange={(e) => setForm({ ...form, personSwap: e.target.value })} style={{ ...inputStyle, padding: "12px", fontSize: 14, border: "2px solid #22C55E" }}>
                            <option value="">(Seleccionar saliente...)</option>
                            {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 8, display: "block" }}>Colaborador</label>
                        <select value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} style={{ ...inputStyle, padding: "12px", fontSize: 14 }}>
                          <option value="">(Seleccionar colaborador...)</option>
                          {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {form.type === "rotacion_soporte" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Inicio de Rotación</label>
                        <input type="date" value={form.start_date} disabled style={{ ...inputStyle, padding: "12px", opacity: 0.6 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Hasta el Sprint (apertura)</label>
                        <select 
                          value={form.end_date} 
                          onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                          style={{ ...inputStyle, padding: "12px", fontSize: 14 }}
                        >
                          <option value="">— Seleccionar sprint —</option>
                          {events
                            .filter(e => e.type === "manual_sprint" && e.start_date > form.start_date)
                            .sort((a, b) => a.start_date.localeCompare(b.start_date))
                            .map(sprint => (
                              <option key={sprint.id} value={sprint.start_date}>
                                {sprint.title} ({new Date(sprint.start_date + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Fecha Inicio</label>
                        <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} style={{ ...inputStyle, padding: "12px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Fecha Fin</label>
                        <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} style={{ ...inputStyle, padding: "12px" }} />
                      </div>
                    </div>
                  )}

                  {form.type !== "manual_sprint" && (
                    <>
                      {form.type !== "rotacion_soporte" && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700 }}>Impacto en Capacidad</label>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#3B82F6" }}>{Math.round(form.impact * 100)}%</span>
                          </div>
                          <input type="range" min="0" max="1" step="0.5" value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: parseFloat(e.target.value) }))} style={{ width: "100%", accentColor: "#3B82F6" }} />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: 11, color: mutedColor, fontWeight: 700, marginBottom: 6, display: "block" }}>Comentarios (opcional)</label>
                        <textarea 
                          value={form.notes} 
                          onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} 
                          style={{ ...inputStyle, height: 60, resize: "none", padding: "12px" }} 
                          placeholder="Ej: Pendiente aprobación..."
                        />
                      </div>
                    </>
                  )}

                  <button onClick={handleSave} style={{ 
                    width: "100%", padding: "16px", borderRadius: 14, border: "none", 
                    background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)", 
                    color: "#fff", fontWeight: 800, cursor: "pointer", 
                    boxShadow: "0 8px 20px rgba(59,130,246,0.3)",
                    transition: "0.2s"
                  }}>
                    {selectedEvent ? "Actualizar Registro" : "Confirmar Carga"}
                  </button>
                </div>
              </div>
            </div>
          )}

            {/* SECCIÓN DERECHA: SPRINT CONSOLE (PREMIUM) */}
            {(() => {
              const dayEvs = eventsForDay(form.start_date);
              const sprintOnDay = dayEvs.find(e => e.type === "manual_sprint" && e.start_date === form.start_date);
              
              if (!sprintOnDay && form.type !== "manual_sprint") return null;
              
              const sStart = sprintOnDay ? sprintOnDay.start_date : form.start_date;
              const sEnd = sprintOnDay ? sprintOnDay.end_date : form.end_date;
              const sTitle = sprintOnDay ? sprintOnDay.title : form.title;
              const s = getSprintSummary(sStart, sEnd);
              
              return (
                <div style={{ flex: 1.5, background: theme.bg === "#0F172A" ? "#0F172A" : "#FFFFFF", padding: "32px", overflowY: "auto", position: "relative" }}>
                  {!s ? (
                    <div style={{ color: mutedColor, textAlign: "center", marginTop: 40 }}>Definí fechas para ver el resumen</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 24 }}>🚀</span>
                          <div style={{ fontSize: 22, fontWeight: 900, color: textColor, letterSpacing: "-0.5px" }}>
                            Plan del Sprint
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: "#3B82F6", fontWeight: 800 }}>{sTitle}</div>
                      </div>
                      
                                   {/* HEADER DE LA CONSOLA: Título y Botón de Gestión */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: textColor, lineHeight: 1.2 }}>
                            {sTitle || "Sprint Console"}
                          </div>
                          <div style={{ fontSize: 12, color: mutedColor, fontWeight: 500, marginTop: 4 }}>
                            {new Date(sStart + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })} - {new Date(sEnd + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </div>
                        </div>

                        {!isMobile && (
                          <button 
                            onClick={() => setShowEditPanel(!showEditPanel)}
                            style={{
                              padding: "8px 16px", borderRadius: 10,
                              background: showEditPanel ? (theme.bg === "#0F172A" ? "#1E293B" : "#F1F5F9") : "#3B82F6",
                              color: showEditPanel ? textColor : "#fff",
                              border: "none", fontWeight: 800, fontSize: 12, cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 8, transition: "0.2s"
                            }}
                          >
                            <span>{showEditPanel ? "✕ Cerrar" : "✏️ Gestionar Día"}</span>
                          </button>
                        )}
                      </div>

                      {/* === PANEL DE ESTADÍSTICAS DEL SPRINT (MINI CARDS) === */}
                      <div style={{ display: "flex", flexWrap: "nowrap", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 8 }}>
                        {[
                          { label: "Laborales", val: s.businessDays, icon: "💼" },
                          { label: "Feriados", val: s.holidays, icon: "🇦🇷" },
                          { label: "Findes", val: s.weekends, icon: "⛔" },
                          { label: "Cumples", val: s.birthdays, icon: "🎂" },
                          { label: "Vacaciones", val: s.vacations, icon: "🏖️" },
                          { label: "Lic. Médica", val: s.medical, icon: "🏥" },
                          { label: "Lic. Examen", val: s.exam, icon: "📝" },
                          { label: "Lic. Estudio", val: s.study, icon: "📚" },
                        ].map((stat, i) => (
                          <div key={i} style={{
                            padding: "8px 12px", borderRadius: 12, background: theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC",
                            border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 10,
                            minWidth: 100, flexShrink: 0
                          }}>
                            <span style={{ fontSize: 18 }}>{stat.icon}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              <span style={{ fontSize: 14, fontWeight: 900, color: textColor, lineHeight: 1 }}>{stat.val}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(() => {
                        // === SECCIÓN EN SOPORTE ===
                        // Busca eventos de tipo "rotacion_soporte" que se solapen con el sprint actual
                        const eventosEnSoporte = allEvents.filter(e => {
                          if (e.type !== "rotacion_soporte") return false;
                          // Se solapa si el evento empieza antes del fin del sprint
                          // y termina después del inicio del sprint
                          return e.start_date <= sEnd && (e.end_date || e.start_date) >= sStart;
                        });

                        if (eventosEnSoporte.length === 0) return null;

                        return (
                          <div style={{ marginBottom: 24, padding: "14px 18px", borderRadius: 16, background: "#EF444410", border: "1.5px solid #EF444430" }}>
                            <div style={{ fontSize: 10, fontWeight: 900, color: "#EF4444", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
                              Colaboradores en Soporte Técnico
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                              {eventosEnSoporte.map(ev => {
                                // Calcular fecha de retorno: el evento "retorno_sprint" que tenga la misma persona/rango
                                const retornoEv = allEvents.find(e =>
                                  e.type === "retorno_sprint" &&
                                  e.start_date === ev.start_date &&
                                  e.end_date === ev.end_date
                                );
                                const retornoDate = ev.end_date || ev.start_date;
                                const retornoLabel = retornoEv
                                  ? (retornoEv.title || new Date(retornoDate + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }))
                                  : new Date(retornoDate + "T12:00:00").toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

                                return (
                                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, background: cardBg, padding: "8px 14px", borderRadius: 12, border: `1px solid ${borderColor}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: textColor }}>{ev.person}</div>
                                    <div style={{ width: 1, height: 14, background: borderColor }} />
                                    <div style={{ fontSize: 11, fontWeight: 600, color: mutedColor }}>
                                      Regresa: <span style={{ color: "#3B82F6", fontWeight: 800 }}>{retornoLabel}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        // Calcular quiénes están en soporte durante este sprint (por eventos, no por rol)
                        const nombresEnSoporte = new Set(
                          allEvents
                            .filter(e =>
                              e.type === "rotacion_soporte" &&
                              e.start_date <= sEnd &&
                              (e.end_date || e.start_date) >= sStart
                            )
                            .map(e => e.person)
                            .filter(Boolean)
                        );

                        // Excluir de la grilla a quienes están en soporte técnico este sprint
                        const personasActivas = people.filter(p => !nombresEnSoporte.has(p.name));
                        const rolesPresentes = [...new Set(personasActivas.map(p => p.role || "Sin Rol"))].sort();
                        const ROLE_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#06B6D4", "#EC4899", "#84cc16"];
                        const personsByGroup = {};
                        rolesPresentes.forEach((role) => {
                          personsByGroup[role] = personasActivas.filter(p => (p.role || "Sin Rol") === role);
                        });

                        const dayPersonMap = {};
                        s.dailyDetail.forEach(d => {
                          dayPersonMap[d.date] = {};
                          if (d.isWeekend) {
                            personasActivas.forEach(p => { dayPersonMap[d.date][p.name] = { status: "weekend" }; });
                          } else if (d.isHoliday) {
                            personasActivas.forEach(p => { dayPersonMap[d.date][p.name] = { status: "holiday", label: d.holidayName }; });
                          } else {
                            (d.present || []).forEach(name => {
                              if (!nombresEnSoporte.has(name)) {
                                dayPersonMap[d.date][name] = { status: "present" };
                              }
                            });
                            (d.unavailable || []).forEach(u => {
                              if (!nombresEnSoporte.has(u.name)) {
                                const typeInfo = eventTypes[u.type] || ABSENCE_TYPES[u.type] || { icon: "📌", color: "#EF4444" };
                                dayPersonMap[d.date][u.name] = { status: "absent", type: u.type, icon: typeInfo.icon, color: typeInfo.color };
                              }
                            });
                          }
                        });

                        const COL_W = 52; 
                        const ROW_NAME_W = 200; 

                        return (
                          <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${borderColor}` }}>
                            <table style={{ borderCollapse: "collapse", minWidth: "100%", tableLayout: "fixed" }}>
                              <thead>
                                <tr>
                                  <th style={{
                                    width: ROW_NAME_W, minWidth: ROW_NAME_W,
                                    padding: "10px 14px", textAlign: "left",
                                    fontSize: 10, fontWeight: 800, color: mutedColor, textTransform: "uppercase",
                                    background: theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC",
                                    borderBottom: `1px solid ${borderColor}`,
                                    position: "sticky", left: 0, zIndex: 2
                                  }}>
                                    Colaborador
                                  </th>
                                  {s.dailyDetail.map((d, i) => {
                                    const isWeekend = d.isWeekend;
                                    const isHoliday = d.isHoliday;
                                    const dayDate = new Date(d.date + "T12:00:00");
                                    return (
                                      <th key={i} style={{
                                        width: COL_W, minWidth: COL_W,
                                        padding: "8px 2px",
                                        textAlign: "center",
                                        background: isHoliday ? "#F9731615" : isWeekend ? "#EF444410" : (theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC"),
                                        borderBottom: `1px solid ${borderColor}`,
                                        borderLeft: `1px solid ${borderColor}20`
                                      }}>
                                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: isWeekend ? "#EF4444" : isHoliday ? "#F97316" : mutedColor }}>
                                          {dayDate.toLocaleDateString('es-AR', { weekday: 'short' })}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: isWeekend ? "#EF4444" : isHoliday ? "#F97316" : textColor }}>
                                          {dayDate.toLocaleDateString('es-AR', { day: '2-digit' })}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>

                              <tbody>
                                {rolesPresentes.map((role, rIdx) => {
                                  const groupPeople = personsByGroup[role];
                                  const groupColor = ROLE_COLORS[rIdx % ROLE_COLORS.length];
                                  const isCollapsed = collapsedRoles.has(role);

                                  return [
                                    <tr key={`role-${role}`} onClick={() => toggleRole(role)} style={{ cursor: "pointer" }}>
                                      <td colSpan={s.dailyDetail.length + 1} style={{
                                        padding: "10px 14px 6px", background: `${groupColor}12`,
                                        borderTop: `2px solid ${groupColor}40`, borderBottom: `1px solid ${groupColor}20`,
                                      }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontWeight: 900, color: groupColor, textTransform: "uppercase" }}>
                                          <span style={{ fontSize: 14, transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "0.2s" }}>▼</span>
                                          {role} <span style={{ fontWeight: 500, color: mutedColor, fontSize: 10 }}>({groupPeople.length})</span>
                                        </div>
                                      </td>
                                    </tr>,
                                    !isCollapsed && groupPeople.map(person => (
                                      <tr key={person.name}>
                                        <td style={{
                                          padding: "8px 14px", fontSize: 12, fontWeight: 700, color: textColor,
                                          background: theme.bg === "#0F172A" ? "#0F172A" : "#FFFFFF",
                                          borderBottom: `1px solid ${borderColor}20`,
                                          position: "sticky", left: 0, zIndex: 1,
                                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: ROW_NAME_W
                                        }}>{person.name}</td>
                                        {s.dailyDetail.map((d, di) => {
                                          const state = dayPersonMap[d.date][person.name] || { status: "none" };
                                          return (
                                            <td key={di} style={{
                                              padding: "6px 2px", textAlign: "center",
                                              borderBottom: `1px solid ${borderColor}15`, borderLeft: `1px solid ${borderColor}15`,
                                              background: d.isHoliday ? "#F9731605" : d.isWeekend ? "#EF444405" : "transparent"
                                            }}>
                                              {state.status === "present" && <span style={{ color: "#10B981", fontWeight: 900, fontSize: 14 }}>✓</span>}
                                              {state.status === "absent" && (
                                                <div title={state.type} style={{ fontSize: 16, cursor: "help" }}>{state.icon}</div>
                                              )}
                                              {state.status === "weekend" && <span style={{ color: "#EF4444", opacity: 0.3, fontSize: 10 }}>⛔</span>}
                                              {state.status === "holiday" && <span style={{ color: "#F97316", opacity: 0.6, fontSize: 14 }}>🇦🇷</span>}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))
                                  ];
                                })}

                                <tr style={{ background: theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC" }}>
                                  <td style={{
                                    padding: "10px 14px", fontSize: 10, fontWeight: 900, color: mutedColor, textTransform: "uppercase",
                                    background: theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC",
                                    borderTop: `2px solid ${borderColor}`, position: "sticky", left: 0, zIndex: 1
                                  }}>Capacidad</td>
                                  {s.dailyDetail.map((d, di) => {
                                    const isSpecial = d.isWeekend || d.isHoliday;
                                    
                                    // Ajustar total y disponible excluyendo a la gente de soporte
                                    let adjTotal = d.total;
                                    let adjAvailable = d.available;
                                    
                                    nombresEnSoporte.forEach(name => {
                                      adjTotal -= 1;
                                      // Si la persona estaba contabilizada como presente ese día, la restamos del available
                                      if (d.present && d.present.includes(name)) {
                                        adjAvailable -= 1;
                                      } else if (d.unavailable) {
                                        // Si tenía una ausencia parcial, restamos su parte disponible
                                        const u = d.unavailable.find(x => x.name === name);
                                        if (u && typeof u.impact === "number" && u.impact < 1) {
                                          adjAvailable -= (1 - u.impact);
                                        }
                                      }
                                    });

                                    // Asegurar que no den negativos por desfasajes decimales
                                    adjTotal = Math.max(0, adjTotal);
                                    adjAvailable = Math.max(0, adjAvailable);

                                    const capPct = adjTotal > 0 ? Math.round((adjAvailable / adjTotal) * 100) : 0;
                                    const capColor = capPct === 100 ? "#10B981" : capPct >= 70 ? "#F59E0B" : "#EF4444";
                                    
                                    return (
                                      <td key={di} style={{
                                        padding: "6px 2px", textAlign: "center", borderTop: `2px solid ${borderColor}`,
                                        borderLeft: `1px solid ${borderColor}20`,
                                        background: isSpecial ? (d.isHoliday ? "#F9731608" : "#EF444408") : (theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC")
                                      }}>
                                        {!isSpecial && <div style={{ fontSize: 11, fontWeight: 900, color: capColor }}>{capPct}%</div>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
