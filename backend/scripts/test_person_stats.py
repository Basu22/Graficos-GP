import asyncio
import httpx
import sys
import json
from typing import Optional

async def test_person_stats(base_url: str, person_id: str, team: str):
    print(f"\n🔍 Iniciando diagnóstico para ID: {person_id} (Equipo: {team})")
    print("-" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{base_url}/api/v1/people/{person_id}/stats?team={team}"
        try:
            print(f"📡 Llamando a: {url}")
            r = await client.get(url)
            
            if r.status_code != 200:
                print(f"❌ ERROR: La API devolvió status {r.status_code}")
                print(f"Detalle: {r.text}")
                return

            data = r.json()
            print("✅ Conexión exitosa con el Backend.")
            
            # 1. Validación de Sprint Activo
            active = data.get("active_sprint", {})
            sprint_name = active.get("name")
            if sprint_name:
                print(f"🟢 Sprint Activo detectado: {sprint_name}")
                tickets = active.get("tickets", [])
                print(f"   🎫 Tickets en el sprint: {len(tickets)}")
                
                # Verificar subtareas y horas en el primer ticket que tenga
                for t in tickets:
                    st = t.get("subtasks_detail", [])
                    if st:
                        total_h = sum(s.get("hours", 0) for s in st)
                        print(f"   🛠️ Trazabilidad OK: Ticket {t['key']} tiene {len(st)} subtareas ({total_h}h totales).")
                        break
            else:
                print("⚠️ No se detectó sprint activo para este equipo.")

            # 2. Validación de Historial
            history = data.get("history_tickets", [])
            sprints_analyzed = data.get("sprints_analyzed", [])
            print(f"📋 Historial: {len(history)} tickets encontrados en {len(sprints_analyzed)} sprints.")

            # 3. Validación de Métricas
            metrics = {
                "Velocidad": data.get("avg_velocity"),
                "Predictibilidad": data.get("predictability_pct"),
                "Cycle Time": data.get("avg_cycle_time")
            }
            print(f"📊 Métricas calculadas: {metrics}")

            print("-" * 60)
            print("✨ DIAGNÓSTICO FINALIZADO CON ÉXITO")

        except Exception as e:
            print(f"🚨 FALLO CRÍTICO: {str(e)}")

if __name__ == "__main__":
    # Configuración por defecto
    BASE = "http://localhost:8000"
    
    if len(sys.argv) < 3:
        print("Uso: python3 test_person_stats.py <PERSON_ID> <TEAM>")
        print("Ejemplo: python3 test_person_stats.py 78e7d32f-a40b-4020-bc88-43d4d17a2ab8 Back")
        sys.exit(1)
        
    p_id = sys.argv[1]
    p_team = sys.argv[2]
    
    asyncio.run(test_person_stats(BASE, p_id, p_team))
