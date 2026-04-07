/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║     SMART INBOX — Motor de Decisiones (config dinámica)      ║
 * ║  Los criterios se cargan desde Google Sheets en runtime.     ║
 * ║  Fallback a criterios hardcodeados si el Sheet no responde.  ║
 * ╚══════════════════════════════════════════════════════════════╝
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

const calcIsStale = (dateStr, isPending) => {
  if (!isPending || !dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) / 86400000 > 3;
};

// ─── CRITERIOS FALLBACK (si el Sheet no responde) ─────────────────
export const DEFAULT_CONFIG = {
  URGENTE_PATTERNS: [
    '@basilio', 'menciona a basilio', 'accionable', 'acciones pendientes',
    'fecha limite', 'fecha límite', 'urgente', 'urgent',
    'validacion de accesos', 'validación de accesos',
    'capacitacion experian', 'capacitación experian',
    // Emails de contactos bancarios que generan urgencias
    'amayo@bancosanjuan.com', 'ruccia@bancosantafe.com.ar', 'sosar@bancosantafe.com.ar',
    'msalas@bancosanjuan.com', 'mmallaviabarrena@bancosanjuan.com',
    'mbonocore@bancosanjuan.com', 'vachillini@bancosanjuan.com',
    'ptomasini@bancosanjuan.com', 'erika.roude@bancoentrerios.com.ar',
    'ayelen', 'ayelén', 'necesito que', 'podés revisar', 'me confirmás',
  ],
  BLOQUEO_PATTERNS: [
    'comite rei', 'comité rei',
    'fabian.urchueguia@bancoentrerios.com.ar', 'jmuller@bancosanjuan.com',
    'comite de implementacion', 'comité de implementación',
    'motor comercial', 'subida a produccion', 'subida a producción',
    'sergio isaguirre', 'fix tecnico', 'fix técnico',
    'esperando respuesta', 'bloqueado por',
  ],
  JIRA_EPICS: ['rei', 'motor v4', 'ingresos minimos', 'ingresos mínimos', 'experian'],
  HEALTH_SENDERS: ['santiago travi', 'stravi', 'operativagobdato'],
  HEALTH_SUBJECTS: ['estado de ofertas', 'reporte diario', 'detalle de ofertas'],
  INICIATIVA_CONTACTS: [
    'amayo@bancosanjuan.com', 'ruccia@bancosantafe.com.ar', 'sosar@bancosantafe.com.ar',
    'msalas@bancosanjuan.com', 'mmallaviabarrena@bancosanjuan.com',
    'mbonocore@bancosanjuan.com', 'vachillini@bancosanjuan.com',
    'ptomasini@bancosanjuan.com', 'erika.roude@bancoentrerios.com.ar',
  ],
  INITIATIVE_TAGS:  ['riesgos', 'segmentos', 'negocio', 'producto', 'iniciativa', 'roadmap'],
  INITIATIVE_TEAMS: ['back', 'datos', 'agilidad', 'frontend', 'data', 'devops'],
  ONBOARDING_LABELS: ['mda', 'onboarding', 'accesos'],
  JIRA_ACTION_PATTERNS: [
    'mentioned you', 'te mencionó', 'assigned to you', 'asignado a vos',
    'action required', 'needs your', 'waiting on you', 'acciones pendientes',
    '@basilio',
  ],
  NOISE_PATTERNS: [
    'confluence', 'wiki actualizado', 'page updated', 'document updated',
    'aceptado:', 'rechazado:', 'delegado:', 'accepted:', 'declined:',
    'tentative:', 'maybe:', 'ha aceptado', 'ha rechazado',
  ],
  SCRUM_CEREMONIES: ['review', 'planning', 'retrospectiva', 'retro', 'sprint'],
};

// ─── PARSER DE CONFIG DESDE SHEETS ───────────────────────────────
/**
 * Parsea las filas del Sheet en un objeto de config compatible con DEFAULT_CONFIG.
 * El sheet tiene columnas: Nivel, Tag, Criterio
 * El criterio es texto libre del cual extraemos emails y keywords.
 */
export function parseSheetConfig(rows = []) {
  const emailRe  = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const findRow = (tagFragment) =>
    rows.find(r => normalize(r.Tag || '').includes(normalize(tagFragment)));

  const extractEmails = (text = '') => [...new Set((text.match(emailRe) || []).map(normalize))];
  const extractKeywords = (text = '') =>
    text.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 3 && !s.includes('@'))
        .map(normalize);

  const urgRow  = findRow('urgente');
  const bloqRow = findRow('bloqueo');
  const iniRow  = findRow('iniciativa');

  const urgEmails  = urgRow  ? extractEmails(urgRow.Criterio  || '') : [];
  const urgKws     = urgRow  ? extractKeywords(urgRow.Criterio  || '') : [];
  const bloqEmails = bloqRow ? extractEmails(bloqRow.Criterio || '') : [];
  const bloqKws    = bloqRow ? extractKeywords(bloqRow.Criterio || '') : [];
  const iniEmails  = iniRow  ? extractEmails(iniRow.Criterio  || '') : [];

  return {
    ...DEFAULT_CONFIG,
    URGENTE_PATTERNS: [...new Set([...DEFAULT_CONFIG.URGENTE_PATTERNS, ...urgEmails, ...urgKws])],
    BLOQUEO_PATTERNS: [...new Set([...DEFAULT_CONFIG.BLOQUEO_PATTERNS, ...bloqEmails, ...bloqKws])],
    INICIATIVA_CONTACTS: [...new Set([...DEFAULT_CONFIG.INICIATIVA_CONTACTS, ...iniEmails])],
    _sheetLoaded: true,
    _sheetRows: rows.length,
  };
}

// ─── PRE-COMPILACIÓN DE PATTERNS (O(1) en clasificación) ─────────
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
  };
}

// Compilado por defecto (usado mientras el sheet carga)
let _compiled = compileConfig(DEFAULT_CONFIG);

/** Actualizar definiciones cuando llega config del Sheet */
export function applySheetConfig(rows) {
  const parsed = parseSheetConfig(rows);
  _compiled = compileConfig(parsed);
  return parsed;
}

// ─── HELPERS ─────────────────────────────────────────────────────
const isMeetingNoise = (email) => {
  const s = normalize(email.subject || '');
  const f = normalize(email.from || '');
  if (_compiled.ceremonies.some(fn => fn(s))) return false; // ceremonias no son ruido
  return _compiled.meetResp.some(fn => fn(s)) || f.includes('zoom') || f.includes('google meet');
};

const groupByThread = (emails) => {
  const map = new Map();
  for (const e of emails) {
    const key = e.threadId || normalize(e.subject || '').slice(0, 60);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
};

const detectTeamResponse = (emails) => {
  for (const e of emails) {
    const f = normalize(e.from || '');
    const team = DEFAULT_CONFIG.INITIATIVE_TEAMS.find(t => f.includes(t));
    if (team) return { hasResponse: true, respondingTeam: team, responseEmail: e };
  }
  return { hasResponse: false, respondingTeam: null, responseEmail: null };
};

// ─── PROCESADOR PRINCIPAL ────────────────────────────────────────
export function processSmartInbox(emails = [], options = {}) {
  const { userName = 'Basilio Ossvald', userEmail = 'bossvald@flink.com.ar' } = options;
  const userN = normalize(userName.split(' ')[0]);

  const urgentes   = [];
  const bloqueados = [];
  const jiraItems  = [];
  const healthMails= [];
  const initiatives= [];
  const onboarding = [];
  const infoItems  = [];

  for (const email of emails) {
    const sn   = normalize(email.subject  || '');
    const fn   = normalize(email.from     || '');
    const cn   = normalize((email.snippet || '') + ' ' + (email.body || ''));
    const full = `${sn} ${fn} ${cn}`;

    // 0. Ruido calendario
    if (isMeetingNoise(email)) {
      infoItems.push({ ...email, _tag: 'INFO', _reason: 'meeting_noise' });
      continue;
    }
    // 1. Ruido explícito
    if (_compiled.noise.some(p => p.test(sn) || p.test(fn))) {
      infoItems.push({ ...email, _tag: 'INFO', _reason: 'noise' });
      continue;
    }

    // 2. Reportes de salud (Health Monitor)
    const isHealth = _compiled.healthSnd.some(p => p.test(fn))
      || _compiled.healthSubj.some(p => p.test(sn));
    if (isHealth) {
      healthMails.push(email);
      continue;
    }

    // 3. URGENTE
    if (_compiled.urgent.some(p => p.test(full)) || full.includes(`@${userN}`)) {
      urgentes.push({
        ...email, _tag: 'URGENTE',
        _timeBucket: getTimeBucket(email.date),
        isStale: calcIsStale(email.date, true),
        ticketId: extractTicketId(email.subject),
      });
      continue;
    }

    // 4. BLOQUEO
    if (_compiled.blocker.some(p => p.test(full))) {
      bloqueados.push({
        ...email, _tag: 'BLOQUEO',
        _timeBucket: getTimeBucket(email.date),
        isStale: calcIsStale(email.date, true),
        ticketId: extractTicketId(email.subject),
      });
      continue;
    }

    // 5. JIRA / Ceremonias
    const isJira = fn.includes('jira') || fn.includes('atlassian')
      || sn.includes('jira') || _compiled.epics.some(p => p.test(full));
    const isCeremony = _compiled.ceremonies.some(fn2 => fn2(sn));
    if (isJira || isCeremony) {
      const ticketId = extractTicketId(email.subject);
      const requiresAction = _compiled.jiraAct.some(p => p.test(full)) || full.includes(`@${userN}`);
      jiraItems.push({
        ...email,
        _tag: requiresAction ? 'JIRA' : 'JIRA-FYI',
        _type: requiresAction ? 'action' : 'fyi',
        _isCeremony: isCeremony && !isJira,
        _timeBucket: getTimeBucket(email.date),
        isStale: calcIsStale(email.date, requiresAction),
        ticketId, link: buildJiraLink(ticketId),
      });
      continue;
    }

    // 6. Onboarding MDA
    if (_compiled.onboard.some(p => p.test(sn) || p.test(cn))) {
      onboarding.push(email);
      continue;
    }

    // 7. Iniciativas (contactos bancarios o tags de iniciativa)
    const isIni = _compiled.iniTags.some(p => p.test(sn) || p.test(cn))
      || _compiled.iniCtacts.some(p => p.test(fn));
    if (isIni) {
      initiatives.push(email);
      continue;
    }

    infoItems.push({ ...email, _tag: 'INFO', _reason: 'unclassified' });
  }

  // Hilos de iniciativas
  const threads = groupByThread(initiatives);
  const initiativeCards = [];
  for (const [threadKey, threadEmails] of threads.entries()) {
    const sorted  = [...threadEmails].sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
    const original = sorted[0];
    const { hasResponse, respondingTeam, responseEmail } = detectTeamResponse(sorted.slice(1));
    const tag = DEFAULT_CONFIG.INITIATIVE_TAGS.find(t => normalize(original.subject||'').includes(t)) || 'iniciativa';
    const isWaiting = !hasResponse;
    initiativeCards.push({
      threadId: threadKey, tag,
      _tag: 'INICIATIVA',
      subject: original.subject, from: original.from, date: original.date,
      snippet: original.snippet,
      originalRequest: { id: original.id, from: original.from, snippet: original.snippet, date: original.date },
      responseStatus: isWaiting ? 'WAITING' : 'RESPONDED',
      respondingTeam: respondingTeam || null,
      lastResponse: responseEmail ? { from: responseEmail.from, snippet: responseEmail.snippet, date: responseEmail.date } : null,
      totalMessages: sorted.length,
      _timeBucket: getTimeBucket(original.date),
      isStale: calcIsStale(original.date, isWaiting),
    });
  }

  // Onboarding
  const onboardingStatus = onboarding.length > 0 ? detectOnboardingStatus(onboarding) : null;

  // Ordenamientos
  urgentes.sort((a, b) => new Date(b.date||0) - new Date(a.date||0));
  bloqueados.sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
  jiraItems.sort((a, b) => {
    if (a._type === 'action' && b._type !== 'action') return -1;
    if (a._type !== 'action' && b._type === 'action') return 1;
    return new Date(b.date||0) - new Date(a.date||0);
  });
  initiativeCards.sort((a, b) => {
    if (a.responseStatus === 'WAITING' && b.responseStatus !== 'WAITING') return -1;
    if (a.responseStatus !== 'WAITING' && b.responseStatus === 'WAITING') return 1;
    return 0;
  });

  return {
    urgentes, bloqueados, jira: jiraItems, health: healthMails,
    initiatives: initiativeCards, infoItems,
    onboarding: onboardingStatus,
    dailyKPIs: null, // Se llena async via /health-report/analyze
    urgentCount: urgentes.length + bloqueados.length,
    _meta: {
      totalProcessed: emails.length,
      processedAt: new Date().toISOString(),
      counts: { urgentes: urgentes.length, bloqueados: bloqueados.length, jira: jiraItems.length, health: healthMails.length, initiatives: initiativeCards.length, info: infoItems.length },
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
