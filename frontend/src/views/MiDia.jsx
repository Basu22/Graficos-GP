import { useState, useEffect, useCallback } from "react";
import { API } from "../constants";

// Estilos base y tokens
const PALETTE = {
  bg: "#f0f4f8",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  primary: "#3B82F6",
  accent: "#F59E0B",
  groups: {
    clientes: "#F59E0B",
    tickets: "#EF4444",
    equipo: "#3B82F6",
    notif: "#22C55E",
  },
  priority: {
    alta: "#EF4444",
    media: "#F59E0B",
    baja: "#22C55E",
  }
};

const Shimmer = () => (
  <div style={{
    width: "100%", height: "100%", background: "linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)",
    backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite linear", borderRadius: 8
  }}>
    <style>{`
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    `}</style>
  </div>
);

export default function MiDia({ T }) {
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
  const [manualTasks, setManualTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [aiPlan, setAiPlan] = useState(null);
  const [lastAiUpdate, setLastAiUpdate] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch inicial (Weather + Data)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Clima
      fetch("https://wttr.in/?format=j1")
        .then(r => r.json())
        .then(wData => {
          setWeather({
            temp: wData.current_condition[0].temp_C,
            desc: wData.current_condition[0].lang_es?.[0]?.value || wData.current_condition[0].weatherDesc[0].value,
            icon: "⛅"
          });
        }).catch(() => setWeather({ temp: "--", desc: "Clima no disponible", icon: "⚠️" }));

      // Datos de Mi Dia (Google)
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
        setEvents(data.events.map(ev => ({
          id: ev.id,
          time: ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Todo el día",
          title: ev.summary,
          description: ev.location || "Google Calendar",
          now: ev.start.dateTime && new Date() >= new Date(ev.start.dateTime) && new Date() <= new Date(ev.end.dateTime)
        })));
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

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const currentDay = now.getDay();

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: PALETTE.text, animation: "fadeIn 0.5s ease-out" }}>
      {/* TOPBAR */}
      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", 
        background: PALETTE.card, padding: "16px 24px", borderRadius: 16, marginBottom: 24,
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)", border: `1px solid ${PALETTE.border}`
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
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {["Gmail", "Calendar", "Drive", "Meet"].map(app => (
            <div key={app} style={{ fontSize: 11, fontWeight: 600, color: PALETTE.primary, cursor: "pointer", opacity: 0.8 }}>{app}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr", gap: 24 }}>
        {/* COL 1: CALENDARIO */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: PALETTE.card, padding: 20, borderRadius: 16, border: `1px solid ${PALETTE.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              {dayNames.map((d, i) => (
                <div key={d} onClick={() => setSelectedDay(i)} style={{ 
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer",
                  padding: "8px 4px", borderRadius: 8, minWidth: 40,
                  background: i === currentDay ? "#000" : "transparent",
                  color: i === currentDay ? "#fff" : PALETTE.text
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{d}</span>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: i === currentDay ? "#fff" : (i % 2 === 0 ? PALETTE.primary : "transparent") }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>AGENDA HOY</h3>
              <button onClick={fetchData} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🔄</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loading ? <div style={{ height: 100 }}><Shimmer /></div> : events.map(ev => (
                <div key={ev.id} style={{ 
                  display: "flex", gap: 12, padding: 12, borderRadius: 12, background: PALETTE.bg,
                  borderLeft: `4px solid ${ev.now ? PALETTE.accent : PALETTE.primary}`
                }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700 }}>{ev.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{ev.title}</span>
                      {ev.now && <span style={{ fontSize: 8, background: PALETTE.accent, color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>AHORA</span>}
                    </div>
                    <div style={{ fontSize: 11, color: PALETTE.textMuted }}>{ev.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: PALETTE.card, padding: 20, borderRadius: 16, border: `1px solid ${PALETTE.border}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 15 }}>TAREAS MANUALES</h3>
            <input 
              type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={handleAddTask}
              placeholder="Nueva tarea y Enter..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${PALETTE.border}`, fontSize: 12, outline: "none", marginBottom: 12 }}
            />
            {manualTasks.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${PALETTE.bg}` }}>
                <input type="checkbox" checked={t.done} onChange={() => setManualTasks(manualTasks.map(x => x.id === t.id ? {...x, done: !x.done} : x))} />
                <span style={{ fontSize: 12, textDecoration: t.done ? "line-through" : "none", color: t.done ? PALETTE.textMuted : PALETTE.text }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COL 2: INBOX */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 16, border: `1px solid ${PALETTE.border}`, minHeight: 600 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800 }}>BANDEJA DE ENTRADA</h3>
              <button onClick={fetchData} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🔄</button>
            </div>

            {Object.entries(mailGroups).map(([id, group]) => (
              <div key={id} style={{ marginBottom: 16 }}>
                <div 
                  onClick={() => toggleGroup(id)} 
                  style={{ 
                    display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, 
                    background: PALETTE.groups[id] + "15", cursor: "pointer", border: `1px solid ${PALETTE.groups[id]}20`
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: PALETTE.groups[id] }} />
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: PALETTE.groups[id] }}>{id}</span>
                  </div>
                  {group.unread > 0 && <span style={{ fontSize: 10, background: PALETTE.groups[id], color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 800 }}>{group.unread}</span>}
                </div>

                {group.open && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {group.items.map(mail => (
                      <div key={mail.id} style={{ padding: 12, borderRadius: 8, background: mail.unread ? "#f8fafc" : "transparent", cursor: "pointer", borderBottom: `1px solid ${PALETTE.bg}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: mail.unread ? 800 : 500 }}>{mail.from}</span>
                          <span style={{ fontSize: 10, color: PALETTE.textMuted }}>{mail.time}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: mail.unread ? 600 : 400, marginBottom: 2 }}>{mail.subject}</div>
                        <div style={{ fontSize: 10, color: PALETTE.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mail.preview}</div>
                      </div>
                    ))}
                    {group.items.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: PALETTE.textMuted }}>Vacío</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* COL 3: IA PLAN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: PALETTE.card, padding: 20, borderRadius: 16, border: `1px solid ${PALETTE.border}`, minHeight: 600 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800 }}>PLAN SEMANAL IA ✨</h3>
              <button 
                onClick={generateAIPlan} 
                disabled={generatingAi}
                style={{ 
                  background: PALETTE.primary, color: "#fff", border: "none", padding: "6px 14px", 
                  borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer"
                }}
              >
                {generatingAi ? "GEN..." : "GENERAR"}
              </button>
            </div>

            {generatingAi ? <div style={{ height: 400 }}><Shimmer /></div> : !aiPlan ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <span style={{ fontSize: 40 }}>✨</span>
                <p style={{ fontSize: 12, color: PALETTE.textMuted }}>Deja que la IA organice tu semana basándose en tus mails.</p>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                <div style={{ fontSize: 11, color: PALETTE.textMuted, marginBottom: 15, textAlign: "right" }}>Actualizado: {lastAiUpdate}</div>
                {aiPlan.map(day => (
                  <div key={day.dayIndex}>
                    <div style={{ background: "#f1f5f9", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: PALETTE.primary }}>RESUMEN: {day.summary}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {day.tasks.map((task, idx) => (
                        <div key={idx} style={{ 
                          padding: 16, borderRadius: 12, background: PALETTE.bg, border: `1px solid ${PALETTE.border}`,
                          position: "relative"
                        }}>
                          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: PALETTE.priority[task.priority], color: "#fff", textTransform: "uppercase" }}>
                            {task.priority}
                          </div>
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
    </div>
  );
}
