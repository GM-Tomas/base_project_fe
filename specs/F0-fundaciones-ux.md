# F0 — Fundaciones de UX

**Estado:** Lista para implementar · **Repos:** frontend (la API no cambia)

## Objetivo

Todas las fases siguientes agregan diálogos, confirmaciones y acciones por fila. Esta fase construye esas
piezas una sola vez —accesibles y consistentes— y las aplica ya a lo que existe, que hoy tiene problemas
concretos:

- Borrar un asset es un clic en un ícono gris casi invisible, **sin confirmación**.
- Los diálogos no se cierran con Escape, no atrapan el foco y no lo devuelven al cerrar.
- No hay feedback después de guardar o borrar.
- El valor no acepta el formato argentino (`1.234,56` falla como "número inválido") y no acepta 0.
- Para usar una plataforma nueva hay que elegir "+ Add new platform…" y escribir en un segundo campo.

## Alcance

Componentes de UI reutilizables, un *host* de diálogos y toasts, y su aplicación a Add asset, Profile,
Assets y History. **Fuera de alcance:** cambios de API, responsive (F7), modo privacidad (F7).

## Requisitos

### F0-R1 · Diálogos accesibles (`Modal`)

1. Todos los diálogos usan `Modal`: `role="dialog"`, `aria-modal="true"` y `aria-labelledby` apuntando a su título.
2. Escape y el clic en el fondo cierran el diálogo; el clic dentro, no.
3. Al abrir, el foco va al primer campo (o al elemento que el diálogo indique). Tab y Shift+Tab ciclan dentro del diálogo.
4. Al cerrar, el foco vuelve al elemento que lo abrió.
5. Mientras el diálogo está ocupado (guardando), Escape y el fondo no lo cierran: el resultado no se pierde.
6. Se renderiza en un portal sobre `document.body`, encima de todo.

### F0-R2 · Confirmar antes de destruir (`ConfirmDialog`)

1. Borrar un asset abre "Remove asset?" con un texto que nombra asset, plataforma y valor:
   *"Bitcoin on Binance ($18,450) will stop counting toward your net worth."* Botones **Cancel** y
   **Remove** (estilo peligro).
2. El foco inicial está en **Cancel**: Enter no borra por accidente.
3. Mientras borra, el botón dice "Removing…" y los dos quedan deshabilitados. Si la API falla, su mensaje
   aparece dentro del diálogo y nada se borra.
4. Al terminar, el diálogo se cierra y aparece el toast "Asset removed".

### F0-R3 · Toasts

1. Las acciones exitosas avisan con un toast: "Asset added", "Asset removed", "Snapshot saved" (y los de
   fases siguientes).
2. Se apilan abajo a la derecha y se cierran solos a los 5 s, o con su botón ×.
3. Un toast puede llevar una acción (p. ej. **Undo** en F2); usarla cierra el toast.
4. Accesibles: región `role="status"` con `aria-live="polite"`; un toast de error usa `role="alert"`.
5. Los errores de formularios siguen en línea, dentro del formulario (no en toasts).

### F0-R4 · Montos en cualquier formato (`MoneyInput`)

1. Acepta `1234.56`, `1,234.56`, `1.234,56`, `1234,56`, `1 234,56`, `$1,234`, `US$ 1.234`, `1.234.567`.
   Espacios, `$`, `US$` y `USD` se ignoran.
2. Separadores: si aparecen `.` y `,`, el **último** en aparecer es el decimal. Si aparece uno solo:
   repetido (`1.234.567`) es de miles; una sola vez y seguido de exactamente 3 dígitos (`1.234`, `1,234`)
   es de miles; en cualquier otro caso es decimal (`12,5` → 12.5).
3. Debajo del campo se muestra cómo se interpretó: *"= $1,234.56"*. Si no se entiende: *"Enter an amount
   like 1,234.56"*.
4. Negativos: *"Amounts can't be negative"*. Más de 2 decimales se redondea (como la API).
5. `inputMode="decimal"` (teclado numérico en el celular).
6. Add asset acepta valor **0** (la API lo permite: una cuenta vacía que se va a usar después).

### F0-R5 · Plataforma y clase con autocompletado (`Combobox`)

1. En Add asset, plataforma y clase son **un solo campo de texto** con sugerencias de las existentes.
   Desaparecen "+ Add new…" y el segundo campo.
2. Si lo escrito no coincide con ninguna existente, el campo lo dice: *"New platform — it will be created"*
   / *"New class"*. Plataformas se comparan sin distinguir mayúsculas; clases, exactas (como la API).
3. Si coincide con otra capitalización (`binance`), el campo avisa *"Matches Binance"* (la API la guarda
   como la existente).
4. Con una sola plataforma o clase existente, el campo arranca vacío con las sugerencias disponibles; en
   una cuenta nueva, arranca vacío sin sugerencias.

### F0-R6 · Acciones de fila (`IconButton`)

1. Cada acción de fila es un botón con ícono, nombre accesible que incluye el objeto (`"Remove Bitcoin"`),
   tooltip, contraste suficiente y foco visible.
2. En Assets hoy: **Remove**. (F1 suma Edit; F2, Gain/loss y Transfer.)

### F0-R7 · Estados vacíos (`EmptyState`)

1. Dashboard sin holdings: *"Start by adding what you own"* con botón **Add your first asset**.
2. Assets sin holdings: lo mismo. Con un filtro sin resultados: *"No assets match this filter"* con
   **Show all**.
3. Platforms sin plataformas: *"Platforms appear as you add assets"* con **Add an asset**.
4. History sin snapshots: explica qué es un checkpoint y ofrece **Save a snapshot**.

### F0-R8 · Host de diálogos y toasts (`UiProvider`)

1. Cualquier componente abre un diálogo con `openDialog(...)` y muestra un toast con
   `toast.success(...)` / `toast.error(...)`, sin manejar estado propio.
2. Al cerrar sesión o cambiar de cuenta, diálogos y toasts abiertos se descartan (viven dentro del
   `WealthProvider` con `key={user.id}`).

## Diseño (frontend)

```
src/components/ui/
  Modal.tsx           portal, role=dialog, foco atrapado, Escape/fondo, devuelve el foco
  ConfirmDialog.tsx   Modal + mensaje + Cancel/Confirm (tono peligro), estado ocupado y error
  Toaster.tsx         región de toasts (status/alert), temporizadores, acción opcional
  MoneyInput.tsx      input + parseMoney + vista previa + error
  Combobox.tsx        input + <datalist> + aviso "new" / "matches"
  IconButton.tsx      botón de ícono con aria-label y title
  EmptyState.tsx      título, texto y acción
src/context/UiContext.tsx   UiProvider: pila de diálogos y toasts; hooks useUi() y useToast()
src/lib/money.ts            parseMoney(text) → { value } | { error }; formatMoney(value)
src/components/dialogs/HoldingFormDialog.tsx   reemplaza AddAssetModal (lista para "edit" en F1)
```

- `openDialog(render)` recibe una función `(close) => ReactNode` y apila el diálogo; el *host* renderiza
  la pila. `WealthContext` deja de manejar `isAddModalOpen`.
- CSS nuevo en `globals.css`: `.btn-danger`, `.icon-btn`, `.toast-region`, `.toast`, `.empty-state`,
  `.field-hint`, `.field-error`.
- Sin librerías nuevas: el proyecto usa su propio CSS (Nocturne) y un `Modal` propio alcanza.

## Tareas

- [ ] `lib/money.ts` + tests de la tabla de formatos (R4).
- [ ] `Modal`, `ConfirmDialog`, `Toaster`, `UiContext` + tests (R1, R2.2–R2.3, R3, R8).
- [ ] `MoneyInput`, `Combobox`, `IconButton`, `EmptyState`.
- [ ] `HoldingFormDialog` (reemplaza `AddAssetModal`), `ProfileModal` sobre `Modal`.
- [ ] Assets: borrar con confirmación + toast; History: toast al guardar snapshot.
- [ ] Estados vacíos en Dashboard, Assets, Platforms, History.
- [ ] Ajustar `app.test.tsx` (flujos nuevos) y README del frontend.

## Pruebas

| Requisito | Dónde |
|---|---|
| R1 | `src/components/ui/Modal.test.tsx` (roles, Escape, fondo, foco, ocupado) |
| R2 | `src/test/app.test.tsx` (borrar con confirmación, error dentro del diálogo) |
| R3 | `src/components/ui/Toaster.test.tsx` + flujos en `app.test.tsx` |
| R4 | `src/lib/money.test.ts` (tabla de formatos) + alta con `1.234,56` en `app.test.tsx` |
| R5 | `app.test.tsx` (plataforma nueva, existente y con otra capitalización) |
| R6–R8 | `app.test.tsx` |

## Decisiones y riesgos

- **`<datalist>` nativo para el combobox**: accesible y sin dependencias; el estilo de la lista desplegable
  lo pone el navegador. Si molesta, se reemplaza por un *listbox* ARIA propio sin cambiar la interfaz del
  componente.
- **Regla de "1.234"**: un solo separador seguido de 3 dígitos se lee como miles (1234), que es lo
  habitual al escribir montos en castellano. Para el raro caso de querer 1,234 dólares con 3 decimales no
  hay ambigüedad real (la API guarda 2 decimales). La vista previa muestra siempre la interpretación.
