# 🏃 Agility Dashboard

Dashboard interactivo de métricas ágiles conectado a Jira, construido con **FastAPI + React**.

## 📐 Arquitectura

```
agility-dashboard/
├── backend/                        # FastAPI
│   └── app/
│       ├── api/v1/endpoints/
│       │   ├── sprints.py          # GET /api/v1/sprints/
│       │   └── metrics.py          # GET /api/v1/metrics/*
│       ├── core/
│       │   ├── config.py           # Settings con pydantic-settings
│       │   └── jira_client.py      # Cliente HTTP para Jira (httpx + cache TTL)
│       ├── schemas/
│       │   └── metrics.py          # Pydantic response models
│       ├── services/
│       │   ├── sprint_helpers.py   # Utilidades compartidas
│       │   ├── velocity_service.py
│       │   ├── predictability_service.py
│       │   ├── lead_time_service.py
│       │   ├── scope_service.py
│       │   ├── carry_over_service.py
│       │   └── executive_service.py
│       └── main.py                 # App entry point + CORS
│
└── frontend/                       # React + Vite + Recharts
    └── src/
        ├── services/api.js         # Axios - llamadas al backend
        ├── hooks/useMetrics.js     # React Query hooks
        ├── components/
        │   ├── charts/             # VelocityChart, PredictabilityChart, etc.
        │   ├── dashboard/          # KPICard, DashboardHeader
        │   └── executive/          # ExecutiveSummary, StrategicSynthesis
        └── pages/
            ├── DashboardPage.jsx   # Vista 1: Performance Q1
            └── ExecutiveReportPage.jsx  # Vista 2: Reporte Ejecutivo
```

## 🚀 Setup rápido

### 1. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de Jira

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env

npm install
npm run dev
```

### 3. Con Docker Compose

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Editar ambos .env

docker-compose up --build
```

## 🔑 Variables de entorno (backend)

> ℹ️ Usamos **Jira Server / Data Center** con Personal Access Token (PAT). No usa usuario/contraseña de Jira Cloud.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `JIRA_BASE_URL` | URL de tu instancia Jira (sin slash final) | `https://jira.tu-empresa.com` |
| `JIRA_PAT` | Personal Access Token de Jira (generado en tu perfil) | `NjYwN...` |
| `JIRA_PROJECT_KEY` | Clave del proyecto | `BACK`, `FRONT`, `GP`, etc. |
| `CONFLUENCE_BASE_URL` | URL base de Confluence | `https://confluence.tu-empresa.com` |
| `CONFLUENCE_PAT` | Personal Access Token de Confluence | mismo que Jira en Data Center |
| `CONFLUENCE_PAGE_ID` | ID de la página donde se publica el reporte | `123456789` |
| `CACHE_TTL` | Cache en memoria, en segundos | `300` |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) | `http://localhost:5173` |

## 📊 Endpoints disponibles

| Método | Path | Descripción |
|---|---|---|
| GET | `/api/v1/sprints/` | Lista de sprints |
| GET | `/api/v1/metrics/velocity` | Velocidad por sprint |
| GET | `/api/v1/metrics/predictability` | Predictibilidad % Say/Do |
| GET | `/api/v1/metrics/lead-time` | Lead Time promedio |
| GET | `/api/v1/metrics/scope-change` | Cambio de alcance |
| GET | `/api/v1/metrics/carry-over` | Carry Over (pts no entregados) |
| GET | `/api/v1/metrics/executive-report` | Reporte ejecutivo completo |

**Parámetros opcionales** (todos los endpoints de métricas):
- `last_n=6` — últimos N sprints
- `sprint_ids=101&sprint_ids=102` — sprints específicos

## 📈 Métricas implementadas

- **Velocidad**: Story points comprometidos vs. entregados por sprint
- **Predictibilidad**: % Say/Do (delivered / committed)
- **Lead Time**: Días promedio desde creación hasta resolución
- **Cambio de Alcance**: Scope creep por sprint
- **Carry Over**: Puntos que pasan al siguiente sprint
- **Reporte Ejecutivo**: KPIs + síntesis estratégica automática

## 🧱 Stack tecnológico

**Backend:** Python 3.12, FastAPI, httpx, pydantic-settings, cachetools, python-dateutil

**Frontend:** React 18, Vite, Recharts, React Query, Axios, Tailwind CSS, React Router
