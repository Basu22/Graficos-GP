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
        
        selected_model_name = next((m for m in ['models/gemini-1.5-flash', 'models/gemini-pro'] 
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
        
        IMPORTANTE: 
        1. Clasifica cada punto empezando con [VERDE], [AMARILLO] o [ROJO].
        2. [VERDE]: Logros, mejoras notables o métricas saludables.
        3. [AMARILLO]: Áreas de atención, alertas leves o estabilidad sin mejora.
        4. [ROJO]: Riesgos críticos, bloqueos o degradación de métricas.
        5. Sé breve, profesional y directo (formato ejecutivo).
        6. No uses negritas (**). Solo texto plano.
        """

        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        
        raw_lines = [line.strip() for line in text.split('\n') if line.strip()]
        processed_points = []
        
        for line in raw_lines:
            # Limpiar prefijos comunes de bullets
            line = line.lstrip('-*•').strip()
            if not line: continue
            
            # Determinar tipo
            p_type = "green"
            if "[ROJO]" in line.upper(): p_type = "red"
            elif "[AMARILLO]" in line.upper(): p_type = "yellow"
            
            # Limpiar tags
            clean_text = line.replace("[VERDE]", "").replace("[AMARILLO]", "").replace("[ROJO]", "").strip()
            if clean_text:
                processed_points.append({"text": clean_text, "type": p_type})

        # Cache before returning
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
