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
        threads = await get_gmail_threads(max_results=100, days=30)
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
        creds = get_google_creds()
        service = build('calendar', 'v3', credentials=creds)
        tz = "America/Argentina/Buenos_Aires"
        event_body = {
            "summary": body.title,
            "description": body.description or "",
            "start": {"dateTime": body.start, "timeZone": tz},
            "end":   {"dateTime": body.end,   "timeZone": tz},
        }
        if body.attendees:
            event_body["attendees"] = [{"email": e} for e in body.attendees if e]
        created = service.events().insert(
            calendarId="primary",
            body=event_body,
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
# ─────────────────────────────────────────────────────────────────
import csv, io, httpx, re
from functools import lru_cache
from datetime import datetime as _dt

SHEET_ID = "1bEb7w_iBqHbuPFNlBFi9jVZFtos1-VfFuI8npxVimkk"
SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"

# Cache TTL simple (resetteable forzando un nuevo endpoint call)
_config_cache = {"data": None, "ts": 0, "ttl": 300}

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
        logger.warning(f"No se pudo leer el Sheet de configuración: {e}")
        return _config_cache["data"] or []

@router.get("/inbox-config")
async def get_inbox_config(refresh: bool = False):
    """
    Retorna la configuración de criterios del Smart Inbox
    cargada desde Google Sheets. TTL de 5 minutos.
    """
    rows = await fetch_sheet_config(force_refresh=refresh)
    if not rows:
        raise HTTPException(status_code=503, detail="No se pudo obtener la configuración del Sheet")
    return {"config": rows, "source": SHEET_CSV_URL, "cached": not refresh}


# ─────────────────────────────────────────────────────────────────
# HEALTH REPORT — Parser con tabla Productos × Bancos
# Fuente: 4 mails/día de operativagobdato@gbsj.com.ar
# Asunto real: "Detalle de ofertas cargadas | BSF |20260406"
# Fecha en formato YYYYMMDD (sin barras)
# ─────────────────────────────────────────────────────────────────

BANKS = ["BSF", "BER", "BSJ", "BSC"]

PRODUCT_DEFS = [
    {"key": "haberes",   "label": "Adelanto de Haberes",  "patterns": ["adelanto de haberes", "haberes"]},
    {"key": "prestamos", "label": "Oferta Préstamos",     "patterns": ["oferta prestamos", "oferta préstamos", "prestamos"]},
    {"key": "cch",       "label": "Oferta Tarjeta – CCH", "patterns": [r"oferta tarjeta.*cch", r"tarjeta.*cch", r"\bcch\b"]},
    {"key": "csh",       "label": "Oferta Tarjeta – CSH", "patterns": [r"oferta tarjeta.*csh", r"tarjeta.*csh", r"\bcsh\b"]},
    {"key": "nc",        "label": "Oferta Tarjeta – NC",  "patterns": [r"oferta tarjeta.*\bnc\b", r"no cliente"]},
]

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


@router.post("/health-report/analyze")
async def analyze_health_reports(emails: list[dict]):
    """
    Construye la tabla Monitor de Salud (Productos × Bancos con diff%).

    Flujo:
    1. Filtra mails individuales de operativagobdato@gbsj.com.ar
       con asunto "Detalle de Ofertas Cargadas | BANCO | FECHA"
    2. Agrupa por fecha extraída del asunto (no del campo date)
    3. Compara los 2 DIAS MAS RECIENTES con datos reales
    4. Tabla: filas=Productos, columnas=Bancos+Total con diff%
    """
    OPERATIVA_SENDER = "operativagobdato"
    DETAIL_KEYWORD   = "detalle de ofertas"
    SUMMARY_KEYWORDS = ["reporte diario", "estado de ofertas"]

    detail_mails, summary_mails = [], []
    for m in emails:
        subj = (m.get("subject") or "").lower()
        frm  = (m.get("from")   or "").lower()
        if (OPERATIVA_SENDER in frm or OPERATIVA_SENDER in subj) and DETAIL_KEYWORD in subj:
            detail_mails.append(m)
        elif any(kw in subj for kw in SUMMARY_KEYWORDS):
            summary_mails.append(m)

    logger.info(f"[Health] detail={len(detail_mails)} summary={len(summary_mails)}")

    # Agrupar por fecha reportada: {YYYY-MM-DD: {BANCO: {prod_key: valor}}}
    days = {}
    for mail in detail_mails:
        subj  = mail.get("subject") or ""
        bank  = _extract_bank_from_subject(subj)
        fdate = _extract_date_from_subject(subj) or (mail.get("date") or "")[:10]
        if not bank or not fdate:
            continue
        content = f"{subj} {mail.get('snippet','') or ''} {mail.get('body','') or ''}"
        products = _extract_products_from_text(content)
        if fdate not in days:
            days[fdate] = {}
        days[fdate][bank] = products
        logger.debug(f"[Health] {fdate}/{bank} -> {products}")

    # Fallback: intentar parsear mails de resumen si hay menos de 2 dias con datos
    if len(days) < 2 and summary_mails:
        summary_mails.sort(key=lambda x: x.get("date", ""), reverse=True)
        other_banks_pat = '|'.join(b for b in BANKS)  # pre-compila fuera del loop
        for sm in summary_mails[:6]:
            dk = (sm.get("date") or "")[:10]
            if dk and dk not in days:
                text = f"{sm.get('subject','')} {sm.get('snippet','')} {sm.get('body','')}"
                day_data = {}
                for bank in BANKS:
                    try:
                        # Busca el bloque de texto asociado a cada banco
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
    latest_day  = days[latest_date]
    prev_day    = days[prev_date] if prev_date else {}
    logger.info(f"[Health] Comparando {latest_date} vs {prev_date}")

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
            row["banks"][bank] = {"current": curr, "previous": prev, "diff": diff}
            row["total_current"]  += curr
            row["total_previous"] += prev
        row["total_diff"] = _calc_diff(row["total_current"], row["total_previous"])
        if row["total_diff"] is not None and row["total_diff"] < -5:
            has_any_issue = True
        if row["total_current"] > 0 or row["total_previous"] > 0:
            table_rows.append(row)

    # Extraer snippet de análisis del "Reporte Diario de Estado de Ofertas"
    # Se buscan oraciones que contengan palabras clave de análisis real
    ANALYSIS_KEYWORDS = [
        r'\bcaída\b', r'\bbajada\b', r'\bsubida\b', r'\balza\b', r'\bincremento\b',
        r'\bdisminución\b', r'\bdecreto\b', r'\bbaja\b', r'\bsube\b', r'\bbajan\b',
        r'\bsuben\b', r'\bvariación\b', r'\baumento\b', r'\bdescenso\b',
        r'\bcaen\b', r'\bsube\b', r'\bcayó\b', r'\bsubió\b', r'\baumentó\b',
    ]
    ANALYSIS_PAT = re.compile('|'.join(ANALYSIS_KEYWORDS), re.IGNORECASE)

    latest_snippet, latest_from = "", ""
    if summary_mails:
        summary_mails.sort(key=lambda x: x.get("date", ""), reverse=True)
        sm = summary_mails[0]
        latest_from = sm.get("from", "")
        full_text = " ".join([
            sm.get("snippet", "") or "",
            sm.get("body", "") or "",
        ]).strip()
        # Dividir en oraciones y buscar las que tienen análisis
        sentences = re.split(r'(?<=[.!?])\s+|[\n\r]+', full_text)
        analysis_sentences = [
            s.strip() for s in sentences
            if ANALYSIS_PAT.search(s) and len(s.strip()) > 20
        ]
        if analysis_sentences:
            latest_snippet = " ".join(analysis_sentences[:6])[:600]
        else:
            # Fallback: primeros 400 chars del snippet
            latest_snippet = (sm.get("snippet") or "")[:400]


    # Analisis IA
    ai_analysis = None
    try:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        models = [m.name for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
        if models and table_rows:
            model = genai.GenerativeModel(models[0])
            var_lines = [
                f"- {row['label']}: {'sube' if (row['total_diff'] or 0) > 0 else 'baja'} {abs(row['total_diff'] or 0)}% (total actual {row['total_current']:,})"
                for row in table_rows if row["total_diff"] is not None
            ]
            other_ctx = [
                f"  [{m.get('from','')}] {m.get('subject','')}: {(m.get('snippet','') or '')[:80]}"
                for m in emails[:25]
                if OPERATIVA_SENDER not in (m.get("from","") or "").lower() and m.get("snippet")
            ]
            prompt = f"""Sos analista del equipo de Oferta Minorista (bancos BSF, BER, BSJ, BSC).

Comparacion {latest_date} vs {prev_date or "dia anterior"}:
{chr(10).join(var_lines) or "Sin variaciones detectadas."}

Snippet del reporte diario:
{latest_snippet[:250] if latest_snippet else "No disponible."}

Otros mails del inbox:
{chr(10).join(other_ctx[:8])}

En maximo 3 puntos sin markdown:
1. Que banco/producto tuvo mayor impacto y en que direccion
2. Si algun mail explica la variacion (falla tecnica, feriado, politica)
3. Recomendacion de accion si hay baja significativa
Responde en espanol, maximo 90 palabras."""
            ai_analysis = model.generate_content(prompt).text.strip()
    except Exception as e:
        logger.warning(f"[Health] IA fallo: {e}")

    return {
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
            "daysWithData":      sorted_days[:6],
        }
    }
