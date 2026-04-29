## 📋 Directorio de Herramientas de Prueba

Hemos organizado las herramientas en categorías para facilitar el mantenimiento del sistema.

### 🖥️ Frontend (Interfaz y Sintaxis)
*   `frontend/check-frontend.sh`: Valida la sintaxis de todos los archivos `.jsx` y `.js`. Esencial antes de cada commit para evitar que el dashboard explote en blanco.

### 👥 Personas y Tareas (EP-01)
*   `backend/scripts/test_person_stats.py`: El script que usamos hoy. Valida la ficha de una persona, subtareas y horas de Tempo.

### 📊 Métricas y "Fórmula de Oro" (Jira Agile)
Estos scripts validan el motor de cálculo de velocidad y predictibilidad:
*   `backend/test_formula.py`: Verifica el cálculo de Committed vs Delivered.
*   `backend/test_velocity.py`: Valida el histórico de velocidad del board.
*   `backend/test_scope_creep.py`: Específico para medir el crecimiento del alcance durante el sprint.
*   `backend/test_carryover.py`: Verifica qué tickets pasan de un sprint a otro.

### ⚙️ Configuración y Mapeos
*   `backend/test_mappings.py`: Valida que los estados de Jira (To Do, In Progress, Done) estén bien mapeados a nuestras categorías.
*   `backend/check_fields.py`: Verifica que Jira tenga todos los Custom Fields necesarios (Story Points, Epics, etc.).
*   `backend/test_jql.py`: Prueba las consultas JQL crudas antes de integrarlas al código.

### 🚀 Infraestructura y Despliegue (Raspberry Pi)
Basado en las reglas de oro del proyecto:
*   `/deploy.sh`: Orquestador de despliegue desde laptop.
*   `/rpi-update.sh`: Ejecutor de actualización en la Raspberry Pi.
*   `/start-dev-local.sh`: Arranque del entorno local.

---

## 📋 Check-list de Validación (QA) General
...

Cada vez que se modifique la lógica de `person_stats_service.py` o `PersonDetail.jsx`, se debe verificar:

1.  **Vínculo con Jira**:
    *   [ ] ¿Aparece el selector de usuarios de Jira arriba?
    *   [ ] ¿Al hacer clic en "Vincular" se cargan los stats inmediatamente?
2.  **Sprint Activo**:
    *   [ ] ¿Se muestran los SP asignados vs efectivos?
    *   [ ] ¿El porcentaje de completado es correcto (no muestra `undefined%`)?
3.  **Drill-down de Tareas (EP-01)**:
    *   [ ] Al hacer clic en una HU, ¿se despliegan las subtareas?
    *   [ ] ¿Las subtareas de la persona aparecen resaltadas en azul con el icono 👤?
    *   [ ] ¿Se muestra el badge de horas `🕒 Xh` tanto en la subtarea como en el cabezal de la HU?
4.  **Historial**:
    *   [ ] ¿Se listan los sprints cerrados del Quarter seleccionado?
    *   [ ] ¿Al desplegar un sprint pasado se ven los tickets correctos?

## 🚨 Solución de Problemas Comunes

*   **"Sin sprint activo"**: Verifica que el nombre del sprint en Jira contenga el nombre del equipo (ej: "Back") o que el fallback en el backend esté funcionando.
*   **"subtasks_map is not defined"**: Error clásico de scope. Asegúrate de que `fmt_issue_local` reciba los datos procesados.
*   **Lentitud extrema (>10s)**: Verifica que no haya importaciones circulares o que no se estén descargando reportes pesados innecesarios para el historial.
