import React, { useState, createContext, useContext } from 'react';

// ─── SISTEMA DE TEMAS ────────────────────────────────────────────────────────
const ThemeCtx = createContext(true); // true = dark

const TAG_STYLES = {
  URGENTE:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   text: '#EF4444', icon: '🚨' },
  BLOQUEO:    { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)',  text: '#F97316', icon: '🔒' },
  JIRA:       { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.3)', text: '#3B82F6', icon: '🎯' },
  'JIRA-FYI': { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: '#64748b', icon: 'ℹ️' },
  INICIATIVA: { bg: 'rgba(168,85,247,0.10)',  border: 'rgba(168,85,247,0.3)', text: '#A855F7', icon: '🔭' },
  HEALTH:     { bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.3)', text: '#10B981', icon: '📊' },
  INFO:       { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.15)', text: '#94a3b8', icon: '📬' },
};

function getP(isDark) {
  if (isDark) return {
    bg:           '#0F172A',
    card:         '#1E293B',
    cardHover:    '#253349',
    text:         '#F1F5F9',
    muted:        '#94A3B8',
    border:       '#334155',
    rowAlt:       '#172033',
    headerBg:     'rgba(249,115,22,0.18)',
    headerText:   '#FB923C',
    sectionBg:    '#172033',
    inputBg:      '#0F172A',
    shadow:       '0 8px 32px rgba(0,0,0,0.5)',
    containerBg:  '#1E293B',
    containerBorder: '#334155',
  };
  return {
    bg:        '#ffffff',
    card:      '#f8fafc',
    cardHover: '#f1f5f9',
    text:      '#0f172a',
    muted:     '#64748b',
    border:    '#e2e8f0',
    rowAlt:    '#f8fafc',
    headerBg:  '#fff7ed',
    headerText:'#ea580c',
    sectionBg: '#f1f5f9',
    inputBg:   '#f1f5f9',
    shadow:    '0 4px 20px rgba(0,0,0,0.08)',
    containerBg: '#ffffff',
    containerBorder: '#e2e8f0',
  };
}

function useP() { return getP(useContext(ThemeCtx)); }

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({ tag, extra }) {
  const s = TAG_STYLES[tag] || TAG_STYLES.INFO;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8,
      padding: '2px 8px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      flexShrink: 0,
    }}>
      {s.icon} {extra || tag}
    </span>
  );
}

// ─── TABLA: PRODUCTOS × BANCOS ───────────────────────────────────────────────
function BankTable({ tableRows, banks }) {
  const P = useP();
  if (!tableRows || tableRows.length === 0) return null;
  const fmt = v => new Intl.NumberFormat('es-AR').format(v);

  const DiffCell = ({ bd }) => {
    if (!bd) return <td style={{ textAlign: 'right', padding: '5px 8px', color: P.muted, fontSize: 11 }}>—</td>;
    const { current, diff, isFallback } = bd;
    const isDown = diff !== null && diff < 0;
    const isUp   = diff !== null && diff > 0;
    const col    = isDown ? '#EF4444' : isUp ? '#10B981' : P.text;
    return (
      <td style={{ textAlign: 'right', padding: '5px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: P.text, fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
          {current ? fmt(current) : '—'}
          {isFallback && current ? (
            <span
              title="Dato del día anterior (no llegó el reporte de hoy)"
              style={{ fontSize: 9, cursor: 'help', lineHeight: 1 }}
            >⚠️</span>
          ) : null}
        </div>
        {diff !== null && diff !== undefined && (
          <div style={{ fontSize: 9, fontWeight: 700, color: col }}>
            {isDown ? '↓' : isUp ? '↑' : ''}&nbsp;{Math.abs(diff)}%
          </div>
        )}
      </td>
    );
  };

  return (
    <div style={{ overflowX: 'auto', marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: `1px solid ${P.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: P.headerBg }}>
            <th style={{ textAlign: 'left', padding: '7px 10px', color: P.headerText, fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Producto
            </th>
            {(banks || []).map(b => (
              <th key={b} style={{ textAlign: 'right', padding: '7px 8px', color: P.headerText, fontWeight: 800, fontSize: 9, letterSpacing: 0.6 }}>
                {b}
              </th>
            ))}
            <th style={{ textAlign: 'right', padding: '7px 8px', color: P.headerText, fontWeight: 800, fontSize: 9, letterSpacing: 0.6 }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, ri) => {
            const rowBg   = ri % 2 === 0 ? P.rowAlt : 'transparent';
            const tdiff   = row.total_diff;
            const totalCol = tdiff !== null && tdiff < 0 ? '#EF4444' : tdiff > 0 ? '#10B981' : P.text;
            return (
              <tr key={row.key} style={{ background: rowBg, borderTop: `1px solid ${P.border}` }}>
                <td style={{ padding: '6px 10px', fontWeight: 600, color: P.text, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {row.label}
                </td>
                {(banks || []).map(b => <DiffCell key={b} bd={row.banks?.[b]} />)}
                <td style={{ textAlign: 'right', padding: '5px 8px', borderLeft: `1px solid ${P.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: totalCol, fontFamily: "'DM Mono', monospace" }}>
                    {row.total_current ? fmt(row.total_current) : '—'}
                  </div>
                  {tdiff !== null && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: totalCol }}>
                      {tdiff < 0 ? '↓' : tdiff > 0 ? '↑' : ''}&nbsp;{Math.abs(tdiff)}%
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MONITOR DE SALUD ────────────────────────────────────────────────────────
function HealthBanner({ healthReport, loadingHealth }) {
  const P = useP();
  const [expanded, setExpanded] = useState(false);

  if (loadingHealth) return (
    <div style={{ borderRadius: 14, padding: 16, marginBottom: 16, background: P.card, border: `1px solid ${P.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.muted, fontSize: 12 }}>
        <span>⏳</span> Analizando reportes de salud…
      </div>
    </div>
  );

  if (!healthReport) return null;

  if (healthReport.error) return (
    <div style={{ borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: P.card, border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>📊</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted }}>Monitor de Salud</div>
        <div style={{ fontSize: 10, color: P.muted, opacity: 0.7 }}>Sin reportes de oferta en los últimos 30 días</div>
      </div>
    </div>
  );

  const { tableRows, banks, hasAnyIssue, latestDate, previousDate, latestFrom, latestSnippet, aiAnalysis } = healthReport;
  const semaforo = hasAnyIssue ? '🔴' : '🟢';
  const bgCard   = hasAnyIssue ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)';
  const bdrCard  = hasAnyIssue ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)';

  return (
    <div style={{ borderRadius: 14, padding: 16, marginBottom: 16, background: bgCard, border: `1px solid ${bdrCard}` }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: expanded ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{semaforo}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: P.text }}>Monitor de Salud · Oferta Minorista</div>
            <div style={{ fontSize: 9, color: P.muted }}>
              {latestDate} vs {previousDate || 'N/A'} · {latestFrom?.split('<')[0]?.trim()}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: P.muted }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <>
          <BankTable tableRows={tableRows} banks={banks} />
          {(latestSnippet || aiAnalysis) && (
            <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {latestSnippet && (
                <div style={{ background: P.sectionBg, borderRadius: 8, padding: '8px 12px', border: `1px solid ${P.border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                    �� Análisis · {latestFrom?.split('<')[0]?.trim() || 'Reporte'}
                  </div>
                  <div style={{ fontSize: 11, color: P.muted, lineHeight: 1.6 }}>{latestSnippet}</div>
                </div>
              )}
              {aiAnalysis && (
                <div style={{ background: 'rgba(59,130,246,0.07)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(59,130,246,0.18)' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                    ✨ Análisis IA — cruce con el inbox
                  </div>
                  <div style={{ fontSize: 11, color: P.text, lineHeight: 1.6 }}>{aiAnalysis}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── CARD DE MAIL ────────────────────────────────────────────────────────────
function InboxCard({ item }) {
  const P = useP();
  const [open, setOpen] = useState(false);
  const tag  = item._tag || 'INFO';
  const s    = TAG_STYLES[tag] || TAG_STYLES.INFO;
  const isStale = item.isStale;

  return (
    <div onClick={() => setOpen(o => !o)} style={{
      background: isStale ? `linear-gradient(90deg, rgba(249,115,22,0.07) 0%, ${P.card} 100%)` : P.card,
      border: `1px solid ${isStale ? 'rgba(249,115,22,0.35)' : P.border}`,
      borderLeft: isStale ? '3px solid #F97316' : `3px solid ${s.border}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <Badge tag={tag} extra={item._isCeremony ? 'Ceremonia' : null} />
        {isStale && <Badge tag="BLOQUEO" extra="Estancado" />}
        {item.ticketId && (
          <a href={`https://jira.gbsj.com.ar/browse/${item.ticketId}`} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', textDecoration: 'none',
              background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: 5,
              border: '1px solid rgba(59,130,246,0.3)', flexShrink: 0 }}>
            {item.ticketId} ↗
          </a>
        )}
        <span style={{ fontSize: 9, color: P.muted, marginLeft: 'auto', fontFamily: "'DM Mono', monospace" }}>
          {item.date ? new Date(item.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: isStale ? '#FB923C' : P.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap', marginBottom: 4 }}>
        {item.subject || item.title || 'Sin asunto'}
      </div>
      <div style={{ fontSize: 10, color: P.muted }}>
        {item.from || item.originalRequest?.from || ''}
      </div>
      {open && (item.snippet || item.originalRequest?.snippet) && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: P.sectionBg, borderRadius: 8,
          fontSize: 11, color: P.muted, lineHeight: 1.6, borderTop: `1px solid ${P.border}` }}>
          {item.snippet || item.originalRequest?.snippet}
        </div>
      )}
      {item.responseStatus && open && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 5,
            color: item.responseStatus === 'WAITING' ? '#F59E0B' : '#10B981',
            background: item.responseStatus === 'WAITING' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${item.responseStatus === 'WAITING' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}>
            {item.responseStatus === 'WAITING' ? '⏳ Esperando respuesta' : `✓ Respondido — ${item.respondingTeam}`}
          </span>
          {item.totalMessages > 1 && <span style={{ fontSize: 9, color: P.muted }}>{item.totalMessages} mensajes en el hilo</span>}
        </div>
      )}
    </div>
  );
}

// ─── SECCIÓN COLAPSABLE ──────────────────────────────────────────────────────
function Section({ title, items, tagStyle, collapsible = true }) {
  const P = useP();
  const [collapsed, setCollapsed] = useState(false);
  if (!items || items.length === 0) return null;
  const s = tagStyle;

  return (
    <div style={{ marginBottom: 20 }}>
      <div onClick={() => collapsible && setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8,
          borderBottom: `1px solid ${s?.border || P.border}`, cursor: collapsible ? 'pointer' : 'default', userSelect: 'none' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: s?.text || P.muted, boxShadow: `0 0 6px ${s?.text || P.muted}` }} />
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: s?.text || P.muted }}>
          {title}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, background: s?.bg || P.sectionBg,
          color: s?.text || P.muted, border: `1px solid ${s?.border || P.border}`, padding: '1px 7px', borderRadius: 10 }}>
          {items.length}
        </span>
        {collapsible && <span style={{ fontSize: 10, color: P.muted, marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</span>}
      </div>
      {!collapsed && items.map((item, i) => <InboxCard key={item.id || i} item={item} />)}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function SmartInboxColumn({ smartInbox, healthReport, loadingHealth, isDark = true, onSync, onSyncHealth }) {

  const P = getP(isDark);

  if (!smartInbox) {
    return (
      <ThemeCtx.Provider value={isDark}>
        <div style={{ background: P.containerBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${P.containerBorder}`, borderRadius: 24, padding: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: 0, color: P.muted, fontSize: 13 }}>
          Cargando inbox…
        </div>
      </ThemeCtx.Provider>
    );
  }

  const { urgent = [], blocked = [], jira = [], jiraFyi = [], initiatives = [], ceremonies = [], info = [] } = smartInbox;
  const urgentTotal = urgent.length;
  const hasContent  = urgentTotal > 0 || blocked.length > 0 || jira.length > 0 || initiatives.length > 0 || ceremonies.length > 0;

  return (
    <ThemeCtx.Provider value={isDark}>
      <style>{`
        @keyframes si-stale-pulse { 0%,100%{opacity:1} 50%{opacity:.75} }
        .si-scroll::-webkit-scrollbar { width: 5px; }
        .si-scroll::-webkit-scrollbar-track { background: transparent; }
        .si-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
      `}</style>

      <div style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 24, padding: 24,
        display: 'flex', flexDirection: 'column',
        height: '100%', minHeight: 0,
        color: P.text,
        overflow: 'hidden',
      }}>
        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5,
              background: isDark
                ? 'linear-gradient(90deg, #f1f5f9, #94a3b8)'
                : 'linear-gradient(90deg, #0f172a, #475569)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smart Inbox
            </h3>
            <span style={{ fontSize: 9, color: P.muted, fontWeight: 600 }}>Oferta Minorista</span>
            {urgentTotal > 0 && (
              <span style={{ fontSize: 9, fontWeight: 800, background: '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                {urgentTotal} urgentes
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              id="btn-sync-inbox"
              onClick={onSync}
              style={{ fontSize: 10, color: P.muted, background: 'transparent', border: `1px solid ${P.border}`,
                borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
              title="Recarga el Smart Inbox (mails de equipo, clientes, etc.)"
            >
              🔄 Sync Inbox
            </button>
            <button
              id="btn-sync-salud"
              onClick={onSyncHealth}
              style={{ fontSize: 10, color: '#10B981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
              title="Actualiza el Monitor de Salud (query directo a Gmail operativo)"
            >
              🏥 Sync Salud
            </button>
          </div>
        </div>

        {/* ── SCROLL AREA ── */}
        <div className="si-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 24, minHeight: 0 }}>
          {hasContent ? (
            <>
              <HealthBanner healthReport={healthReport} loadingHealth={loadingHealth} />

              {urgent.length > 0 && (
                <Section title="🚨 Urgente — Acción Requerida" items={urgent} tagStyle={TAG_STYLES.URGENTE} />
              )}
              {blocked.length > 0 && (
                <Section title="🔒 Bloqueos Activos" items={blocked} tagStyle={TAG_STYLES.BLOQUEO} />
              )}
              {initiatives.length > 0 && (
                <Section title="🔭 Iniciativas en Seguimiento" items={initiatives} tagStyle={TAG_STYLES.INICIATIVA} />
              )}
              {jira.length > 0 && (
                <Section title="🎯 Jira — Solo para estar al tanto" items={jira} tagStyle={TAG_STYLES.JIRA} />
              )}
              {jiraFyi.length > 0 && (
                <Section title="ℹ️ Jira FYI" items={jiraFyi} tagStyle={TAG_STYLES['JIRA-FYI']} />
              )}
              {ceremonies.length > 0 && (
                <Section title="📅 Ceremonias" items={ceremonies} tagStyle={TAG_STYLES.INFO} />
              )}
              {info.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 0' }}>
                  <span style={{ fontSize: 10, color: P.muted, fontWeight: 600 }}>
                    📬 Información ({info.length} items filtrados)
                  </span>
                </div>
              )}
            </>
          ) : (
            <HealthBanner healthReport={healthReport} loadingHealth={loadingHealth} />
          )}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
