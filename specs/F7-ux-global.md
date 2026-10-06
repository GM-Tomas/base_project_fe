# F7 — UX global

**Estado:** Hecha · **Repos:** frontend (+ preferencias en el backend) · **Depende de:** F0–F6

## Objetivo

Pulir la experiencia completa: que BASE se use bien **en el celular**, que se puedan **ocultar los montos**
en público, que las acciones frecuentes estén a **un clic o una tecla**, que los datos se puedan **llevar**
(exportar) y que el historial se mantenga solo (**snapshot automático**).

## Alcance

Layout responsive, modo privacidad, menú de acciones rápidas y atajos de teclado, exportación, preferencias
generales (snapshot automático, vista inicial, período de History), *skeletons* de carga, revisión de
accesibilidad.

**Fuera de alcance:** importar datos, PWA/instalable, notificaciones push.

## Requisitos

### F7-R1 · Responsive

1. Hasta 900 px de ancho: la barra lateral se reemplaza por una **barra inferior** con Dashboard, Assets,
   Debts, History y **More** (Platforms, Estimate, Settings, perfil).
2. Las grillas pasan a una columna; las tablas muestran las columnas prioritarias (nombre, valor,
   acciones) y el resto en el detalle; los diálogos y paneles ocupan la pantalla completa.
3. Sin desbordes horizontales a 375 px; objetivos táctiles de al menos 40 × 40 px.

### F7-R2 · Modo privacidad

1. Botón con ícono de ojo en el header (*"Hide amounts"* / *"Show amounts"*) y atajo **H**.
2. Oculto, todo monto de la app se muestra como `$•••••` (los porcentajes siguen visibles).
3. Se recuerda en el dispositivo (`localStorage`), porque depende de dónde estás, no de la cuenta.

### F7-R3 · Acciones rápidas y atajos

1. El botón del header pasa a ser **New ▾** con: Asset, Gain/loss, Transfer, Debt, Debt payment, Checkpoint.
2. Atajos: **N** asset, **G** gain/loss, **T** transfer, **D** debt, **S** snapshot, **/** buscar (en
   Assets), **H** privacidad, **?** ayuda de atajos. No se disparan mientras se escribe en un campo ni con
   un diálogo abierto.
3. **?** abre un diálogo con la lista de atajos.

### F7-R4 · Exportar

1. Settings → **Data**: **Export everything (JSON)** — holdings, deudas, movimientos (todas las páginas),
   checkpoints, configuración de clases y plataformas, preferencias — con fecha y versión del formato.
2. CSV por entidad: assets, deudas, actividad, checkpoints (separador `,`, UTF-8 con BOM para Excel).
3. Se genera en el navegador a partir de la API; no hay endpoint nuevo.

### F7-R5 · Preferencias generales

1. Settings → **Preferences**: **Automatic checkpoint** (*Off* · *Monthly*), **Start on** (vista
   inicial), período por defecto de History.
2. *Monthly*: al abrir la app, si no hay checkpoint del mes calendario actual, se guarda uno y se avisa con
   toast (*"Monthly checkpoint saved"*). Nunca más de uno por mes, aunque haya varias pestañas abiertas
   (el backend rechaza el segundo del mismo segundo; el frontend vuelve a mirar los snapshots antes de
   guardar).
3. Se guardan en el backend (`/preferences` de F4) y valen en todos los dispositivos.

### F7-R6 · Carga y errores

1. *Skeletons* con la forma de cada vista mientras cargan los datos (en lugar de *"Loading your data…"*).
2. Si un componente falla al renderizar, un *error boundary* muestra *"Something went wrong in this
   view"* con **Reload**, sin tirar la app entera.

### F7-R7 · Accesibilidad

1. Navegación con `aria-current="page"` en la vista activa; orden de foco lógico; foco visible en todo.
2. Contraste AA en textos (revisar los grises al 50–60 %).
3. Gráficos con descripción textual (`aria-label` con el resumen: *"Net worth from $88,000 to $104,000
   over 1 year"*).

## Diseño

### API

`GET`/`PUT /api/v1/preferences` (F4) suma:

```json
{ "autoSnapshot": "OFF", "defaultView": "dashboard", "historyPeriod": "1Y", "estimate": { … } }
```

`autoSnapshot`: `OFF` | `MONTHLY`; `defaultView`: una vista existente; `historyPeriod`: un preset de F6.

### Frontend

- `AppShell` con `Sidebar` (escritorio) y `BottomNav` + `MoreSheet` (móvil) según `matchMedia`.
- `PrivacyProvider` + `<Amount value={…} />`: único componente que formatea montos en pantalla (también
  resuelve el formato compacto de gráficos).
- `NewMenu`, `useHotkeys`, `ShortcutsDialog`.
- `lib/export.ts` (JSON y CSV) + `DataSection`; `PreferencesSection`; `useAutoSnapshot`.
- `Skeleton`, `ErrorBoundary`.

### Mock API

Preferencias nuevas en memoria.

## Tareas

**Backend**
- [x] Campos nuevos de preferencias (validación, por defecto), `openapi.json`.

**Frontend**
- [x] `Amount` + privacidad en todas las vistas.
- [x] Shell responsive (barra inferior, More, tablas y diálogos móviles).
- [x] New ▾, atajos y ayuda.
- [x] Exportación JSON/CSV.
- [x] Preferencias y snapshot automático.
- [x] Skeletons, error boundary, revisión de accesibilidad.
- [x] Tests (privacidad, atajos, exportación, auto-snapshot una sola vez, vista inicial).

## Pruebas

| Requisito | Dónde |
|---|---|
| R1 | tests con `matchMedia` simulado (barra inferior, More) + revisión manual a 375 px |
| R2 | todos los montos ocultos, porcentajes visibles, persistencia, atajo |
| R3 | menú, cada atajo, no dispara al escribir ni con diálogo abierto |
| R4 | contenido del JSON (todas las páginas de movimientos), CSV con BOM y escapes |
| R5 | backend: validación y por defecto; frontend: guarda una vez por mes, no guarda si ya hay |
| R6, R7 | skeleton, error boundary, `aria-current`, `aria-label` de gráficos |

## Decisiones y riesgos

- **Privacidad por dispositivo** (no por cuenta): ocultar montos en la oficina no debería ocultarlos en
  casa.
- **Snapshot automático desde el cliente** (al abrir la app) en vez de un cron del servidor: no requiere
  infraestructura nueva; si la app no se abre en un mes, ese mes no tiene checkpoint (se puede cargar a
  mano con F6).
- **Exportar sin endpoint nuevo**: la API ya da todo; evita otra superficie que proteger.

### Decisiones al implementar

**Backend**

- **`historyPeriod` no acepta `CUSTOM`**: un rango propio necesita sus fechas; se guardan solo los presets
  (`1M`…`ALL`). Valores desconocidos responden `400` con la lista de los válidos.
- **El PUT sigue reemplazando el documento entero**: lo que no se manda vuelve a su valor por defecto, así que
  el frontend manda siempre todas las preferencias (también al guardar Estimate). Un valor guardado que no es
  válido (o que no existía antes de F7) se lee como su valor por defecto, campo por campo.

**Frontend**

- **Privacidad en los formateadores, no en un componente `<Amount>`**: `formatCurrency`, `formatSignedCurrency`,
  `formatUsd` y `compactUsd` consultan el modo privacidad (`lib/privacy.ts`, guardado por dispositivo en
  `localStorage` y sincronizado entre pestañas). Así se ocultan también los montos dentro de frases, *tooltips*,
  ejes y nombres accesibles de los gráficos sin envolver cada uno. `WealthProvider` se suscribe para que todo
  se vuelva a dibujar al cambiarlo. La máscara es siempre `$•••••` (`$•••` en los ejes): sin signo ni largo, para
  no dar pistas. Lo que se escribe en un campo, y el valor actual que precarga un formulario de edición, se ven
  (`exactUsd`): ocultarlos impediría usarlos. El mock usa `exactUsd` para que sus mensajes sean los de la API.
- **New ▾ reemplaza al botón "Add an asset / Add a debt" del header.** Cada opción muestra su tecla; las que no
  se pueden usar quedan deshabilitadas con el motivo (*"Add an asset first"*, *"No debts yet"*). *Gain or loss* y
  *Debt payment* preguntan sobre qué asset o deuda (salvo que haya uno solo); *Checkpoint* guarda el de hoy. El
  menú se maneja con flechas, Home, End, Escape y Tab, y el foco vuelve a New al cerrar lo que abrió.
- **Atajos**: no se disparan escribiendo en un campo de texto, una lista (`select`) o un área de texto (sí con el
  foco en una casilla o un radio), ni con un diálogo o un menú abierto, ni con Ctrl, ⌘ o Alt, ni al mantener la
  tecla. `/` lleva a Assets y pone el foco en la búsqueda. Si un atajo no se puede usar (G sin assets), un aviso
  dice qué falta.
- **Exportar** está en Settings → *Your data*. El JSON lleva `format: "base-wealth-export"`, `version: 1` y
  `exportedAt`, y los movimientos de todas las páginas (de a 200). Los CSV: UTF-8 con BOM, CRLF, comillas cuando
  hace falta, y el texto que una planilla ejecutaría como fórmula (`=`, `+`, `-`, `@` al principio) queda como
  texto con un apóstrofo. Nombres: `base-<qué>-AAAA-MM-DD`. Los montos van como números, nunca ocultos.
- **Preferencias** en Settings, arriba de todo, guardadas al instante. *Start on* vale desde la próxima vez que
  se abre la app; el período de History también se aplica en el momento. Si la API todavía no tiene los campos
  nuevos, se usan los valores por defecto.
- **Checkpoint mensual**: se revisa una vez al abrir la app (o al activarlo), con el mes calendario en la hora
  del navegador, solo si hay algo registrado (assets o deudas). Antes de guardar, el navegador "reserva" el mes
  (`base.monthlyCheckpoint.<cuenta>` en `localStorage`, así otra pestaña no guarda otro) y vuelve a leer los
  snapshots (por si otro dispositivo ya lo guardó). Si falla, libera la reserva y avisa que se reintenta la
  próxima vez. Si se borra el checkpoint automático, ese navegador no vuelve a guardarlo ese mes.
- **Responsive** con `matchMedia` (`useMediaQuery`, hasta 900 px) para cambiar la barra lateral por la inferior
  (Dashboard, Assets, Debts, History, More) y CSS para el resto. *More* es una hoja que sube desde abajo, con
  Platforms, Estimate, Settings y el perfil. Las tablas ocultan sus columnas secundarias (`col-optional`); en una
  fila de asset queda solo *Record a change* y el resto está en su panel (tocando la fila). Los diálogos ocupan
  toda la pantalla; los períodos de History van en dos filas. Botones, campos y chips de al menos 40 px. Se
  verificó con Playwright a 375 px que ninguna vista desborda en horizontal.
- **Carga**: un *skeleton* con la forma de la app (navegación, header y las tarjetas del dashboard); *"Loading
  your data…"* queda como estado para lectores de pantalla.
- **Error boundary por vista** (con la vista como `key`): si una vista falla, se ve *"Something went wrong in
  this view"* con **Reload**, que la vuelve a dibujar y relee los datos; la navegación y las demás vistas siguen
  andando.
- **Accesibilidad**: `aria-current="page"` en la navegación (escritorio y celular), el título de cada vista es un
  `h1`, y los gráficos se nombran por lo que muestran (*"Net worth from $10,000 to $12,346 over 3 months. Use the
  arrow keys…"*, *"Portfolio from $12,346 now to $25,000 in 1 year…"*, la dona con cada clase y su %). Contraste
  medido: los grises de texto van del 50 % (4,7:1 sobre las tarjetas) en adelante, todos AA; el subtítulo del
  header pasó al 60 %.

