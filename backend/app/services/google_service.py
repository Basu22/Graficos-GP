import os.path
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)

# Si se modifican estos alcances, elimina el archivo token.json.
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar'
]

def get_google_creds():
    settings = get_settings()
    creds = None
    # El archivo token.json almacena los tokens de acceso y actualización del usuario.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Si no hay credenciales (válidas), permite al usuario iniciar sesión.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Prioridad 1: Variable de entorno en el .env
            if settings.google_credentials_json:
                logger.info("Cargando credenciales de Google desde el .env")
                try:
                    config = json.loads(settings.google_credentials_json)
                    flow = InstalledAppFlow.from_client_config(config, SCOPES)
                except Exception as e:
                    logger.error(f"Error parseando GOOGLE_CREDENTIALS_JSON: {e}")
                    return None
            # Prioridad 2: Archivo físico (fallback)
            elif os.path.exists('credentials.json'):
                logger.info("Cargando credenciales de Google desde archivo credentials.json")
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            else:
                logger.error("No se encontró GOOGLE_CREDENTIALS_JSON en el .env ni el archivo credentials.json")
                return None
            
            # Cambiamos a run_local_server con prints para visibilidad
            print("\n" + "="*50)
            print("🚀 ESPERANDO AUTORIZACIÓN DE GOOGLE...")
            print("Fijate si se abrió una pestaña en tu navegador.")
            print("Si no, buscá el link que aparece acá abajo:")
            print("="*50 + "\n")
            
            creds = flow.run_local_server(port=0)
            
            # Guarda las credenciales para la próxima ejecución
            with open('token.json', 'w') as token:
                token.write(creds.to_json())
            print("\n✅ LOGIN EXITOSO - Token guardado en token.json\n")
    
    return creds

async def get_gmail_threads(max_results=50, days=30):
    """
    Trae los últimos `max_results` mensajes de Gmail del período `days` días.
    Utiliza Batch HTTP Requests de Google API, que permite enviar decenas de 
    peticiones en un solo request HTTP. Evita problemas de concurrencia y vuela. 🚀
    """
    creds = get_google_creds()
    if not creds: return []

    service = build('gmail', 'v1', credentials=creds)
    query = f"newer_than:{days}d"

    # Step 1: Traer la lista de IDs
    results = service.users().messages().list(
        userId='me',
        q=query,
        maxResults=max_results,
    ).execute()

    messages = results.get('messages', [])
    if not messages:
        return []

    detailed = []
    
    # Step 2: Callback que se ejecuta por cada mensaje decodificado del Batch
    def handle_batch_response(request_id, response, exception):
        if exception:
            logger.warning(f"Error procesando mail en batch: {exception}")
            return
        
        try:
            headers = response['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sin asunto')
            sender  = next((h['value'] for h in headers if h['name'] == 'From'), 'Desconocido')
            
            import datetime
            ts = int(response.get('internalDate', 0)) / 1000
            date_iso = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).isoformat()
            
            detailed.append({
                "id":       response['id'],
                "threadId": response.get('threadId', response['id']),
                "subject":  subject,
                "from":     sender,
                "snippet":  response.get('snippet', ''),
                "date":     date_iso,
                "labels":   response.get('labelIds', []),
            })
        except Exception as e:
            logger.warning(f"Error leyendo headers de {response.get('id')}: {e}")

    # Step 3: Construimos el batch request (en chunks de 15 para respetar el rate limit per-second de Google)
    chunk_size = 15
    for i in range(0, len(messages), chunk_size):
        chunk = messages[i:i+chunk_size]
        batch = service.new_batch_http_request(callback=handle_batch_response)
        for msg_stub in chunk:
            req = service.users().messages().get(
                userId='me',
                id=msg_stub['id'],
                format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            )
            batch.add(req)
        
        # Ejecutar chunk liberando el Event Loop para no bloquear otros endpoints
        import asyncio
        batch.execute()
        await asyncio.sleep(0.1)

    # Reordenar por fecha descendente
    detailed.sort(key=lambda x: x.get('date', ''), reverse=True)
    return detailed

async def get_calendar_week():
    """Trae todos los eventos de la semana laboral actual (Lun-Vie)."""
    creds = get_google_creds()
    if not creds: return []

    service = build('calendar', 'v3', credentials=creds)
    from datetime import datetime, timedelta, timezone

    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    friday = monday + timedelta(days=4, hours=23, minutes=59, seconds=59)

    events_result = service.events().list(
        calendarId='primary',
        timeMin=monday.isoformat(),
        timeMax=friday.isoformat(),
        singleEvents=True,
        orderBy='startTime',
        maxResults=100
    ).execute()

    return events_result.get('items', [])

async def get_calendar_today():
    return await get_calendar_week()

async def update_calendar_event(event_id: str, updates: dict):
    """Actualiza un evento. Si cambia horario, envía notificaciones a invitados."""
    creds = get_google_creds()
    if not creds: raise Exception("Sin credenciales Google")
    service = build('calendar', 'v3', credentials=creds)
    updated = service.events().patch(
        calendarId='primary',
        eventId=event_id,
        body=updates,
        sendNotifications=True
    ).execute()
    return updated

async def cancel_calendar_event(event_id: str):
    """Cancela (elimina) un evento y envía mail de cancelación a todos los invitados."""
    creds = get_google_creds()
    if not creds: raise Exception("Sin credenciales Google")
    service = build('calendar', 'v3', credentials=creds)
    service.events().delete(
        calendarId='primary',
        eventId=event_id,
        sendNotifications=True
    ).execute()
    return {"ok": True}

async def check_calendar_conflicts(start_iso: str, end_iso: str, exclude_event_id: str = None):
    """Detecta conflictos de calendario en un rango dado."""
    creds = get_google_creds()
    if not creds: return []
    service = build('calendar', 'v3', credentials=creds)
    result = service.events().list(
        calendarId='primary',
        timeMin=start_iso,
        timeMax=end_iso,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    events = result.get('items', [])
    if exclude_event_id:
        events = [e for e in events if e['id'] != exclude_event_id]
    return events

async def add_event_attendee(event_id: str, email: str, display_name: str = None):
    """Agrega un participante al evento y envía invitación."""
    creds = get_google_creds()
    if not creds: raise Exception("Sin credenciales Google")
    service = build('calendar', 'v3', credentials=creds)
    event = service.events().get(calendarId='primary', eventId=event_id).execute()
    attendees = event.get('attendees', [])
    if any(a['email'] == email for a in attendees):
        raise Exception(f"{email} ya es participante del evento")
    new_attendee = {'email': email}
    if display_name:
        new_attendee['displayName'] = display_name
    attendees.append(new_attendee)
    updated = service.events().patch(
        calendarId='primary',
        eventId=event_id,
        body={'attendees': attendees},
        sendNotifications=True
    ).execute()
    return updated

async def remove_event_attendee(event_id: str, email: str):
    """Elimina un participante del evento y envía notificación de cancelación."""
    creds = get_google_creds()
    if not creds: raise Exception("Sin credenciales Google")
    service = build('calendar', 'v3', credentials=creds)
    
    # 1. Obtenemos el evento completo actual
    event = service.events().get(calendarId='primary', eventId=event_id).execute()
    attendees = event.get('attendees', [])
    
    # 2. Filtramos (Case-insensitive y sin espacios)
    search_email = email.strip().lower()
    new_attendees = [a for a in attendees if a.get('email', '').strip().lower() != search_email]
    
    if len(new_attendees) == len(attendees):
        # Si no lo encontramos, puede que ya no esté o el mail sea distinto
        logger.warning(f"Participante {email} no encontrado en la lista actual. Mails presentes: {[a.get('email') for a in attendees]}")
        return event

    # 3. Aplicamos el cambio usando UPDATE (reemplazo total) en lugar de patch
    event['attendees'] = new_attendees
    
    # Limpiamos campos que Google no quiere en el update si vienen del get
    fields_to_remove = ['etag', 'updated', 'created', 'creator', 'organizer']
    for field in fields_to_remove:
        event.pop(field, None)

    logger.info(f"Enviando update para {event_id}. Participantes restantes: {len(new_attendees)}")
    
    updated = service.events().update(
        calendarId='primary',
        eventId=event_id,
        body=event,
        sendNotifications=True
    ).execute()
    
    return updated

