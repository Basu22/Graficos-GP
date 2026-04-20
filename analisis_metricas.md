# Análisis de Métricas Individuales: María Teresa Bravo

A continuación, se detalla el análisis de cada una de las métricas visualizadas en el panel de **Métricas (Q1 2026)** para el usuario María Teresa Bravo. Para cada panel, explicamos el **propósito funcional** (qué significa para el negocio o el Scrum Master) y el **cálculo técnico** (cómo el sistema lo extrae de Jira).

---

## 1. Velocidad promedio (4.9 SP)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Indica el "ritmo" de trabajo histórico de la persona. Responde a la pregunta: *"En promedio, ¿cuántos puntos de esfuerzo aporta María en un solo Sprint?"*
- **¿Qué sentido tiene?** Es crucial para la planificación (Sprint Planning). Si la velocidad promedio de María es 4.9 SP, el equipo no debería asignarle una carga de 10 SP para el próximo sprint, ya que probablemente no logre terminarla.

**⚙️ Análisis Técnico**
- **Cálculo:** Se suman todos los SP *Efectivos* (basados en la proporción de subtareas) de las historias que están en estado `Done` y que pertenecen a los sprints del Q1 2026. Este total se divide por la cantidad de Sprints analizados en ese trimestre.
- **Qué incluye:** Solo historias terminadas en sprints pasados.
- **Qué excluye:** El sprint activo actual no entra en este cálculo, ya que la velocidad es una métrica retrospectiva. Tampoco incluye los SP de historias que quedaron a la mitad (Carry Over).

---

## 2. Predictibilidad (100%)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Mide la capacidad de la persona para cumplir con los compromisos asumidos. 
- **¿Qué sentido tiene?** Un 100% significa que todo el esfuerzo que María se comprometió a entregar al inicio de cada sprint, efectivamente lo terminó antes del cierre. Un número bajo (ej: 60%) indica que la persona o se está comprometiendo a más de lo que puede hacer, o está sufriendo bloqueos constantes.

**⚙️ Análisis Técnico**
- **Cálculo:** `(Total SP Entregados / Total SP Comprometidos) * 100`.
- **Qué incluye:** Compara los SP efectivos de las historias completadas vs los SP efectivos de las historias en las que María participó en ese trimestre. 
- **Detalle de subtareas:** Si María tenía 2 SP asignados (vía subtareas) en una historia de 5 SP, y la historia se terminó, suma 2 al Entregado y 2 al Comprometido (100%). 

---

## 3. Lead time promedio (40.6 días)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Mide el tiempo "End-to-End" desde que una necesidad es creada en Jira hasta que es resuelta.
- **¿Qué sentido tiene?** Un Lead Time de 40.6 días es una alerta clara de que los tickets en los que participa María nacieron mucho tiempo antes de ser terminados. Esto suele suceder cuando el Backlog está muy avejentado o cuando los tickets pasan mucho tiempo "bloqueados" o "en espera" antes de entrar al sprint.

**⚙️ Análisis Técnico**
- **Cálculo:** Se toma la fecha `created` (cuando se creó el ticket en Jira) y la fecha `resolutiondate` (cuando pasó a Done). Se calcula la diferencia en días y se promedia entre todos los tickets completados.
- **Atención:** Esto **no** mide cuánto tiempo trabajó María en el ticket (para eso sería el *Cycle Time*). Mide cuánto tiempo existió el ticket.

---

## 4. Total SP entregados (29.5 SP)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Es el volumen bruto de trabajo aportado por María en el trimestre.
- **¿Qué sentido tiene?** Mientras la velocidad promedia por sprint, este número te da el impacto total. Sirve para justificar evaluaciones de desempeño y entender quiénes son los principales motores de entrega del equipo.

**⚙️ Análisis Técnico**
- **Cálculo:** Sumatoria simple del esfuerzo proporcional asignado a María en todas las historias en estado `Done` dentro de los sprints del filtro (Q1 2026).
- **Ejemplo:** Si una historia de 10 SP tenía 4 subtareas y María hizo 2, el sistema le adjudica `5 SP`. Esos 5 SP se suman directo a este gran total.

---

## 5. Tickets completados (14)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Complementa la visión de los Story Points. Si María tiene 29.5 SP repartidos en 14 tickets, significa que el tamaño promedio de su participación es de ~2 SP por ticket.
- **¿Qué sentido tiene?** Ayuda a entender el "context switching". Una persona con 30 SP en 5 tickets está muy enfocada. Una persona con 30 SP en 35 tickets está fragmentando muchísimo su tiempo, lo cual es ineficiente.

**⚙️ Análisis Técnico**
- **Cálculo:** Un conteo de las historias/tareas principales (`issuetype` no sea subtarea) que estén en categoría `Done` y en las que María haya participado (es decir, donde su cálculo de esfuerzo relativo sea > 0, o donde sea la assignee principal).
- **Qué excluye:** Las subtareas en sí mismas no se cuentan como "tickets completados" en esta pantalla, sino que se usan para vincularla a los tickets principales (las 14 Historias/Tareas).

---

## 6. Bugs abiertos (0)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Es un indicador de calidad y deuda técnica inmediata. 
- **¿Qué sentido tiene?** Muestra si María está arrastrando problemas urgentes en el sprint actual. Tener esto en 0 es un estado saludable; tener números altos significa que la persona debe frenar el desarrollo de nuevas features (Historias) para apagar incendios.

**⚙️ Análisis Técnico**
- **Cálculo:** El sistema cuenta aquellos tickets del **Sprint Activo** cuyo tipo de incidencia contiene la palabra `bug` o `incidencia` y que **no** están en estado `Done`.
- **Dato clave:** A diferencia de las otras métricas que miran al historial del Q1, este número es una "foto del momento" (solo cuenta los bugs del sprint que está corriendo ahora mismo).

---

## 7. Distribución de Trabajo (Historia: 14, Tarea: 1)
**📌 Análisis Funcional**
- **¿Para qué sirve?** Ayuda a entender en qué invierte su tiempo la persona. ¿Está creando valor (Historias) o está en mantenimiento/configuraciones (Tareas)? 
- **¿Qué sentido tiene?** En el caso de María, tiene una dedicación altísima a la creación de valor (14 Historias vs 1 Tarea). Un perfil más técnico (como DevOps o QA) podría tener un gráfico volcado hacia Tareas, Bugs o Incidencias.

**⚙️ Análisis Técnico**
- **Cálculo:** Agrupa todos los tickets principales en los que María participa (tanto del sprint activo como del historial consultado) según el valor de su campo `issuetype.name` de Jira. 
- **Qué incluye:** Incluye tanto los tickets completados como los que están en progreso o por hacer.
