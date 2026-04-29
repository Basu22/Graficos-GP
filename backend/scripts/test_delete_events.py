import requests
import json

API = "http://localhost:8000/api/v1"

def test():
    print("--- Test de Gestión de Eventos ---")
    
    # 1. Crear un Sprint Manual
    sprint_data = {
        "title": "Sprint de Prueba",
        "type": "manual_sprint",
        "start_date": "2026-06-01",
        "end_date": "2026-06-15",
        "impact": 0.0
    }
    r = requests.post(f"{API}/calendar/events", json=sprint_data)
    sprint = r.json()
    print(f"Sprint creado: {sprint['id']}")
    
    # 2. Verificar que existe
    r = requests.get(f"{API}/calendar/events")
    events = r.json()
    assert any(e['id'] == sprint['id'] for e in events)
    print("Sprint verificado en la lista.")
    
    # 3. Borrar el Sprint
    r = requests.delete(f"{API}/calendar/events/{sprint['id']}")
    print(f"Sprint borrado. Status: {r.status_code}")
    
    # 4. Verificar que ya no existe
    r = requests.get(f"{API}/calendar/events")
    events = r.json()
    assert not any(e['id'] == sprint['id'] for e in events)
    print("Sprint eliminado correctamente de la base de datos.")

if __name__ == "__main__":
    test()
