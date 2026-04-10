**Iteración 1: Calendario**

Rol: Actúa como un experto en React y CSS modular.

Contexto: Estoy trabajando en un dashboard de Agility (te adjunto captura y código). El componente GmailCalendarWidget.jsx actualmente tiene un rango de 4am a 10pm y usa scroll vertical.

Tarea - Iteración 1:
Necesito modificar el componente para que el rango visual sea de 08:00hs a 19:00hs. El objetivo crítico es que desaparezca el scroll vertical; el calendario debe ajustarse perfectamente al alto de su contenedor padre.

Requisitos Técnicos:

    Rango: Cambia DAY_START a 8 y DAY_END a 19.

    Altura Dinámica: En lugar de usar HOUR_HEIGHT = 56 (píxeles fijos), modifica la lógica para que las horas se distribuyan equitativamente en el alto disponible (height: 100%).

    Preservación: No toques la lógica de EVENT_COLORS, el posicionamiento side-by-side de eventos, ni el diseño de "QuickEventForm".

    Línea de tiempo: Asegúrate de que la "línea roja" (hora actual) siga funcionando correctamente con el nuevo rango.

Formato de salida: Dame el bloque de constantes actualizado y la función del componente con los cambios en el JSX y estilos.