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
    'https://www.googleapis.com/auth/calendar.readonly'
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
            
            creds = flow.run_local_server(port=0)
        
        # Guarda las credenciales para la próxima ejecución
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    return creds

async def get_gmail_threads(max_results=20):
    creds = get_google_creds()
    if not creds: return []
    
    service = build('gmail', 'v1', credentials=creds)
    results = service.users().threads().list(userId='me', maxResults=max_results).execute()
    threads = results.get('threads', [])
    
    detailed_threads = []
    for t in threads:
        thread = service.users().threads().get(userId='me', id=t['id']).execute()
        msg = thread['messages'][0] # Primer mensaje para el asunto/remitente
        headers = msg['payload']['headers']
        
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sin asunto')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Desconocido')
        snippet = msg.get('snippet', '')
        
        detailed_threads.append({
            "id": t['id'],
            "subject": subject,
            "from": sender,
            "snippet": snippet,
            "internalDate": msg['internalDate']
        })
        
    return detailed_threads

async def get_calendar_today():
    creds = get_google_creds()
    if not creds: return []
    
    service = build('calendar', 'v3', credentials=creds)
    from datetime import datetime, timedelta
    
    now = datetime.utcnow().isoformat() + 'Z'
    end_of_day = (datetime.utcnow() + timedelta(days=1)).isoformat() + 'Z'
    
    events_result = service.events().list(
        calendarId='primary', timeMin=now, timeMax=end_of_day,
        singleEvents=True, orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])
    return events
