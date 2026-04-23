# 📏 Guía de Buenas Prácticas HTML5 / JSX

> **Versión:** 1.0 — Abril 2026
> **Propósito:** Evitar la "sopa de divs" (`div soup`), mejorar la mantenibilidad del código, prevenir bugs estructurales, y estandarizar la arquitectura DOM del Agility Dashboard.

---

## 1. El Problema del "Div Soup"

Durante el desarrollo inicial del dashboard (específicamente en componentes complejos como `OfferJourney.jsx`), se evidenció que el uso intensivo y anidado de etiquetas `<div>` genéricas provoca:

- **Bugs silenciosos:** Es difícil rastrear el inicio y fin de una etiqueta cuando todas son iguales, lo que genera errores como `Unterminated JSX contents` o cierres prematuros de contenedores.
- **Baja legibilidad:** Leer la estructura jerárquica de un componente toma más tiempo.
- **Accesibilidad deficiente:** Los lectores de pantalla no pueden inferir la estructura de la página.

**Solución:** Uso estricto de **etiquetas semánticas HTML5** y un sistema de **IDs descriptivos**.

---

## 2. Etiquetas Semánticas HTML5

A partir de esta versión, se prohíbe el uso de `<div>` como etiqueta de primer nivel para componentes y secciones principales. Se debe utilizar la etiqueta HTML5 que mejor describa el contenido.

### 2.1 Tabla de Reemplazos Obligatorios

| En lugar de usar... | Se DEBE usar... | Cuándo y para qué |
|---|---|---|
| `<div className="card">` | `<article>` | Componentes autónomos como una tarjeta individual (ej: la card de distribución por banco). |
| `<div className="section">` | `<section>` | Bloques temáticos principales de una vista (ej: la sección de reportes o la sección del gráfico principal). |
| `<div className="header">` | `<header>` | Títulos, subtítulos y metadata superior de un `<article>` o `<section>`. |
| `<div className="footer">` | `<footer>` | Totales, notas al pie, o acciones inferiores de un `<article>` o `<section>`. |
| `<div className="nav">` | `<nav>` | Barras de pestañas o menús de navegación interna. |
| `<div className="filters">` | `<fieldset>` o `<form>` | Grupos de controles interactivos (ej: selectores de banco y campaña). |
| `<div className="table-wrapper">`| `<figure>` | Envoltorio para un `<table>`, usualmente acompañado de un `<figcaption>` para el título o unidad de medida. |

---

## 3. Sistema de IDs Descriptivos

Toda sección importante del DOM debe estar identificada de forma unívoca para facilitar la depuración, el testing automatizado (E2E) y el rastreo de cierres de etiquetas.

### 3.1 Nomenclatura Estándar

El ID debe seguir la estructura kebab-case: `[vista/componente]-[bloque]-[elemento]`

**Ejemplos aplicados a `OfferJourney.jsx`:**

- `offer-journey-controls` (Panel general de filtros)
- `offer-controls-campaigns` (Grupo de botones de campaña)
- `offer-controls-banks` (Grupo de botones de bancos)
- `offer-chart-main-section` (Contenedor general del gráfico principal)
- `offer-chart-brush` (El componente de selección temporal inferior)
- `offer-modal-comment-editor` (Modal completo de comentarios)
- `offer-report-daily-section` (Sección que envuelve la tabla diaria)
- `offer-report-monthly-section` (Sección que envuelve la tabla mensual)
- `offer-charts-secondary-grid` (Grilla inferior de componentes de distribución)

---

## 4. Ejemplos de Implementación JSX

### ❌ Incorrecto (Div Soup)

```jsx
<div style={{ background: 'var(--card)' }}>
  <div style={{ display: 'flex' }}>
    <h4>📄 Reporte Diario</h4>
    <span>Mostrando N días</span>
  </div>
  <div style={{ overflowX: 'auto' }}>
    <table>...</table>
  </div>
</div>
```

### ✅ Correcto (HTML5 Semántico + IDs)

```jsx
<section id="offer-report-daily-section" aria-label="Reporte Ejecutivo Diario" style={{ background: 'var(--card)' }}>
  <header style={{ display: 'flex' }}>
    <h4>📄 Reporte Diario</h4>
    <span>Mostrando N días</span>
  </header>
  <figure id="offer-report-daily-figure" style={{ overflowX: 'auto' }}>
    <table>...</table>
    <figcaption className="sr-only">Evolución diaria de métricas por banco</figcaption>
  </figure>
</section>
```

---

## 5. Reglas de Mantenimiento y Refactorización

1. **Regla de Semántica Primero:** Antes de teclear `<div`, pregúntate si hay una etiqueta semántica que describa mejor la intención.
2. **Regla de Cierre Explícito:** Si un contenedor anida más de dos niveles de profundidad, es altamente recomendable agregar un comentario HTML o JSX indicando qué etiqueta se está cerrando:
   ```jsx
     </section> {/* End of #offer-report-daily-section */}
   ```
3. **Regla de Modales:** Todos los modales interactivos deben utilizar `role="dialog"`, `aria-modal="true"`, y poseer un `aria-labelledby` apuntando al ID de su título.
4. **Refactorización Gradual:** No se exige una refactorización masiva e inmediata de todo el código preexistente (`App.jsx`, `MiDia.jsx`, etc.). La refactorización debe hacerse de forma oportunista: si se va a modificar significativamente un componente, se aprovecha para aplicarle estas buenas prácticas.
