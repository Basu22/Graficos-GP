from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.google_service import (
    get_gmail_threads, get_calendar_today, get_google_creds,
    update_calendar_event, cancel_calendar_event,
    check_calendar_conflicts, add_event_attendee, remove_event_attendee
)
from googleapiclient.discovery import build
from app.services.gemini_service import generate_weekly_plan
import logging
import google.generativeai as genai
from app.core.config import get_settings

router = APIRouter(prefix="/midia", tags=["midia"])
logger = logging.getLogger(__name__)

@router.get("/data")
async def get_midia_data():
    try:
        # Se volvió a ejecución secuencial porque google-api-python-client  
        # no es thread-safe y bloquea el event loop. Con Batch API ya es rapidísimo (<2s).
        threads = await get_gmail_threads(max_results=300, days=30)
        events = await get_calendar_today()

        # Categorización básica para la vista de acordeones (fallback visual)
        categorized = {"clientes": [], "tickets": [], "equipo": [], "notif": []}
        for t in threads:
            subj = t['subject'].lower()
            frm  = t.get('from', '').lower()
            if any(k in subj for k in ['factura', 'cliente', 'reunion', 'pago']):
                categorized['clientes'].append(t)
            elif any(k in subj or k in frm for k in ['jira', 'atlassian', 'bug', 'ticket', 'issue']):
                categorized['tickets'].append(t)
            elif any(k in subj for k in ['equipo', 'sync', 'almuerzo', 'team']):
                categorized['equipo'].append(t)
            else:
                categorized['notif'].append(t)

        return {
            "mail_groups":    categorized,
            "all_mails":      threads,     # ← lista plana para processSmartInbox
            "events":         events,
            "google_connected": get_google_creds() is not None,
            "mails_fetched":  len(threads),
        }
    except Exception as e:
        logger.error(f"Error en Mi Dia data: {e}")
        return {"error": str(e), "google_connected": False}

@router.post("/generate-plan")
async def generate_plan(mails: list[dict]):
    logger.info(f"generate-plan recibió {len(mails)} mails")
    if not mails:
        raise HTTPException(status_code=400, detail="No hay mails para procesar")
    plan = await generate_weekly_plan(mails)
    logger.info(f"Plan generado: {len(plan)} días")
    return plan

# ─── Modelos ───────────────────────────────────────────────────────────────────

class UpdateEventBody(BaseModel):
    summary: Optional[str] = None
    description: Optional[str] = None
    start: Optional[dict] = None   # {"dateTime": "2025-04-01T10:00:00-03:00", "timeZone": "America/Argentina/Buenos_Aires"}
    end: Optional[dict] = None

class ConflictCheckBody(BaseModel):
    start_iso: str
    end_iso: str
    exclude_event_id: Optional[str] = None

class AddAttendeeBody(BaseModel):
    email: str
    display_name: Optional[str] = None

class GenerateDescriptionBody(BaseModel):
    title: str
    current_description: Optional[str] = None

# ─── Endpoints de gestión de eventos ──────────────────────────────────────────

@router.patch("/events/{event_id}")
async def patch_event(event_id: str, body: UpdateEventBody):
    """Actualiza título, descripción y/o horario. Envía notificaciones a invitados."""
    try:
        updates = body.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="Ningún campo para actualizar")
        result = await update_calendar_event(event_id, updates)
        return result
    except Exception as e:
        logger.error(f"Error actualizando evento {event_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    """Cancela el evento y envía mail de cancelación a todos los participantes."""
    try:
        return await cancel_calendar_event(event_id)
    except Exception as e:
        logger.error(f"Error cancelando evento {event_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/events/check-conflicts")
async def check_conflicts(body: ConflictCheckBody):
    """Detecta si hay otros eventos en el rango horario dado."""
    try:
        conflicts = await check_calendar_conflicts(body.start_iso, body.end_iso, body.exclude_event_id)
        return {"conflicts": [{"id": e["id"], "title": e.get("summary", "Sin título"),
                               "start": e["start"], "end": e["end"]} for e in conflicts]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/events/{event_id}/attendees")
async def add_attendee(event_id: str, body: AddAttendeeBody):
    """Agrega un participante y le envía invitación por mail."""
    try:
        result = await add_event_attendee(event_id, body.email, body.display_name)
        return result
    except Exception as e:
        logger.error(f"Error agregando participante a {event_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/events/{event_id}/attendees/{email:path}")
async def remove_attendee(event_id: str, email: str):
    """Elimina un participante y le envía notificación de cancelación."""
    try:
        result = await remove_event_attendee(event_id, email)
        return result
    except Exception as e:
        logger.error(f"Error eliminando participante de {event_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

class RSVPBody(BaseModel):
    response: str  # 'accepted' | 'declined' | 'tentative'

@router.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, body: RSVPBody):
    """Confirma asistencia al evento con Sí/No/Quizás."""
    valid = ['accepted', 'declined', 'tentative']
    if body.response not in valid:
        raise HTTPException(status_code=400, detail=f"Respuesta inválida. Usar: {valid}")
    try:
        creds = get_google_creds()
        service = build('calendar', 'v3', credentials=creds)
        
        # 1. Traemos el evento para conocer la lista completa de asistentes
        event = service.events().get(calendarId='primary', eventId=event_id).execute()
        attendees = event.get('attendees', [])
        
        # 2. Buscamos al asistente "self" (el usuario autenticado)
        self_email = None
        for a in attendees:
            if a.get('self'):
                self_email = a.get('email')
                break
        
        if not self_email:
            raise HTTPException(status_code=404, detail="No sos invitado a este evento")
        
        # 3. Actualizamos solo el responseStatus del usuario, preservando el resto
        updated_attendees = [
            {**a, 'responseStatus': body.response} if a.get('email') == self_email
            else {'email': a['email'], 'responseStatus': a.get('responseStatus', 'needsAction')}
            for a in attendees
        ]
        
        updated = service.events().patch(
            calendarId='primary',
            eventId=event_id,
            body={'attendees': updated_attendees},
            sendNotifications=False  # RSVP no envía mails a los demás
        ).execute()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enviando RSVP para {event_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/events/{event_id}/attendees")
async def update_attendees(event_id: str, attendees: list[dict], scope: str = "single"):
    """Actualiza participantes con soporte para eventos recurrentes.
    scope: 'single' = solo este, 'following' = este y posteriores, 'all' = todos.
    """
    try:
        # Preservamos email + responseStatus para no resetear las confirmaciones existentes.
        clean_attendees = [
            {
                "email": a["email"],
                "responseStatus": a.get("responseStatus", "needsAction")
            }
            for a in attendees if "email" in a
        ]

        if scope == "all":
            # Actualizar el evento maestro de la serie recurrente
            creds = get_google_creds()
            service = build('calendar', 'v3', credentials=creds)
            instance = service.events().get(calendarId='primary', eventId=event_id).execute()
            master_id = instance.get('recurringEventId', event_id)
            updated = await update_calendar_event(master_id, {"attendees": clean_attendees})
        elif scope == "following":
            # Actualizar esta instancia y las siguientes
            creds = get_google_creds()
            service = build('calendar', 'v3', credentials=creds)
            instance = service.events().get(calendarId='primary', eventId=event_id).execute()
            # Seteamos el fin de recurrencia del master en la fecha anterior a esta instancia
            # y creamos una nueva serie desde esta en adelante. Por simplicidad, aplicamos
            # solo a esta instancia (comportamiento conservador).
            updated = await update_calendar_event(event_id, {"attendees": clean_attendees})
        else:
            # Solo este evento (default)
            updated = await update_calendar_event(event_id, {"attendees": clean_attendees})
        
        return updated
    except Exception as e:
        logger.error(f"Error actualizando participantes de {event_id} (scope={scope}): {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/generate-event-description")
async def generate_event_description(body: GenerateDescriptionBody):
    """Genera una descripción para un evento usando el motor de IA disponible."""
    try:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        available_models = [m.name for m in genai.list_models()
                            if 'generateContent' in m.supported_generation_methods]
        if not available_models:
            raise HTTPException(status_code=503, detail="Sin modelos de IA disponibles")
        model = genai.GenerativeModel(available_models[0])
        prompt = f"""Generá una descripción clara y profesional para el siguiente evento de calendario.
Título: {body.title}
{"Descripción actual: " + body.current_description if body.current_description else ""}

La descripción debe incluir:
- Objetivo de la reunión
- Agenda sugerida (3-5 puntos breves)
- Qué se espera de los participantes

Responde SOLO con el texto de la descripción, sin markdown ni encabezados."""
        response = model.generate_content(prompt)
        return {"description": response.text.strip()}
    except Exception as e:
        logger.error(f"Error generando descripción de evento: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# INSTANT MEETING ─ Crea reunión ahora con Meet
# ─────────────────────────────────────────────
class InstantMeetingBody(BaseModel):
    title: str = "Reunión instantánea"
    duration_minutes: int = 30

@router.post("/instant-meeting")
async def create_instant_meeting(body: InstantMeetingBody):
    """
    Crea un evento de Google Calendar que empieza AHORA con Google Meet.
    Devuelve { hangoutLink, eventId, htmlLink } para que el frontend abra la URL.
    """
    try:
        import datetime, uuid
        creds = get_google_creds()
        service = build('calendar', 'v3', credentials=creds)

        now = datetime.datetime.utcnow()
        end = now + datetime.timedelta(minutes=body.duration_minutes)

        event_body = {
            "summary": body.title,
            "start": {"dateTime": now.isoformat() + "Z", "timeZone": "America/Argentina/Buenos_Aires"},
            "end":   {"dateTime": end.isoformat() + "Z", "timeZone": "America/Argentina/Buenos_Aires"},
            "conferenceData": {
                "createRequest": {
                    "requestId": str(uuid.uuid4()),   # único por petición
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

        created = service.events().insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1,   # necesario para que genere el Meet
            sendNotifications=False,
        ).execute()

        hangout_link = created.get("hangoutLink")
        if not hangout_link:
            raise HTTPException(status_code=500, detail="Google no generó el link de Meet")

        return {
            "hangoutLink": hangout_link,
            "eventId":     created.get("id"),
            "htmlLink":    created.get("htmlLink"),
            "title":       created.get("summary"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creando reunión instantánea: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# CREATE EVENT ─ Desde el widget tipo Gmail
# ─────────────────────────────────────────────
class CreateEventBody(BaseModel):
    title: str
    start: str         # ISO8601 "2026-04-07T10:00:00"
    end: str           # ISO8601 "2026-04-07T11:00:00"
    attendees: list[str] = []
    description: Optional[str] = None

@router.post("/create-event")
async def create_quick_event(body: CreateEventBody):
    """
    Crea un evento de Calendar desde el widget rápido estilo Gmail.
    """
    try:
        import uuid
        creds = get_google_creds()
        service = build('calendar', 'v3', credentials=creds)
        tz = "America/Argentina/Buenos_Aires"
        event_body = {
            "summary": body.title,
            "description": body.description or "",
            "start": {"dateTime": body.start, "timeZone": tz},
            "end":   {"dateTime": body.end,   "timeZone": tz},
            "conferenceData": {
                "createRequest": {
                    "requestId": str(uuid.uuid4()),
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }
        if body.attendees:
            event_body["attendees"] = [{"email": e} for e in body.attendees if e]
        
        created = service.events().insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1,
            sendUpdates="all" if body.attendees else "none",
        ).execute()
        return {
            "eventId":  created.get("id"),
            "htmlLink": created.get("htmlLink"),
            "title":    created.get("summary"),
            "start":    created.get("start"),
            "end":      created.get("end"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creando evento rapido: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────
# CONFIG DESDE GOOGLE SHEETS — Motor de Decisiones
# Sheet ID: 1bEb7w_iBqHbuPFNlBFi9jVZFtos1-VfFuI8npxVimkk
# Pestaña Motor (default gid=0) + Pestaña Filtros (gid=2103787807)
# ─────────────────────────────────────────────────────────────────
import csv, io, httpx, re
from functools import lru_cache
from datetime import datetime as _dt

SHEET_ID          = "1bEb7w_iBqHbuPFNlBFi9jVZFtos1-VfFuI8npxVimkk"
SHEET_CSV_URL     = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"
SHEET_FILTROS_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=2103787807"

# Cachés con TTL de 5 minutos
_config_cache  = {"data": None, "ts": 0, "ttl": 300}
_filters_cache = {"data": None, "ts": 0, "ttl": 300}

async def fetch_sheet_config(force_refresh: bool = False) -> list[dict]:
    now = _dt.utcnow().timestamp()
    if not force_refresh and _config_cache["data"] and (now - _config_cache["ts"]) < _config_cache["ttl"]:
        return _config_cache["data"]
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(SHEET_CSV_URL)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            rows = [dict(row) for row in reader if row.get("Tag") and row.get("Criterio")]
            _config_cache["data"] = rows
            _config_cache["ts"] = now
            return rows
    except Exception as e:
        logger.warning(f"No se pudo leer el Sheet Motor: {e}")
        return _config_cache["data"] or []

async def fetch_filters_config(force_refresh: bool = False) -> list[dict]:
    """Lee la pestaña Filtros — IGNORAR / SILENCIAR / REBOTAR."""
    now = _dt.utcnow().timestamp()
    if not force_refresh and _filters_cache["data"] and (now - _filters_cache["ts"]) < _filters_cache["ttl"]:
        return _filters_cache["data"]
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(SHEET_FILTROS_URL)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            rows = [
                dict(row) for row in reader
                if row.get("Tipo") and row.get("Campo") and row.get("Valor")
                and (row.get("Activo") or "SI").strip().upper() == "SI"
            ]
            _filters_cache["data"] = rows
            _filters_cache["ts"] = now
            logger.info(f"[Filtros] {len(rows)} filtros activos cargados desde Sheets")
            return rows
    except Exception as e:
        logger.warning(f"No se pudo leer el Sheet Filtros: {e}")
        return _filters_cache["data"] or []

@router.get("/inbox-config")
async def get_inbox_config(refresh: bool = False):
    """
    Retorna la configuración completa del Smart Inbox:
    - config: reglas de clasificación (pestaña Motor)
    - filters: reglas de filtrado previo (pestaña Filtros)
    TTL de 5 minutos para cada pestaña.
    """
    rows    = await fetch_sheet_config(force_refresh=refresh)
    filters = await fetch_filters_config(force_refresh=refresh)
    if not rows:
        raise HTTPException(status_code=503, detail="No se pudo obtener la configuración del Sheet")
    return {
        "config":  rows,
        "filters": filters,
        "source":  SHEET_CSV_URL,
        "cached":  not refresh,
    }



# ─────────────────────────────────────────────────────────────────
# HEALTH REPORT — Parser con tabla Productos × Bancos
# Fuente: 4 mails/día de operativagobdato@gbsj.com.ar
# Asunto real: "Detalle de ofertas cargadas | BSF |20260406"
# Fecha en formato YYYYMMDD (sin barras)
# ─────────────────────────────────────────────────────────────────

BANKS = ["BSF", "BER", "BSJ", "BSC"]

# Patrones con soporte para el formato real: "Oferta Tarjeta - CSH" (guión + espacios)
# que envía el remitente operativagobdato@gbsj.com.ar
PRODUCT_DEFS = [
    {"key": "haberes",   "label": "Adelanto de Haberes",  "patterns": [
        r"adelanto de haberes", r"haberes"]},
    {"key": "prestamos", "label": "Oferta Préstamos",     "patterns": [
        r"oferta prestamos", r"oferta pr[eé]stamos", r"prestamos"]},
    {"key": "cch",       "label": "Oferta Tarjeta – CCH", "patterns": [
        r"oferta tarjeta[\s\-–]+cch", r"tarjeta[\s\-–]+cch", r"\bcch\b"]},
    {"key": "csh",       "label": "Oferta Tarjeta – CSH", "patterns": [
        r"oferta tarjeta[\s\-–]+csh", r"tarjeta[\s\-–]+csh", r"\bcsh\b"]},
    {"key": "nc",        "label": "Oferta Tarjeta – NC",  "patterns": [
        r"oferta tarjeta[\s\-–]+nc\b", r"tarjeta[\s\-–]+nc\b", r"\bnc\b"]},
]

# ─── Caché del resultado del análisis (TTL 120 min) ─────────────────────────────
# Aumentamos el TTL y simplificamos para que sea muy estable
_health_cache: dict = {"data": None, "ts": 0.0, "fingerprint": ""}
HEALTH_CACHE_TTL = 7200  # 2 horas


def _clean_num(s: str) -> int:
    return int(re.sub(r"[.,\s]", "", s.strip()))

def _extract_products_from_text(text: str) -> dict:
    """
    Extrae valores de productos del cuerpo de un mail de banco.
    Soporta: "Adelanto de Haberes    262.039" o "Haberes: 262.039"
    """
    result = {}
    flat = re.sub(r"[\r\n]+", " ", text)
    for prod in PRODUCT_DEFS:
        val = None
        for pat in prod["patterns"]:
            # número después del patrón
            m = re.search(rf'{pat}[\s:\|]+([0-9][0-9.,]*)', flat, re.IGNORECASE)
            if m:
                try: val = _clean_num(m.group(1)); break
                except: pass
            # número antes del patrón
            m = re.search(rf'([0-9][0-9.,]+)\s+{pat}', flat, re.IGNORECASE)
            if m:
                try: val = _clean_num(m.group(1)); break
                except: pass
        if val is not None:
            result[prod["key"]] = val
    return result

def _extract_bank_from_subject(subject: str) -> str | None:
    """
    Extrae el banco de: "Detalle de ofertas cargadas | BSF |20260406"
    """
    up = subject.upper()
    for bank in BANKS:
        if re.search(rf'\b{bank}\b', up):
            return bank
    return None

def _extract_date_from_subject(subject: str) -> str | None:
    """
    Soporta múltiples formatos de fecha en el asunto:
      - YYYYMMDD        → "Detalle de ofertas cargadas | BSF |20260406"
      - DD/MM/YYYY      → "... | 31/03/2026"
      - DD-MM-YYYY      → "... | 31-03-2026"
    Siempre retorna YYYY-MM-DD para ordenar correctamente.
    """
    # Formato YYYYMMDD (8 dígitos juntos)
    m = re.search(r'\b(20\d{2})(\d{2})(\d{2})\b', subject)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Formato DD/MM/YYYY o DD-MM-YYYY
    m = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})', subject)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2: y = "20" + y
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return None

def _calc_diff(curr, prev) -> float | None:
    if not prev: return None
    return round(((curr - prev) / prev) * 100, 1)


@router.post("/health-report/sync")
async def sync_health_report():
    """
    Invalida la caché del Monitor de Salud para que el próximo
    llamado a /health-report/analyze recalcule desde cero.
    Se expone como botón independiente "Sync Salud" en el frontend,
    separado del Sync del Smart Inbox.
    """
    _health_cache["data"]        = None
    _health_cache["ts"]          = 0.0
    _health_cache["fingerprint"] = ""
    logger.info("[Health] Caché invalidada manualmente via Sync Salud")
    return {"ok": True, "message": "Caché del Monitor de Salud invalidada. El próximo análisis recalculará desde Gmail."}


@router.post("/health-report/analyze")
async def analyze_health_reports(emails: list[dict]):
    """
    Construye la tabla Monitor de Salud (Productos × Bancos con diff%).

    Flujo:
    1. Query directo a Gmail para mails de operativagobdato (independiente del Inbox general)
    2. Combina con la lista recibida del frontend (dedup por ID)
    3. Verifica caché de 60 min — si los IDs no cambiaron, devuelve resultado guardado
    4. Agrupa por fecha del asunto (no por fecha de recepción)
    5. Para bancos sin mail en el día más reciente, usa el último dato disponible (sin ceros)
    """
    import hashlib, time, datetime as _dt
    from googleapiclient.discovery import build as _build

    OPERATIVA_SENDER = "operativagobdato"
    DETAIL_KEYWORD   = "detalle de ofertas"
    SUMMARY_KEYWORDS = ["reporte diario", "estado de ofertas"]

    # ── FASE A: Query directo a Gmail para mails del remitente operativo ──────────
    operativa_mails: list[dict] = []
    reporte_mails:   list[dict] = []

    def _get_body_text(full_msg: dict) -> str:
        """Extrae texto plano del body de un mensaje Gmail en formato 'full'."""
        import base64 as _b64
        def _decode(data):
            return _b64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore') if data else ''
        def _walk(part):
            mime = part.get('mimeType', '')
            if mime == 'text/plain':
                return _decode(part.get('body', {}).get('data', ''))
            if mime == 'text/html':
                raw = _decode(part.get('body', {}).get('data', ''))
                return re.sub(r'<[^>]+>', ' ', raw)
            for sub in part.get('parts', []):
                t = _walk(sub)
                if t.strip(): return t
            return ''
        payload = full_msg.get('payload', {})
        if not payload.get('parts'):
            mime = payload.get('mimeType', '')
            raw  = payload.get('body', {}).get('data', '')
            txt  = _b64.urlsafe_b64decode(raw + '==').decode('utf-8', errors='ignore') if raw else ''
            if 'html' in mime:
                txt = re.sub(r'<[^>]+>', ' ', txt)
            return txt
        for part in payload.get('parts', []):
            t = _walk(part)
            if t.strip(): return t
        return ''

    try:
        creds = get_google_creds()
        if creds:
            _svc = _build('gmail', 'v1', credentials=creds)
            _res = _svc.users().messages().list(
                userId='me',
                q=f"from:{OPERATIVA_SENDER} subject:detalle de ofertas",
                maxResults=50, # Reducimos a los últimos 50 para velocidad
            ).execute()
            for _m in _res.get('messages', []):
                try:
                    # format='full' para obtener el body HTML con CSH y NC
                    # (el snippet se trunca a ~199 chars, omitiendo los últimos productos)
                    _full = _svc.users().messages().get(
                        userId='me', id=_m['id'],
                        format='full'
                    ).execute()
                    _hdrs = _full.get('payload', {}).get('headers', [])
                    _subj = next((h['value'] for h in _hdrs if h['name'] == 'Subject'), '')
                    _from = next((h['value'] for h in _hdrs if h['name'] == 'From'), '')
                    _ts   = int(_full.get('internalDate', 0)) / 1000
                    _date = _dt.datetime.fromtimestamp(_ts, tz=_dt.timezone.utc).isoformat()
                    _body = _get_body_text(_full)
                    operativa_mails.append({
                        "id":      _full['id'],
                        "subject": _subj,
                        "from":    _from,
                        "snippet": _full.get('snippet', ''),
                        "body":    _body,    # body completo: incluye CSH y NC
                        "date":    _date,
                    })
                except Exception as _e:
                    logger.warning(f"[Health] error leyendo mail operativo {_m['id']}: {_e}")
            logger.info(f"[Health] query directo: {len(operativa_mails)} mails operativos")

            # ── FASE A2: Buscar también los Reportes Diarios de Ofertas (para el snippet de análisis)
            reporte_mails: list[dict] = []
            _res2 = _svc.users().messages().list(
                userId='me',
                q='subject:"reporte diario de estado de ofertas" -subject:"ANALISIS IA"',
                maxResults=10,
            ).execute()
            for _m2 in _res2.get('messages', []):
                try:
                    _rfull = _svc.users().messages().get(
                        userId='me', id=_m2['id'], format='full'
                    ).execute()
                    _rhdrs = _rfull.get('payload', {}).get('headers', [])
                    _rsubj = next((h['value'] for h in _rhdrs if h['name'] == 'Subject'), '')
                    
                    if "analisis ia" in _rsubj.lower() or "análisis ia" in _rsubj.lower():
                        continue

                    _rfrom = next((h['value'] for h in _rhdrs if h['name'] == 'From'), '')
                    _rts   = int(_rfull.get('internalDate', 0)) / 1000
                    _rdate = _dt.datetime.fromtimestamp(_rts, tz=_dt.timezone.utc).isoformat()
                    _rbody = _get_body_text(_rfull)
                    reporte_mails.append({
                        "id":      _rfull['id'],
                        "subject": _rsubj,
                        "from":    _rfrom,
                        "snippet": _rfull.get('snippet', ''),
                        "body":    _rbody,
                        "date":    _rdate,
                    })
                except Exception as _e2:
                    logger.warning(f"[Health] error leyendo reporte {_m2['id']}: {_e2}")
            logger.info(f"[Health] reportes diarios encontrados: {len(reporte_mails)}")

    except Exception as _e:
        logger.warning(f"[Health] query directo falló o tomó demasiado tiempo: {_e}")
        # No matamos la ejecución, intentamos seguir con lo que mandó el frontend
        if not operativa_mails:
             logger.info("[Health] Usando mails recibidos del frontend como fallback")


    # ── FASE B: Combinar ambas fuentes (priorizando nuestra versión con body completo) ──
    all_by_id: dict[str, dict] = {m['id']: m for m in emails if m.get('id')}
    for m in operativa_mails:
        # Sobreescribimos porque nuestra versión tiene el body='full' con CSH y NC
        all_by_id[m['id']] = m
    all_mails = list(all_by_id.values())

    # ── FASE C: Caché de 60 min con fingerprint de IDs ───────────────────────────
    fingerprint = hashlib.md5("".join(sorted(all_by_id.keys())).encode()).hexdigest()
    now_ts = time.time()
    if (
        _health_cache["data"] is not None
        and _health_cache["fingerprint"] == fingerprint
        and (now_ts - _health_cache["ts"]) < HEALTH_CACHE_TTL
    ):
        logger.info(f"[Health] Cache hit — fingerprint={fingerprint[:8]}")
        return _health_cache["data"]

    # ── FASE D: Filtrar y clasificar ──────────────────────────────────────────────
    detail_mails, summary_mails = [], []
    for m in all_mails:
        subj = (m.get("subject") or "").lower()
        frm  = (m.get("from")   or "").lower()
        if (OPERATIVA_SENDER in frm or OPERATIVA_SENDER in subj) and DETAIL_KEYWORD in subj:
            detail_mails.append(m)
        elif any(kw in subj for kw in SUMMARY_KEYWORDS):
            summary_mails.append(m)

    logger.info(f"[Health] detail={len(detail_mails)} summary={len(summary_mails)} total={len(all_mails)}")

    # ── FASE E: Agrupar datos por fecha del asunto ────────────────────────────────
    days: dict[str, dict] = {}
    for mail in detail_mails:
        subj  = mail.get("subject") or ""
        bank  = _extract_bank_from_subject(subj)
        fdate = _extract_date_from_subject(subj) or (mail.get("date") or "")[:10]
        if not bank or not fdate:
            continue
        content  = f"{subj} {mail.get('snippet','') or ''} {mail.get('body','') or ''}"
        products = _extract_products_from_text(content)
        if fdate not in days:
            days[fdate] = {}
        days[fdate][bank] = products
        logger.debug(f"[Health] {fdate}/{bank} -> {products}")

    # Fallback: parsear mails de resumen si hay menos de 2 días con datos
    if len(days) < 2 and summary_mails:
        summary_mails.sort(key=lambda x: x.get("date", ""), reverse=True)
        for sm in summary_mails[:6]:
            dk = (sm.get("date") or "")[:10]
            if dk and dk not in days:
                text = f"{sm.get('subject','')} {sm.get('snippet','')} {sm.get('body','')}"
                day_data: dict[str, dict] = {}
                for bank in BANKS:
                    try:
                        bm = re.search(rf'\b{bank}\b(.{{0,600}})', text, re.IGNORECASE | re.DOTALL)
                        if bm:
                            prods = _extract_products_from_text(bm.group(1))
                            if prods:
                                day_data[bank] = prods
                    except re.error:
                        pass
                if day_data:
                    days[dk] = day_data

    sorted_days = sorted(days.keys(), reverse=True)
    if not sorted_days:
        return {"error": "no_reports_found", "message": "No se encontraron reportes de oferta en los ultimos 30 dias."}

    latest_date = sorted_days[0]
    prev_date   = sorted_days[1] if len(sorted_days) > 1 else None
    latest_day  = days[latest_date].copy()
    prev_day    = days[prev_date].copy() if prev_date else {}

    # ── FASE F: Fallback por banco — último dato conocido si falta el mail ────────
    # Si un banco no tiene datos en la fecha más reciente o la anterior,
    # usamos el último registro histórico disponible para ese banco.
    bank_history: dict[str, dict] = {}
    for d in sorted_days:
        for bank, prod_data in days[d].items():
            if bank not in bank_history and prod_data:
                bank_history[bank] = prod_data

    bank_prev_history: dict[str, dict] = {}
    for d in sorted_days[1:]:
        for bank, prod_data in days[d].items():
            if bank not in bank_prev_history and prod_data:
                bank_prev_history[bank] = prod_data

    for bank in BANKS:
        if not latest_day.get(bank) and bank in bank_history:
            latest_day[bank] = bank_history[bank]
            logger.info(f"[Health] {bank}: sin datos el {latest_date}, usando último registro disponible")
        if not prev_day.get(bank) and bank in bank_prev_history:
            prev_day[bank] = bank_prev_history[bank]
            logger.info(f"[Health] {bank}: sin datos previos, usando último registro previo disponible")

    # Qué bancos no tenían mail propio en latest_date (usan dato de otro día) → ⚠️ en UI
    fallback_banks: set[str] = {
        bank for bank in BANKS
        if bank not in days.get(latest_date, {}) and latest_day.get(bank)
    }

    logger.info(f"[Health] Comparando {latest_date} vs {prev_date} | fallback={fallback_banks}")



    # Construir tabla filas=Producto, columnas=Banco
    table_rows = []
    has_any_issue = False
    for prod_def in PRODUCT_DEFS:
        pk = prod_def["key"]
        row = {"key": pk, "label": prod_def["label"], "banks": {}, "total_current": 0, "total_previous": 0}
        for bank in BANKS:
            curr = (latest_day.get(bank) or {}).get(pk, 0)
            prev = (prev_day.get(bank)   or {}).get(pk, 0)
            diff = _calc_diff(curr, prev)
            row["banks"][bank] = {
                "current":    curr,
                "previous":   prev,
                "diff":       diff,
                "isFallback": bank in fallback_banks,  # ⚠️ dato del día anterior
            }
            row["total_current"]  += curr
            row["total_previous"] += prev
        row["total_diff"] = _calc_diff(row["total_current"], row["total_previous"])
        if row["total_diff"] is not None and row["total_diff"] < -5:
            has_any_issue = True
        if row["total_current"] > 0 or row["total_previous"] > 0:
            table_rows.append(row)

    # ── Extraer el snippet narrativo del Reporte Diario más reciente ─────────────
    # Los reportes vienen primero de la Fase A2, con fallback a los que mandó el frontend
    latest_snippet, latest_from = "", ""
    _all_reportes = sorted(
        reporte_mails + [
            m for m in all_mails
            if any(kw in (m.get('subject') or '').lower() for kw in SUMMARY_KEYWORDS)
            and m.get('id') not in {r['id'] for r in reporte_mails}
            and "analisis ia" not in (m.get('subject') or '').lower()
            and "análisis ia" not in (m.get('subject') or '').lower()
        ],
        key=lambda x: x.get('date', ''), reverse=True
    )

    for sm in _all_reportes[:5]:
        body_text = sm.get("body", "") or sm.get("snippet", "") or ""
        if not body_text.strip():
            continue

        # La intro es un patrón estándar pero puede variar alguna palabra.
        # Siempre termina mencionando el horario ("XX.XX hs.").
        intro_regex = r'din[aá]mica comunicacional.*?corrida de proceso.*?(\d{1,2}[.:]\d{2}\s*hs\.?)'
        m_intro = re.search(intro_regex, body_text, re.IGNORECASE | re.DOTALL)
        if m_intro:
            after = body_text[m_intro.end():].strip()
        else:
        # Fallback: si no machó la frase exacta pero logramos atrapar el horario de la intro
            m_hs = re.search(r'\b\d{1,2}[.:]\d{2}\s*hs\.?', body_text[:600], re.IGNORECASE)
            if m_hs:
                after = body_text[m_hs.end():].strip()
            else:
                after = body_text

        # Cortar en el momento que empieza la firma del remitente
        after = re.split(r'PwC Argentina|Price Waterhouse|Manager \| Digital Advisory', after, flags=re.IGNORECASE)[0].strip()

        # Quitar líneas de tabla (solo números/espacios/puntos) y de banco
        lines = re.split(r'[\n\r]+|(?<=\.)\s{2,}', after)
        narrative = [
            ln.strip() for ln in lines
            if ln.strip()
            and len(ln.strip()) > 25
            and not re.match(r'^[\d\s.,\-]+$', ln.strip())
            and not re.match(r'^(BSF|BER|BSJ|BSC|Total|Adelanto|Oferta|Haberes|Prestamos|CCH|CSH|NC)[\s:]*$', ln.strip(), re.I)
            and '[Image]' not in ln
            and 'Forwarded message' not in ln
            and not ln.startswith('De: ')
            and not ln.startswith('Date: ')
            and not ln.startswith('Subject: ')
            and not ln.startswith('To: ')
        ]

        if narrative:
            latest_from    = sm.get("from", "")
            latest_snippet = " ".join(narrative[:4])[:600]
            logger.info(f"[Health] Snippet narrativo extraído ({len(latest_snippet)} chars): {latest_snippet[:80]}...")
            break

    if not latest_snippet and _all_reportes:
        # Fallback: snippet del mail más reciente
        latest_from    = _all_reportes[0].get("from", "")
        latest_snippet = (_all_reportes[0].get("snippet") or "")[:400]

    # Analisis IA (Opcional, con timeout para evitar 502)
    ai_analysis = None
    try:
        settings = get_settings()
        if settings.gemini_api_key and table_rows:
            genai.configure(api_key=settings.gemini_api_key)
            # Solo 1 intento con el modelo más rápido
            model = genai.GenerativeModel("gemini-1.5-flash")
            # 5 segundos o nada, prioridad absoluta a la carga de la tabla
            resp = model.generate_content(prompt, request_options={"timeout": 5.0})
            ai_analysis = resp.text.strip()
            logger.info("[Health] IA exitosa (Flash)")
    except Exception as e:
        logger.warning(f"[Health] IA omitida por estabilidad: {e}")

    except Exception as e:
        logger.warning(f"[Health] IA fallo inesperado general: {e}")

    result = {
        "latestDate":    latest_date,
        "previousDate":  prev_date,
        "latestFrom":    latest_from,
        "latestSnippet": latest_snippet,
        "tableRows":     table_rows,
        "banks":         BANKS,
        "hasAnyIssue":   has_any_issue,
        "aiAnalysis":    ai_analysis,
        "_debug": {
            "detailMailsFound":  len(detail_mails),
            "summaryMailsFound": len(summary_mails),
            "totalMailsCombined": len(all_mails),
            "daysWithData":      sorted_days[:6],
            "cacheFingerprint":  fingerprint[:8],
        }
    }
    # Guardar en caché con el fingerprint actual
    _health_cache["data"]        = result
    _health_cache["ts"]          = now_ts
    _health_cache["fingerprint"] = fingerprint
    logger.info(f"[Health] Resultado guardado en caché — fingerprint={fingerprint[:8]}")
    return result
