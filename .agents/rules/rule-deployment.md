---
trigger: always_on
---

# Reglas de Despliegue y Sincronización

Este archivo define las normas críticas para la modificación de los scripts de infraestructura del proyecto Agility Dashboard.

## Archivos Protegidos
- `/deploy.sh` (Orquestador de Despliegue desde Laptop)
- `/rpi-update.sh` (Ejecutor de Actualización en Raspberry Pi)
- `/start-dev-local.sh` (Arranque del Entorno de Desarrollo Local)

## Protocolo de Modificación
Queda ESTRICTAMENTE PROHIBIDO modificar cualquiera de estos archivos sin antes presentar una propuesta al usuario que incluya:

1. **El Por Qué**: Cuál es el problema, bug o mejora técnica que motiva el cambio.
2. **El Para Qué**: Qué beneficio directo obtendrás (ej: evitar conflictos de puertos, mayor consistencia de versiones).
3. **El Qué**: Una descripción clara de los cambios exactos.
4. **Impacto en el Tiempo**: Si el cambio afectará la duración del despliegue en producción.

## Estándar de Oro
Cualquier cambio en la lógica de despliegue debe priorizar la **Consistencia** (que lo que se ve en local sea idéntico a producción) por sobre la velocidad, a menos que el usuario indique lo contrario explícitamente.
