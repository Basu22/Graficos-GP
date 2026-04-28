import React, { useState, useEffect } from 'react';
import { API } from '../constants';

// Helpers visuales
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
};

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + "00000".substring(0, 6 - c.length) + c;
};

// Limpieza local (espejo de parseMessage en smartInbox.js)
const parseBody = (s = '') => {
  if (!s) return { mainText: '', quotedFrom: null };
  const breakPoints = [
    /(On|El|Escribió|Escribio).*?\d{1,2}.*?\d{4}.*?(wrote|escribió|escribio):/i,
    /(On|El|Escribió|Escribio).*?\d{1,2}.*? (wrote|escribió|escribio):/i,
    /\*?(De|From):\*?\s+[A-Z]/i,
  ];
  let splitIndex = s.length;
  for (const bp of breakPoints) {
    const match = s.match(bp);
    if (match && match.index < splitIndex) splitIndex = match.index;
  }
  const mainPart = s.substring(0, splitIndex)
    .replace(/[>|]+/g, '').replace(/\[cid:.*?\]/g, '').replace(/&lt;.*?&gt;/g, '')
    .replace(/<.*?>/g, '').replace(/_{10,}/g, '').replace(/\*+/g, '')
    .replace(/(Obtener Outlook para|Enviado desde mi|Sent from my|Get Outlook for).*$/gim, '')
    .replace(/(Saludos|Atentamente|Cordial saludo|Gracias|Best regards),?.*$/gim, '')
    .replace(/(Price Waterhouse|Bouchard 557|C1106ABG|En PwC trabajamos|Piensa antes de imprimir|Advisory Email|Phone:).*$/gis, '')
    .replace(/Notice: This e-mail.*$/gis, '')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    .replace(/\s+/g, ' ').trim();

  // Extraer autor citado
  let quotedFrom = null;
  if (splitIndex < s.length) {
    const quotedRaw = s.substring(splitIndex);
    const escribioIdx = quotedRaw.search(/(?:escribió|escribio|wrote):/i);
    if (escribioIdx > 0) {
      const beforeWrote = quotedRaw.substring(0, escribioIdx);
      const nameMatch = beforeWrote.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:,\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+?)?)\s*\(?[<(&]/);
      if (nameMatch) quotedFrom = nameMatch[1].trim();
    }
  }
  return { mainText: mainPart, quotedFrom };
};

export function EmailThreadModal({ thread, onClose, theme, isDark }) {
  const [fullThread, setFullThread]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Al abrir, traer el hilo completo del backend
  useEffect(() => {
    if (!thread?.threadId) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/midia/thread/${thread.threadId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        // Procesar mensajes con la misma lógica de limpieza del smartInbox
        const processed = data.messages.map(m => {
          const parsed = parseBody(m.body || m.snippet || '');
          return { from: m.from, snippet: parsed.mainText, quotedFrom: parsed.quotedFrom, date: m.date };
        });
        setFullThread({ ...thread, messages: processed, totalMessages: data.totalMessages });
      })
      .catch(e => { console.error('Error cargando thread:', e); setError(e.message); })
      .finally(() => setLoading(false));
  }, [thread?.threadId]);

  if (!thread) return null;

  const display = fullThread || thread; // Usar datos completos si ya cargaron

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-AR', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  const cleanName = (from) => {
    return from.split('<')[0].replace(/"/g, '').trim();
  };

  const gmailLink = `https://mail.google.com/mail/#inbox/${thread.threadId}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      padding: 20, backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      
      <div style={{
        backgroundColor: theme.card, 
        borderRadius: 20, 
        width: '100%', 
        maxWidth: 800,
        height: '85vh', 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: theme.shadow, 
        border: `1px solid ${theme.border}`,
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        {/* HEADER */}
        <div style={{
          padding: '24px 24px 16px 24px',
          borderBottom: `1px solid ${theme.border}`,
          backgroundColor: theme.card,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
               <button onClick={onClose} style={{
                background: theme.bg, border: 'none', cursor: 'pointer', 
                width: 32, height: 32, borderRadius: '50%', color: theme.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18
              }}>✕</button>
              <div style={{ color: theme.muted, fontSize: 12, fontWeight: 600 }}>
                {loading ? 'Cargando hilo...' : `${display.totalMessages} mensajes en el hilo`}
              </div>
            </div>
            
            <a href={gmailLink} target="_blank" rel="noreferrer" style={{
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
              color: '#3B82F6',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(59,130,246,0.2)'
            }}>
              Abrir en Gmail ↗
            </a>
          </div>

          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>
            {display.subject}
          </h2>
          
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '2px 8px', borderRadius: 4,
              backgroundColor: display.responseStatus === 'WAITING' ? 'rgba(249,115,22,0.15)' : 'rgba(16,185,129,0.15)',
              color: display.responseStatus === 'WAITING' ? '#F97316' : '#10B981',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {display.responseStatus === 'WAITING' ? '⏳ Esperando Acción' : '✅ Respondido'}
            </span>
          </div>
        </div>

        {/* TIMELINE DE MENSAJES */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          backgroundColor: isDark ? '#111827' : '#F8FAFC'
        }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: theme.muted }}>
              <div style={{ width: 20, height: 20, border: `2px solid ${theme.border}`, borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Cargando hilo completo...
            </div>
          )}
          {error && (
            <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', padding: 20 }}>
              ⚠️ Error al cargar: {error}
            </div>
          )}
          {!loading && !error && display.messages?.map((msg, idx) => {
            const isLast = idx === display.messages.length - 1;
            const name = cleanName(msg.from);
            const avatarColor = stringToColor(name);
            
            return (
              <div key={idx} style={{ 
                display: 'flex', 
                gap: 16,
                opacity: isLast ? 1 : 0.85,
                marginLeft: msg.quotedFrom ? 40 : 0,         // Tabulación si es respuesta
                borderLeft: msg.quotedFrom 
                  ? `2px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.15)'}` 
                  : 'none',
                paddingLeft: msg.quotedFrom ? 16 : 0,
                transition: 'margin 0.2s ease'
              }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', 
                  backgroundColor: avatarColor,
                  color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {getInitials(name)}
                </div>

                {/* Burbuja */}
                <div style={{ 
                  flex: 1,
                  backgroundColor: isLast 
                    ? (isDark ? 'rgba(59,130,246,0.1)' : 'white')
                    : (isDark ? theme.card : 'white'),
                  border: isLast 
                    ? `1px solid rgba(59,130,246,0.3)` 
                    : `1px solid ${theme.border}`,
                  borderRadius: '0 16px 16px 16px',
                  padding: '16px',
                  boxShadow: isLast ? '0 4px 12px rgba(59,130,246,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: theme.text }}>{name}</span>
                    <span style={{ fontSize: 11, color: theme.muted }}>{formatDate(msg.date)}</span>
                  </div>
                  {/* Texto principal del mensaje */}
                  <div style={{ 
                    fontSize: 14, 
                    lineHeight: 1.6, 
                    color: isDark ? '#E2E8F0' : '#334155',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    {msg.snippet}
                  </div>
                  
                  {isLast && display.responseStatus === 'WAITING' && (
                    <div style={{ 
                      marginTop: 12, 
                      paddingTop: 12, 
                      borderTop: `1px dashed ${theme.border}`,
                      fontSize: 12,
                      color: '#F97316',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      ⚠️ Este hilo requiere tu atención
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER (Sprint B: Aquí irá la caja de respuesta) */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: theme.card,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 11, color: theme.muted, fontStyle: 'italic' }}>
            Próximamente: Podrás responder directamente desde aquí.
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
