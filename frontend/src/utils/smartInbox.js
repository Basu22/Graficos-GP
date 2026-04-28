/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║     SMART INBOX — Motor de Decisiones (config dinámica)      ║
 * ║  Clasificación + Filtros vienen 100% desde Google Sheets.    ║
 * ║  Fallback mínimo de emergencia si el Sheet no responde.      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Pipeline:
 *   Mail → [FILTROS] → IGNORAR | SILENCIAR | REBOTAR | pasa →
 *          [CLASIFICADOR] → URGENTE / BLOQUEO / JIRA / INICIATIVA / ...
 */

// ─── HELPERS BASE ────────────────────────────────────────────────
export const normalize = (str = '') =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const extractTicketId = (subject = '') => {
  const match = subject.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match ? match[1] : null;
};

const buildJiraLink = (ticketId) =>
  ticketId ? `https://jira.gbsj.com.ar/browse/${ticketId}` : null;

const getTimeBucket = (dateStr) => {
  if (!dateStr) return 'older';
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (ageDays <= 1) return 'today';
  if (ageDays <= 7) return 'thisWeek';
  return 'older';
};

const calcIsStale = (dateStr, isPending, slaDays = 3) => {
  if (!isPending || !dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) / 86400000 > slaDays;
};

// ─── FALLBACK MÍNIMO (solo si el Sheet está caído) ────────────────
// NO contiene emails ni keywords reales — es solo la estructura vacía
// para que el motor no explote. En condiciones normales todo viene del Sheet.
export const DEFAULT_CONFIG = {
  URGENTE_PATTERNS:    [],
  BLOQUEO_PATTERNS:    [],
  JIRA_EPICS:          [],
  HEALTH_SENDERS:      ['operativagobdato'],
  HEALTH_SUBJECTS:     ['estado de ofertas', 'reporte diario', 'detalle de ofertas'],
  INICIATIVA_CONTACTS: [],
  INITIATIVE_TAGS:     [],
  INITIATIVE_TEAMS:    ['back', 'datos', 'agilidad', 'frontend', 'data', 'devops'],
  ONBOARDING_LABELS:   [],
  JIRA_ACTION_PATTERNS:[],
  NOISE_PATTERNS:      [],
  SCRUM_CEREMONIES:    ['review', 'planning', 'retrospectiva', 'retro', 'sprint'],
  // SLA por tag (días). Se sobreescribe con los datos del Sheet.
  SLA_BY_TAG: { URGENTE: 1, BLOQUEO: 2, JIRA: 3, INICIATIVA: 5 },
};

// ─── ESTADO GLOBAL DE FILTROS ────────────────────────────────────
// Se llena cuando llega la respuesta del Sheet.
let _filters = { ignorar: [], silenciar: [], rebotar: [] };

// ─── PARSER DE CONFIG DESDE SHEETS (pestaña Motor) ───────────────
export function parseSheetConfig(rows = []) {
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const findRows = (tagFragment) =>
    rows.filter(r => normalize(r.Tag || '').includes(normalize(tagFragment)));

  const extractEmails   = (text = '') => [...new Set((text.match(emailRe) || []).map(normalize))];
  const extractKeywords = (text = '') =>
    text.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2 && !s.includes('@')).map(normalize);

  const criteriaFor = (tag) => findRows(tag).flatMap(r => [
    ...extractEmails(r.Criterio   || ''),
    ...extractKeywords(r.Criterio || ''),
  ]);

  const slaFor = (tag) => {
    const row = findRows(tag)[0];
    return row?.SLA_dias ? parseInt(row.SLA_dias) : null;
  };

  const urgPatterns  = criteriaFor('urgente');
  const bloqPatterns = criteriaFor('bloqueo');
  const jiraEpics    = criteriaFor('jira').filter(k => !k.includes('@'));
  const jiraActPats  = criteriaFor('jira');
  const healthSnds   = criteriaFor('health');
  const healthSubjs  = criteriaFor('health');
  const iniContacts  = criteriaFor('iniciativa').filter(k => k.includes('@'));
  const iniTags      = criteriaFor('iniciativa').filter(k => !k.includes('@'));
  const onboardKws   = criteriaFor('onboarding');
  const ceremonies   = criteriaFor('ceremonia');

  const SLA_BY_TAG = {
    URGENTE:   slaFor('urgente')   || DEFAULT_CONFIG.SLA_BY_TAG.URGENTE,
    BLOQUEO:   slaFor('bloqueo')   || DEFAULT_CONFIG.SLA_BY_TAG.BLOQUEO,
    JIRA:      slaFor('jira')      || DEFAULT_CONFIG.SLA_BY_TAG.JIRA,
    INICIATIVA:slaFor('iniciativa')|| DEFAULT_CONFIG.SLA_BY_TAG.INICIATIVA,
  };

  return {
    ...DEFAULT_CONFIG,
    URGENTE_PATTERNS:    urgPatterns.length  ? urgPatterns  : DEFAULT_CONFIG.URGENTE_PATTERNS,
    BLOQUEO_PATTERNS:    bloqPatterns.length ? bloqPatterns : DEFAULT_CONFIG.BLOQUEO_PATTERNS,
    JIRA_EPICS:          jiraEpics.length    ? jiraEpics    : DEFAULT_CONFIG.JIRA_EPICS,
    JIRA_ACTION_PATTERNS:jiraActPats.length  ? jiraActPats  : DEFAULT_CONFIG.JIRA_ACTION_PATTERNS,
    HEALTH_SENDERS:      healthSnds.length   ? healthSnds   : DEFAULT_CONFIG.HEALTH_SENDERS,
    HEALTH_SUBJECTS:     healthSubjs.length  ? healthSubjs  : DEFAULT_CONFIG.HEALTH_SUBJECTS,
    INICIATIVA_CONTACTS: iniContacts.length  ? iniContacts  : DEFAULT_CONFIG.INICIATIVA_CONTACTS,
    INITIATIVE_TAGS:     iniTags.length      ? iniTags      : DEFAULT_CONFIG.INITIATIVE_TAGS,
    ONBOARDING_LABELS:   onboardKws.length   ? onboardKws   : DEFAULT_CONFIG.ONBOARDING_LABELS,
    SCRUM_CEREMONIES:    ceremonies.length   ? ceremonies   : DEFAULT_CONFIG.SCRUM_CEREMONIES,
    SLA_BY_TAG,
    _sheetLoaded: true,
    _sheetRows: rows.length,
  };
}

// ─── PARSER DE FILTROS DESDE SHEETS (pestaña Filtros) ─────────────
export function parseFiltersConfig(filterRows = []) {
  const build = (tipo) =>
    filterRows
      .filter(r => (r.Tipo || '').toUpperCase() === tipo && (r.Activo || 'SI').toUpperCase() === 'SI')
      .map(r => ({ campo: r.Campo || '', valor: normalize(r.Valor || '') }));

  return {
    ignorar:  build('IGNORAR'),
    silenciar:build('SILENCIAR'),
    rebotar:  build('REBOTAR'),
  };
}

// ─── APLICAR FILTROS A UN MAIL ────────────────────────────────────
function applyFilters(email) {
  const sn = normalize(email.subject || '');
  const fn = normalize(email.from    || '');

  const match = (regla) => {
    const val = regla.valor;
    if (regla.campo === 'asunto_contiene')    return sn.includes(val);
    if (regla.campo === 'remitente_contiene') return fn.includes(val);
    return false;
  };

  if (_filters.ignorar.some(match))   return 'IGNORAR';
  if (_filters.silenciar.some(match)) return 'SILENCIAR';
  if (_filters.rebotar.some(match))   return 'REBOTAR';
  return null;
}

// ─── PRE-COMPILACIÓN DE PATTERNS ─────────────────────────────────
function compileConfig(cfg) {
  const compile = (list) => list.map(p => ({
    raw: p,
    test: (str) => str.includes(normalize(p)),
  }));
  return {
    urgent:    compile(cfg.URGENTE_PATTERNS),
    blocker:   compile(cfg.BLOQUEO_PATTERNS),
    epics:     compile(cfg.JIRA_EPICS),
    jiraAct:   compile(cfg.JIRA_ACTION_PATTERNS),
    noise:     compile(cfg.NOISE_PATTERNS),
    iniTags:   compile(cfg.INITIATIVE_TAGS),
    iniTeams:  compile(cfg.INITIATIVE_TEAMS),
    iniCtacts: compile(cfg.INICIATIVA_CONTACTS),
    onboard:   compile(cfg.ONBOARDING_LABELS),
    healthSnd: compile(cfg.HEALTH_SENDERS),
    healthSubj:compile(cfg.HEALTH_SUBJECTS),
    ceremonies: cfg.SCRUM_CEREMONIES.map(p => (str) => str.includes(normalize(p))),
    meetResp: [
      'accepted:', 'declined:', 'aceptado:', 'rechazado:', 'delegado:',
      'tentative:', 'accepted your', 'declined your', 'ha aceptado', 'ha rechazado', 'maybe:'
    ].map(p => (str) => str.includes(normalize(p))),
    sla: cfg.SLA_BY_TAG || DEFAULT_CONFIG.SLA_BY_TAG,
  };
}

let _compiled = compileConfig(DEFAULT_CONFIG);

/** Actualizar clasificador + filtros cuando llega config del Sheet */
export function applySheetConfig(motorRows, filterRows = []) {
  const parsed = parseSheetConfig(motorRows);
  _compiled = compileConfig(parsed);
  _filters  = parseFiltersConfig(filterRows);
  return parsed;
}

// ─── HELPERS DE ASUNTO ──────────────────────────────────────────
const cleanSubject = (s = '') => {
  return normalize(s)
    .replace(/^(re|rv|fw|fwd|re\[\d+\]|fwd\[\d+\]|aw|antw|resp|enc|tr|ref):\s*/gi, '')
    .replace(/\[.*?\]/g, '') // Quita [JIRA-123] o similares para agrupar mejor
    .trim();
};

const groupBySmartThread = (emails) => {
  const map = new Map();
  for (const e of emails) {
    const key = cleanSubject(e.subject);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
};

// Patrones para detectar inicio de mensaje citado
const QUOTE_BREAK_POINTS = [
  /(On|El|Escribió|Escribio).*?\d{1,2}.*?\d{4}.*?(wrote|escribió|escribio):/i,
  /(On|El|Escribió|Escribio).*?\d{1,2}.*? (wrote|escribió|escribio):/i,
  /[A-Z][a-záéíóúñ]+,\s+[A-Z][a-záéíóúñ].*? (escribió|escribio|wrote):/i,
  /\*?(De|From):\*?\s+[A-Z]/i,
  /\n\s*-+ Mensaje reenviado -+/i,
  /Para: Gomez, Miguel/i,
  /De: Fabiola Linares/i
];

// Podadora pura: solo limpia el texto actual, sin guillotina
const applyPodadora = (s = '') => s
  .replace(/[>|]{1,}/g, '')
  .replace(/\[cid:.*?\]/g, '')
  .replace(/&lt;.*?&gt;/g, '')
  .replace(/<.*?>/g, '')
  .replace(/_{10,}/g, '')
  .replace(/\*+/g, '')
  .replace(/(Obtener Outlook para|Enviado desde mi|Sent from my|Get Outlook for).*$/gim, '')
  .replace(/(Saludos|Atentamente|Cordial saludo|Gracias|Best regards),?.*$/gim, '')
  .replace(/(Agustin Amicone|Fabiola Linares|Miguel Gomez|Customer Service DA Hub|Price Waterhouse|Bouchard 557|C1106ABG|LinkedIn \| Instagram|En PwC trabajamos de manera flexible|Piensa antes de imprimir|Senior Associate|Advisory Email|Phone:).*$/gis, '')
  .replace(/Notice: This e-mail message and any files.*$/gis, '')
  .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
  .replace(/\+?\d[\d\s-]{8,}\d/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Parsea el mensaje en: texto principal + mensaje citado (si lo hay)
const parseMessage = (s = '') => {
  if (!s) return { mainText: '', quotedFrom: null, quotedText: null };

  let splitIndex = s.length;
  let hitPattern = null;

  for (const bp of QUOTE_BREAK_POINTS) {
    const match = s.match(bp);
    if (match && match.index < splitIndex) {
      splitIndex = match.index;
      hitPattern = match[0];
    }
  }

  if (splitIndex === s.length) {
    // No hay mensaje citado, solo limpiar
    return { mainText: applyPodadora(s), quotedFrom: null, quotedText: null };
  }

  const mainPart  = applyPodadora(s.substring(0, splitIndex));
  const quotedRaw = s.substring(splitIndex);

  // Extraer el nombre del autor buscando justo antes de "escribió:"
  const escribioIdx = quotedRaw.search(/(?:escribió|escribio|wrote):/i);
  let quotedFrom = 'Mensaje anterior';
  if (escribioIdx > 0) {
    const beforeWrote = quotedRaw.substring(0, escribioIdx);
    // Busca "Apellido, Nombre" cerca del final del fragmento
    const nameMatch = beforeWrote.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:,\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+?)?)\s*\(?[<(&]/);
    if (nameMatch) quotedFrom = nameMatch[1].trim();
  }

  // Extraer el texto del mensaje citado (lo que va después de "escribió:")
  const bodyMatch = quotedRaw.match(/(?:escribió|escribio|wrote):\s*(.+)/is);
  const quotedText = bodyMatch 
    ? applyPodadora(bodyMatch[1]).substring(0, 280) // Máximo 280 chars de contexto
    : applyPodadora(quotedRaw).substring(0, 280);

  console.log(`💬 Citado detectado de: "${quotedFrom}"`);
  return { mainText: mainPart, quotedFrom: quotedFrom.trim(), quotedText };
};

// Compatibilidad hacia atrás: cleanSnippet ahora extrae solo el texto principal
const cleanSnippet = (s = '') => parseMessage(s).mainText;

const isMeetingNoise = (email) => {
  const s = normalize(email.subject || '');
  const f = normalize(email.from    || '');
  
  // Patrones ultra-comunes de ruido de calendario y notificaciones automáticas
  const noisePatterns = [
    'aceptado:', 'rechazado:', 'tentativo:', 'provisional:', 'delegado:', 'aceptada:', 'rechazada:',
    'accepted:', 'declined:', 'tentative:', 'provisional:', 'delegated:',
    'accepted your', 'declined your', 'tentative your', 'invitacion de calendario',
    'updated invitation', 'new invitation', 'has accepted', 'has declined',
    'invitation:', 'canceled:', 'cancelado:', 'cancelada:', 'notas:', 'delivery status notification',
    'invitación:', 'invitacion:', 'rechazado (ausente):', 'respuesta automática:', 'automatic reply:'
  ];

  const isResp = noisePatterns.some(p => s.includes(p)) || 
                 f.includes('calendar-notification') || 
                 f.includes('google.com/calendar') ||
                 f.includes('gemini-notes@google.com') ||
                 f.includes('mailer-daemon@') ||
                 f.includes('no-reply@') ||
                 f.includes('noreply@') ||
                 f.includes('openai.com') ||
                 f.includes('miro.com') ||
                 f.includes('wellhub.com') ||
                 f.includes('sync2cal.com');

  if (isResp) return true;

  // Si no es una respuesta automática, pero es una ceremonia, la dejamos pasar
  if (_compiled.ceremonies.some(fn => fn(s))) return false;

  return f.includes('zoom') || f.includes('google meet');
};

// ─── PROCESADOR PRINCIPAL ────────────────────────────────────────
export function processSmartInbox(emails = [], options = {}) {
  const { userEmail = 'bossvald@flink.com.ar' } = options;
  const sla = _compiled.sla;

  // 1. Filtrado inicial (descartar lo que no sirve)
  const usefulEmails = emails.filter(email => {
    const filterResult = applyFilters(email);
    if (filterResult === 'IGNORAR') {
      console.log(`🚫 SmartInbox: Ignorando "${email.subject}" por regla de filtro.`);
      return false;
    }
    if (isMeetingNoise(email)) return false;
    return true;
  });

  // 2. Agrupamiento por hilo inteligente
  const threads = groupBySmartThread(usefulEmails);
  
  const result = {
    urgentes: [], bloqueados: [], jira: [], jiraFyi: [],
    initiatives: [], health: [], support: [], infoItems: [],
    urgentCount: 0
  };

  for (const [subjectKey, threadEmails] of threads.entries()) {
    // Ordenar mensajes del hilo por fecha
    const sorted = [...threadEmails].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    const first  = sorted[0];
    
    // Determinar quién tiene el turno
    const lastSender = normalize(latest.from || '');
    const userEm     = normalize(userEmail);
    const isWaitingMyAction = !lastSender.includes(userEm);

    // Metadata del hilo
    const threadData = {
      id: latest.id,
      threadId: latest.threadId || subjectKey,
      subject: first.subject,
      from: latest.from,
      date: latest.date,
      snippet: cleanSnippet(latest.snippet), // Google snippet: ya viene limpio y sin texto citado
      totalMessages: sorted.length,
      messages: sorted.map(m => { 
        const parsed = parseMessage(m.body || m.snippet);
        return {
          from: m.from, 
          snippet: parsed.mainText,
          quotedFrom: parsed.quotedFrom,
          quotedText: parsed.quotedText,
          date: m.date 
        };
      }),
      responseStatus: isWaitingMyAction ? 'WAITING' : 'RESPONDED',
      _timeBucket: getTimeBucket(latest.date),
      isStale: calcIsStale(latest.date, isWaitingMyAction, 3), // 3 días SLA default
    };

    const fullText = sorted.map(e => `${e.subject} ${e.from} ${e.snippet}`).join(' ');

    // ── 3. Clasificación del Hilo ─────────────────────────────────
    
    // Health (siempre aparte)
    if (_compiled.healthSnd.some(p => p.test(normalize(latest.from))) || 
        _compiled.healthSubj.some(p => p.test(normalize(latest.subject)))) {
      result.health.push(threadData);
      continue;
    }

    // Urgente / Bloqueo
    if (_compiled.urgent.some(p => p.test(normalize(fullText)))) {
      threadData._tag = 'URGENTE';
      threadData.isStale = calcIsStale(latest.date, isWaitingMyAction, sla.URGENTE);
      result.urgentes.push(threadData);
      continue;
    }

    if (_compiled.blocker.some(p => p.test(normalize(fullText)))) {
      threadData._tag = 'BLOQUEO';
      threadData.isStale = calcIsStale(latest.date, isWaitingMyAction, sla.BLOQUEO);
      result.bloqueados.push(threadData);
      continue;
    }

    // Jira
    const isJira = threadEmails.some(e => normalize(e.from).includes('jira') || normalize(e.from).includes('atlassian'));
    if (isJira) {
      const ticketId = extractTicketId(first.subject);
      const requiresAction = isWaitingMyAction || fullText.includes('bossvald'); 
      threadData._tag = requiresAction ? 'JIRA' : 'JIRA-FYI';
      threadData.ticketId = ticketId;
      threadData.link = buildJiraLink(ticketId);
      if (requiresAction) result.jira.push(threadData);
      else result.jiraFyi.push(threadData);
      continue;
    }

    // Iniciativas (aquí caen los Pedidos Experian)
    const isIni = _compiled.iniTags.some(p => p.test(normalize(fullText))) || 
                  _compiled.iniCtacts.some(p => p.test(normalize(latest.from)));
    
    // Mesa de Ayuda dedicada
    if (normalize(latest.from).includes('mimesadeayuda@gbsj.com.ar')) {
      threadData._tag = 'SOPORTE';
      result.support.push(threadData);
      continue;
    }

    if (isIni) {
      threadData._tag = 'INICIATIVA';
      result.initiatives.push(threadData);
      continue;
    }

    // Todo lo demás a Info
    result.infoItems.push({ ...threadData, _tag: 'INFO' });
  }

  // Ordenamientos finales
  result.urgentes.sort((a, b) => new Date(b.date) - new Date(a.date));
  result.initiatives.sort((a, b) => (a.responseStatus === 'WAITING' ? -1 : 1));

  // Mapeo final para que el Frontend (SmartInboxColumn.jsx) entienda los nombres
  return {
    urgent:      result.urgentes,
    blocked:     result.bloqueados,
    jira:        result.jira,
    jiraFyi:     result.jiraFyi,
    initiatives: result.initiatives,
    health:      result.health,
    support:     result.support,
    info:        result.infoItems,
    urgentCount: result.urgentCount,
    _meta: {
      totalProcessed: usefulEmails.length,
      threadsCount: threads.size
    }
  };
}

const detectOnboardingStatus = (emails) => {
  const tickets = new Map();
  const resolved = ['resuelto','resolved','done','cerrado','closed','completed'].map(normalize);
  for (const e of emails) {
    const tid = extractTicketId(e.subject);
    if (!tid) continue;
    const cn = normalize(`${e.subject} ${e.snippet||''}`);
    const isRes = resolved.some(p => cn.includes(p));
    if (!tickets.has(tid)) {
      tickets.set(tid, { ticketId: tid, subject: e.subject, link: buildJiraLink(tid), status: isRes ? 'RESOLVED' : 'PENDING', lastUpdate: e.date });
    } else if (isRes) { tickets.get(tid).status = 'RESOLVED'; }
  }
  const all = [...tickets.values()];
  return { tickets: all, total: all.length, resolved: all.filter(t => t.status==='RESOLVED').length, pending: all.filter(t => t.status==='PENDING').length, completionPct: all.length > 0 ? Math.round(all.filter(t => t.status==='RESOLVED').length / all.length * 100) : 0 };
};

export const selectors = {
  selectUrgentCount:        (inbox) => inbox?.urgentCount || 0,
  selectHasKPIAlerts:       (inbox) => inbox?.dailyKPIs?.hasAnyIssue || false,
  selectOnboardingPct:      (inbox) => inbox?.onboarding?.completionPct ?? null,
  selectWaitingInitiatives: (inbox) => inbox?.initiatives?.filter(i => i.responseStatus === 'WAITING') || [],
};
