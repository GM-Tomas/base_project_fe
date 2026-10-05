# F7 — UX global

**Estado:** Lista para implementar · **Repos:** frontend (+ preferencias en el backend) · **Depende de:** F0–F6

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
- [ ] Campos nuevos de preferencias (validación, por defecto), `openapi.json`.

**Frontend**
- [ ] `Amount` + privacidad en todas las vistas.
- [ ] Shell responsive (barra inferior, More, tablas y diálogos móviles).
- [ ] New ▾, atajos y ayuda.
- [ ] Exportación JSON/CSV.
- [ ] Preferencias y snapshot automático.
- [ ] Skeletons, error boundary, revisión de accesibilidad.
- [ ] Tests (privacidad, atajos, exportación, auto-snapshot una sola vez, vista inicial).

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
