import sys
sys.path.append('/home/flink/Documentos/Graficos-GP/backend')
import asyncio, google.generativeai as genai
from app.core.config import get_settings

settings = get_settings()
genai.configure(api_key=settings.gemini_api_key)
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(m.name)
