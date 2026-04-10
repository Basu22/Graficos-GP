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

// ─── HELPERS ─────────────────────────────────────────────────────
const isMeetingNoise = (email) => {
  const s = normalize(email.subject || '');
  const f = normalize(email.from    || '');
  if (_compiled.ceremonies.some(fn => fn(s))) return false;
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
  const sla = _compiled.sla;

  for (const email of emails) {
    // ── 0. PIPELINE DE FILTROS (Sheet pestaña Filtros) ───────────
    const filterResult = applyFilters(email);
    if (filterResult === 'IGNORAR')   continue;   // descartado completamente
    if (filterResult === 'SILENCIAR') {
      infoItems.push({ ...email, _tag: 'INFO', _reason: 'silenced' });
      continue;
    }
    if (filterResult === 'REBOTAR') {
      healthMails.push(email);                      // hoy solo HEALTH usa REBOTAR
      continue;
    }

    const sn   = normalize(email.subject  || '');
    const fn   = normalize(email.from     || '');
    const cn   = normalize((email.snippet || '') + ' ' + (email.body || ''));
    const full = `${sn} ${fn} ${cn}`;

    // ── 1. Ruido residual de reuniones (no capturado por filtros) ─
    if (isMeetingNoise(email)) {
      infoItems.push({ ...email, _tag: 'INFO', _reason: 'meeting_noise' });
      continue;
    }

    // ── 2. Reportes de salud (Health Monitor) ────────────────────
    const isHealth = _compiled.healthSnd.some(p => p.test(fn))
      || _compiled.healthSubj.some(p => p.test(sn));
    if (isHealth) { healthMails.push(email); continue; }

    // ── 3. URGENTE ────────────────────────────────────────────────
    if (_compiled.urgent.some(p => p.test(full)) || full.includes(`@${userN}`)) {
      urgentes.push({
        ...email, _tag: 'URGENTE',
        _timeBucket: getTimeBucket(email.date),
        isStale: calcIsStale(email.date, true, sla.URGENTE),
        ticketId: extractTicketId(email.subject),
      });
      continue;
    }

    // ── 4. BLOQUEO ────────────────────────────────────────────────
    if (_compiled.blocker.some(p => p.test(full))) {
      bloqueados.push({
        ...email, _tag: 'BLOQUEO',
        _timeBucket: getTimeBucket(email.date),
        isStale: calcIsStale(email.date, true, sla.BLOQUEO),
        ticketId: extractTicketId(email.subject),
      });
      continue;
    }

    // ── 5. JIRA / Ceremonias ──────────────────────────────────────
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
        isStale: calcIsStale(email.date, requiresAction, sla.JIRA),
        ticketId, link: buildJiraLink(ticketId),
      });
      continue;
    }

    // ── 6. Onboarding ─────────────────────────────────────────────
    if (_compiled.onboard.some(p => p.test(sn) || p.test(cn))) {
      onboarding.push(email);
      continue;
    }

    // ── 7. Iniciativas ────────────────────────────────────────────
    const isIni = _compiled.iniTags.some(p => p.test(sn) || p.test(cn))
      || _compiled.iniCtacts.some(p => p.test(fn));
    if (isIni) { initiatives.push(email); continue; }

    infoItems.push({ ...email, _tag: 'INFO', _reason: 'unclassified' });
  }

  // Hilos de iniciativas
  const threads = groupByThread(initiatives);
  const initiativeCards = [];
  for (const [threadKey, threadEmails] of threads.entries()) {
    const sorted   = [...threadEmails].sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
    const original = sorted[0];
    const { hasResponse, respondingTeam, responseEmail } = detectTeamResponse(sorted.slice(1));
    const tag = (_compiled.iniTags.find(p => p.test(normalize(original.subject||'')))?.raw) || 'iniciativa';
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
      isStale: calcIsStale(original.date, isWaiting, sla.INICIATIVA),
    });
  }

  // Onboarding
  const onboardingStatus = onboarding.length > 0 ? detectOnboardingStatus(onboarding) : null;

  // Ordenamientos
  urgentes.sort((a, b) => new Date(b.date||0) - new Date(a.date||0));
  bloqueados.sort((a, b) => new Date(a.date||0) - new Date(b.date||0));
  jiraItems.sort((a, b) => {
    if (a._type === 'action' && b._type !== 'action') return -1;
    if (a._type !== 'action' && b._type === 'action') return  1;
    return new Date(b.date||0) - new Date(a.date||0);
  });
  initiativeCards.sort((a, b) => {
    if (a.responseStatus === 'WAITING' && b.responseStatus !== 'WAITING') return -1;
    if (a.responseStatus !== 'WAITING' && b.responseStatus === 'WAITING') return  1;
    return 0;
  });

  return {
    urgentes, bloqueados, jira: jiraItems, health: healthMails,
    initiatives: initiativeCards, infoItems,
    onboarding: onboardingStatus,
    dailyKPIs: null,
    urgentCount: urgentes.length + bloqueados.length,
    _meta: {
      totalProcessed: emails.length,
      processedAt: new Date().toISOString(),
      filtersApplied: {
        ignorar:  _filters.ignorar.length,
        silenciar:_filters.silenciar.length,
        rebotar:  _filters.rebotar.length,
      },
      counts: {
        urgentes: urgentes.length, bloqueados: bloqueados.length,
        jira: jiraItems.length, health: healthMails.length,
        initiatives: initiativeCards.length, info: infoItems.length,
      },
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
