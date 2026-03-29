import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({ baseURL: BASE_URL });


// ── Sprints ──────────────────────────────────────────────────────────────────

export const getSprints = (state = "closed,active") =>
  api.get("/sprints/", { params: { state } }).then((r) => r.data);

// ── Métricas individuales ────────────────────────────────────────────────────

export const getVelocity = (params = {}) =>
  api.get("/metrics/velocity", { params }).then((r) => r.data);

export const getPredictability = (params = {}) =>
  api.get("/metrics/predictability", { params }).then((r) => r.data);

export const getLeadTime = (params = {}) =>
  api.get("/metrics/lead-time", { params }).then((r) => r.data);

export const getScopeChange = (params = {}) =>
  api.get("/metrics/scope-change", { params }).then((r) => r.data);

export const getCarryOver = (params = {}) =>
  api.get("/metrics/carry-over", { params }).then((r) => r.data);

// ── Reporte ejecutivo ────────────────────────────────────────────────────────

export const getExecutiveReport = (params = {}) =>
  api.get("/metrics/executive-report", { params }).then((r) => r.data);
