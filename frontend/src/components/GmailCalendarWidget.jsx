/**
 * GmailCalendarWidget — Widget de calendario estilo Gmail
 * 
 * Features:
 * - Vista de día con horas 4am–10pm
 * - Eventos posicionados según hora (alto proporcional a duración)
 * - Slots libres identificados visualmente
 * - Click en slot vacío → abre formulario rápido de nuevo evento
 * - Integración con Google Calendar API (via backend)
 */
import { useState, useRef, useEffect } from 'react';
import { API } from '../constants';

// ─── HELPERS ─────────────────────────────────────────────────────
const HOUR_HEIGHT = 56; // px por hora en la grilla
const DAY_START = 4;    // 4am
const DAY_END = 22;     // 10pm
const TOTAL_HOURS = DAY_END - DAY_START;

const toMinutes = (date) => date.getHours() * 60 + date.getMinutes();
const timeToY = (date) => ((toMinutes(date) - DAY_START * 60) / 60) * HOUR_HEIGHT;
const durationToH = (start, end) => ((end - start) / 1000 / 60 / 60) * HOUR_HEIGHT;

const formatHour = (h) => {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const formatTime = (date) =>
  date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

const snapToSlot = (y) => {
  // Snap a intervalos de 30 min
  const totalMins = DAY_START * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(totalMins / 30) * 30;
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return { h: Math.max(DAY_START, Math.min(DAY_END - 1, h)), m };
};

// Colores de eventos por índice (rotativo, como Gmail)
const EVENT_COLORS = [
  { bg: 'rgba(178, 212, 255, 0.85)', border: '#3B82F6', text: '#1D4ED8' },
  { bg: 'rgba(165, 243, 196, 0.85)', border: '#10B981', text: '#065F46' },
  { bg: 'rgba(253, 210, 155, 0.85)', border: '#F59E0B', text: '#92400E' },
  { bg: 'rgba(255, 179, 179, 0.85)', border: '#EF4444', text: '#991B1B' },
  { bg: 'rgba(216, 180, 254, 0.85)', border: '#8B5CF6', text: '#5B21B6' },
];

// ─── SUB-COMPONENTE: FORMULARIO RÁPIDO ───────────────────────────
function QuickEventForm({ slot, onSave, onCancel, dateLabel }) {
  const [title, setTitle] = useState('');
  const [startH, setStartH] = useState(slot.h);
  const [startM, setStartM] = useState(slot.m);
  const [endH, setEndH] = useState(slot.m === 30 ? slot.h + 1 : slot.h);
  const [endM, setEndM] = useState(slot.m === 30 ? 0 : 30);
  const [guests, setGuests] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pad = (n) => String(n).padStart(2, '0');

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title,
      startTime: `${pad(startH)}:${pad(startM)}`,
      endTime: `${pad(endH)}:${pad(endM)}`,
      guests: guests.split(',').map(g => g.trim()).filter(Boolean),
      description,
    });
    setSaving(false);
  };

  const timeOptions = [];
  for (let h = DAY_START; h <= DAY_END; h++) {
    timeOptions.push({ label: `${pad(h)}:00`, h, m: 0 });
    if (h < DAY_END) timeOptions.push({ label: `${pad(h)}:30`, h, m: 30 });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, animation: 'gcFadeIn 0.15s ease-out'
    }}>
      <style>{`
        @keyframes gcFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .gc-input { width: 100%; border: none; border-bottom: 2px solid #e2e8f0; outline: none; padding: 6px 0; font-size: 13px; font-family: inherit; color: #1e293b; background: transparent; transition: border-color 0.2s; }
        .gc-input:focus { border-color: #4285f4; }
        .gc-select { border: none; border-bottom: 2px solid #e2e8f0; outline: none; padding: 4px 0; font-size: 12px; font-family: inherit; color: #475569; background: transparent; cursor: pointer; }
        .gc-select:focus { border-color: #4285f4; }
        .gc-row { display: flex; align-items: flex-start; gap: 14px; padding: 10px 0; }
        .gc-icon { font-size: 16px; margin-top: 4px; min-width: 20px; opacity: 0.6; }
        .gc-label { font-size: 11px; color: #94a3b8; margin-bottom: 3px; }
      `}</style>

      <div style={{
        background: '#fff', borderRadius: 12, padding: '0', width: 380,
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: '#f1f5f9', padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
            Nuevo evento · {dateLabel}
          </span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ padding: '8px 20px 16px' }}>
          {/* Título */}
          <div className="gc-row" style={{ paddingTop: 20 }}>
            <div style={{ flex: 1 }}>
              <input
                ref={inputRef}
                className="gc-input"
                placeholder="Añade un título"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={{ fontSize: 22, fontWeight: 400, paddingBottom: 8 }}
              />
            </div>
          </div>

          {/* Hora */}
          <div className="gc-row">
            <span className="gc-icon">🕐</span>
            <div>
              <div className="gc-label">{dateLabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select className="gc-select" value={`${startH}:${startM}`}
                  onChange={e => { const [h, m] = e.target.value.split(':'); setStartH(+h); setStartM(+m); }}>
                  {timeOptions.map(o => <option key={o.label} value={`${o.h}:${o.m}`}>{o.label}</option>)}
                </select>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>–</span>
                <select className="gc-select" value={`${endH}:${endM}`}
                  onChange={e => { const [h, m] = e.target.value.split(':'); setEndH(+h); setEndM(+m); }}>
                  {timeOptions.map(o => <option key={o.label} value={`${o.h}:${o.m}`}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Zona horaria · No se repite</div>
            </div>
          </div>

          {/* Invitados */}
          <div className="gc-row">
            <span className="gc-icon">👥</span>
            <div style={{ flex: 1 }}>
              <div className="gc-label">Añadir invitados</div>
              <input className="gc-input" placeholder="correo@ejemplo.com, ..."
                value={guests} onChange={e => setGuests(e.target.value)} />
            </div>
          </div>

          {/* Descripción */}
          <div className="gc-row">
            <span className="gc-icon">📝</span>
            <div style={{ flex: 1 }}>
              <div className="gc-label">Añade una descripción</div>
              <input className="gc-input" placeholder="Opcional"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Calendario */}
          <div className="gc-row">
            <span className="gc-icon">📅</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Flink</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>No disponible · Visibilidad predeterminada</div>
            </div>
            <div style={{ marginLeft: 8, width: 12, height: 12, borderRadius: '50%', background: '#4285f4', alignSelf: 'flex-start', marginTop: 4 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', padding: '12px 20px',
          borderTop: '1px solid #f1f5f9', gap: 10
        }}>
          <button onClick={onCancel} style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 20,
            padding: '8px 20px', cursor: 'pointer', fontSize: 13, color: '#475569'
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!title.trim() || saving} style={{
            background: saving ? '#94a3b8' : '#4285f4', color: '#fff', border: 'none',
            borderRadius: 20, padding: '8px 24px', cursor: title.trim() ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 600, transition: 'background 0.2s'
          }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────
export default function GmailCalendarWidget({ events = [], selectedDay, selectedDate, onEventCreated, onEventClick, isDark = false }) {
  // Tokens de color reactivos al tema
  const cw = isDark ? {
    line:      '#334155',
    timeLabel: '#64748B',
    slotHover: 'rgba(99,102,241,0.08)',
    bg:        '#1E293B',
    border:    '#334155',
  } : {
    line:      '#e2e8f0',
    timeLabel: '#94a3b8',
    slotHover: 'rgba(66,133,244,0.06)',
    bg:        '#ffffff',
    border:    '#e2e8f0',
  };
  const [quickSlot, setQuickSlot] = useState(null);
  const [hoverY, setHoverY] = useState(null);
  const gridRef = useRef();
  const scrollRef = useRef();
  const now = new Date();

  // Calcular hora actual y si es hoy ANTES de usarlos en efectos
  const nowY = timeToY(now);
  const isToday = now.getDay() === selectedDay;

  // Scroll automático al cargar o cambiar de día
  useEffect(() => {
    if (scrollRef.current) {
      let targetY;
      // Si es hoy, scroll a la hora actual - 100px para contexto
      // Si es otro día, scroll directo a las 8 AM
      if (isToday) {
        targetY = timeToY(now) - 100;
      } else {
        targetY = (8 - DAY_START) * HOUR_HEIGHT;
      }
      scrollRef.current.scrollTop = Math.max(0, targetY);
    }
  }, [selectedDay, isToday]);

  // Filtrar eventos del día seleccionado y calcular superposiciones
  const rawDayEvents = events.filter(ev => ev.dayOfWeek === selectedDay);

  // Lógica de posicionamiento side-by-side para superposiciones
  const clusters = [];
  const sorted = [...rawDayEvents].sort((a, b) => new Date(a.rawStart) - new Date(b.rawStart));

  sorted.forEach(ev => {
    let matchedCluster = clusters.find(c =>
      c.some(other => {
        const s1 = new Date(ev.rawStart);
        const e1 = ev.rawEnd ? new Date(ev.rawEnd) : new Date(s1.getTime() + 30 * 60000);
        const s2 = new Date(other.rawStart);
        const e2 = other.rawEnd ? new Date(other.rawEnd) : new Date(s2.getTime() + 30 * 60000);
        return s1 < e2 && s2 < e1;
      })
    );
    if (matchedCluster) matchedCluster.push(ev);
    else clusters.push([ev]);
  });

  clusters.forEach(cluster => {
    const cols = [];
    cluster.forEach(ev => {
      let col = 0;
      while (cols[col] && cols[col].some(other => {
        const s1 = new Date(ev.rawStart);
        const e1 = ev.rawEnd ? new Date(ev.rawEnd) : new Date(s1.getTime() + 30 * 60000);
        const s2 = new Date(other.rawStart);
        const e2 = other.rawEnd ? new Date(other.rawEnd) : new Date(s2.getTime() + 30 * 60000);
        return s1 < e2 && s2 < e1;
      })) {
        col++;
      }
      if (!cols[col]) cols[col] = [];
      cols[col].push(ev);
      ev._colIndex = col;
      ev._clusterCols = 0; // Provisional
    });
    cluster.forEach(ev => ev._clusterCols = cols.length);
  });

  const dayEvents = sorted;

  // Click en slot vacío: abrir formulario rápido
  const handleGridClick = (e) => {
    if (e.target !== gridRef.current && !e.target.classList.contains('gc-slot-bg')) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = snapToSlot(y);
    setQuickSlot(slot);
  };

  const handleMouseMove = (e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverY(e.clientY - rect.top);
  };

  const handleSaveEvent = async ({ title, startTime, endTime, guests, description }) => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const payload = {
        title,
        start: `${dateStr}T${startTime}:00`,
        end: `${dateStr}T${endTime}:00`,
        attendees: guests,
        description,
      };
      const res = await fetch(`${API}/midia/create-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error al guardar');
      onEventCreated?.();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el evento: ' + e.message);
    }
    setQuickSlot(null);
  };

  const dateLabel = selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) || '';

  return (
    <>
      <style>{`
        .gc-event:hover { filter: brightness(0.92); cursor: pointer; }
        .gc-slot-bg { position: absolute; left: 0; right: 0; cursor: crosshair; }
        .gc-hover-line { position: absolute; left: 52px; right: 0; height: 1px; background: rgba(66,133,244,0.3); pointer-events: none; transition: top 0.05s; }
        .gc-now-line { position: absolute; left: 44px; right: 0; height: 2px; background: #EF4444; pointer-events: none; z-index: 10; }
        .gc-now-dot { position: absolute; left: 38px; width: 12px; height: 12px; background: #EF4444; border-radius: 50%; transform: translateY(-5px); z-index: 10; }
      `}</style>

      {/* Scroll Container */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

        {/* Grilla */}
        <div
          ref={gridRef}
          onClick={handleGridClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverY(null)}
          style={{
            position: 'relative',
            height: TOTAL_HOURS * HOUR_HEIGHT,
            marginLeft: 52,
            borderLeft: `1px solid ${cw.line}`,
          }}
        >
          {/* Líneas de hora + etiquetas */}
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            const hour = DAY_START + i;
            return (
              <div key={hour} style={{ position: 'absolute', top: i * HOUR_HEIGHT, left: 0, right: 0, display: 'flex', alignItems: 'flex-start' }}>
                {/* Etiqueta de hora */}
                <span style={{
                  position: 'absolute', left: -50, fontSize: 10, color: cw.timeLabel,
                  fontFamily: "'DM Mono', monospace", fontWeight: 600, whiteSpace: 'nowrap',
                  transform: 'translateY(-50%)', paddingRight: 8,
                  display: i === 0 ? 'none' : 'block'
                }}>
                  {formatHour(hour)}
                </span>
                {/* Línea horizontal */}
                <div style={{ width: '100%', height: 1, background: i % 2 === 0 ? cw.line : (isDark ? '#1a2744' : '#f1f5f9'), marginTop: 0 }} />
              </div>
            );
          })}

          {/* Half-hour lines (punteadas, más sutiles) */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div key={`h${i}`} style={{
              position: 'absolute', top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
              left: 0, right: 0, height: 1,
              borderTop: `1px dashed ${isDark ? '#1e3050' : '#f1f5f9'}`
            }} />
          ))}

          {/* Background de slots (para detectar clicks) */}
          <div className="gc-slot-bg" style={{ top: 0, bottom: 0 }} />

          {/* Línea de hora actual */}
          {isToday && nowY >= 0 && nowY <= TOTAL_HOURS * HOUR_HEIGHT && (
            <>
              <div className="gc-now-dot" style={{ top: nowY }} />
              <div className="gc-now-line" style={{ top: nowY }} />
            </>
          )}

          {/* Línea de hover */}
          {hoverY !== null && (
            <div className="gc-hover-line" style={{ top: hoverY }} />
          )}

          {/* Eventos del día */}
          {dayEvents.map((ev, idx) => {
            const start = new Date(ev.rawStart);
            const end = ev.rawEnd ? new Date(ev.rawEnd) : new Date(start.getTime() + 30 * 60000);
            const y = timeToY(start);
            const h = Math.max(HOUR_HEIGHT / 2, durationToH(start, end));
            const color = EVENT_COLORS[idx % EVENT_COLORS.length];
            const isPast = ev.isPast;
            const isActive = ev.isActive;

            const width = 100 / ev._clusterCols;
            const left = ev._colIndex * width;

            return (
              <div
                key={ev.id}
                className="gc-event"
                onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
                style={{
                  position: 'absolute',
                  top: y + 1,
                  left: `${left}%`,
                  width: `${width}%`,
                  height: h - 2,
                  background: isPast ? 'rgba(200,200,200,0.5)' : color.bg,
                  borderLeft: `3px solid ${isPast ? '#94a3b8' : color.border}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                  paddingRight: ev.link ? '34px' : '8px',
                  overflow: 'hidden',
                  boxShadow: isActive ? `0 0 0 2px ${color.border}` : '0 1px 3px rgba(0,0,0,0.08)',
                  opacity: isPast ? 0.7 : 1,
                  zIndex: 5,
                  transition: 'all 0.15s',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: isPast ? '#64748b' : color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.title}
                </div>
                {h > HOUR_HEIGHT * 0.6 && (
                  <div style={{ fontSize: 9, color: isPast ? '#94a3b8' : color.text, opacity: 0.8, marginTop: 1 }}>
                    {ev.time}{ev.timeEnd ? ` – ${ev.timeEnd}` : ''}
                  </div>
                )}
                {ev.link && (
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Unirse a la reunión"
                    style={{
                      position: 'absolute',
                      right: 0, top: 0, bottom: 0,
                      width: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.2)',
                      fontSize: '18px',
                      textDecoration: 'none',
                      borderLeft: '1px solid rgba(0,0,0,0.05)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  >
                    👨🏼‍💻
                  </a>
                )}
                {isActive && (
                  <div style={{ position: 'absolute', top: 4, right: ev.link ? 34 : 6, width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                )}
              </div>
            );
          })}

          {/* Hint para slots vacíos */}
          {dayEvents.length === 0 && (
            <div style={{
              position: 'absolute', top: '35%', left: 0, right: 0,
              textAlign: 'center', color: '#cbd5e1', fontSize: 12, pointerEvents: 'none'
            }}>
              Día libre — hacé click para agregar un evento
            </div>
          )}
        </div>
      </div>

      {/* Formulario rápido */}
      {quickSlot && (
        <QuickEventForm
          slot={quickSlot}
          dateLabel={dateLabel}
          onSave={handleSaveEvent}
          onCancel={() => setQuickSlot(null)}
        />
      )}
    </>
  );
}
