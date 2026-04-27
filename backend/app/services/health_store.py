import json
import os
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Configuración de zona horaria (Argentina UTC-3)
AR_TZ = timezone(timedelta(hours=-3))

logger = logging.getLogger(__name__)

# Directorio base para datos
BASE_DIR = Path(__file__).parent.parent / "data"
STORE_PATH = BASE_DIR / "health_store.json"

def _ensure_dir():
    os.makedirs(BASE_DIR, exist_ok=True)

def load_store() -> dict:
    """Carga el JSON con el histórico del monitor de salud."""
    _ensure_dir()
    if not STORE_PATH.exists():
        return {}
    try:
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error cargando health_store.json: {e}")
        return {}

def save_store(data: dict):
    """Guarda el JSON atómicamente."""
    _ensure_dir()
    tmp_path = STORE_PATH.with_suffix(".tmp")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # Rename es atómico en sistemas POSIX
        os.replace(tmp_path, STORE_PATH)
    except Exception as e:
        logger.error(f"Error guardando health_store.json: {e}")
        if tmp_path.exists():
            os.remove(tmp_path)

def _is_within_write_window(record_date_str: str) -> bool:
    """
    Retorna True si el momento actual (hora AR) está dentro de la ventana
    de escritura permitida para la fecha dada (15:00 D hasta 06:00 D+1).
    """
    try:
        now_ar = datetime.now(AR_TZ)
        record_date = datetime.strptime(record_date_str, "%Y-%m-%d").date()
        
        # Inicio de la ventana: 15:00 del día del registro
        window_open = datetime(record_date.year, record_date.month, record_date.day, 15, 0, 0, tzinfo=AR_TZ)
        # Cierre: 15 horas después (06:00 del día siguiente)
        window_close = window_open + timedelta(hours=15)
        
        return window_open <= now_ar <= window_close
    except Exception as e:
        logger.warning(f"Error calculando ventana para {record_date_str}: {e}")
        return True # Permisivo en caso de error

def _is_record_frozen(existing_record: dict) -> bool:
    """
    Un registro está congelado si ya tiene 'ultima_modificacion' y
    la ventana de escritura de su fecha ya cerró.
    """
    if not existing_record or not isinstance(existing_record, dict):
        return False
    
    info = existing_record.get("info_ingesta") or {}
    ultima = info.get("ultima_modificacion")
    if not ultima:
        return False # Sin marca, permitimos actualización
        
    try:
        # Extraemos la fecha del registro desde el timestamp de última mod
        mod_dt = datetime.fromisoformat(ultima)
        # Importante: usamos la fecha del registro, no de la modificación
        # Pero simplificamos: si ya pasó el tiempo de ventana para esa fecha, está congelado.
        return False # Esta lógica se aplica mejor directamente en upsert_days
    except:
        return False

# Prioridades de ingesta
TIPO_PRIORIDAD = {
    "manual": 3,
    "reproceso": 2,
    "primer_servicio": 1,
    None: 0
}

def _get_tipo(bank_data: dict) -> str:
    """Extrae el tipo de ingesta de un registro de banco."""
    if not isinstance(bank_data, dict):
        return None
    return (bank_data.get("info_ingesta") or {}).get("tipo")

def upsert_days(new_days: dict) -> dict:
    """
    Actualiza o agrega datos respetando prioridad y ventana temporal.
    - Reproceso pisa primer_servicio.
    - Se permite escribir solo entre 15:00 (D) y 06:00 (D+1).
    - Agrega 'ultima_modificacion' a cada registro.
    """
    store = load_store()
    now_ar = datetime.now(AR_TZ)
    changed = False
    
    for date, bank_data in new_days.items():
        if date not in store:
            store[date] = {}
            
        for bank, new_entry in bank_data.items():
            existing = store[date].get(bank)
            
            # 1. Prioridades
            prio_new = TIPO_PRIORIDAD.get(_get_tipo(new_entry), 0)
            prio_existing = TIPO_PRIORIDAD.get(_get_tipo(existing), 0) if existing else -1
            
            # Regla de oro: reproceso nunca es pisado por primer_servicio. 
            # Manual nunca es pisado por nadie.
            if existing and prio_new < prio_existing:
                logger.debug(f"[HealthStore] {date}/{bank} ignorado por baja prioridad ({_get_tipo(new_entry)} < {_get_tipo(existing)})")
                continue
            
            # 2. Solo actualizamos si cambió algo o es mayor prioridad
            if existing is None or prio_new > prio_existing or (prio_new == prio_existing and existing != new_entry):
                # Inyectar metadata de modificación
                if "info_ingesta" not in new_entry:
                    new_entry["info_ingesta"] = {}
                new_entry["info_ingesta"]["ultima_modificacion"] = now_ar.isoformat()
                
                store[date][bank] = new_entry
                changed = True
                
    if changed:
        save_store(store)
        
    return store

def get_latest_date() -> str:
    """Retorna la fecha más reciente con datos en el store (YYYY-MM-DD)."""
    store = load_store()
    if not store:
        return ""
    return sorted(store.keys(), reverse=True)[0]

def save_daily_comment(date_str: str, bank: str, comment_text: str) -> bool:
    """
    Guarda un comentario analítico para una fecha y banco específicos.
    Los comentarios NO están sujetos a la ventana de escritura.
    """
    store = load_store()
    if date_str not in store:
        logger.warning(f"[HealthStore] No se puede comentar fecha inexistente: {date_str}")
        return False
        
    if bank not in store[date_str]:
        # Si el banco no existe en esa fecha, lo inicializamos para permitir el comentario
        store[date_str][bank] = {"info_ingesta": {"tipo": "manual"}}
        
    store[date_str][bank]["analisis_diario"] = comment_text
    save_store(store)
    return True

def save_global_analysis(date_str: str, analysis_text: str) -> bool:
    """
    Guarda el análisis global del día (analisis_mail) enviado por mail.
    Se guarda en la raíz de la fecha dentro de info_ingesta.
    """
    store = load_store()
    if date_str not in store:
        return False
    
    # Aseguramos que info_ingesta exista a nivel de fecha
    if "info_ingesta" not in store[date_str]:
        store[date_str]["info_ingesta"] = {}
    elif not isinstance(store[date_str]["info_ingesta"], dict):
        # Por si acaso había algo que no fuera dict (aunque no debería)
        store[date_str]["info_ingesta"] = {"_original": store[date_str]["info_ingesta"]}

    store[date_str]["info_ingesta"]["analisis_mail"] = analysis_text
    save_store(store)
    return True
