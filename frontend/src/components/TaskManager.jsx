import { useState, useEffect, useRef, useCallback } from 'react';

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const LS_TASKS   = 'tm_tasks_v1';
const LS_COLS    = 'tm_columns_v1';
const LS_POMO    = 'tm_pomo_v1';

const DEFAULT_COLUMNS = [
  { id: 'todo',        label: 'Por hacer',  color: '#64748B' },
  { id: 'inprogress',  label: 'En curso',   color: '#3B82F6' },
  { id: 'done',        label: 'Listo',      color: '#10B981' },
];

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── SOLICITAR PERMISO DE NOTIFICACIONES ──────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// ─── FORMATO MM:SS ────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── HOOK POMODORO ────────────────────────────────────────────────────────────
function usePomodoro() {
  const WORK_SECS  = 25 * 60;
  const BREAK_SECS =  5 * 60;

  const [phase, setPhase]   = useState('work');   // 'work' | 'break'
  const [secs, setSecs]     = useState(WORK_SECS);
  const [running, setRunning] = useState(false);
  const [round, setRound]   = useState(1);
  const intervalRef = useRef(null);

  const tick = useCallback(() => {
    setSecs(prev => {
      if (prev <= 1) {
        // Cambio de fase
        setPhase(p => {
          const next = p === 'work' ? 'break' : 'work';
          if (next === 'break') {
            sendNotif('🍅 ¡Pomodoro terminado!', '25 min completados. Tomá un descanso de 5 min.');
            setSecs(BREAK_SECS);
          } else {
            setRound(r => r + 1);
            sendNotif('⏰ ¡Descanso terminado!', 'Es hora de concentrarse de nuevo.');
            setSecs(WORK_SECS);
          }
          return next;
        });
        return prev; // el setSecs real lo hace setPhase arriba
      }
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const toggle = () => {
    if (!running) requestNotifPermission();
    setRunning(r => !r);
  };

  const reset = () => {
    setRunning(false);
    setPhase('work');
    setSecs(WORK_SECS);
  };

  const skipBreak = () => {
    setRunning(false);
    setPhase('work');
    setSecs(WORK_SECS);
    setRound(r => r + 1);
  };

  const progress = phase === 'work'
    ? 1 - secs / WORK_SECS
    : 1 - secs / BREAK_SECS;

  return { phase, secs, running, round, progress, toggle, reset, skipBreak };
}

// ─── POMODORO WIDGET ─────────────────────────────────────────────────────────
function PomodoroWidget({ P }) {
  const { phase, secs, running, round, progress, toggle, reset, skipBreak } = usePomodoro();

  const isWork   = phase === 'work';
  const accent   = isWork ? '#EF4444' : '#10B981';
  const SIZE     = 100;
  const R        = 44;
  const CIRC     = 2 * Math.PI * R;
  const dash     = CIRC * progress;

  return (
    <div style={{
      background: P.cardInner, borderRadius: 16, padding: '16px 18px',
      border: `1px solid ${P.border}`, marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: accent }}>
            {isWork ? '🍅 Foco' : '☕ Descanso'}
          </div>
          <div style={{ fontSize: 9, color: P.textMuted }}>Ronda #{round}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={toggle} style={{
            background: running ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
            border: `1px solid ${running ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}`,
            color: running ? '#EF4444' : '#3B82F6',
            borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer'
          }}>
            {running ? '⏸ Pausar' : '▶ Iniciar'}
          </button>
          <button onClick={reset} title="Reiniciar" style={{
            background: 'transparent', border: `1px solid ${P.border}`,
            color: P.textMuted, borderRadius: 8, padding: '5px 8px', fontSize: 11, cursor: 'pointer'
          }}>↺</button>
          {!isWork && (
            <button onClick={skipBreak} title="Saltar descanso" style={{
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#10B981', borderRadius: 8, padding: '5px 8px', fontSize: 11, cursor: 'pointer'
            }}>⏭</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Círculo SVG */}
        <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={P.border} strokeWidth={6} />
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={accent} strokeWidth={6}
            strokeDasharray={`${dash} ${CIRC}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
          <text x={SIZE/2} y={SIZE/2 + 5} textAnchor="middle"
            fill={P.text} fontSize="18" fontWeight="800"
            fontFamily="'DM Mono', monospace">
            {fmtTime(secs)}
          </text>
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: P.textMuted, lineHeight: 1.6 }}>
            {isWork
              ? 'Mantené el foco. Las notificaciones del navegador te avisarán cuando termine.'
              : 'Levantate, estirá. El siguiente Pomodoro empieza solo.'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: i < (round - 1) % 4 + (running && isWork ? 1 : 0)
                  ? accent : P.border
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({ task, columns, onMove, onDelete, onEdit, P }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(task.text);
  const ref = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const isOverdue = task.dueDate && !task.done && new Date(task.dueDate) < new Date();

  return (
    <div style={{
      background: P.card, border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : P.border}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative',
      transition: 'all 0.15s ease'
    }}
    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
    onMouseOut={e =>  e.currentTarget.style.transform = 'translateY(0)'}
    >
      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEdit(task.id, draft); setEditing(false); }
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              width: '100%', background: P.cardInner, border: `1px solid ${P.border}`,
              borderRadius: 6, padding: '6px 8px', color: P.text, fontSize: 12,
              resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5
            }}
            rows={2}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={() => { onEdit(task.id, draft); setEditing(false); }} style={{
              fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10B981',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontWeight: 700
            }}>✓ Guardar</button>
            <button onClick={() => { setDraft(task.text); setEditing(false); }} style={{
              fontSize: 10, background: 'transparent', color: P.textMuted,
              border: `1px solid ${P.border}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer'
            }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: P.text, lineHeight: 1.5, marginRight: 20, marginBottom: task.dueDate ? 4 : 0 }}>
            {task.text}
          </div>
          {task.dueDate && (
            <div style={{ fontSize: 9, color: isOverdue ? '#EF4444' : P.textMuted, fontWeight: 700 }}>
              {isOverdue ? '⚠️ ' : '📅 '}{new Date(task.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </div>
          )}
          <div ref={ref} style={{ position: 'absolute', top: 8, right: 8 }}>
            <button onClick={() => setMenuOpen(o => !o)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: P.textMuted, fontSize: 14, lineHeight: 1, padding: 2
            }}>⋯</button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 20, background: P.card,
                border: `1px solid ${P.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 50, minWidth: 130, overflow: 'hidden'
              }}>
                <div style={{ padding: '4px 0', fontSize: 11 }}>
                  <div style={{ padding: '4px 2px', fontWeight: 700, color: P.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 12 }}>
                    Mover a
                  </div>
                  {columns.filter(c => c.id !== task.columnId).map(col => (
                    <button key={col.id} onClick={() => { onMove(task.id, col.id); setMenuOpen(false); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent',
                        border: 'none', cursor: 'pointer', color: col.color, fontSize: 11, fontWeight: 600 }}>
                      → {col.label}
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${P.border}`, margin: '4px 0' }} />
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent',
                      border: 'none', cursor: 'pointer', color: P.text, fontSize: 11 }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => { onDelete(task.id); setMenuOpen(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'transparent',
                      border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 11 }}>
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── KANBAN COLUMN ────────────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, columns, onMove, onDelete, onEdit, onAddTask, onEditCol, P }) {
  const [newText, setNewText]   = useState('');
  const [adding, setAdding]     = useState(false);
  const [dueDate, setDueDate]   = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft]     = useState(col.label);

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAddTask(col.id, newText.trim(), dueDate || null);
    setNewText('');
    setDueDate('');
    setAdding(false);
  };

  return (
    <div style={{
      background: P.cardInner, borderRadius: 14, padding: '12px 10px',
      border: `1px solid ${P.border}`, minWidth: 0, display: 'flex', flexDirection: 'column'
    }}>
      {/* Header columna */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={() => { onEditCol(col.id, labelDraft); setEditingLabel(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onEditCol(col.id, labelDraft); setEditingLabel(false); } }}
            style={{
              background: 'transparent', border: `1px solid ${col.color}`,
              borderRadius: 5, padding: '2px 6px', color: col.color,
              fontSize: 10, fontWeight: 800, outline: 'none', width: '80%'
            }}
          />
        ) : (
          <span
            onDoubleClick={() => { setLabelDraft(col.label); setEditingLabel(true); }}
            title="Doble click para editar"
            style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: 1, color: col.color, cursor: 'pointer' }}
          >
            {col.label}
          </span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 900, background: `${col.color}22`,
          color: col.color, border: `1px solid ${col.color}44`,
          padding: '1px 6px', borderRadius: 8
        }}>{tasks.length}</span>
      </div>

      {/* Tareas */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} columns={columns}
            onMove={onMove} onDelete={onDelete} onEdit={onEdit} P={P} />
        ))}
      </div>

      {/* Añadir tarea */}
      {adding ? (
        <div style={{ marginTop: 6 }}>
          <textarea
            autoFocus
            placeholder="Descripción de la tarea..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } if (e.key === 'Escape') setAdding(false); }}
            style={{
              width: '100%', background: P.card, border: `1px solid ${P.border}`,
              borderRadius: 8, padding: '7px 10px', color: P.text, fontSize: 12,
              resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              boxSizing: 'border-box'
            }}
            rows={2}
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{
              width: '100%', marginTop: 4, background: P.card, border: `1px solid ${P.border}`,
              borderRadius: 6, padding: '4px 8px', color: P.textMuted, fontSize: 11,
              outline: 'none', boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button onClick={handleAdd} style={{
              flex: 1, padding: '6px', borderRadius: 7, border: 'none',
              background: col.color, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer'
            }}>+ Agregar</button>
            <button onClick={() => { setAdding(false); setNewText(''); setDueDate(''); }} style={{
              padding: '6px 10px', borderRadius: 7, border: `1px solid ${P.border}`,
              background: 'transparent', color: P.textMuted, fontSize: 11, cursor: 'pointer'
            }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          marginTop: 8, width: '100%', padding: '6px', borderRadius: 8,
          border: `1px dashed ${P.border}`, background: 'transparent',
          color: P.textMuted, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
          textAlign: 'center'
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.textMuted; }}
        >
          + Tarea
        </button>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TaskManager({ T }) {
  const isDark = T?.bg === '#0F172A' || T?.bg === '#0f172a';
  const P = {
    bg:        isDark ? '#0F172A' : '#f0f4f8',
    card:      isDark ? '#1E293B' : '#ffffff',
    cardInner: isDark ? '#172033' : '#f8fafc',
    border:    isDark ? '#334155' : '#e2e8f0',
    text:      isDark ? '#F1F5F9' : '#1e293b',
    textMuted: isDark ? '#94A3B8' : '#64748b',
    textFaint: isDark ? '#64748B' : '#94a3b8',
  };

  const [columns, setColumns] = useState(() => loadLS(LS_COLS, DEFAULT_COLUMNS));
  const [tasks, setTasks]     = useState(() => loadLS(LS_TASKS, []));

  useEffect(() => saveLS(LS_COLS, columns), [columns]);
  useEffect(() => {
    saveLS(LS_TASKS, tasks);
    // Verificar tareas vencidas y notificar
    const today = new Date().toISOString().slice(0, 10);
    tasks.filter(t => t.dueDate === today && t.columnId !== 'done').forEach(t => {
      sendNotif(`📌 Tarea vence hoy`, t.text);
    });
  }, [tasks]);

  const addTask = (columnId, text, dueDate) => {
    const t = { id: Date.now(), text, columnId, dueDate, createdAt: new Date().toISOString() };
    setTasks(prev => [...prev, t]);
  };

  const moveTask = (taskId, newColId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, columnId: newColId } : t));
  };

  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const editTask = (taskId, newText) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, text: newText } : t));
  };

  const editCol = (colId, newLabel) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, label: newLabel } : c));
  };

  return (
    <div style={{
      background: P.card, borderRadius: 20, padding: 20,
      display: 'flex', flexDirection: 'column', height: '100%',
      border: `1px solid ${P.border}`, overflow: 'hidden', color: P.text
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: 1.5, background: isDark
              ? 'linear-gradient(90deg, #f1f5f9, #94a3b8)'
              : 'linear-gradient(90deg, #0f172a, #475569)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Tareas
          </h3>
          <div style={{ fontSize: 9, color: P.textMuted, marginTop: 1 }}>
            {tasks.filter(t => t.columnId !== 'done').length} pendientes · {tasks.filter(t => t.columnId === 'done').length} completadas
          </div>
        </div>
        <button
          onClick={() => { if (confirm('¿Limpiar todas las tareas completadas?')) setTasks(prev => prev.filter(t => t.columnId !== 'done')); }}
          style={{ fontSize: 9, color: P.textMuted, background: 'transparent',
            border: `1px solid ${P.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
          title="Limpiar completadas"
        >
          🧹 Limpiar hechas
        </button>
      </div>

      {/* Pomodoro */}
      <PomodoroWidget P={P} />

      {/* Kanban */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: 8, minHeight: 0, overflow: 'hidden'
      }}>
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={tasks.filter(t => t.columnId === col.id)}
            columns={columns}
            onMove={moveTask}
            onDelete={deleteTask}
            onEdit={editTask}
            onAddTask={addTask}
            onEditCol={editCol}
            P={P}
          />
        ))}
      </div>
    </div>
  );
}
