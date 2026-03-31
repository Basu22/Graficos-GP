import google.generativeai as genai
from app.core.config import get_settings
from app.schemas.metrics import ExecutiveKPIs
from cachetools import TTLCache
import logging
import hashlib
import json

logger = logging.getLogger(__name__)

# Caché de 1 hora para hasta 100 combinaciones de métricas
synthesis_cache = TTLCache(maxsize=100, ttl=3600)

async def generate_synthesis_ai(kpis: ExecutiveKPIs, team_name: str) -> list[dict]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return [{"text": "Gemini API Key no configurada.", "type": "yellow"}]

    # Generar una llave de caché basada en el equipo y los valores de los KPIs
    kpi_data = {
        "closed": kpis.closed_points,
        "total": kpis.total_points,
        "predictability": kpis.predictability_avg,
        "lead_time": kpis.lead_time_avg,
        "scope_creep": kpis.scope_creep_total,
        "efficiency": kpis.efficiency_improvement_pct
    }
    kpi_hash = hashlib.md5(json.dumps(kpi_data, sort_keys=True).encode()).hexdigest()
    cache_key = f"{team_name}_{kpi_hash}"
    
    if cache_key in synthesis_cache:
        logger.info(f"Usando síntesis de caché para {team_name}")
        return synthesis_cache[cache_key]

    try:
        genai.configure(api_key=settings.gemini_api_key)
        
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        
        if not available_models:
            raise Exception("Tu API Key no tiene acceso a modelos de generación.")
        
        selected_model_name = next((m for m in ['models/gemini-2.5-flash', 'models/gemini-2.0-flash', 'models/gemini-2.0-flash-lite'] 
                                   if m in available_models), available_models[0])
            
        logger.info(f"Usando modelo Gemini: {selected_model_name}")
        model = genai.GenerativeModel(selected_model_name)

        prompt = f"""
        Actúa como un experto en Agile y Delivery Manager. 
        Analiza las métricas del equipo '{team_name}' y genera 3 a 4 puntos clave tipo semáforo.
        
        Métricas actuales:
        - Puntos Cerrados: {kpis.closed_points} de {kpis.total_points}
        - Predictibilidad Say/Do: {kpis.predictability_avg}%
        - Lead Time Medio: {kpis.lead_time_avg} días
        - Scope Creep (puntos agregados): {kpis.scope_creep_total}
        - Mejora de Eficiencia: {kpis.efficiency_improvement_pct}%
        
        REGLAS CRÍTICAS: 
        1. NO escribas introducciones ni saludos.
        2. Empieza CADA línea con [VERDE], [AMARILLO] o [ROJO].
        3. CRITERIOS DE COLOR (Sé objetivo):
           - [VERDE]: Predictibilidad >= 85%, Mejora Lead Time > 0 (si es <10 días), Cierre total > 90%.
           - [AMARILLO]: Predictibilidad 75-84%, Lead Time estable, Scope Creep moderado.
           - [ROJO]: Predictibilidad < 75%, Scope Creep > 20% del total, Lead Time > 15 días.
        4. Sé breve, profesional y directo (formato ejecutivo).
        """

        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        
        raw_lines = [line.strip() for line in text.split('\n') if line.strip()]
        processed_points = []
        
        # Palabras comunes en intros que queremos filtrar si Gemini desobedece
        intro_keywords = ["AQUÍ TIENES", "ESTE ES EL ANÁLISIS", "ANÁLISIS DE LAS MÉTRICAS", "SÍNTESIS PARA EL EQUIPO"]
        
        for line in raw_lines:
            # Si la línea parece una intro, ignorarla
            if any(key in line.upper() for key in intro_keywords) and "[" not in line:
                continue
                
            line = line.lstrip('-*•').strip()
            if not line: continue
            
            p_type = "green"
            if "[ROJO]" in line.upper() or "RED" in line.upper(): p_type = "red"
            elif "[AMARILLO]" in line.upper() or "YELLOW" in line.upper(): p_type = "yellow"
            
            # Limpieza profunda de tags en cualquier idioma/formato
            clean_text = line
            for tag in ["[VERDE]", "[AMARILLO]", "[ROJO]", "GREEN:", "YELLOW:", "RED:", "[GREEN]", "[YELLOW]", "[RED]"]:
                clean_text = clean_text.replace(tag, "").replace(tag.lower(), "").replace(tag.upper(), "")
            
            clean_text = clean_text.strip().lstrip(':').strip()
            
            if clean_text and len(clean_text) > 5:
                processed_points.append({"text": clean_text, "type": p_type})

        # Si aún queda una intro (a veces no traen tags), la sacamos
        if processed_points and ("Aquí tiene" in processed_points[0]['text'] or "Este es" in processed_points[0]['text']):
            processed_points.pop(0)

        final_points = processed_points[:4]
        if not final_points and text:
            final_points = [{"text": text[:500], "type": "green"}]
            
        synthesis_cache[cache_key] = final_points
        return final_points

    except Exception as e:
        error_str = str(e)
        logger.error(f"Error llamando a Gemini: {e}")
        
        if "429" in error_str or "ResourceExhausted" in error_str:
            return [{
                "text": "⚠️ Asistente IA descansando (Cuota diaria alcanzada). Las métricas siguen siendo visibles, pero el análisis automático se ha pausado.",
                "type": "yellow"
            }]
        
        return [{"text": f"Error en análisis IA: {error_str[:50]}...", "type": "red"}]

async def generate_weekly_plan(mails_data: list[dict]) -> list[dict]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return []

    try:
        genai.configure(api_key=settings.gemini_api_key)
        # Mismo mecanismo dinámico que el reporte ejecutivo
        available_models = [m.name for m in genai.list_models() 
                            if 'generateContent' in m.supported_generation_methods]
        if not available_models:
            logger.error("No hay modelos de Gemini disponibles")
            return []
        
        model_name = available_models[0]
        logger.info(f"Generando plan semanal con modelo: {model_name}")
        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config={"response_mime_type": "application/json"}
        )

        mails_summary = [
            f"DE: {m.get('from', 'Desconocido')} | ASUNTO: {m.get('subject', 'Sin asunto')} | SNIPPET: {m.get('snippet', '')}"
            for m in mails_data[:20]
        ]
        
        prompt = f"""
        Eres un asistente de productividad experto. 
        Lee los siguientes correos electrónicos recibidos esta semana (lunes a domingo actual):
        
        {json.dumps(mails_summary, indent=2)}
        
        REQUISITOS:
        1. Por cada día de la semana (donde sea necesario) genera tareas accionables.
        2. Cada tarea debe tener: title, detail, origin (from + subject del mail), priority (alta|media|baja) e icon (emoji).
        3. Incluye un "summary" de una línea por cada día que tenga tareas.
        4. Si un mail es URRENGTE o de un CLIENTE, ponle prioridad 'alta'.
        5. Devuelve ÚNICAMENTE un JSON válido en este formato exacto, sin markdown ni texto extra:
        [
          {{
            "dayIndex": 0-6,
            "summary": "...",
            "tasks": [
              {{
                "title": "...",
                "detail": "...",
                "origin": "...",
                "priority": "alta|media|baja",
                "icon": "🚀"
              }}
            ]
          }}
        ]
        """
        
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        
        logger.info(f"Gemini RAW response (Weekly Plan): {text}")
        
        # Limpieza agresiva de markdown por si Gemini desobedece
        clean_text = text
        if "```" in text:
            import re
            match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
            if match:
                clean_text = match.group(1).strip()
            else:
                clean_text = text.replace("```json", "").replace("```", "").strip()

        try:
            return json.loads(clean_text)
        except json.JSONDecodeError:
            logger.error(f"Error parseando JSON de Gemini. RAW text: {text}")
            # Intento desesperado de rescate si el JSON está mal formado
            return []

    except Exception as e:
        logger.error(f"Error generando plan semanal AI: {e}")
        return []
