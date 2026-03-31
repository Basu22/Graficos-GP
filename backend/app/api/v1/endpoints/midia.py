from fastapi import APIRouter, Depends, HTTPException
from app.services.google_service import get_gmail_threads, get_calendar_today, get_google_creds
from app.services.gemini_service import generate_weekly_plan
import logging

router = APIRouter(prefix="/midia", tags=["midia"])
logger = logging.getLogger(__name__)

@router.get("/data")
async def get_midia_data():
    """
    Obtiene los datos iniciales para la solapa Mi Día:
    - Mails (Threads)
    - Eventos de hoy
    """
    try:
        threads = await get_gmail_threads(max_results=30)
        events = await get_calendar_today()
        
        # Categorización básica por keywords (esto lo ampliará la IA después)
        categorized = {
            "clientes": [],
            "tickets": [],
            "equipo": [],
            "notif": []
        }
        
        for t in threads:
            subj = t['subject'].lower()
            if any(k in subj for k in ['factura', 'cliente', 'reunion', 'pago']):
                categorized['clientes'].append(t)
            elif any(k in subj for k in ['jira', 'bug', 'ticket', 'issue']):
                categorized['tickets'].append(t)
            elif any(k in subj for k in ['equipo', 'sync', 'almuerzo']):
                categorized['equipo'].append(t)
            else:
                categorized['notif'].append(t)
                
        return {
            "mail_groups": categorized,
            "events": events,
            "google_connected": get_google_creds() is not None
        }
    except Exception as e:
        logger.error(f"Error en Mi Dia data: {e}")
        return {"error": str(e), "google_connected": False}

@router.post("/generate-plan")
async def generate_plan(mails: list[dict]):
    """
    Toma una lista de mails y genera el plan semanal AI.
    """
    logger.info(f"generate-plan recibió {len(mails)} mails")
    if mails:
        logger.info(f"Ejemplo del primer mail recibido: {mails[0]}")
    
    if not mails:
        raise HTTPException(status_code=400, detail="No hay mails para procesar")
    
    plan = await generate_weekly_plan(mails)
    logger.info(f"Plan generado: {len(plan)} días")
    return plan
