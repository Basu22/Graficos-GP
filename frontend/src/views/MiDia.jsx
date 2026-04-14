import { useState, useEffect, useCallback } from "react";
import { API } from "../constants";
import { useHolidays } from "../hooks/useHolidays";
import { useSmartInbox } from "../hooks/useSmartInbox";
import SmartInboxColumn from "../components/SmartInboxColumn";
import GmailCalendarWidget from "../components/GmailCalendarWidget";

// Tokens del tema — reactivos al toggle dark/light
function getPalette(T) {
  const isDark = T?.bg === '#0F172A';
  return {
    bg:        isDark ? '#0F172A'  : '#f0f4f8',
    card:      isDark ? '#1E293B'  : '#ffffff',
    cardInner: isDark ? '#172033'  : '#f8fafc',
    border:    isDark ? '#334155'  : '#e2e8f0',
    text:      isDark ? '#F1F5F9'  : '#1e293b',
    textMuted: isDark ? '#94A3B8'  : '#64748b',
    textFaint: isDark ? '#64748B'  : '#94a3b8',
    primary:   '#3B82F6',
    accent:    '#F59E0B',
    shadow:    isDark
      ? '0 4px 20px rgba(0,0,0,0.4)'
      : '0 4px 12px rgba(0,0,0,0.03)',
    groups: { clientes: '#F59E0B', tickets: '#EF4444', equipo: '#3B82F6', notif: '#22C55E' },
    priority:  { alta: '#EF4444', media: '#F59E0B', baja: '#22C55E' },
  };
}

const Shimmer = () => (
  <div style={{
    width: "100%", height: "100%", background: "linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)",
    backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear", borderRadius: 8
  }}>
    <style>{`
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      @keyframes pulse-red { 
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .meet-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4) !important;
        background: linear-gradient(135deg, #2563EB, #4F46E5) !important;
      }
      .day-item:hover {
        background: #f8fafc !important;
        transform: translateY(-2px);
      }
      .is-holiday {
        background: rgba(239, 68, 68, 0.08) !important;
        border: 1.5px solid rgba(239, 68, 68, 0.4) !important;
        color: #ef4444 !important;
      }
    `}</style>
  </div>
);

export default function MiDia({ T }) {
  const PALETTE = getPalette(T);   // ← reactivo al tema
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mailGroups, setMailGroups] = useState({
    clientes: { open: true, items: [], unread: 0 },
    tickets: { open: true, items: [], unread: 0 },
    equipo: { open: false, items: [], unread: 0 },
    notif: { open: false, items: [], unread: 0 },
  });
  const [events, setEvents] = useState([]);
  const [allMails, setAllMails] = useState([]);  // Lista plana de 30d para Smart Inbox
  const [manualTasks, setManualTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [aiPlan, setAiPlan] = useState(null);
  const [lastAiUpdate, setLastAiUpdate] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  // Semana laboral: 1=Lun ... 5=Vie. Si hoy es fin de semana, posicionar en Lunes.
  const todayIndex = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 1 && todayIndex <= 5 ? todayIndex : 1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState("");
  const [addingAttendee, setAddingAttendee] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [recurringDialog, setRecurringDialog] = useState({ open: false, onConfirm: null });
  const [recurringScope, setRecurringScope] = useState('single');
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Hook de feriados
  const { nextHoliday, injectHolidays } = useHolidays();

  const { smartInbox, urgentCount, hasKPIAlerts, onboardingPct, waitingInitiatives, healthReport, loadingHealth } = useSmartInbox(
    allMails,
    { userName: 'Basilio Ossvald', userEmail: 'bossvald@flink.com.ar' }
  );

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch inicial (Weather + Data)
  // Mapeo de códigos de clima de wttr.in a emojis
  const getWeatherIcon = (code) => {
    const icons = {
      "113": "☀️", "116": "⛅", "119": "☁️", "122": "☁️",
      "176": "🌦️", "179": "🌨️", "182": "🌨️", "185": "🌨️", "200": "⛈️",
      "248": "🌫️", "260": "🌫️", "263": "🌦️", "266": "🌦️", "293": "🌦️",
      "296": "🌦️", "299": "🌧️", "302": "🌧️", "311": "🌧️", "314": "🌧️"
    };
    return icons[code] || "⛅";
  };

  // Fetch de Clima Independiente
  const fetchWeather = useCallback(async () => {
    try {
      const resp = await fetch("https://wttr.in/?format=j1");
      const wData = await resp.json();
      const current = wData.current_condition[0];
      
      // Aplanamos el pronóstico de 3 días para tener un flujo continuo
      let allHourly = [];
      wData.weather.forEach((day, dayIdx) => {
        day.hourly.forEach(h => {
          const hour = parseInt(h.time === "0" ? "0" : h.time.padStart(4, "0").slice(0, 2));
          // Calculamos un timestamp aproximado para el filtrado
          const dateRef = new Date();
          dateRef.setDate(dateRef.getDate() + dayIdx);
          dateRef.setHours(hour, 0, 0, 0);
          
          allHourly.push({
            time: h.time === "0" ? "00:00" : `${h.time.padStart(4, "0").slice(0, 2)}:00`,
            temp: h.tempC,
            icon: getWeatherIcon(h.weatherCode),
            ts: dateRef.getTime()
          });
        });
      });

      const dailyIcons = {};
      wData.weather.forEach(w => {
        dailyIcons[w.date] = getWeatherIcon(w.hourly[4].weatherCode);
      });

      setWeather({
        temp: current.temp_C,
        desc: current.lang_es?.[0]?.value || current.weatherDesc[0].value,
        icon: getWeatherIcon(current.weatherCode),
        fullHourly: allHourly, // Guardamos la lista completa
        dailyIcons
      });
    } catch (e) {
      console.error("Error clima:", e);
    }
  }, []);

  // Timer para refrescar solo el clima cada 1 hora
  useEffect(() => {
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 3600000); // 1 hora
    return () => clearInterval(weatherTimer);
  }, [fetchWeather]);

  // Fetch de Datos de Negocio (Google, etc.)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/midia/data`);
      const data = await res.json();
      
      if (!data.google_connected || data.error) {
        // Si no hay conexión, usamos un estado "vacio" o mock informativo
        setMailGroups({
          clientes: { open: true, unread: 0, items: [] },
          tickets: { open: true, unread: 0, items: [] },
          equipo: { open: false, unread: 0, items: [] },
          notif: { open: false, unread: 0, items: [] },
        });
        setEvents([]);
      } else {
        setMailGroups(prev => {
          const newGroups = { ...prev };
          Object.keys(data.mail_groups).forEach(key => {
            newGroups[key] = {
              ...prev[key],
              items: data.mail_groups[key],
              unread: data.mail_groups[key].length
            };
          });
          return newGroups;
        });
        // Lista plana completa para processSmartInbox (30d, hasta 150 mails)
        if (data.all_mails) setAllMails(data.all_mails);
        setEvents(data.events
          // Filtrar eventos "todo el día" (sin dateTime)
          .filter(ev => ev.start.dateTime)
          .map(ev => {
            const start = new Date(ev.start.dateTime);
            const end = ev.end.dateTime ? new Date(ev.end.dateTime) : null;
            const nowDate = new Date();
            const isActive = end && nowDate >= start && nowDate <= end;
            const isPast = end && nowDate > end;
            const attendees = ev.attendees || [];
            const selfAttendee = attendees.find(a => a.self);
            const selfConfirmed = selfAttendee ? selfAttendee.responseStatus === 'accepted' : true;
            return {
              id: ev.id,
              dayOfWeek: start.getDay(), // 1=Lun ... 5=Vie
              dayOfMonth: start.getDate(),
              time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timeEnd: end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
              startFull: start.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
              endFull: end ? end.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null,
              title: ev.summary || "Sin título",
              description: ev.description || "",
              location: ev.location || "",
              link: ev.hangoutLink || ev.htmlLink || null,
              rawStart: ev.start.dateTime,
              rawEnd: ev.end.dateTime || null,
              attendees,
              selfConfirmed,
              isActive,
              isPast,
              recurringEventId: ev.recurringEventId || null,  // 👈 para detectar eventos periódicos
            };
          }));
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleGroup = (id) => {
    setMailGroups(prev => ({ ...prev, [id]: { ...prev[id], open: !prev[id].open } }));
  };

  const handleAddTask = (e) => {
    if (e.key === "Enter" && newTaskText.trim()) {
      setManualTasks([...manualTasks, { id: Date.now(), text: newTaskText, done: false }]);
      setNewTaskText("");
    }
  };

  const generateAIPlan = async () => {
    setGeneratingAi(true);
    try {
      // Recopilamos todos los mails para procesar
      const allMails = Object.values(mailGroups).flatMap(g => g.items);
      
      if (allMails.length === 0) {
        alert("Primero cargá tus mails de Google para generar un plan.");
        setGeneratingAi(false);
        return;
      }

      const res = await fetch(`${API}/midia/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allMails)
      });
      
      const data = await res.json();
      console.log("Plan IA Recibido:", data);
      setAiPlan(data);
      setLastAiUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      alert("Error generando el plan con IA");
    }
    setGeneratingAi(false);
  };

  // Semana laboral Lun-Vie con índice JS (1-5)
  const workDaysBase = [
    { label: "Lun", index: 1 },
    { label: "Mar", index: 2 },
    { label: "Mié", index: 3 },
    { label: "Jue", index: 4 },
    { label: "Vie", index: 5 },
  ];
  const currentDay = now.getDay();

  // Calcular la fecha de cada día laboral de esta semana
  const getDateForWeekday = (targetDayIndex) => {
    const today = new Date();
    const diff = targetDayIndex - today.getDay();
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    return d.getDate();
  };

  // Inyectar feriados en los días de la semana
  const workDays = injectHolidays(workDaysBase, getDateForWeekday);

  // Calcular la fecha del día laboral seleccionado (para el widget)
  const getSelectedDate = () => {
    const today = new Date();
    const diff = selectedDay - today.getDay();
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const selectedDate = getSelectedDate();

  // Crear reunión instantánea con Google Meet
  const createInstantMeeting = async () => {
    setCreatingMeeting(true);
    try {
      const res = await fetch(`${API}/midia/instant-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Reunión instantánea', duration_minutes: 30 })
      });
      if (!res.ok) throw new Error('Error al crear la reunión');
      const data = await res.json();
      window.open(data.hangoutLink, '_blank');
    } catch (e) {
      alert('No se pudo crear la reunión: ' + e.message);
    }
    setCreatingMeeting(false);
  };

  // Filtrar eventos del día seleccionado
  const eventsForDay = events.filter(ev => ev.dayOfWeek === selectedDay);

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: PALETTE.text, animation: "fadeIn 0.5s ease-out" }}>
      {/* TOPBAR */}
      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", 
        background: PALETTE.card, padding: "16px 24px", borderRadius: 16, marginBottom: 24,
        boxShadow: PALETTE.shadow, border: `1px solid ${PALETTE.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>
            {now.getHours().toString().padStart(2, '0')}
            <span style={{ animation: "blink 1s infinite", margin: "0 2px" }}>:</span>
            {now.getMinutes().toString().padStart(2, '0')}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span style={{ fontSize: 11, color: PALETTE.textMuted }}>{weather ? `${weather.icon} ${weather.temp}°C · ${weather.desc}` : "Cargando clima..."}</span>
          </div>

          {/* Widget Clima por Horas (Dinámico) */}
          {weather?.fullHourly && (
            <div style={{ 
              display: "flex", gap: 10, padding: "4px 8px", 
              background: PALETTE.cardInner, borderRadius: 14, 
              border: `1px solid ${PALETTE.border}`, flexShrink: 0
            }}>
              {weather.fullHourly
                .filter(h => h.ts > now.getTime()) // Solo el futuro
                .slice(0, 3) // Solo las próximas 3 disponibles
                .map((h, i) => (
                  <div key={i} style={{ textAlign: "center", minWidth: 46 }}>
                    <div style={{ fontSize: 11, fontWeight: 800 }}>{h.temp}°</div>
                    <div style={{ fontSize: 16 }}>{h.icon}</div>
                    <div style={{ fontSize: 9, color: PALETTE.textMuted }}>{h.time}</div>
                  </div>
                ))}
            </div>
          )}

          {/* Próximo feriado: Integrado sin cápsula */}
          {nextHoliday && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: nextHoliday.isToday ? "#F59E0B" : PALETTE.text }}>
                  {nextHoliday.isToday ? "¡Hoy es Feriado!" : `Días para el feriado: ${nextHoliday.daysLeft === 0 ? "Mañana" : nextHoliday.daysLeft}`}
                </span>
                <span style={{ fontSize: 11, color: PALETTE.textMuted }}>{nextHoliday.name}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Botón Meet Instantáneo — abre directamente "Iniciar reunión ahora" */}
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="meet-btn"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #3B82F6, #6366F1)",
              color: "#fff", border: "none", padding: "10px 20px", borderRadius: 14,
              fontSize: 11, fontWeight: 800, cursor: "pointer", textDecoration: "none",
              boxShadow: "0 4px 15px rgba(59, 130, 246, 0.2)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              textTransform: "uppercase", letterSpacing: 0.5
            }}
          >
            📹 Instant Meet
          </a>
          
          <div style={{ display: "flex", gap: 14 }}>
            {["Gmail", "Calendar", "Drive"].map(app => (
              <div key={app} style={{ fontSize: 10, fontWeight: 700, color: PALETTE.textMuted, cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = PALETTE.primary}
                onMouseLeave={e => e.currentTarget.style.color = PALETTE.textMuted}
              >
                {app}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SEGUNDA FILA: Agenda, Inbox, IA Plan ── */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "minmax(300px, 1fr) minmax(350px, 1fr) minmax(320px, 1fr)", 
        gap: 20, 
        height: "calc(100vh - 250px)",
        overflow: "hidden"
      }}>
        {/* COLUMNA 1: AGENDA */}
        <div style={{ 
          background: PALETTE.card, padding: 24, borderRadius: 20, 
          display: "flex", flexDirection: "column", gap: 20, 
          boxShadow: PALETTE.shadow, border: `1px solid ${PALETTE.border}`,
          overflowY: "auto", minWidth: 0, color: PALETTE.text
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, gap: 4 }}>
            {workDays.map((day) => {
              const { label, index } = day;
              const isToday = index === currentDay;
              const isSelected = index === selectedDay;
              const isPast = index < currentDay;
              
              const d = new Date();
              const diff = index - d.getDay();
              d.setDate(d.getDate() + diff);
              const dateKey = d.toISOString().slice(0, 10);
              const dayIcon = weather?.dailyIcons?.[dateKey];

              return (
                <div key={index} onClick={() => setSelectedDay(index)}
                  className={`day-item ${day.isHoliday ? 'is-holiday' : ''}`}
                  style={{
                    flex: 1, padding: "10px 4px", borderRadius: 12, textAlign: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    background: isSelected ? (day.isHoliday ? "#EF4444" : PALETTE.primary) : "transparent",
                    color: isSelected ? "#fff" : day.isHoliday ? "#EF4444" : isPast ? "#94a3b8" : PALETTE.text,
                    border: isToday && !isSelected ? `1.5px solid ${day.isHoliday ? '#EF4444' : '#000'}` : "1.5px solid transparent",
                    animation: isSelected && day.isHoliday ? "pulse-red 2s infinite" : "none"
                  }}
                  title={day.isHoliday ? day.holidayName : ""}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>{label}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{getDateForWeekday(index)}</span>
                    {dayIcon && <span style={{ fontSize: 12, marginTop: -2 }}>{dayIcon}</span>}
                  </div>
                  {day.isHoliday && <span style={{ fontSize: 7, display: "block", fontWeight: 700, opacity: 0.85 }}>🏖️</span>}
                </div>
              );
            })}
          </div>

          {/* GRILLA HORARIA — Google Calendar Style */}
          {loading ? (
            <div style={{ height: 300 }}><Shimmer /></div>
          ) : (
            <GmailCalendarWidget
              events={events}
              selectedDay={selectedDay}
              selectedDate={selectedDate}
              onEventCreated={fetchData}
              onEventClick={(ev) => setSelectedEvent(ev)}
              isDark={T?.bg === '#0F172A'}
            />
          )}
        </div>

        {/* COLUMNA 2: SMART INBOX */}
        <SmartInboxColumn
          smartInbox={smartInbox}
          healthReport={healthReport}
          loadingHealth={loadingHealth}
          onSync={fetchData}
          onSyncHealth={async () => {
            try {
              await fetch(`${API}/midia/health-report/sync`, { method: 'POST' });
              fetchData();
            } catch(e) { console.error('Sync Salud falló:', e); }
          }}
          isDark={T?.bg === '#0F172A' || T?.bg === '#0f172a'}
        />

        {/* COLUMNA 3: PLAN IA */}
        <div style={{ 
          background: PALETTE.card, padding: "24px", borderRadius: 20, 
          boxShadow: PALETTE.shadow, border: `1px solid ${PALETTE.border}`,
          display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
          color: PALETTE.text
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>PLAN SEMANAL IA ✨</h3>
            <button onClick={generateAIPlan} disabled={generatingAi} style={{ background: PALETTE.primary, color: "#fff", border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {generatingAi ? "GEN..." : "GENERAR"}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", paddingRight: 5 }}>
            {generatingAi ? <div style={{ height: 400 }}><Shimmer /></div> : !aiPlan ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <span style={{ fontSize: 40 }}>✨</span>
                <p style={{ fontSize: 12, color: PALETTE.textMuted }}>Deja que la IA organice tu semana basándose en tus mails.</p>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                <div style={{ fontSize: 11, color: PALETTE.textMuted, marginBottom: 15, textAlign: "right" }}>Actualizado: {lastAiUpdate}</div>
                {aiPlan.map(day => (
                  <div key={day.dayIndex} style={{ marginBottom: 20 }}>
                    <div style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: PALETTE.primary }}>RESUMEN: {day.summary}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {day.tasks.map((task, idx) => (
                        <div key={idx} style={{ padding: 16, borderRadius: 12, background: PALETTE.bg, border: `1px solid ${PALETTE.border}`, position: "relative" }}>
                          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: PALETTE.priority[task.priority], color: "#fff", textTransform: "uppercase" }}>{task.priority}</div>
                          <div style={{ display: "flex", gap: 12 }}>
                            <span style={{ fontSize: 20 }}>{task.icon}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{task.title}</div>
                              <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{task.detail}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: PALETTE.textMuted }}>ORIGEN: {task.origin}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* MODAL DE EVENTO — 80% x 80% */}
      {selectedEvent && (() => {
        const confirmed = selectedEvent.attendees.filter(a => a.responseStatus === 'accepted');
        const pending = selectedEvent.attendees.filter(a => !a.responseStatus || a.responseStatus === 'needsAction' || a.responseStatus === 'tentative');
        const declined = selectedEvent.attendees.filter(a => a.responseStatus === 'declined');

        const openEdit = () => {
          setEditData({
            summary: selectedEvent.title,
            description: selectedEvent.description,
            startDateTime: selectedEvent.rawStart,
            endDateTime: selectedEvent.rawEnd,
          });
          setConflicts([]);
          setEditMode(true);
        };

        const checkConflicts = async (startIso, endIso) => {
          if (!startIso || !endIso) return;
          setCheckingConflicts(true);
          try {
            const res = await fetch(`${API}/midia/events/check-conflicts`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start_iso: startIso, end_iso: endIso, exclude_event_id: selectedEvent.id })
            });
            const data = await res.json();
            setConflicts(data.conflicts || []);
          } catch (e) { console.error(e); }
          setCheckingConflicts(false);
        };

        const saveEvent = async () => {
          setSavingEvent(true);
          try {
            const body = {};
            if (editData.summary !== selectedEvent.title) body.summary = editData.summary;
            if (editData.description !== selectedEvent.description) body.description = editData.description;
            if (editData.startDateTime) body.start = { dateTime: editData.startDateTime, timeZone: 'America/Argentina/Buenos_Aires' };
            if (editData.endDateTime) body.end = { dateTime: editData.endDateTime, timeZone: 'America/Argentina/Buenos_Aires' };
            await fetch(`${API}/midia/events/${selectedEvent.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            alert('✅ Evento actualizado. Los participantes recibirán una notificación.');
            setEditMode(false);
            fetchData();
          } catch (e) { alert('Error guardando el evento'); }
          setSavingEvent(false);
        };

        const cancelEvent = async () => {
          if (!confirm('¿Cancelar este evento? Se enviará un mail de cancelación a todos los participantes.')) return;
          setCancellingEvent(true);
          try {
            await fetch(`${API}/midia/events/${selectedEvent.id}`, { method: 'DELETE' });
            alert('✅ Evento cancelado. Se notificó a los participantes.');
            setSelectedEvent(null);
            fetchData();
          } catch (e) { alert('Error cancelando el evento'); }
          setCancellingEvent(false);
        };

        const generateAIDescription = async () => {
          setGeneratingDescription(true);
          try {
            const res = await fetch(`${API}/midia/generate-event-description`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: editData.summary || selectedEvent.title, current_description: editData.description })
            });
            const data = await res.json();
            setEditData(prev => ({ ...prev, description: data.description }));
          } catch (e) { alert('Error generando descripción con IA'); }
          setGeneratingDescription(false);
        };

        const handleAddAttendee = () => {
          const email = newAttendeeEmail.trim().toLowerCase();
          if (!email) return;
          if (selectedEvent.attendees.some(a => a.email.toLowerCase() === email)) {
            alert('Este mail ya está invitado.'); return;
          }
          
          setSelectedEvent(prev => ({
            ...prev,
            attendees: [...prev.attendees, { email, responseStatus: 'needsAction' }]
          }));
          setNewAttendeeEmail('');
        };

        const handleRemoveAttendee = (email) => {
          setSelectedEvent(prev => ({
            ...prev,
            attendees: prev.attendees.filter(a => a.email !== email)
          }));
        };

        const saveAttendees = async (scope = 'single') => {
          setSavingEvent(true);
          try {
            const res = await fetch(`${API}/midia/events/${selectedEvent.id}/attendees?scope=${scope}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(selectedEvent.attendees)
            });
            if (!res.ok) throw new Error();
            alert('✅ Participantes actualizados. Google enviará los mails automáticamente.');
            fetchData();
          } catch (e) {
            alert('Error al guardar participantes. Reintentá en unos segundos.');
          }
          setSavingEvent(false);
          setRecurringDialog({ open: false, onConfirm: null });
        };

        const handleSaveAttendeesClick = () => {
          // Si el evento es recurrente, mostrar el dialog antes de guardar
          if (selectedEvent.recurringEventId) {
            setRecurringDialog({
              open: true,
              onConfirm: (scope) => saveAttendees(scope)
            });
          } else {
            saveAttendees('single');
          }
        };

        const AttendeeCard = ({ att, showRemove }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
            background: att.self ? '#f0f9ff' : '#f8fafc', border: att.self ? '1px solid #bae6fd' : '1px solid #f1f5f9' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: att.self ? 800 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.displayName || att.email}{att.self ? ' 👈' : ''}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.email}</div>
            </div>
            {showRemove && !att.self && (
              <button onClick={() => handleRemoveAttendee(att.email)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                title="Quitar participante">✕</button>
            )}
          </div>
        );

        return (
          <div onClick={() => { setSelectedEvent(null); setEditMode(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.2s ease-out' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 24, width: '80vw', height: '80vh',
                boxShadow: '0 32px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* ── HEADER ── */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {selectedEvent.isActive && <span style={{ fontSize: 9, background: '#22C55E', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 800, marginRight: 8 }}>EN CURSO</span>}
                  {selectedEvent.isPast && <span style={{ fontSize: 9, background: '#94a3b8', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 800, marginRight: 8 }}>FINALIZADO</span>}
                  {!selectedEvent.isActive && !selectedEvent.isPast && <span style={{ fontSize: 9, background: '#3B82F6', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 800, marginRight: 8 }}>PRÓXIMO</span>}
                  {editMode
                    ? <input value={editData.summary} onChange={e => setEditData(p => ({ ...p, summary: e.target.value }))}
                        style={{ fontSize: 20, fontWeight: 800, border: 'none', borderBottom: '2px solid #3B82F6', outline: 'none', width: '100%', background: 'transparent' }} />
                    : <h2 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEvent.title}</h2>
                  }
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!selectedEvent.isPast && (
                    editMode
                      ? <>
                          <button onClick={saveEvent} disabled={savingEvent}
                            style={{ background: '#22C55E', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {savingEvent ? '⏳...' : '💾 Guardar'}
                          </button>
                          <button onClick={() => setEditMode(false)}
                            style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                        </>
                      : <>
                          <button onClick={openEdit}
                            style={{ background: '#f1f5f9', color: '#334155', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
                          <button onClick={cancelEvent} disabled={cancellingEvent}
                            style={{ background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {cancellingEvent ? '⏳...' : '🗑 Cancelar evento'}
                          </button>
                        </>
                  )}
                  <button onClick={() => { setSelectedEvent(null); setEditMode(false); }}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: 15, color: '#64748b' }}>✕</button>
                </div>
              </div>

              {/* ── BODY: col izq + col der ── */}
              <div style={{ display: 'grid', gridTemplateColumns: editMode ? '1fr' : 'minmax(300px, 1fr) minmax(400px, 1.4fr)', flex: 1, overflow: 'hidden' }}>

                {/* ── COL IZQUIERDA: Info / Edición ── */}
                <div style={{ padding: '24px 28px', overflowY: 'auto', borderRight: editMode ? 'none' : '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {editMode ? (
                    <>
                      {/* Fecha/Hora edición */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 8 }}>Inicio</div>
                        <input type="datetime-local" value={editData.startDateTime?.slice(0, 16) || ''}
                          onChange={e => { const v = e.target.value; setEditData(p => ({ ...p, startDateTime: v })); checkConflicts(v, editData.endDateTime); }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 8 }}>Fin</div>
                        <input type="datetime-local" value={editData.endDateTime?.slice(0, 16) || ''}
                          onChange={e => { const v = e.target.value; setEditData(p => ({ ...p, endDateTime: v })); checkConflicts(editData.startDateTime, v); }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                      </div>

                      {/* Conflictos */}
                      {checkingConflicts && <div style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Verificando conflictos...</div>}
                      {conflicts.length > 0 && (
                        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', padding: 12, borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>⚠️ {conflicts.length} conflicto(s) detectado(s):</div>
                          {conflicts.map((c, i) => <div key={i} style={{ fontSize: 11, color: '#78350F' }}>• {c.title}</div>)}
                          <div style={{ fontSize: 11, color: '#92400E', marginTop: 8 }}>Podés guardarlo igual si lo necesitás.</div>
                        </div>
                      )}

                      {/* Descripción + IA */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8' }}>Descripción</div>
                          <button onClick={generateAIDescription} disabled={generatingDescription}
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                            {generatingDescription ? '✨ Generando...' : '✨ Generar con IA'}
                          </button>
                        </div>
                        <textarea value={editData.description || ''}
                          onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                          rows={8}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, lineHeight: 1.6, resize: 'vertical', fontFamily: 'Sora, sans-serif' }} />
                      </div>

                      {/* Agregar participante */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 8 }}>Agregar Participante</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="email" value={newAttendeeEmail}
                            onChange={e => setNewAttendeeEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddAttendee()}
                            placeholder="correo@empresa.com"
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                          <button onClick={handleAddAttendee} disabled={addingAttendee || !newAttendeeEmail.trim()}
                            style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {addingAttendee ? '...' : '+ Invitar'}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 6 }}>Fecha y Hora</div>
                        <div style={{ fontSize: 13, color: '#334155' }}>📅 {selectedEvent.startFull}{selectedEvent.endFull ? ` → ${selectedEvent.endFull}` : ''}</div>
                      </div>
                      {selectedEvent.link && (
                        <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#3B82F6', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                          🔗 Unirse a la reunión
                        </a>
                      )}
                      {selectedEvent.location && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 6 }}>Lugar</div>
                          <div style={{ fontSize: 13, color: '#334155' }}>📍 {selectedEvent.location}</div>
                        </div>
                      )}
                      {selectedEvent.description && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 6 }}>Detalle</div>
                          <div style={{ fontSize: 13, color: '#475569', background: '#f8fafc', padding: 14, borderRadius: 10, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selectedEvent.description}</div>
                        </div>
                      )}
                      {/* RSVP: Confirmar asistencia */}
                      {(() => {
                        const selfAtt = selectedEvent.attendees.find(a => a.self);
                        if (!selfAtt) return null;
                        const status = selfAtt.responseStatus;
                        const rsvpOptions = [
                          { key: 'accepted',  label: 'Sí',     emoji: '✅', color: '#10B981', bg: '#ECFDF5' },
                          { key: 'declined',  label: 'No',     emoji: '❌', color: '#EF4444', bg: '#FEF2F2' },
                          { key: 'tentative', label: 'Quizás', emoji: '🤔', color: '#F59E0B', bg: '#FFFBEB' },
                        ];
                        const handleRSVP = async (response) => {
                          setRsvpLoading(true);
                          try {
                            const res = await fetch(`${API}/midia/events/${selectedEvent.id}/rsvp`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ response })
                            });
                            if (!res.ok) throw new Error();
                            
                            const isAccepted = response === 'accepted';
                            const newAttendees = selectedEvent.attendees.map(a =>
                              a.self ? { ...a, responseStatus: response } : a
                            );

                            // 1. Actualizar el modal (botones + lista de la derecha)
                            setSelectedEvent(prev => ({
                              ...prev,
                              selfConfirmed: isAccepted,
                              attendees: newAttendees
                            }));

                            // 2. Actualizar el listado general (skin del card)
                            setEvents(prev => prev.map(ev =>
                              ev.id === selectedEvent.id
                                ? { ...ev, selfConfirmed: isAccepted, attendees: newAttendees }
                                : ev
                            ));
                          } catch { alert('Error al confirmar asistencia'); }
                          setRsvpLoading(false);
                        };
                        return (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 8 }}>Tu asistencia</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {rsvpOptions.map(opt => (
                                <button key={opt.key} onClick={() => handleRSVP(opt.key)} disabled={rsvpLoading}
                                  style={{
                                    flex: 1, padding: '8px 6px', borderRadius: 10, border: `2px solid ${status === opt.key ? opt.color : '#e2e8f0'}`,
                                    background: status === opt.key ? opt.bg : '#fff',
                                    color: status === opt.key ? opt.color : '#64748b',
                                    fontWeight: status === opt.key ? 700 : 500,
                                    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s'
                                  }}
                                >
                                  {opt.emoji} {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* ── COL DERECHA: Participantes en 3 columnas ── */}
                {!editMode && (
                  <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
                    {/* Header Participantes + Botón Guardar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8' }}>
                        Participantes ({selectedEvent.attendees.length})
                      </div>
                      <button 
                        onClick={handleSaveAttendeesClick} 
                        disabled={savingEvent}
                        style={{ 
                          background: '#10B981', color: '#fff', border: 'none', padding: '6px 14px', 
                          borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        {savingEvent ? '⌛...' : '💾 Guardar Participantes'}
                      </button>
                    </div>

                    {/* Agregar participante con autocomplete */}
                    <div style={{ position: 'relative', display: 'flex', gap: 8, marginBottom: 20 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input type="email" value={newAttendeeEmail}
                          onChange={e => {
                            const val = e.target.value;
                            setNewAttendeeEmail(val);
                            if (val.length >= 2) {
                              // Buscar en todos los asistentes de todos los eventos de la semana
                              const allEmails = [...new Set(
                                events.flatMap(ev => ev.attendees || [])
                                  .map(a => a.email)
                                  .filter(em => em && em.toLowerCase().includes(val.toLowerCase())
                                    && !selectedEvent.attendees.some(a => a.email === em))
                              )];
                              setContactSuggestions(allEmails.slice(0, 6));
                              setShowSuggestions(allEmails.length > 0);
                            } else {
                              setShowSuggestions(false);
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') { handleAddAttendee(); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          placeholder="Agregar por correo..."
                          style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
                        {showSuggestions && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden'
                          }}>
                            {contactSuggestions.map(em => (
                              <div key={em}
                                onMouseDown={() => { setNewAttendeeEmail(em); setShowSuggestions(false); }}
                                style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', color: '#334155',
                                  borderBottom: '1px solid #f1f5f9' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              >
                                📧 {em}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { handleAddAttendee(); setShowSuggestions(false); }}
                        style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Agregar
                      </button>
                    </div>

                    {/* 3 columnas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {/* Confirmados */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#22C55E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ✅ Confirmados <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{confirmed.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {confirmed.length === 0
                            ? <div style={{ fontSize: 11, color: '#94a3b8', padding: 8 }}>—</div>
                            : confirmed.map((att, i) => <AttendeeCard key={i} att={att} showRemove={true} />)
                          }
                        </div>
                      </div>
                      {/* Pendientes */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⏳ Pendientes <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{pending.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {pending.length === 0
                            ? <div style={{ fontSize: 11, color: '#94a3b8', padding: 8 }}>—</div>
                            : pending.map((att, i) => <AttendeeCard key={i} att={att} showRemove={true} />)
                          }
                        </div>
                      </div>
                      {/* Cancelados */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ❌ Cancelados <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{declined.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {declined.length === 0
                            ? <div style={{ fontSize: 11, color: '#94a3b8', padding: 8 }}>—</div>
                            : declined.map((att, i) => <AttendeeCard key={i} att={att} showRemove={false} />)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dialog evento periódico */}
      {recurringDialog.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 32px',
            width: 370, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
              Editar evento periódico
            </h3>
            {[
              { value: 'single',    label: 'Este evento' },
              { value: 'following', label: 'Este evento y los posteriores' },
              { value: 'all',       label: 'Todos los eventos' },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', cursor: 'pointer', fontSize: 14, color: '#334155',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <input
                  type="radio" name="recurScope" value={opt.value}
                  checked={recurringScope === opt.value}
                  onChange={() => setRecurringScope(opt.value)}
                  style={{ accentColor: '#3B82F6', width: 18, height: 18, cursor: 'pointer' }}
                />
                {opt.label}
              </label>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => { setRecurringDialog({ open: false, onConfirm: null }); setRecurringScope('single'); }}
                style={{
                  background: 'transparent', border: '1px solid #e2e8f0',
                  padding: '8px 20px', borderRadius: 8, fontSize: 13,
                  cursor: 'pointer', color: '#64748b'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { recurringDialog.onConfirm(recurringScope); setRecurringScope('single'); }}
                style={{
                  background: '#3B82F6', color: '#fff', border: 'none',
                  padding: '8px 24px', borderRadius: 8, fontSize: 13,
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
