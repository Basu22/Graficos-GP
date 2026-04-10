/**
 * useSmartInbox – Hook con config dinámica desde Google Sheets
 * y análisis avanzado de salud (BSF/BER/BSC/BSJ con productos CCH/CSH/NC).
 */
import { useMemo, useState, useEffect, useCallback } from "react";
import { processSmartInbox, selectors, applySheetConfig } from "../utils/smartInbox";
import { API } from "../constants";

// En localhost usamos ruta relativa para que el proxy de Vite evite CORS
const BACKEND = window.location.hostname === 'localhost'
  ? '/api/v1'
  : API;


export function useSmartInbox(emailsOrGroups = [], userInfo = {}) {

  const [healthReport, setHealthReport] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ── Normalizar entrada ─────────────────────────────────────────
  const allEmails = useMemo(() => {
    if (Array.isArray(emailsOrGroups)) return emailsOrGroups;
    return Object.entries(emailsOrGroups).flatMap(([key, group]) =>
      (group.items || []).map(e => ({ ...e, labels: e.labels || [key] }))
    );
  }, [emailsOrGroups]);

  // ── Cargar config desde Google Sheets (una vez por sesión) ─────
  useEffect(() => {
    if (configLoaded) return;
    const loadConfig = async () => {
      try {
        const res = await fetch(`${BACKEND}/midia/inbox-config`);
        if (!res.ok) throw new Error("Sheet no disponible");
        const { config, filters = [] } = await res.json();
        applySheetConfig(config, filters);
        setConfigLoaded(true);
        console.log(`✅ Smart Inbox config cargada (${config.length} reglas motor, ${filters.length} filtros)`);
      } catch (e) {
        console.warn("⚠️ Usando criterios por defecto (Sheet no disponible):", e.message);
        setConfigLoaded(true);
      }
    };
    loadConfig();
  }, [configLoaded]);

  // ── Procesar emails ────────────────────────────────────────────
  const smartInbox = useMemo(() => {
    if (allEmails.length === 0) return null;
    return processSmartInbox(allEmails, {
      userName:  userInfo.userName  || "Basilio Ossvald",
      userEmail: userInfo.userEmail || "bossvald@flink.com.ar",
    });
  }, [allEmails, userInfo.userName, userInfo.userEmail, configLoaded]);

  // ── Análisis de Salud (comparar últimos 2 reportes + IA) ───────
  const fetchHealthReport = useCallback(async () => {
    if (allEmails.length === 0) return;
    setLoadingHealth(true);
    try {
      const res = await fetch(`${BACKEND}/midia/health-report/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allEmails),
      });
      if (!res.ok) throw new Error("Error en análisis de salud");
      const data = await res.json();
      setHealthReport(data);
    } catch (e) {
      console.warn("Health report analysis failed:", e.message);
    }
    setLoadingHealth(false);
  }, [allEmails]);

  // Disparar análisis cuando llegan emails
  useEffect(() => {
    if (allEmails.length > 0 && !healthReport && !loadingHealth) {
      fetchHealthReport();
    }
  }, [allEmails.length, fetchHealthReport]);

  return {
    smartInbox: smartInbox ? { ...smartInbox, healthReport } : null,
    healthReport,
    loadingHealth,
    configLoaded,
    urgentCount:         selectors.selectUrgentCount(smartInbox),
    hasKPIAlerts:        healthReport?.hasAnyIssue || false,
    onboardingPct:       selectors.selectOnboardingPct(smartInbox),
    waitingInitiatives:  selectors.selectWaitingInitiatives(smartInbox),
    refreshHealthReport: fetchHealthReport,
  };
}
