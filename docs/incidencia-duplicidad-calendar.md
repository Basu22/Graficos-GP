# Resolución de Incidencia: Pérdida Silenciosa de Datos en Eventos de Calendario (Bug del Gemelo Malvado)

**Fecha de Identificación:** 15 de Mayo de 2026
**Módulo Afectado:** Calendario / Gestión de Soporte y Sprints
**Síntoma Principal:** Al intentar guardar el evento de "Rotación de Soporte" desde la interfaz de usuario, el campo `personSwap` (que encadena a la persona saliente con la entrante) se enviaba correctamente desde el frontend, pero nunca se reflejaba en el archivo físico `calendar_events.json`, rompiendo la continuidad visual y el cálculo de capacidad.

---

## 🔍 Análisis de la Causa Raíz

Tras horas de debugeo en el código de backend y análisis de persistencia, se descubrió un problema arquitectónico de **rutas duplicadas (Shadowing de Endpoints)**.

Existían dos archivos en el backend definiendo exactamente las mismas rutas (`@router.post("/events")`):
1. `backend/app/api/v1/endpoints/calendar.py`
2. `backend/app/api/v1/endpoints/calendar_events.py`

Debido al orden en que el archivo `app/main.py` importaba e inicializaba los enrutadores, **FastAPI otorgó prioridad absoluta a `calendar_events.py`**.

### El Mecanismo de Falla (Silencioso)
1. Durante la refactorización, el archivo "inactivo" (`calendar.py`) fue el que se intentó parchear para aceptar el nuevo campo `personSwap`.
2. El archivo "activo" (`calendar_events.py`) mantenía un modelo Pydantic antiguo (`class EventIn(BaseModel):`) que **no declaraba** el atributo `personSwap`.
3. Pydantic, por diseño de seguridad, al recibir un JSON con campos que no están estrictamente definidos en su modelo (`EventIn`), **los descarta silenciosamente** durante la serialización (`event.dict()`). 
4. El servidor retornaba un código HTTP 200 (Éxito), pero el objeto persistido en disco estaba mutilado (le faltaba el campo `personSwap`).

---

## 🛠️ Solución Implementada

Se realizó una inyección directa en el archivo que tenía el control real de la ejecución (`calendar_events.py`).

1. **Actualización del Modelo de Datos:** Se agregó `personSwap: Optional[str] = None` a la clase `EventIn` en `calendar_events.py`.
2. **Forzado de Persistencia:** Se añadió una validación explícita en los métodos `create_event` y `update_event` para garantizar que la copia del diccionario rescate el campo opcional:
   ```python
   new_event = event.dict()
   if getattr(event, "personSwap", None) is not None:
       new_event["personSwap"] = event.personSwap
   elif "personSwap" in event.dict():
       new_event["personSwap"] = event.dict().get("personSwap")
   ```

---

## ⚠️ Reglas Técnicas y Futuras Modificaciones (¡IMPORTANTE!)

Para evitar que este "Bug del Gemelo" vuelva a ocurrir y genere pérdida de datos o comportamientos fantasma:

1. **Archivo Correcto:** **TODA MODIFICACIÓN** relacionada con la API del calendario (GET, POST, PUT, DELETE de `/events` o `/holidays`) debe realizarse EXCLUSIVAMENTE en:
   👉 `backend/app/api/v1/endpoints/calendar_events.py`

2. **Archivo a Depurar:** El archivo `backend/app/api/v1/endpoints/calendar.py` es actualmente "código muerto" (zombie). Aunque se modificaron sus funciones para compartir el directorio `backend/data/` (a través de `app.utils.storage`), no está recibiendo tráfico real. **Se recomienda encarecidamente eliminar o renombrar `calendar.py` (ej. `_calendar.py.old`)** en el próximo ciclo de refactorización para evitar confusiones de desarrollo.

3. **Inclusión de Campos:** Si en el futuro se añade un nuevo parámetro en el Payload del Frontend (`CalendarView.jsx`), **es estrictamente necesario añadirlo al esquema `EventIn` de Pydantic** en `calendar_events.py`. De lo contrario, FastAPI lo purgará sin avisar.
