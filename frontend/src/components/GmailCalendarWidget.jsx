/**
 * GmailCalendarWidget — Widget de calendario estilo Gmail (Iteración 1: Calendario)
 * 
 * Features:
 * - Vista de día con rango 08:00hs a 19:00hs
 * - Altura dinámica: Basada en porcentajes para eliminar el scroll vertical
 * - Distribución equitativa: Las horas se ajustan al 100% del alto del padre
 * - Click en slot vacío → abre formulario rápido de nuevo evento
 * - Integración con Google Calendar API (via backend)
 */
import { useState, useRef, useEffect } from 'react';
import { API } from '../constants';

// ─── CONFIGURACIÓN DE RANGO (Iteración 1) ─────────────────────────
const DAY_START = 8;    // 8am
const DAY_END = 19;     // 7pm
const TOTAL_HOURS = DAY_END - DAY_START;

// Helpers actualizados a lógica porcentual (%) para eliminar scroll
const toMinutes = (date) => date.getHours() * 60 + date.getMinutes();
const timeToPct = (date) => {
  const mins = toMinutes(date) - DAY_START * 60;
  return (mins / (TOTAL_HOURS * 60)) * 100;
};
const durationToPct = (start, end) => {
  const diffMins = (end - start) / 1000 / 60;
  return (diffMins / (TOTAL_HOURS * 60)) * 100;
};

const formatHour = (h) => {
  if (h === 12) return '12 PM';
  if (h === 0 || h === 24) return '12 AM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const snapToSlot = (pct) => {
  // Snap a intervalos de 30 min sobre la escala porcentual 0-100
  const totalMinsInDay = TOTAL_HOURS * 60;
  const minsSinceStart = (pct / 100) * totalMinsInDay;
  const snappedMins = Math.round(minsSinceStart / 30) * 30;
  const totalMins = DAY_START * 60 + snappedMins;

  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return { h: Math.max(DAY_START, Math.min(DAY_END - 1, h)), m };
};

// Colores de eventos por índice (Preservados)
const EVENT_COLORS = [
  { bg: 'rgba(178, 212, 255, 0.85)', border: '#3B82F6', text: '#1D4ED8' },
  { bg: 'rgba(165, 243, 196, 0.85)', border: '#10B981', text: '#065F46' },
  { bg: 'rgba(253, 210, 155, 0.85)', border: '#F59E0B', text: '#92400E' },
  { bg: 'rgba(255, 179, 179, 0.85)', border: '#EF4444', text: '#991B1B' },
  { bg: 'rgba(216, 180, 254, 0.85)', border: '#8B5CF6', text: '#5B21B6' },
];

// ─── SUB-COMPONENTE: FORMULARIO RÁPIDO (Preservado) ───────────────────────────
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
            </div>
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
            fontSize: 13, fontWeight: 600
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
  const cw = isDark ? {
    line: '#334155',
    timeLabel: '#64748B',
    slotHover: 'rgba(99,102,241,0.08)',
    bg: '#1E293B',
    border: '#334155',
  } : {
    line: '#e2e8f0',
    timeLabel: '#94a3b8',
    slotHover: 'rgba(66,133,244,0.06)',
    bg: '#ffffff',
    border: '#e2e8f0',
  };

  const [quickSlot, setQuickSlot] = useState(null);
  const [hoverY, setHoverY] = useState(null);
  const gridRef = useRef();
  const now = new Date();

  // Posicionamiento porcentual de la hora actual
  const nowPct = timeToPct(now);
  const isToday = now.getDay() === selectedDay;

  // Filtrar eventos del día seleccionado y calcular superposiciones (Lógica side-by-side preservada)
  const rawDayEvents = events.filter(ev => ev.dayOfWeek === selectedDay);
  const sorted = [...rawDayEvents].sort((a, b) => new Date(a.rawStart) - new Date(b.rawStart));

  // Agrupamiento lateral (mantenemos algoritmos de clusters originales)
  const clusters = [];
  sorted.forEach(ev => {
    let matchedCluster = clusters.find(c =>
      c.some(other => {
        const s1 = new Date(ev.rawStart), e1 = ev.rawEnd ? new Date(ev.rawEnd) : new Date(s1.getTime() + 30 * 60000);
        const s2 = new Date(other.rawStart), e2 = other.rawEnd ? new Date(other.rawEnd) : new Date(s2.getTime() + 30 * 60000);
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
        const s1 = new Date(ev.rawStart), e1 = ev.rawEnd ? new Date(ev.rawEnd) : new Date(s1.getTime() + 30 * 60000);
        const s2 = new Date(other.rawStart), e2 = other.rawEnd ? new Date(other.rawEnd) : new Date(s2.getTime() + 30 * 60000);
        return s1 < e2 && s2 < e1;
      })) col++;
      if (!cols[col]) cols[col] = [];
      cols[col].push(ev);
      ev._colIndex = col;
    });
    cluster.forEach(ev => ev._clusterCols = cols.length);
  });

  const handleGridClick = (e) => {
    if (e.target !== gridRef.current && !e.target.classList.contains('gc-slot-bg')) return;
    const rect = gridRef.current.getBoundingClientRect();
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const slot = snapToSlot(yPct);
    setQuickSlot(slot);
  };

  const handleMouseMove = (e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverY(((e.clientY - rect.top) / rect.height) * 100);
  };

  const handleSaveEvent = async (payload) => {
    // Lógica original de creación de evento
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await fetch(`${API}/midia/create-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, start: `${dateStr}T${payload.startTime}:00`, end: `${dateStr}T${payload.endTime}:00` }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      onEventCreated?.();
    } catch (e) {
      alert('No se pudo guardar: ' + e.message);
    }
    setQuickSlot(null);
  };

  const dateLabel = selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) || '';

  return (
    <>
      <style>{`
        .gc-event:hover { filter: brightness(0.92); cursor: pointer; }
        .gc-slot-bg { position: absolute; left: 0; right: 0; top: 0; bottom: 0; cursor: crosshair; }
        .gc-hover-line { position: absolute; left: 52px; right: 0; height: 1px; background: rgba(66,133,244,0.3); pointer-events: none; }
        .gc-now-line { position: absolute; left: 44px; right: 0; height: 2px; background: #EF4444; pointer-events: none; z-index: 10; }
        .gc-now-dot { position: absolute; left: 38px; width: 12px; height: 12px; background: #EF4444; border-radius: 50%; transform: translateY(-5px); z-index: 10; }
      `}</style>

      {/* Rango 08 - 19 | Altura dinámica al 100% | Sin scroll */}
      <div style={{ flex: 1, position: 'relative', paddingBottom: 5 }}>
        <div
          ref={gridRef}
          onClick={handleGridClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverY(null)}
          style={{
            position: 'relative',
            height: '100%',
            marginLeft: 52,
            borderLeft: `1px solid ${cw.line}`,
          }}
        >
          {/* Horas distribuidas equitativamente en el alto disponible */}
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            const hour = DAY_START + i;
            const topPct = (i / TOTAL_HOURS) * 100;
            return (
              <div key={hour} style={{ position: 'absolute', top: `${topPct}%`, left: 0, right: 0 }}>
                <span style={{
                  position: 'absolute', left: -50, fontSize: 10, color: cw.timeLabel,
                  fontFamily: "'DM Mono', monospace", fontWeight: 600, transform: 'translateY(-50%)', paddingRight: 8
                }}>
                  {formatHour(hour)}
                </span>
                <div style={{ width: '100%', height: 1, background: cw.line }} />
              </div>
            );
          })}

          <div className="gc-slot-bg" />

          {/* Línea actual (%) */}
          {isToday && nowPct >= 0 && nowPct <= 100 && (
            <>
              <div className="gc-now-dot" style={{ top: `${nowPct}%` }} />
              <div className="gc-now-line" style={{ top: `${nowPct}%` }} />
            </>
          )}

          {/* Línea hover (%) */}
          {hoverY !== null && <div className="gc-hover-line" style={{ top: `${hoverY}%` }} />}

          {/* Eventos (%) */}
          {sorted.map((ev, idx) => {
            const start = new Date(ev.rawStart), end = ev.rawEnd ? new Date(ev.rawEnd) : new Date(start.getTime() + 30 * 60000);
            const topPct = timeToPct(start), heightPct = durationToPct(start, end);
            const color = EVENT_COLORS[idx % EVENT_COLORS.length];
            const width = 100 / ev._clusterCols, left = ev._colIndex * width;

            return (
              <div
                key={ev.id}
                className="gc-event"
                onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
                style={{
                  position: 'absolute', top: `${topPct}%`, left: `${left}%`, width: `${width}%`, height: `${heightPct}%`,
                  background: ev.isPast ? 'rgba(200,200,200,0.5)' : color.bg, borderLeft: `3px solid ${ev.isPast ? '#94a3b8' : color.border}`,
                  borderRadius: 4, padding: '2px 6px', zIndex: 5, overflow: 'hidden', boxSizing: 'border-box'
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {quickSlot && (
        <QuickEventForm slot={quickSlot} dateLabel={dateLabel} onSave={handleSaveEvent} onCancel={() => setQuickSlot(null)} />
      )}
    </>
  );
}
