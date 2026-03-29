import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

// Obligamos al navegador a adjuntar las cookies de Cloudflare SIEMPRE
const api = axios.create({ 
  baseURL: BASE_URL,
  withCredentials: true 
});

let isReloading = false;

// Interceptor mágico para Cloudflare Access
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si la sesión de Cloudflare vence, hace un Redirect (302) a un dominio cruzado.
    if (!isReloading && error.message === "Network Error" && !error.response) {
      isReloading = true;
      console.warn("Cloudflare rebotó la petición. Obligando a enviar credenciales con F5...");
      setTimeout(() => window.location.reload(), 500);
    }
    
    if (!isReloading && error.response && [401, 403].includes(error.response.status)) {
      isReloading = true;
      setTimeout(() => window.location.reload(), 500);
    }
    return Promise.reject(error);
  }
);


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
