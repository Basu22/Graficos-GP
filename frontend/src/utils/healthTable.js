const PRODUCT_DEFS = [
  {"key": "haberes",   "label": "Adelanto de Haberes"},
  {"key": "prestamos", "label": "Oferta Préstamos"},
  {"key": "cch",       "label": "Oferta Tarjeta – CCH"},
  {"key": "csh",       "label": "Oferta Tarjeta – CSH"},
  {"key": "nc",        "label": "Oferta Tarjeta – NC"}
];

const BANKS = ["BSF", "BER", "BSJ", "BSC"];

function calcDiff(curr, prev) {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10; // Redondeo a 1 decimal
}

export function buildHealthTableData(rawDays, allDays, targetDate) {
  if (!allDays || allDays.length === 0 || !rawDays) {
    return { tableRows: [], hasAnyIssue: false, latestDate: null, previousDate: null, banks: BANKS };
  }

  if (!targetDate || !allDays.includes(targetDate)) {
    targetDate = allDays[0];
  }

  const idx = allDays.indexOf(targetDate);
  const latestDate = targetDate;
  const previousDate = idx + 1 < allDays.length ? allDays[idx + 1] : null;

  const latestDay = { ...(rawDays[latestDate] || {}) };
  const prevDay = previousDate ? { ...(rawDays[previousDate] || {}) } : {};

  // Historial para fallbacks
  const bankHistory = {};
  for (let i = idx; i < allDays.length; i++) {
    const d = allDays[i];
    for (const bank of Object.keys(rawDays[d] || {})) {
      if (!bankHistory[bank] && rawDays[d][bank]) {
        bankHistory[bank] = rawDays[d][bank];
      }
    }
  }

  const bankPrevHistory = {};
  if (previousDate) {
    for (let i = idx + 1; i < allDays.length; i++) {
      const d = allDays[i];
      for (const bank of Object.keys(rawDays[d] || {})) {
        if (!bankPrevHistory[bank] && rawDays[d][bank]) {
          bankPrevHistory[bank] = rawDays[d][bank];
        }
      }
    }
  }

  for (const bank of BANKS) {
    if (!latestDay[bank] && bankHistory[bank]) latestDay[bank] = bankHistory[bank];
    if (!prevDay[bank] && bankPrevHistory[bank]) prevDay[bank] = bankPrevHistory[bank];
  }

  const fallbackBanks = new Set();
  const rawLatest = rawDays[latestDate] || {};
  for (const bank of BANKS) {
    if (!rawLatest[bank] && latestDay[bank]) fallbackBanks.add(bank);
  }

  const tableRows = [];
  let hasAnyIssue = false;

  for (const prodDef of PRODUCT_DEFS) {
    const pk = prodDef.key;
    const row = { key: pk, label: prodDef.label, banks: {}, total_current: 0, total_previous: 0 };
    for (const bank of BANKS) {
      const curr = (latestDay[bank] || {})[pk] || 0;
      const prev = (prevDay[bank] || {})[pk] || 0;
      const diff = calcDiff(curr, prev);
      row.banks[bank] = { current: curr, previous: prev, diff, isFallback: fallbackBanks.has(bank) };
      row.total_current += curr;
      row.total_previous += prev;
    }
    row.total_diff = calcDiff(row.total_current, row.total_previous);
    if (row.total_diff !== null && row.total_diff < -5) hasAnyIssue = true;
    if (row.total_current > 0 || row.total_previous > 0) {
      tableRows.push(row);
    }
  }

  // Info de ingesta por banco para el día visualizado
  const ingestaInfo = {};
  for (const bank of BANKS) {
    const bd = (rawDays[latestDate] || {})[bank];
    ingestaInfo[bank] = bd?.info_ingesta || null;
  }

  return { tableRows, hasAnyIssue, latestDate, previousDate, banks: BANKS, ingestaInfo };
}
