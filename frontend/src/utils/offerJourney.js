
/**
 * Procesa los datos brutos de health_store.json para las gráficas de Recharts.
 * @param {Object} rawDays - El objeto con fecha -> bancos -> productos
 * @param {Array} allDays - Lista ordenada de fechas (YYYY-MM-DD)
 * @param {String} productKey - El producto a analizar (haberes, prestamos, etc)
 * @param {Array} selectedBanks - Bancos a incluir
 */
export function prepareTimelineData(rawDays, allDays, selectedProducts = ["haberes"], selectedBanks = ["BSF", "BER", "BSJ", "BSC"]) {
  if (!rawDays || !allDays) return [];

  // Ordenamos cronológicamente para el gráfico (ascendente)
  const sortedDays = [...allDays].sort();

  return sortedDays.map(date => {
    const dayData = rawDays[date] || {};
    const point = { date };
    
    selectedBanks.forEach(bank => {
      const bankData = dayData[bank] || {};
      let totalValue = 0;
      selectedProducts.forEach(prod => {
        totalValue += (bankData[prod] || 0);
      });
      point[bank] = totalValue;
      // Guardamos el tipo de ingesta para tooltips (tomamos el del último producto sumado, suele ser el mismo por banco)
      point[`${bank}_tipo`] = bankData.info_ingesta?.tipo || 'primer_servicio';
      // Guardamos el comentario analítico si existe
      point[`${bank}_comment`] = bankData.analisis_diario || null;
    });

    // Guardamos el análisis global (analisis_mail) si existe
    point.daily_analysis = dayData.info_ingesta?.analisis_mail || null;

    return point;
  });
}

/**
 * Obtiene la lista de meses disponibles en los datos
 */
export function getAvailableMonths(allDays) {
  if (!allDays) return [];
  const months = new Set(allDays.map(d => d.substring(0, 7)));
  return Array.from(months).sort().reverse().map(m => {
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return { id: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

/**
 * Agrupa los datos por mes, calculando el promedio de cada banco/producto en ese mes.
 */
export function aggregateByMonth(rawDays, allDays, selectedBanks, selectedProducts) {
  if (!rawDays || !allDays) return [];

  const monthlySums = {};
  const monthlyCounts = {};

  allDays.forEach(date => {
    const month = date.substring(0, 7);
    if (!monthlySums[month]) {
      monthlySums[month] = {};
      monthlyCounts[month] = 0;
      selectedBanks.forEach(b => monthlySums[month][b] = 0);
    }

    monthlyCounts[month]++;
    const dayData = rawDays[date] || {};

    selectedBanks.forEach(bank => {
      const bankData = dayData[bank] || {};
      let totalValue = 0;
      selectedProducts.forEach(prod => {
        totalValue += (bankData[prod] || 0);
      });
      monthlySums[month][bank] += totalValue;
    });
  });

  const result = Object.keys(monthlySums).sort().map(month => {
    const point = { month };
    selectedBanks.forEach(bank => {
      point[bank] = Math.round(monthlySums[month][bank] / monthlyCounts[month]);
    });
    return point;
  });

  return result;
}

/**
 * Calcula los deltas % entre meses.
 * @param {Array} monthlyData - Salida de aggregateByMonth (ordenada cronológicamente)
 * @param {Array} selectedBanks
 */
export function calcMonthlyDeltas(monthlyData, selectedBanks) {
  if (!monthlyData || monthlyData.length < 2) return [];

  const deltas = [];
  for (let i = 1; i < monthlyData.length; i++) {
    const prevMonth = monthlyData[i - 1];
    const currentMonth = monthlyData[i];
    const deltaPoint = { month: currentMonth.month };
    
    selectedBanks.forEach(bank => {
      const prevVal = prevMonth[bank] || 0;
      const currVal = currentMonth[bank] || 0;
      if (prevVal === 0) {
        deltaPoint[bank] = 0;
      } else {
        deltaPoint[bank] = Number((((currVal - prevVal) / prevVal) * 100).toFixed(2));
      }
    });
    deltas.push(deltaPoint);
  }
  return deltas;
}


export const PRODUCT_LABELS = {
  haberes: "Adelanto de Haberes",
  prestamos: "Oferta Préstamos",
  cch: "Oferta Tarjeta – CCH",
  csh: "Oferta Tarjeta – CSH",
  nc: "Oferta Tarjeta – NC"
};

export const BANK_COLORS = {
  BSF: "#3B82F6", // Blue
  BER: "#10B981", // Green
  BSJ: "#F59E0B", // Amber
  BSC: "#EF4444", // Red
};
