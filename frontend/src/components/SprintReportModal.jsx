import { useState } from 'react';
import { API, THEMES } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { Spinner } from "./ui";

// Iconos SVG Nativo Jira
const TypeIcon = ({ type }) => {
  const isStory = type?.toLowerCase().includes('historia') || type?.toLowerCase().includes('story');
  const isTask = type?.toLowerCase().includes('tarea') || type?.toLowerCase().includes('task');
  
  if (isStory) return (
    <div title="Historia" style={{ width: 14, height: 14, backgroundColor: '#4bbf6b', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="white">
        <path d="M5 3v18l7-3 7 3V3z"/>
      </svg>
    </div>
  );
  if (isTask) return (
    <div title="Tarea" style={{ width: 14, height: 14, backgroundColor: '#4b8bf5', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" strokeWidth="4">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  );
  return <span style={{ fontSize: 10 }}>{type}</span>;
};

const PriorityIcon = ({ priority }) => {
  const p = priority?.toLowerCase() || '';
  if (p.includes('super alta')) return (
    <div title="Super Alta" style={{ display: 'flex', flexDirection: 'column', gap: -4, alignItems: 'center', width: 14 }}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="#ff4d4d" style={{ marginBottom: -6 }}><path d="M7 14l5-5 5 5H7z"/></svg>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="#ff4d4d"><path d="M7 14l5-5 5 5H7z"/></svg>
    </div>
  );
  if (p.includes('alta')) return <svg title="Alta" viewBox="0 0 24 24" width="14" height="14" fill="#ff4d4d"><path d="M7 14l5-5 5 5H7z"/></svg>;
  if (p.includes('media')) return (
    <div title="Media" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: 14, height: 14, gap: 2 }}>
      <div style={{ width: 10, height: 2, backgroundColor: '#ff9900' }} />
      <div style={{ width: 10, height: 2, backgroundColor: '#ff9900' }} />
    </div>
  );
  return <span style={{ fontSize: 10 }}>{priority}</span>;
};

const StatusPill = ({ status }) => {
  const s = status?.toLowerCase() || '';
  let bgColor = '#6b7280'; // Gray default
  let color = 'white';

  if (s.includes('listo') || s.includes('done') || s.includes('terminada')) bgColor = '#10b981';
  else if (s.includes('progreso')) bgColor = '#3b82f6';
  else if (s.includes('hacer') || s.includes('sprint') || s.includes('todo')) bgColor = '#9ca3af';

  return (
    <span style={{ 
      padding: '2px 8px', 
      borderRadius: 4, 
      fontSize: 10, 
      fontWeight: 800, 
      backgroundColor: bgColor, 
      color: color,
      textTransform: 'uppercase',
      display: 'inline-block'
    }}>
      {status}
    </span>
  );
};

const StatItem = ({ label, value, color, theme, note }) => (
  <div style={{ 
    backgroundColor: theme.cardInner || '#f8fafc', 
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: 12, 
    padding: '12px 14px', 
    minWidth: 140,
    flex: 1,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  }}>
    <div style={{ fontSize: 9, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 800, marginBottom: 4, letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: color }}>{value}</span>
      <span style={{ fontSize: 10, color: theme.textMuted }}>pts</span>
    </div>
    {note && <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 4, opacity: 0.8 }}>{note}</div>}
  </div>
);

const IssueTable = ({ issues, title, countColor, theme }) => {
  if (!issues || issues.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: `1px solid ${theme.cardBorder}` }}>
        <h3 style={{ color: theme.text, fontSize: 11, fontWeight: 700, margin: 0, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
        <span style={{ color: countColor, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>
          {issues.length}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: theme.textMuted, fontSize: 11, borderBottom: `1px solid ${theme.cardBorder}` }}>
            <th style={{ padding: '8px 4px', fontWeight: 500 }}>Clave</th>
            <th style={{ padding: '8px 4px', fontWeight: 500 }}>Resumen</th>
            <th style={{ padding: '8px 4px', fontWeight: 500, width: 40, textAlign: 'center' }}>Tipo</th>
            <th style={{ padding: '8px 4px', fontWeight: 500, width: 50, textAlign: 'center' }}>Prio</th>
            <th style={{ padding: '8px 4px', fontWeight: 500 }}>Estado</th>
            <th style={{ padding: '8px 4px', fontWeight: 500, textAlign: 'right' }}>Story Points</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => (
            <tr key={issue.key} style={{ borderBottom: `1px solid ${theme.cardBorder}`, fontSize: 12 }}>
              <td style={{ padding: '10px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <a href={`https://jira.gbsj.com.ar/browse/${issue.key}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 800 }}>
                    {issue.key}
                  </a>
                  {issue.added_during_sprint && <span style={{ color: theme.textMuted, fontWeight: 700 }}>*</span>}
                </div>
              </td>
              <td style={{ padding: '10px 4px', color: theme.text, fontWeight: 500 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{issue.summary}</span>
                  {issue.is_carry_over && (
                    <span style={{ fontSize: 9, color: '#EF4444', fontWeight: 800, marginTop: 2 }}>
                      CarryOver {issue.origin_sprint}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ padding: '10px 4px', textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center' }}><TypeIcon type={issue.type} /></div></td>
              <td style={{ padding: '10px 4px', textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center' }}><PriorityIcon priority={issue.priority} /></div></td>
              <td style={{ padding: '10px 4px' }}><StatusPill status={issue.status} /></td>
              <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, color: theme.text }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {issue.initial_points !== issue.points ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: theme.textMuted, textDecoration: 'line-through', fontWeight: 400 }}>
                        {issue.initial_points}
                      </span>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>➞</span>
                      <span style={{ color: '#8B5CF6' }}>{issue.points}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13 }}>{issue.points || '-'}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function SprintReportModal({ sprintId, onClose, T }) {
  const theme = T || THEMES.light;
  const { data, loading, error } = useFetch(sprintId ? `${API}/sprints/${sprintId}/report` : null);

  if (!sprintId) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 20, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: theme.card, borderRadius: 16, width: '100%', maxWidth: 1100,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `1px solid ${theme.cardBorder}`
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header Fijo */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.card,
          borderBottom: `1px solid ${theme.cardBorder}`, padding: '20px 24px 12px 24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>
                {loading ? 'Cargando reporte...' : data?.sprint?.name}
              </h2>
              {!loading && data && (
                <span style={{ fontSize: 11, color: theme.textMuted }}>
                  {data.sprint.start_date?.split('T')[0]} — {data.sprint.complete_date?.split('T')[0] || data.sprint.end_date?.split('T')[0]}
                </span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: theme.bgSecondary || '#f1f5f9', border: 'none', cursor: 'pointer', 
              width: 32, height: 32, borderRadius: '50%', color: theme.text
            }}>✕</button>
          </div>

          {!loading && data && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
              <StatItem label="Comprometido" value={data.initial_committed_points} color="#3B82F6" theme={theme} />
              <StatItem label="Completado" value={data.completed_points} color="#10B981" theme={theme} />
              <StatItem label="Sin Completar" value={data.not_completed_points} color="#F59E0B" theme={theme} />
              <StatItem label="Eliminado" value={data.punted_points} color="#EF4444" theme={theme} />
              <StatItem label="Cambio Alcance" value={data.scope_change_points} color="#8B5CF6" theme={theme} note="Deltas + Adiciones" />
              <StatItem label="Carry Over" value={data.total_carry_over_points} color="#EF4444" theme={theme} note="Puntos heredados" />
            </div>
          )}
        </div>

        {/* Contenido Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
          {loading ? <Spinner /> : error ? <div style={{ color: '#EF4444' }}>Error al cargar el reporte</div> : data && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
              
              <IssueTable title="Incidencias terminadas" issues={data.completed_issues} countColor="#10B981" theme={theme} />

              <IssueTable title="Incidencias Sin Completar" issues={data.not_completed_issues} countColor="#F59E0B" theme={theme} />

              <IssueTable title="Incidencias terminadas fuera de este sprint" issues={data.completed_outside_issues} countColor="#10B981" theme={theme} />

              {data.punted_issues?.length > 0 && (
                <IssueTable title="Incidencias eliminadas del sprint" issues={data.punted_issues} countColor="#EF4444" theme={theme} />
              )}

              <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic', borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 16 }}>
                * Incidencia agregada al sprint después de la fecha de comienzo.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
