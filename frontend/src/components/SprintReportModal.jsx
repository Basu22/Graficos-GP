import { useState } from 'react';
import { API, THEMES } from "../constants";
import { useFetch } from "../hooks/useFetch";
import { Spinner } from "./ui";

export function SprintReportModal({ sprintId, onClose, T }) {
  const theme = T || THEMES.light;
  const { data, loading, error } = useFetch(sprintId ? `${API}/sprints/${sprintId}/report` : null);

  const sumPoints = (issues) => {
    return (issues || []).reduce((acc, i) => acc + (parseFloat(i.points) || 0), 0);
  };

  if (!sprintId) return null;

  const completedPoints = sumPoints(data?.completed_issues);
  const pendingPoints = sumPoints(data?.not_completed_issues);
  const puntedPoints = sumPoints(data?.punted_issues);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 20, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: theme.card, borderRadius: 16, width: '100%', maxWidth: 1000,
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: `1px solid ${theme.cardBorder}`
      }} onClick={e => e.stopPropagation()}>
        
        {/* Sticky Header with Totals */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, backgroundColor: theme.card,
          borderBottom: `1px solid ${theme.cardBorder}`, padding: '20px 24px 12px 24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>
                {loading ? 'Cargando reporte...' : data?.sprint?.name}
              </h2>
              {!loading && data && (
                <span style={{ fontSize: 12, color: theme.textMuted }}>
                  {data.sprint.start_date?.split('T')[0]} — {data.sprint.complete_date?.split('T')[0] || data.sprint.end_date?.split('T')[0]}
                </span>
              )}
            </div>
            <button onClick={onClose} style={{
              background: theme.cardInner || '#f1f5f9', border: 'none', cursor: 'pointer', 
              width: 32, height: 32, borderRadius: '50%', color: theme.text
            }}>✕</button>
          </div>

          {!loading && data && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <StatItem label="Completado" value={completedPoints} color="#10B981" theme={theme} />
              <StatItem label="Sin Completar" value={pendingPoints} color="#EF4444" theme={theme} />
              {puntedPoints > 0 && (
                <StatItem label="Eliminado" value={puntedPoints} color="#64748b" theme={theme} />
              )}
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px' }}>
          {loading ? <Spinner /> : error ? <div style={{ color: '#EF4444' }}>Error al cargar el reporte</div> : data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 12 }}>
              
              <IssueTable 
                title="Incidencias terminadas" 
                issues={data.completed_issues} 
                theme={theme} 
                countColor="#10B981"
              />

              <IssueTable 
                title="Incidencias Sin Completar" 
                issues={data.not_completed_issues} 
                theme={theme} 
                countColor="#EF4444"
              />

              {data.punted_issues?.length > 0 && (
                <IssueTable 
                  title="Incidencias eliminadas del sprint" 
                  issues={data.punted_issues} 
                  theme={theme} 
                  countColor="#64748b"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color, theme }) {
  return (
    <div style={{ 
      flex: 1, padding: '12px 16px', borderRadius: 12, 
      backgroundColor: theme.cardInner || '#f8fafc', border: `1px solid ${theme.cardBorder}` 
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color }}>
        {value} <span style={{ fontSize: 12, opacity: 0.7 }}>pts</span>
      </div>
    </div>
  );
}

function IssueTable({ title, issues, theme, countColor }) {
  if (issues.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: `${countColor}20`, color: countColor }}>
          {issues.length}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.cardBorder}`, textAlign: 'left' }}>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700 }}>Clave</th>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700 }}>Resumen</th>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700 }}>Tipo</th>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700 }}>Prioridad</th>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700 }}>Estado</th>
              <th style={{ padding: '8px 4px', color: theme.textMuted, fontWeight: 700, textAlign: 'right' }}>Story Points</th>
            </tr>
          </thead>
          <tbody>
            {issues.map(issue => (
              <tr key={issue.key} style={{ borderBottom: `1px solid ${theme.cardBorder}`, transition: 'background 0.2s' }}>
                <td style={{ padding: '10px 4px' }}>
                  <a 
                    href={`https://jira.gbsj.com.ar/browse/${issue.key}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: '#3B82F6', fontWeight: 700, textDecoration: 'none' }}
                  >
                    {issue.key}
                  </a>
                </td>
                <td style={{ padding: '10px 4px', color: theme.text, fontWeight: 500 }}>{issue.summary}</td>
                <td style={{ padding: '10px 4px', color: theme.textMuted }}>{issue.type}</td>
                <td style={{ padding: '10px 4px', color: theme.textMuted }}>{issue.priority}</td>
                <td style={{ padding: '10px 4px' }}>
                  <span style={{ 
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                    backgroundColor: issue.status_category === 'done' ? '#DCFCE7' : '#F1F5F9',
                    color: issue.status_category === 'done' ? '#15803d' : '#475569',
                    textTransform: 'uppercase'
                  }}>
                    {issue.status}
                  </span>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, color: theme.text, fontSize: 13 }}>
                  {issue.points || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
