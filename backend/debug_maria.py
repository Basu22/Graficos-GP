import asyncio
import sys
import os

# Añadir el path del backend
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.jira_client import JiraClient
from app.services.person_stats_service import get_person_stats

async def debug():
    client = JiraClient()
    print("🚀 Iniciando debug para Maria Teresa Bravo...")
    try:
        # Probamos obtener los stats de Maria Teresa para Q1 2026
        # El equipo según la captura es "Back"
        stats = await get_person_stats(
            client, 
            assignee_name="Maria Teresa Bravo", 
            team="Back", 
            quarter=1, 
            year=2026
        )
        print("✅ Stats obtenidos con éxito!")
        print(f"Sprints encontrados: {stats.get('sprints_analyzed')}")
        print(f"Tickets en historial: {len(stats.get('history_tickets', []))}")
        
        # Verificamos si hay subtareas en el primer ticket
        if stats.get('history_tickets'):
            first = stats['history_tickets'][0]
            print(f"Ticket: {first['key']} - Subtareas: {len(first.get('subtasks_detail', []))}")
            
    except Exception as e:
        print(f"❌ ERROR DETECTADO: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug())
