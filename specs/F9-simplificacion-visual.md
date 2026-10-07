# F9 — Simplificación visual

**Estado:** Hecha · **Repos:** frontend · **Depende de:** F0–F8

## Objetivo

Las mismas funciones con menos cosas en pantalla. El análisis está en [F8-F10-plan.md](F8-F10-plan.md#f9--simplificación-visual-mismas-funciones-menos-carga):
decoración que no informa, cajas dentro de cajas, un acento usado para todo, etiquetas en mayúsculas,
texto de ayuda en cada número, datos repetidos, íconos en cada fila y vistas muy largas.

## Alcance

Estilos globales, dashboard, acciones por fila, History, Estimate, Settings, Debts, y la vista Platforms
plegada en Assets. Sin cambios de API.

**Fuera de alcance:** un tema claro, rediseñar los diálogos de alta y edición, el idioma (F10).

## Principios

1. **Restar, no rediseñar**: mismo sistema (Nocturne) y componentes; se sacan capas.
2. **Ninguna función se pierde**: cada acción de hoy sigue alcanzable, con a lo sumo un clic más.
3. **El acento es para lo accionable**: botones, navegación activa, foco, selección. Las etiquetas son neutras.
4. **Una línea de explicación como mucho** por número (P8 sigue: de dónde sale, en pocas palabras).
5. **Lo plegable es nativo**: `<details>` para "más"; el menú ⋯ reutiliza el de *New ▾*.

## Requisitos

### F9-R1 · Ruido global
1. Sin grilla de fondo, brillo ni esquinas decorativas en el patrimonio, punto pulsante, ni resplandor al
   pasar sobre botones y sliders.
2. Etiquetas (de tarjetas, columnas, estadísticas, secciones) en tipografía normal, sin mayúsculas, en gris.
3. Tags neutros: el tipo de plataforma es texto gris; la clase es un punto de su color + su nombre. El tag
   *Demo data* es neutro.
4. Sin subtítulo bajo el título de cada vista ni tagline bajo el logo.

### F9-R2 · Dashboard
1. El patrimonio dice, debajo: activos y deudas (con la cuota mensual, y *Debts* lleva a Debts), el cambio
   del año, y cuántas plataformas y activos hay.
2. Dos indicadores: *Ready to spend* y *Expected return*, con una línea cada uno.
3. El recordatorio de checkpoint es una línea discreta, solo en el dashboard.
4. Cada plataforma de *Where it lives* abre Assets filtrado por ella.

### F9-R3 · Acciones por fila
1. Assets y Debts: un botón **⋯** (*"Actions for X"*) por fila abre un menú con las acciones que antes eran
   íconos (Assets: Record a change, Transfer, Edit, Remove; Debts: Pay, Edit, Remove). Flechas, Home/End y
   Escape como en *New ▾*.
2. El menú se abre por encima de todo (no lo recorta la tabla).
3. Clic en la fila o el nombre sigue abriendo el panel con todas las acciones.

### F9-R4 · History
1. El período, *Include today's value* y los botones de checkpoint quedan arriba; debajo, pestañas
   **Overview · Checkpoints · Activity** (patrón de pestañas de ARIA).
2. *Overview*: el gráfico, una tarjeta con tres cifras (cambio, anualizado, mayor caída), *More figures*
   plegado (alto, bajo, mejor y peor tramo) y *Why it changed*.
3. *Activity*: el tipo de cambio pasa de 7 chips a un `<select>`.

### F9-R5 · Estimate
1. *What your expected return is made of* queda plegado (`<details>`), cerrado al entrar.
2. El eco del monto (*"= $900.00"*) solo aparece si lo escrito no es el número tal cual.

### F9-R6 · Settings
1. Pestañas **General · Classes · Platforms · Data**. *General* tiene las preferencias.
2. Descripciones de una línea.

### F9-R7 · Debts
Las cuatro cifras (lo que debés, cuotas, tasa promedio, sin deudas para) van en **una** tarjeta.

### F9-R8 · Platforms dentro de Assets
1. La vista Platforms se va del menú (escritorio y *More* del celular).
2. Assets filtrado por una plataforma muestra arriba su barra: miniatura, nombre, tipo, total, % de lo que
   tenés, y **Add asset here**, **Transfer from here** y **Customize**.
3. Todo lo que abría Platforms (el nombre de la plataforma en una fila, el panel del activo, el dashboard)
   abre Assets filtrado por ella.
4. Una preferencia guardada *Start on: Platforms* abre Assets (el backend la sigue aceptando, D5).

## Pruebas

Los tests de UI existentes se adaptan (abrir ⋯, cambiar de pestaña, Assets filtrado en vez de Platforms) y
se agregan: menú de fila (teclado y acciones), pestañas de History y Settings, barra de plataforma en Assets,
*Start on: Platforms* → Assets, recordatorio solo en el dashboard, eco del monto.

## Decisiones y riesgos

- **Pestañas en History y Settings** en vez de una página larga: el contenido de cada una no se usa a la vez.
- **Platforms se pliega en Assets** y no en un "agrupar por": el dashboard ya muestra el reparto por
  plataforma; lo que faltaba (el detalle de una) es Assets filtrado, con sus acciones arriba.
- **Settings conserva sus íconos por fila**: editar es su tarea principal y son uno o dos por fila.

### Decisiones al implementar

- **La pestaña de Settings vive en el contexto** (como el período de History): *Change* en *Ready to spend*
  abre Settings en *Classes*, donde se decide qué cuenta como disponible, y la pestaña se conserva al volver.
- **El eco del monto vale para todos los campos de montos** (`MoneyInput`), no solo Estimate: un número entero
  se lee como se escribe; cualquier otro formato sigue mostrando cómo se interpretó (P5).
- **La barra de la plataforma no repite el total ni el %**: el pie de la tabla ya los dice (count · total · % de
  tus activos).
- **El menú ⋯ se posiciona fijo** con las coordenadas del botón (abajo, o arriba si no entra) y se cierra con un
  scroll o un resize: no lo recorta el `overflow` de la tabla, sin depender de *anchor positioning*.
- **Los paneles de pestañas inactivas no se montan**: Activity y *Why it changed* solo piden datos cuando se
  ven.
