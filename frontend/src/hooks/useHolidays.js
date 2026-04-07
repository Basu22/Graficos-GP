/**
 * useHolidays – Custom Hook
 * Obtiene los feriados de Argentina desde nolaborables.com.ar
 * Calcula cuántos días faltan para el próximo feriado y su nombre.
 * Maneja Pascuas y feriados puente (fechas móviles).
 */
import { useState, useEffect } from "react";

// Calcula la fecha de Pascuas con el algoritmo de Butcher-Meeus
function calcularPascuas(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1=ene ... 12=dic
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados fijos Argentina (MM-DD)
const FERIADOS_FIJOS = [
  { mes: 1,  dia: 1,  nombre: "Año Nuevo" },
  { mes: 2,  dia: 24, nombre: "Carnaval" },           // aproximado – se sobreescribe con API
  { mes: 2,  dia: 25, nombre: "Carnaval" },
  { mes: 3,  dia: 24, nombre: "Día de la Memoria" },
  { mes: 4,  dia: 2,  nombre: "Malvinas" },
  { mes: 5,  dia: 1,  nombre: "Día del Trabajador" },
  { mes: 5,  dia: 25, nombre: "Revolución de Mayo" },
  { mes: 6,  dia: 20, nombre: "Paso a la Inmortalidad del Gral. Güemes" },
  { mes: 7,  dia: 9,  nombre: "Día de la Independencia" },
  { mes: 8,  dia: 17, nombre: "Paso a la Inmortalidad del Gral. San Martín" },
  { mes: 10, dia: 12, nombre: "Día del Respeto a la Diversidad Cultural" },
  { mes: 11, dia: 20, nombre: "Día de la Soberanía Nacional" },
  { mes: 12, dia: 8,  nombre: "Inmaculada Concepción" },
  { mes: 12, dia: 25, nombre: "Navidad" },
];

// Formatea una fecha como "YYYY-MM-DD" para comparar
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useHolidays() {
  const [holidays, setHolidays] = useState([]); // [{ date: "YYYY-MM-DD", name: string }]
  const [nextHoliday, setNextHoliday] = useState(null); // { name, daysLeft, date }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const year = new Date().getFullYear();

    async function fetchHolidays() {
      setLoading(true);
      try {
        // 1. Intentar la API pública
        const res = await fetch(
          `https://nolaborables.com.ar/api/v2/feriados/${year}`
        );
        if (!res.ok) throw new Error("API no disponible");
        const data = await res.json();

        // La API devuelve: [{ dia, mes, motivo, tipo }, ...]
        const fromApi = data.map((f) => ({
          date: toKey(new Date(year, f.mes - 1, f.dia)),
          name: f.motivo,
        }));

        buildAndSet(fromApi);
      } catch (err) {
        // 2. Fallback: calcular Pascuas + fijos hardcodeados
        console.warn("Feriados API falló, usando fallback:", err.message);
        const pascuas = calcularPascuas(year);
        const viernesSanto = new Date(pascuas);
        viernesSanto.setDate(pascuas.getDate() - 2);

        const fallback = [
          ...FERIADOS_FIJOS.map((f) => ({
            date: toKey(new Date(year, f.mes - 1, f.dia)),
            name: f.nombre,
          })),
          { date: toKey(viernesSanto), name: "Viernes Santo" },
          { date: toKey(pascuas), name: "Pascuas" },
        ];

        buildAndSet(fallback);
        setError("Usando feriados offline");
      } finally {
        setLoading(false);
      }
    }

    function buildAndSet(list) {
      // Ordenar cronológicamente
      const sorted = list
        .map((h) => ({ ...h, dateObj: new Date(h.date + "T00:00:00") }))
        .sort((a, b) => a.dateObj - b.dateObj);

      setHolidays(sorted);

      // Calcular próximo feriado
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const coming = sorted.find((h) => h.dateObj >= today);
      if (coming) {
        const diffMs = coming.dateObj - today;
        const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));
        setNextHoliday({
          name: coming.name,
          daysLeft,
          date: coming.date,
          isToday: daysLeft === 0,
        });
      }
    }

    fetchHolidays();
  }, []);

  /**
   * Inyecta { isHoliday, holidayName } en cada workDay del array LUN-VIE.
   * Recibe: [{ label, index }] donde index es 1=Lun ... 5=Vie
   * Retorna: [{ label, index, isHoliday, holidayName }]
   */
  function injectHolidays(workDays, getDateForWeekday) {
    const holidayMap = {};
    holidays.forEach((h) => { holidayMap[h.date] = h.name; });

    return workDays.map((day) => {
      const dayNum = getDateForWeekday(day.index);
      const today = new Date();
      const diff = day.index - today.getDay();
      const d = new Date(today);
      d.setDate(today.getDate() + diff);
      const key = toKey(d);
      return {
        ...day,
        isHoliday: Boolean(holidayMap[key]),
        holidayName: holidayMap[key] || null,
      };
    });
  }

  return { holidays, nextHoliday, loading, error, injectHolidays };
}
