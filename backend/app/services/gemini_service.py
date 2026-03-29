import google.generativeai as genai
from app.core.config import get_settings
from app.schemas.metrics import ExecutiveKPIs
import logging

logger = logging.getLogger(__name__)

async def generate_synthesis_ai(kpis: ExecutiveKPIs, team_name: str) -> list[str]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return []

    try:
        genai.configure(api_key=settings.gemini_api_key)
        
        # DESCUBRIMIENTO DINÁMICO: En lugar de adivinar el nombre, 
        # le preguntamos a la API qué modelos tiene permitidos esta Key.
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        
        if not available_models:
            raise Exception("Tu API Key no tiene acceso a ningún modelo de generación de contenido (Generative Language API).")
        
        # Prioridad: Flash 1.5 > Flash latest > Pro > El primero que encuentre
        selected_model_name = None
        for preferred in ['models/gemini-1.5-flash', 'models/gemini-1.5-flash-latest', 'models/gemini-pro']:
            if preferred in available_models:
                selected_model_name = preferred
                break
        
        if not selected_model_name:
            selected_model_name = available_models[0]
            
        logger.info(f"Usando modelo Gemini: {selected_model_name}")
        model = genai.GenerativeModel(selected_model_name)

        prompt = f"""
        Actúa como un experto en Agile y Delivery Manager. 
        Analiza las siguientes métricas del equipo '{team_name}' y genera una síntesis estratégica formal y ejecutiva.
        
        Métricas actuales:
        - Puntos Cerrados: {kpis.closed_points} de {kpis.total_points} comprometidos.
        - Predictibilidad Media: {kpis.predictability_avg}% (Objetivo ideal: >80%).
        - Lead Time Medio (Tiempo de entrega): {kpis.lead_time_avg} días.
        - Cambio de Alcance (Scope Creep): {kpis.scope_creep_total} puntos agregados durante los sprints.
        - Mejora de Eficiencia (Lead Time Trend): {kpis.efficiency_improvement_pct}% (valor positivo es mejora).

        Instrucciones:
        1. Genera exactamente 4 puntos (bullets).
        2. Sé directo, profesional y enfocado en la mejora continua.
        3. El primer punto debe ser sobre el volumen y cumplimiento.
        4. El segundo sobre la predictibilidad y estabilidad.
        5. El tercero sobre la eficiencia del flujo (Lead Time).
        6. El cuarto debe ser una recomendación estratégica de alto nivel.
        7. No uses negritas (**). Solo texto plano.
        8. Idioma: Español.
        """

        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        
        # Procesar los bullets (asumiendo que vienen con -, * o n.)
        lines = [line.strip().lstrip('-*•').strip() for line in text.split('\n') if line.strip()]
        return lines[:4] # Asegurar 4 puntos

    except Exception as e:
        error_str = str(e)
        if "429" in error_str or "ResourceExhausted" in error_str:
            return [
                "⚠️ Asistente IA descansando (Cuota diaria alcanzada).",
                "Las métricas siguen siendo visibles, pero el análisis automático se ha pausado.",
                "Reintentar en 24hs o contactar al administrador.",
                "Sugerencia: Revisar la tendencia de Predictibilidad manualmente."
            ]
        
        logger.error(f"Error llamando a Gemini: {e}")
        return [f"Error en análisis IA: {error_str[:50]}..."]
