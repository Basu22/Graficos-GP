# 🛠️ Manual Técnico — Agility Dashboard

> **Versión:** 1.1 — Abril 2026  
> **Audiencia:** Desarrolladores, DevOps y equipo técnico  
> **⚠️ ACTUALIZACIÓN MANDATORIA:** Este documento DEBE actualizarse ante cualquier cambio en: esquema de datos, endpoints, lógica de negocio, tecnologías, librerías o arquitectura de despliegue. No hay excepciones.

---

## 1. Stack Tecnológico

### Backend
| Componente | Tecnología | Versión |
|---|---|---|
| Lenguaje | Python | 3.11+ |
| Framework API | FastAPI | 0.100+ |
| Servidor ASGI | Uvicorn | — |
| Validación de datos | Pydantic v2 | — |
| IA / Análisis | Google Gemini API | `gemini-1.5-flash` |
| Integración Google | Google API Python Client | — |
| Zona horaria | `datetime.timezone` UTC-3 | — |

### Frontend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework | React | 18 |
| Build Tool | Vite | 5+ |
| Gráficos | Recharts | 2.x |
| Estilos | Vanilla CSS (inline styles) | — |
| Peticiones HTTP | Fetch API nativa | — |

### Infraestructura
| Componente | Tecnología |
|---|---|
| Entorno local | `start-dev-local.sh` (Uvicorn + Vite) |
| Contenedores prod | Docker + Docker Compose (Unificado) |
| Servidor prod | Raspberry Pi 4 (8GB RAM) |
| Proxy inverso prod | Nginx (Container: `proxy_unificado`) |
| Dominio externo | Cloudflare Tunnel → `graficosagiles.site` |
| Coexistencia | Comparte proxy con proyecto 'Gastos Familia' |

---

## 2. Estructura del Proyecto

```
Graficos-GP/
├── backend/
│   └── app/
│       ├── api/v1/endpoints/
│       │   └── midia.py          # Endpoints de salud y comentarios
│       ├── core/
│       │   └── config.py         # Settings (env vars, CORS)
│       ├── data/
│       │   ├── health_store.json # 🗄️ Base de datos principal (JSON flat-file)
│       │   ├── people.json       # Datos del equipo
│       │   └── calendar_events.json
│       ├── services/
│       │   ├── health_store.py   # Lógica de persistencia del monitor de salud
│       │   ├── gemini_service.py # Integración con Gemini IA
│       │   ├── google_service.py # Gmail + Calendar API
│       │   └── ...               # Otros servicios (sprints, métricas, etc.)
│       └── main.py               # Punto de entrada FastAPI
├── frontend/
│   └── src/
│       ├── App.jsx               # Componente raíz + routing de pestañas
│       ├── views/
│       │   ├── MiDia.jsx         # Vista principal diaria
│       │   ├── OfferJourney.jsx  # Journey de Ofertas (gráficos + comentarios)
│       │   ├── DashboardPerformance.jsx
│       │   ├── CalendarView.jsx
│       │   ├── SprintEnCurso.jsx
│       │   ├── TeamView.jsx
│       │   └── ReporteEjecutivo.jsx
│       ├── hooks/
│       │   ├── useSmartInbox.js  # Orquestador principal de datos
│       │   ├── useHolidays.js    # Feriados (API externa + fallback local)
│       │   └── useMetrics.js
│       ├── utils/
│       │   ├── offerJourney.js   # Funciones de transformación de datos para gráficos
│       │   └── smartInbox.js     # Motor de clasificación de correos
│       └── constants/
│           └── index.js          # API base URL y otras constantes
├── docs/
│   ├── MANUAL_FUNCIONAL.md       # Este documento + el funcional
│   └── MANUAL_TECNICO.md
├── start-dev-local.sh            # 🔒 Script protegido — ver reglas de despliegue
├── deploy.sh                     # 🔒 Script protegido
└── docker-compose.yml
```

---

## 3. Base de Datos: `health_store.json`

### 3.1 Descripción
El sistema usa una **base de datos flat-file JSON** (`backend/app/data/health_store.json`) como única fuente de verdad para los datos históricos de ofertas. No se usa ningún motor de base de datos relacional.

### 3.2 Esquema del documento

```json
{
  "YYYY-MM-DD": {
    "BANCO": {
      "info_ingesta": {
        "hora": "HH:MM:SS",
        "tipo": "primer_servicio | reproceso | manual",
        "ultima_modificacion": "ISO 8601 timestamp con TZ"
      },
      "haberes": 123456,
      "prestamos": 78900,
      "cch": 12000,
      "csh": 8500,
      "nc": 4300,
      "analisis_diario": "Texto libre del analista"
    }
  }
}
```

### 3.3 Campos del esquema

| Campo | Tipo | Descripción |
|---|---|---|
| `info_ingesta.hora` | `string HH:MM:SS` | Hora local de la ingesta original del correo |
| `info_ingesta.tipo` | `enum` | `primer_servicio`, `reproceso`, o `manual` |
| `info_ingesta.ultima_modificacion` | `ISO 8601` | Timestamp de la última vez que el registro fue escrito por el sistema |
| `haberes` | `integer` | Volumen de Adelanto de Haberes |
| `prestamos` | `integer` | Volumen de Oferta Préstamos |
| `cch` | `integer` | Volumen de Oferta Tarjeta – CCH |
| `csh` | `integer` | Volumen de Oferta Tarjeta – CSH |
| `nc` | `integer` | Volumen de Oferta Tarjeta – NC |
| `analisis_diario` | `string` | Comentario analítico libre. **NO está sujeto a ventanas de escritura.** |

### 3.4 Bancos disponibles

| Código | Banco |
|---|---|
| `BSF` | Banco Santa Fe |
| `BER` | Banco Entre Ríos (BERSA) |
| `BSJ` | Banco San Juan |
| `BSC` | Banco Santa Cruz |

---

## 4. Lógica del Motor de Persistencia (`health_store.py`)

### 4.1 Escritura Atómica
El archivo se escribe en dos pasos: primero a un `.tmp` y luego se hace un `os.replace()`. Esto garantiza que el archivo nunca quede en estado corrupto, ya que `rename` es una operación atómica en sistemas POSIX (Linux/macOS).

### 4.2 Lógica de "Congelamiento" y Ventanas
Aunque existen ventanas horarias para la recepción de mails, el sistema ya NO bloquea la escritura basándose en la hora en que el usuario hace clic en "Sincronizar". En su lugar, el sistema confía en el **Sistema de Prioridades** (ver 4.3).

Un registro se considera "protegido" solo si lo que se intenta ingresar tiene una prioridad menor a lo que ya existe (ej: un mail de la tarde intentando pisar un reproceso de la madrugada).

### 4.3 Sistema de Prioridades
Definidas como constantes en `TIPO_PRIORIDAD`:

```python
TIPO_PRIORIDAD = {
    "manual": 3,          # Comentarios o ediciones manuales (Nivel Máximo)
    "reproceso": 2,       # Mails de 22:00 a 06:00
    "primer_servicio": 1, # Mails de 15:00 a 19:00
    None: 0
}
```

**Regla:** Un registro de mayor prioridad nunca puede ser pisado por uno de menor prioridad.

### 4.4 Comentarios Analíticos (`save_daily_comment`)
Los comentarios son independientes de la lógica de ventanas de escritura. La función `save_daily_comment(date, bank, comment)`:
1. Carga el store.
2. Verifica que la fecha y el banco existan (si el banco no existe, lo inicializa como `tipo: manual`).
3. Escribe el campo `analisis_diario` directamente.
4. Llama a `save_store()` para persistir.

---

## 5. API REST — Endpoints Principales

### Router Base: `/api/v1/midia/`

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/midia/mails` | Devuelve solo la lista de correos y su categorización (Sync Inbox) |
| `GET`  | `/midia/calendar` | Devuelve solo los eventos del calendario (Sync Calendar) |
| `POST` | `/midia/events/{id}/rsvp` | Envía la respuesta de asistencia (accepted, declined, tentative) a Google Calendar |
| `POST` | `/midia/health-report/sync` | Dispara el query directo a Gmail para buscar reportes bancarios operativos |
| `POST` | `/midia/health-report/analyze` | Ejecuta el análisis de salud sobre los mails (extracción, IA y actualización del store) |
| `GET`  | `/midia/inbox-config` | Devuelve la configuración del Smart Inbox desde Google Sheets |
| `POST` | `/midia/health-report/comment` | Guarda un comentario analítico (`analisis_diario`) en el store |

#### Body del endpoint de comentarios (`POST /midia/health-report/comment`)

```json
{
  "date": "YYYY-MM-DD",
  "bank": "BSF | BER | BSJ | BSC",
  "comment": "Texto del analista"
}
```

**Respuesta exitosa:**
```json
{ "ok": true }
```

**Respuesta de error (400):** Si la fecha no existe en el store.

---

## 6. Frontend — Flujo de Datos

### 6.1 Orquestador Principal (`useSmartInbox.js`)

Es el hook central que coordina toda la carga de datos:

1. **Al montar:** Llama a `GET /midia/inbox-config` para obtener la configuración dinámica del Smart Inbox (reglas de clasificación desde Google Sheets).
2. **Al recibir emails:** Llama a `POST /midia/health-report/analyze` enviando los correos en bruto.
3. **Retorna** entre otros: `healthReport`, `refreshHealthReport` (función para forzar una nueva carga sin recargar página).

### 6.2 Proxy de Vite (evitar CORS en desarrollo)

En `frontend/vite.config.js`, la ruta `/api` redirige transparentemente a `http://localhost:8000`. Esto evita errores de CORS en desarrollo:

```js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    secure: false,
  }
}
```

En **producción**, Nginx actúa como proxy inverso con la misma función.

### 6.3 Detección de Entorno (`BACKEND` dinámico)

Los componentes que hacen peticiones directas (como `OfferJourney.jsx`) detectan si están en local o en producción:

```js
const BACKEND = window.location.hostname === 'localhost'
  ? '/api/v1'
  : API; // API = URL de producción desde constants/index.js
```

### 6.4 Gotchas de Recharts (Escalas y Contexto)
> [!IMPORTANT]
> Recharts inyecta las escalas (`xAxis`, `yAxis`) a sus hijos directos mediante clonación. **NO envolver** componentes como `ReferenceLine` o `ReferenceDot` en etiquetas `<g>` o `<div>` personalizadas dentro del `LineChart`, ya que esto rompe la propagación del contexto y arroja errores de `xAxis is undefined`. Siempre se deben renderizar como una lista plana de componentes de Recharts.

---

## 7. Transformación de Datos para Gráficos (`offerJourney.js`)

### `prepareTimelineData(rawDays, allDays, selectedProducts, selectedBanks)`
Convierte el JSON del store a un array apto para Recharts `LineChart`. Para cada día:
- Suma los valores de todos los `selectedProducts` para cada banco.
- Incluye metadatos: `${bank}_tipo` y `${bank}_comment`.

### `aggregateByMonth(rawDays, allDays, selectedBanks, selectedProducts)`
Agrupa los datos diarios en promedios mensuales.

### `calcMonthlyDeltas(monthlyData, selectedBanks)`
Calcula la variación porcentual entre meses consecutivos: `((curr - prev) / prev) * 100`.

---

## 8. Lógica de Variación Porcentual en el Tooltip

La variación que se muestra al pasar el cursor por el gráfico se calcula **en el frontend**, en tiempo real, dentro de `CustomTooltip`:

```js
const currentIndex = fullData?.findIndex(d => d.date === label);
const prevDay = currentIndex > 0 ? fullData[currentIndex - 1] : null;
const delta = prevDay && prevDay[bank] > 0
  ? (((value - prevDay[bank]) / prevDay[bank]) * 100).toFixed(1)
  : null;
```

**Regla de visualización:**
- `delta > 0` → ↑ Verde
- `delta < 0` → ↓ Rojo
- `delta == 0` → Sin flecha, en gris neutro
- `delta == null` → No se muestra (primer día sin referencia previa)

El mismo cálculo se aplica en el modal de edición de comentarios para contextualizar al analista.

---

## 9. Flujo de Trabajo con GitHub

GitHub es el motor de sincronización. Debido a la sensibilidad de los datos de este proyecto (Jira, Google, IA), el manejo de secretos es estricto.

### 9.1 El Ciclo de Desarrollo
1. **Local:** Programación y pruebas en la Lenovo.
2. **Push:** Subida del código (lógica, estilos, componentes).
3. **Pull en RPi:** Actualización del servidor de producción.

### 9.2 Manejo de Secretos y Google Auth
Este proyecto requiere archivos de identidad que **JAMÁS deben estar en GitHub**:
- `.env`: API Keys de Gemini y variables de entorno.
- `backend/credentials.json`: Identidad de la App en Google Cloud.
- `backend/token.json`: Sesión autorizada del usuario.
- `backend/app/data/*.json`: El histórico de datos (health_store).

> [!CAUTION]
> Si estos archivos se filtran en GitHub, cualquier persona podría acceder a tu correo y calendario. Siempre verificar el `.gitignore` antes de un commit.

---

## 10. Despliegue

---

## 10. Variables de Entorno

Las variables sensibles se gestionan en archivos `.env` (no versionados en git):

| Variable | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Autenticación OAuth2 con Gmail/Calendar |
| `GEMINI_API_KEY` | Acceso a la API de Gemini para análisis de IA |
| `CORS_ORIGINS` | Lista de orígenes permitidos para el middleware CORS de FastAPI |
| `APP_ENV` | `development` o `production` |

---

## 11. Historial de Cambios Técnicos

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-03-29 | Arquitectura inicial: FastAPI + React + health_store.json |
| 1.0.1 | 2026-03-30 | Lógica de ventanas de escritura + prioridades de ingesta |
| 1.1 | 2026-04-23 | Endpoint `POST /midia/health-report/comment` + `save_daily_comment()` + sistema de comentarios en `OfferJourney.jsx` + cálculo de variaciones en CustomTooltip |
| 1.1.1 | 2026-04-23 | Fix reactividad en `PersonDetail`: Sincronización de estado `jiraName` con la prop `person` mediante `useEffect`. |
| 1.2 | 2026-04-23 | Implementación de `analisis_mail`: Nuevo endpoint `POST /midia/health-report/global-analysis` y guardado en la raíz de la fecha del store. |
| 1.3 | 2026-04-23 | Optimización UX Modal: flujo persistente, previsualizaciones completas y navegación. Integración de `Brush` con reseteo dinámico (`key` binding) y reubicación de leyenda/márgenes. |
| 1.4 | 2026-04-23 | Implementación de `Reporte Ejecutivo Diario`: Tabla de datos reactiva sincronizada con Zoom (Brush) y filtros. Optimización de posicionamiento dinámico para iconos de mail (yPos visible). |
| 1.5 | 2026-04-23 | Transposición de tablas (Bancos × Tiempo), orden cronológico ascendente, formatos de fecha corporativos (DD MMM YY / MMM YY), semáforo de deltas en tablas. Corrección de bug: `</div>` faltante en contenedor GRÁFICO PRINCIPAL. |
| 1.6 | 2026-04-24 | Eliminación de restricción de ventana horaria para ejecución de Sync. Prioridad absoluta del tipo de mail sobre el tiempo de ingesta. Inclusión de prioridad `manual: 3` en `health_store.py`. |
| 1.7 | 2026-04-24 | Desacoplamiento de Sincronización: Nuevos endpoints granulares (`/mails`, `/calendar`). Separación de flujo de refresco en frontend para evitar recargas innecesarias del calendario al sincronizar salud. |
| 1.7.1 | 2026-04-24 | Hotfix: Corrección de `ReferenceError: rsvpLoading` en el modal de agenda de `MiDia.jsx`. Documentación de funcionalidad RSVP. |

---

## 12. Detalles de Implementación UI (v1.3)

### 12.1 Gestión de Comentarios (Modal UX)
Se rediseñó el componente de edición para permitir un flujo de trabajo sin interrupciones:
- **Estado Local:** El modal utiliza un objeto `editingComment` enriquecido con `_allData` para permitir la navegación entre bancos sin cerrar el componente.
- **Persistencia:** Al invocar `saveComment`, el sistema actualiza el `health_store.json` y, tras la respuesta exitosa, refresca el estado local del componente para reflejar los cambios en las previsualizaciones sin necesidad de un refetch completo de la página.
- **Previsualizaciones:** Se eliminó el truncado de texto mediante CSS (`whiteSpace: normal`) para permitir la lectura completa de reportes previos directamente desde el selector.

### 12.2 Selector de Periodo (Brush) y Estabilidad
Para garantizar un comportamiento robusto ante cambios en la longitud del dataset (filtros 30d/90d/TODO), se implementó un patrón de **Componente No Controlado con Remontado Dinámico**:

- **Dynamic Key Remounting:** Se utiliza `key={brush-${range}}` en el componente `<Brush />`. Esto fuerza a React a destruir y recrear la instancia del Brush cada vez que cambia el rango de tiempo, evitando conflictos de estado interno en Recharts.
- **Modo Uncontrolled:** Se eliminaron las props `startIndex` y `endIndex` del Brush. Al ser un componente no controlado, el Brush calcula automáticamente su extensión total basándose en los nuevos datos al momento de montarse.
- **Escucha Pasiva de Estado:** El estado local `brushIndices` se actualiza mediante `onChange` solo para renderizar las etiquetas de fecha externas, pero no se inyecta de vuelta al componente, eliminando bucles de actualización o desajustes visuales.
- **Custom Labels:** Se implementó un indicador de rango personalizado mediante `foreignObject` posicionado por debajo del área del Brush para garantizar visibilidad absoluta y limpieza visual.

### 12.3 Optimización de Layout
- **Altura:** Se incrementó el contenedor a `500px` para mejorar el ratio de aspecto de las líneas de tiempo extensas.
- **Leyenda:** Movida a `verticalAlign="bottom"` para despejar el área superior de `ReferenceDot` y evitar colisiones visuales.

### 12.4 Reporte Ejecutivo Diario (v1.4)
Se añadió una capa de visualización tabular sincronizada con el gráfico:
- **Slicing Reactivo:** La tabla consume el mismo `timelineData` que el gráfico, pero aplica un `.slice()` dinámico basado en `brushIndices.start` y `brushIndices.end`.
- **Cálculo de Deltas On-the-fly:** Para mantener la coherencia con el gráfico, los deltas se calculan buscando el `originalIdx` en el dataset completo, asegurando que el primer elemento visible en el zoom muestre su variación real respecto al día anterior (fuera del zoom).

### 12.5 Reportes Ejecutivos y Refinamientos Visuales (v1.5)
- **Transposición de tablas:** Los reportes Diario y Mensual ahora presentan los Bancos en filas (eje Y) y los periodos en columnas (eje X), facilitando la lectura comparativa horizontal.
- **Orden cronológico ascendente:** Ambas tablas muestran el periodo más antiguo a la izquierda, fluyendo hacia el periodo más reciente a la derecha. Esto hace que la evolución histórica sea legible de forma natural (izquierda → derecha = pasado → presente).
- **Formatos de fecha corporativos:** Se implementaron funciones para estandarizar las fechas en los headers (`DD MMM YY` y `MMM YY`).
- **Sistema de Semáforo:** Las celdas de delta en las tablas siguen la misma lógica (Verde crecimiento positivo, Amarillo caída leve ≤ 10%, Rojo caída crítica > 10%).
- **Corrección Estructural:** Se documenta la restauración del `</div>` del contenedor `GRÁFICO PRINCIPAL` que fue eliminado involuntariamente durante una iteración, destacando la necesidad de implementar buenas prácticas de semántica HTML en futuras iteraciones.

---

## 13. Troubleshooting y Errores Comunes

### 13.1 Cloudflare: 502 Bad Gateway (Host Error)
**Síntoma:** Al ingresar a `graficosagiles.site`, Cloudflare muestra una pantalla de error 502 indicando que el navegador y Cloudflare están operativos, pero el "Host" da error.
**Diagnóstico:** El contenedor de `cloudflared` está funcionando correctamente y conectando con Cloudflare, pero no puede rutear el tráfico hacia el contenedor del frontend.
**Causa Común (Conflicto de Instancias):** Si se instaló `cloudflared` nativamente en el sistema operativo de la Raspberry Pi y posteriormente se incluyó en `docker-compose.prod.yml`, ambas instancias intentarán responder al mismo túnel.
- La instancia nativa recibe la regla de Cloudflare de rutear a `http://frontend:80`.
- Al no estar dentro de la red de Docker, la instancia nativa no puede resolver el DNS interno `frontend`, por lo que la conexión es rechazada y devuelve un 502.
**Solución Permanente:** Desactivar la instancia nativa del sistema operativo para que solo opere la versión en contenedores:
```bash
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared
```
**Alternativa:** En el dashboard de Cloudflare Zero Trust, configurar la ruta apuntando a la IP local de la Raspberry Pi (ej. `http://192.168.1.140:80`) en lugar del nombre del contenedor, para que cualquier instancia del túnel sepa cómo alcanzar el puerto expuesto.

---

## 14. Mantenimiento y Despliegue Seguro (Zero Downtime)

Este proyecto convive con 'Gastos Familia' en una **Infraestructura Unificada**. Para evitar afectar al otro proyecto durante un despliegue, seguir estas reglas:

### 14.1 Despliegue Quirúrgico
**NUNCA** ejecutar `docker compose up -d` a secas en la carpeta de infraestructura de la Raspberry. 
El script `deploy.sh` de la PC ya está configurado para actualizar solo lo necesario:
`docker compose up -d --build dash-backend dash-frontend`

### 14.2 Evitar el `down`
El comando `docker compose down` apaga el Proxy y el Túnel, dejando fuera de línea a TODOS los proyectos. Evitar su uso en producción.

### 14.3 Recarga de Configuración
Para aplicar cambios en `nginx.conf`, usar:
`docker restart proxy_unificado`

