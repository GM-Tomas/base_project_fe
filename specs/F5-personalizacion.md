# F5 — Personalización: clases y plataformas

**Estado:** Lista para implementar · **Repos:** backend + frontend · **Depende de:** F4

## Objetivo

Que el usuario **configure sus categorías y sus plataformas**: crear clases nuevas (sin tener que inventar
un asset), renombrarlas, borrarlas, decidir cuáles son líquidas y qué retorno esperan por defecto; y
personalizar la **miniatura** de cada plataforma (letras o emoji, color), su tipo y su nombre. Todo desde
una vista **Settings**, y con atajos desde las tarjetas.

## Alcance

Vista Settings; clases (crear, editar nombre/color/liquidez/retorno por defecto, merge, borrar moviendo sus
assets); plataformas (miniatura, color, tipo, renombrar, merge); uso de colores y miniaturas en todas las
vistas; retorno por defecto de la clase en el retorno del portfolio.

**Fuera de alcance:** logos como imagen (backlog), crear una plataforma sin assets (las plataformas siguen
existiendo mientras tengan assets; su personalización se conserva aunque se vacíen).

## Requisitos

### F5-R1 · Vista Settings

1. Ítem **Settings** (engranaje) al final de la navegación, con secciones **Asset classes** y
   **Platforms** (F7 suma **Preferences** y **Data**).

### F5-R2 · Clases de activo

1. Lista: color, nombre, *Liquid* (sí/no), retorno por defecto, cantidad de assets y valor.
2. **New class**: nombre (≤ 60, distinto de las existentes), color, líquida, retorno por defecto. Aparece
   enseguida en los selectores de clase aunque no tenga assets.
3. **Edit**: los mismos campos. Renombrar actualiza todos sus assets (transacción). Si el nombre nuevo ya
   existe: *"Merge Stocks into Equity? Its 3 assets move to Equity."* (merge con confirmación; la
   configuración de la clase de destino se conserva).
4. **Remove**: sin assets, con confirmación. Con assets: *"Move its 3 assets to…"* (selector de otra clase)
   y se mueven y borra todo junto.
5. Las clases por defecto (Cash, Fixed Income, Index Fund, Equity, Crypto) se editan y borran igual (una
   clase por defecto borrada no vuelve a aparecer; crearla de nuevo la recupera).
6. **Liquid** define qué cuenta en "Ready to spend" del dashboard. Por defecto, las de la configuración
   actual (Cash, Equity, Crypto, Index Fund).
7. **Retorno por defecto**: lo usan los assets de esa clase sin retorno propio (`effectiveReturnPct` y
   retorno del portfolio de F4). El detalle de un asset lo indica (*"8% · from Equity"*).
8. **Color**: paleta de 12 colores del sistema de diseño + hexadecimal propio. Se usa en el donut, las
   etiquetas y los chips.
9. Hasta **100** clases creadas o personalizadas por usuario.

### F5-R3 · Plataformas

1. Lista: miniatura, nombre, tipo, cantidad de assets y valor.
2. **Customize** (desde Settings o la tarjeta de la plataforma, menú ⋯):
   - **Miniatura**: 1 o 2 caracteres o un emoji (por defecto, la inicial); vista previa en vivo con el
     color elegido.
   - **Color**: paleta + hexadecimal propio (por defecto, el actual derivado del nombre).
   - **Tipo**: Bank, Broker, Exchange, Wallet, Other o uno propio (≤ 40).
   - **Nombre**: renombrar cambia el nombre en todos sus assets (transacción). Si coincide con otra
     plataforma (sin distinguir mayúsculas): *"Merge Binance US into Binance? Its 2 assets move there."*
3. La miniatura y el color se ven en Platforms, Dashboard ("Where it lives"), Assets (mini-avatar junto al
   nombre de la plataforma), los selectores y los diálogos de transferencia.
4. **Reset to default** vuelve miniatura y color a los derivados del nombre.
5. La personalización se guarda por plataforma (sin distinguir mayúsculas) y se conserva si la plataforma
   se queda sin assets y vuelve a usarse. Hasta **1000** plataformas personalizadas.

## Diseño

### Identificadores (D6)

- Clase: `id = base64url(nombre NFC)` (las clases distinguen mayúsculas, como hoy).
- Plataforma: `id = base64url(platformKey(nombre))` (clave sin mayúsculas ni formas Unicode, la misma que
  ya agrupa las plataformas).

### API

#### Clases

- `GET /api/v1/asset-classes` suma `classes` (se mantienen `defaults`, `inUse` y `all`; `all` = nombres
  visibles):

  ```json
  { "id": "Q3J5cHRv", "name": "Crypto", "color": "#c86bd6", "liquid": true, "expectedReturnPct": 15,
    "isDefault": true, "holdingsCount": 2, "valueUsd": 24570 }
  ```

- `POST /api/v1/asset-classes` `{ name, color?, liquid?, expectedReturnPct? }` → `201` · `409 class-exists`.
- `PATCH /api/v1/asset-classes/{id}` `{ name?, color?, liquid?, expectedReturnPct?, mergeIfExists? }`
  (`null` borra color/retorno) → `200` · `409 class-exists` (renombrar sobre una existente sin
  `mergeIfExists: true`) · `404`.
- `DELETE /api/v1/asset-classes/{id}?moveTo=<nombre>` → `204` · `409 class-in-use` (tiene assets y no hay
  `moveTo`) · `404`.
- `color`: `#rrggbb`. `expectedReturnPct`: −100..100.

#### Plataformas

- `GET /api/v1/platforms` suma `id`, `avatarText`, `color` (`null` = por defecto), `holdingsCount`,
  `valueUsd`.
- `PATCH /api/v1/platforms/{id}` `{ name?, type?, avatarText?, color?, mergeIfExists? }` → `200` ·
  `409 platform-exists` · `404`. `avatarText`: 1–2 grafemas (un emoji cuenta como uno), sin espacios en
  los extremos; `type`: ≤ 40.

#### Otros (aditivo)

- `WealthSummary.byPlatform[]` suma `avatarText`, `color`; `byAssetClass[]` suma `color`, `liquid`.
- `liquidity` usa la liquidez efectiva de cada clase del usuario.
- `HoldingResponse.effectiveReturnPct` = propio ?? retorno por defecto de su clase ?? `null`; el retorno
  del portfolio usa el efectivo.

### Persistencia

- `asset_class_settings`: `{ user_id, name, color?, liquid?, expected_return_pct?, hidden, created_at,
  updated_at }`, único `{user_id, name}`. Clases visibles = (por defecto − ocultas) ∪ guardadas no
  ocultas ∪ en uso.
- `platform_settings`: `{ user_id, key, type?, avatar_text?, color?, updated_at }`, único `{user_id, key}`.
  El tipo se lee de acá, si no de la colección `platforms` heredada, si no `Other`.
- Renombrar/merge (clases y plataformas): una transacción que actualiza los holdings afectados y mueve o
  fusiona la configuración. Los movimientos conservan los nombres que tenían (son históricos).

### Frontend

- `SettingsView` con `ClassesSection` y `PlatformsSection`.
- `ClassFormDialog`, `DeleteClassDialog` (mover a…), `PlatformCustomizeDialog` (vista previa en vivo).
- `PlatformAvatar` (miniatura reutilizable) y `ColorPicker` (paleta + hex).
- `lib/constants.ts`: colores y miniaturas salen de la configuración del usuario, con los derivados
  actuales como respaldo.

### Mock API

Clases y plataformas personalizadas, rename/merge, borrar con `moveTo`, liquidez y retorno por defecto.

## Tareas

**Backend**
- [ ] IDs derivados; repositorios de configuración de clases y plataformas.
- [ ] Servicio de clases (listar con stats, crear, editar, renombrar/merge, borrar/mover) en transacción.
- [ ] Servicio de plataformas (personalizar, renombrar/merge) en transacción.
- [ ] Liquidez y retorno efectivos; resumen con colores y miniaturas.
- [ ] Handlers, `openapi.json`, README; e2e de aislamiento (configuración y renombres ajenos).

**Frontend**
- [ ] `api.ts` + mock + tests.
- [ ] Settings, diálogos, `PlatformAvatar`, `ColorPicker`; colores en todas las vistas.
- [ ] Tests de flujos.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R2 | crear, duplicada, renombrar, merge, borrar con y sin `moveTo`, ocultar por defecto, liquidez y retorno efectivos, cuota | lista, diálogos, merge con confirmación |
| R3 | personalizar, `avatarText` (grafemas/emoji), renombrar, merge, conservar al vaciarse, cuota | vista previa, reset, uso en todas las vistas |

## Decisiones y riesgos

- **Plataformas siguen derivadas de los holdings**: crear una plataforma vacía cambiaría el modelo (y las
  reglas de "aparece con su primer asset"); no fue pedido.
- **Personalización como "override" por nombre** en lugar de sembrar las clases por defecto en cada
  cuenta: no hace falta migrar a nadie y cambiar la configuración por defecto sigue alcanzando a quien no
  la tocó.
- **Riesgo**: renombrar una plataforma con muchos assets toca muchos documentos en una transacción (hasta
  1000): dentro de los límites de Mongo, con *timeout* de operación de 10 s.
