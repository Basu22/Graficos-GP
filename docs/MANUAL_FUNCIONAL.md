# 📈 Manual Funcional — Agility Dashboard

> **URL de Acceso (Producción):** `https://graficosagiles.site`  
> **Última actualización:** Abril 2026  
> **Audiencia:** Analistas, Coordinadores y Usuarios del Dashboard  
> **⚠️ ACTUALIZACIÓN OBLIGATORIA:** Este documento debe actualizarse cada vez que se implemente una funcionalidad nueva o se modifique el comportamiento de alguna existente.

---

## 1. ¿Qué es el Agility Dashboard?

El **Agility Dashboard** es una herramienta de inteligencia operativa que centraliza la información de los equipos de desarrollo y los reportes de oferta generados por los bancos (BSF, BER, BSJ, BSC). Permite:

- Monitorear el estado de salud de las ingestas de datos bancarias.
- Analizar la evolución de las ofertas a lo largo del tiempo.
- Hacer seguimiento del rendimiento y avance del equipo de desarrollo.
- Agregar análisis cualitativos sobre los datos para enriquecer los reportes.

---

## 2. Navegación Principal

La barra superior contiene las siguientes pestañas:

| Pestaña | Descripción |
|---|---|
| **Mi DÍA** | Vista principal diaria con correos, alertas e indicadores operativos |
| **Ofertas** | Journey histórico del ciclo de vida de Ofertas por banco y campaña |
| **Performance** | Métricas del equipo de desarrollo (velocidad, predictibilidad) |
| **Ejecutivo** | Resumen consolidado para reportes de gerencia |
| **Sprint** | Vista detallada del sprint en curso con tareas y estados |
| **Cal** | Calendario con eventos e iniciaturas del equipo |
| **Team** | Vista de estadísticas y distribución de trabajo por persona |

---

## 3. Mi DÍA

### 3.1 ¿Qué muestra?

La vista **Mi DÍA** es el panel de control operativo diario. Se actualiza automáticamente al ingresar cargando los correos de Gmail del usuario.

#### Indicadores principales
- **Urgentes / Importantes / En Proceso / Para Leer:** Clasificación automática de los correos usando reglas del Motor Smart Inbox.
- **Alerta de Salud:** Si el monitor detecta anomalías en los datos bancarios, se muestra una alerta visible en esta vista.
- **Onboarding %:** Porcentaje de avance de iniciativas nuevas detectadas.

### 3.2 Monitor de Salud (Sync Salud)

El botón **Sync Salud** en la sección de monitor analiza los correos y extrae los datos de ingesta para actualizarlos en el histórico.

#### Lógica de Actualización y Prioridades
El sistema clasifica automáticamente los datos según el **horario de recepción del mail** (hora Argentina, UTC-3), sin importar en qué momento realices la sincronización:

| Tipo | Horario del Mail | Descripción |
|---|---|---|
| **Primer Servicio** | 15:00 — 19:00 | Datos estándar del día. |
| **Reproceso** | 22:00 — 06:00 (D+1) | Datos corregidos. Tienen prioridad sobre el primer servicio. |
| **Manual** | N/A | Ajustes realizados directamente por el analista. Tienen prioridad máxima. |

> **Regla de Oro:** Un dato de tipo **Reproceso** siempre pisará a uno de **Primer Servicio**. Esto permite que si un banco envía una corrección a la madrugada, al sincronizar al día siguiente (a cualquier hora), el sistema tome automáticamente el dato más reciente y correcto.

#### Indicadores de tipo de ingesta
En la vista diaria, cada banco muestra si su dato provino de un "primer servicio" o de un "reproceso", permitiendo identificar cuándo fue necesario re-enviar información.

### 3.3 Agenda y Gestión de Eventos

El bloque central de **Mi DÍA** muestra tu agenda de Google Calendar para el día seleccionado.

#### Confirmación de Asistencia (RSVP)
Al hacer clic en un evento donde hayas sido invitado, verás un modal con opciones de respuesta rápida:
- ✅ **Sí:** Confirma tu asistencia. El evento se resaltará con un borde verde en tu agenda.
- ❌ **No:** Rechaza la invitación. El evento se ocultará o mostrará como cancelado.
- 🤔 **Quizás:** Marca tu asistencia como tentativa.

#### Videollamadas e Integración
- **📹 Instant Meet:** Botón de acceso rápido en la barra superior para crear una sala de Google Meet al instante.
- **Botón "Unirse":** Si el evento del calendario tiene un enlace a Google Meet o Teams, aparecerá un botón azul destacado para entrar a la reunión con un solo clic.

---

## 4. Journey de Ofertas

La pestaña **Ofertas** es el módulo de análisis histórico de las ofertas generadas por los bancos. Permite visualizar tendencias, comparar períodos y dejar anotaciones analíticas.

### 4.1 Filtros Disponibles

#### Campañas (Productos)
Permite seleccionar una o varias campañas para graficar:

| Código | Descripción |
|---|---|
| `haberes` | Adelanto de Haberes |
| `prestamos` | Oferta Préstamos |
| `cch` | Oferta Tarjeta – CCH |
| `csh` | Oferta Tarjeta – CSH |
| `nc` | Oferta Tarjeta – NC |

> **Comportamiento:** Si se seleccionan múltiples campañas, el gráfico muestra la **sumatoria** de todas las seleccionadas por banco.

#### Bancos
Permite activar o desactivar cada banco en el gráfico:
- 🔵 **BSF**
- 🟢 **BER**
- 🟡 **BSJ**
- 🔴 **BSC**

#### Visualización (Modo de Vista)
| Botón | Modo | Descripción |
|---|---|---|
| **Diaria** | `timeline` | Evolución temporal día a día |
| **Mensual** | `monthly_compare` | Promedio mensual por banco |
| **Delta %** | `delta` | Variación porcentual entre meses |

#### Tiempo
| Botón | Cobertura |
|---|---|
| **30d** | Últimos 30 días |
| **90d** | Últimos 90 días |
| **Todo** | Todo el histórico disponible |

#### Selector de Periodo Dinámico (Zoom)
Debajo del gráfico diario encontrarás una barra deslizable con dos manijas. Esta herramienta te permite:
- **Hacer Zoom:** Arrastra las manijas de los extremos para enfocarte en una semana o días específicos.
- **Corte Diario:** El selector es ultra-preciso, permitiéndote elegir exactamente desde qué día hasta qué día quieres visualizar.
- **Rango de Fechas:** Las fechas exactas seleccionadas aparecerán resaltadas en azul justo encima de la barra para tu referencia.
- **Auto-Reset Inteligente:** Cada vez que cambias entre los botones de tiempo (30d, 90d, Todo), el selector se reiniciará automáticamente para mostrarte el periodo completo de forma limpia, evitando desajustes visuales.

#### 📅 Planificación Manual (Calendario)
El calendario permite gestionar la capacidad del equipo de forma visual y centralizada.

*   **Creación de Eventos**: Haciendo clic en un día, se abre el "Consola de Gestión Diaria".
*   **Categorización Inteligente**: Contamos con un grid de selección visual de categorías (Vacaciones, Licencias, etc.). Al seleccionar una, el sistema **genera automáticamente el título** del evento combinando la `Categoría + Nombre del Colaborador`, eliminando carga manual de datos.
*   **Comentarios**: Ahora cada evento permite añadir notas u observaciones que se visualizan con un icono de mensaje `💬` en la línea de tiempo del día.
*   **Resumen del Plan**: En los días de inicio de Sprint, aparecerá un botón minimalista `📋 Resumen Plan` en la esquina inferior derecha de la celda. Al hacer clic, se despliega el resumen de capacidad sin sobrecargar la vista del calendario.

---

### ⚙️ Configuración del Sistema
Hemos rediseñado la configuración para que sea un centro de mando escalable mediante un **menú lateral izquierdo**.

#### 🏷️ Gestión de Categorías (ABM)
Ahora podés personalizar totalmente los tipos de eventos que aparecen en el calendario:
1.  **Crear**: Definí un nombre, un ID único, elegí un icono (emoji) y un color.
2.  **Editar**: Cambiá cualquier atributo de las categorías existentes en tiempo real.
3.  **Borrardo**: Eliminá categorías que ya no utilices (excepto las críticas del sistema como Sprints).

#### 🎭 Roles de Personas
Gestión centralizada de los roles del equipo (Developer, Scrum Master, QA, etc.) para mantener la coherencia en las métricas de capacidad.

#### Comentarios (💬 ON/OFF)
Permite mostrar u ocultar los globos de comentarios analíticos sobre el gráfico. Útil para presentaciones limpias.

---

### 4.2 Evolución Temporal Diaria

El gráfico principal muestra la evolución de las ofertas a lo largo del tiempo. Al pasar el cursor sobre el gráfico:

**El tooltip muestra, por cada banco:**
1. El **valor total** de las campañas seleccionadas.
2. La **variación porcentual** respecto al día anterior, con código de color:
   - ↑ **Verde:** Subida respecto al día anterior.
   - ↓ **Rojo:** Caída respecto al día anterior.
   - (sin flecha): Sin variación (0.0%).
3. El **comentario analítico** del día, si existe (icono 💬).
4. El tipo de ingesta: **R** (reproceso) si corresponde.

---

### 4.3 Sistema de Comentarios Analíticos

El sistema de anotaciones permite a los analistas dejar comentarios cualitativos sobre días específicos del gráfico. Estos comentarios se guardan en el histórico de datos.

#### Cómo agregar o editar un comentario

**Opción A — Clic en un punto del gráfico:**
1. Pasá el cursor sobre el gráfico en la vista "Diaria".
2. Hacé clic en el día que querés comentar.
3. Si hay **un solo banco activo**, el modal se abre directamente.
4. Si hay **varios bancos activos**, primero se pide elegir a qué banco pertenece el comentario.

**Opción B — Clic en un globo existente (💬):**
1. Los días con comentario previo muestran un ícono 💬 sobre la línea.
2. Hacé clic directamente en ese ícono para editar el comentario existente del banco correspondiente.

#### Funcionamiento del Modal (Flujo de Edición Continua)
Para facilitar la carga de reportes diarios, el modal ha sido optimizado:
- **Navegación Interna:** Puedes entrar a editar un banco, guardar, y el sistema te devolverá al selector de bancos para que sigas con el siguiente sin cerrar el modal.
- **Previsualización Completa:** En la lista de bancos, verás el texto completo de los comentarios que ya cargaste. Esto es ideal para copiar y pegar información directamente en reportes ejecutivos o mails.
- **Botón Volver (←):** Si entraste a un banco por error o quieres cambiar, usa el botón "Volver" para regresar a la lista de opciones.
- **Botón Cerrar (X):** Puedes cerrar el modal con la "X" superior o haciendo clic fuera del área central.

#### Visualización en el gráfico
- Un ícono 📧 aparece para el **Análisis Global** (si se cargó).
- Un ícono 💬 aparece sobre el punto del día anotado para comentarios de bancos específicos.
- Si varios bancos tienen comentario el mismo día, los íconos se apilan verticalmente para no solaparse.

---

### 4.5 Reporte Ejecutivo Diario (Sincronizado)
Debajo del gráfico principal se encuentra la tabla de reporte ejecutivo. Esta herramienta consolida los datos numéricos y cualitativos en un formato de lectura rápida.

- **Filtros y Zoom:** La tabla solo mostrará los bancos y productos seleccionados, y se ajustará automáticamente si haces zoom con el selector inferior.
- **Transposición de Tablas:** Los bancos ahora se listan en las filas y los periodos (días) en las columnas, permitiendo una lectura horizontal continua.
- **Variaciones Diarias:** Cada valor viene acompañado de su delta porcentual respecto al día anterior.
- **Semáforo de Tendencias:** 
  - 🟢 **Verde:** Crecimiento positivo.
  - 🟡 **Amarillo:** Caída moderada (hasta -10%).
  - 🔴 **Rojo:** Caída crítica (mayor a -10%).
- **Indicadores de Análisis:**
    - **📧 (Sobre):** Indica que ese día tiene un análisis global enviado por mail.
    - **💬 (Globo):** Indica que hay comentarios técnicos de uno o más bancos.
- **Orden Cronológico Ascendente:** Los datos se leen naturalmente de izquierda a derecha (desde el día más antiguo al más reciente seleccionado).

---

### 4.4 Comparativa Mensual y Delta %

En los modos **Mensual** y **Delta %**, un selector de meses desplegable permite elegir qué meses comparar en el gráfico de barras.

- **Mensual:** Muestra el promedio diario de cada banco para cada mes seleccionado.
- **Delta %:** Muestra la variación porcentual de un mes al siguiente. Las barras en **verde** indican crecimiento y en **rojo** caída.

---

## 5. Gestión de Sprints y Calendario (Consola 3.0)

El Agility Dashboard ha evolucionado a un sistema de gestión **100% manual**, eliminando la dependencia de Jira para la planificación. Esto permite una flexibilidad total para adaptar los sprints a la realidad operativa del equipo.

### 5.1 Consola de Gestión Diaria (Modal Unificado)
Al hacer clic en cualquier día del calendario, se abre el centro de mando operativo:
- **Eventos Cargados:** Lista interactiva de todo lo que ocurre en el día (Vacaciones, Licencias, Sprints). Permite editar (✏️) o borrar (🗑️) registros existentes de forma instantánea.
- **Nueva Actividad:** Formulario integrado para añadir múltiples eventos al mismo día sin cerrar el modal.
- **Impacto en Capacidad:** Los eventos permiten definir un porcentaje de impacto (ej: Vacaciones 100%, Media Jornada 50%) que alimenta el motor de capacidad.

### 5.2 Planificación del Sprint (Sprint Console)
En los días de **Apertura de Sprint**, el modal se expande para mostrar la **Consola de Planificación**:
- **Días Hábiles Reales:** Calcula automáticamente los días laborables restando feriados y fines de semana.
- **Regla de Ceremonias (0.5 + 0.5):** El sistema descuenta automáticamente medio día en la apertura y medio día en el cierre para compensar el tiempo de reuniones (Planning y Review/Retro).
- **Desglose Diario:** Una vista tipo dashboard que muestra, día por día, cuántas personas del equipo están presentes y quiénes están ausentes, con barras de progreso de capacidad.

### 5.3 Ceremonias Automáticas (Eventos Virtuales)
Para justificar visualmente la reducción de capacidad, el sistema inyecta automáticamente dos eventos virtuales (no borrables):
- 📊 **Ceremonia: Planificación:** En el día de inicio.
- 🏁 **Ceremonia: Review + Retro:** En el día de cierre.

### 5.4 Sprints Globales (Sincronización de Equipos)
Los Sprints Manuales son **Globales**. Al cargar un sprint, este aparece automáticamente para todos los equipos (Back, Datos, etc.), asegurando que todos los departamentos trabajen bajo la misma cadencia organizacional.

---

---

## 6. Preguntas Frecuentes (FAQ)

**¿Por qué al hacer Sync Salud no se actualizan los datos?**
Puede deberse a que estás fuera de la ventana horaria de escritura (15:00 — 06:00 del día siguiente). Los registros fuera de esa ventana están congelados para garantizar la integridad del histórico.

**¿Por qué algunos datos no se pueden pisar aunque haga Sync?**
Si un registro ya fue ingresado como "reproceso", ningún dato de "primer servicio" puede sobreescribirlo, ya que el reproceso tiene mayor prioridad.

**¿Puedo editar un comentario que ya guardé?**
Sí. Hacé clic en el ícono 💬 del día correspondiente. El modal se abrirá con el texto actual para que lo modifiques y guardes.

**¿Los comentarios se pierden si hago Sync Salud?**
No. Los comentarios (`analisis_diario`) son un campo independiente de los datos numéricos y no son tocados por el proceso de sincronización.

---

## 7. Historial de Actualizaciones del Manual

| Versión | Fecha | Cambio |
|---|---|---|
| 1.6 | 2026-04-29 | **Gestión 100% Manual:** Se elimina dependencia de Jira para Sprints. Implementación de Sprints Manuales Globales. |
| 1.7 | 2026-04-29 | **Consola de Día 3.0:** Nuevo modal unificado con listado de eventos interactivo (editar/borrar) y formulario de carga continua. |
| 1.8 | 2026-04-29 | **Motor de Capacidad Preciso:** Cálculo de 0.5 días para inicio/fin de sprint. Inyección automática de ceremonias virtuales (Planning/Review). |
| 1.8.1 | 2026-04-29 | **Rediseño Premium:** Nueva estética tipo Dashboard con gradientes, tarjetas de estadísticas y barras de progreso de alta fidelidad. |
