# F2 — Movimientos: ganancias, pérdidas, aportes, retiros y transferencias

**Estado:** Lista para implementar · **Repos:** backend + frontend · **Depende de:** F1

## Objetivo

Registrar **por qué** cambia el valor de cada asset: una ganancia (intereses, dividendos, suba), una
pérdida, plata nueva que entra, plata que sale, o una **transferencia entre plataformas** (del banco al
broker, del exchange a la billetera). Cada cambio queda en un historial de **actividad** que se puede
consultar y, si fue un error, **deshacer**. Esto alimenta el análisis por períodos de F6 (cuánto del
cambio fue rendimiento y cuánto fue ahorro).

## Alcance

Movimientos de un asset (ganancia, pérdida, depósito, retiro), transferencias entre holdings (con
comisión opcional y destino nuevo), registro automático al crear, borrar y editar el valor, detalle de un
asset con su historial, actividad general en History, deshacer. Transacciones de MongoDB.

**Fuera de alcance:** movimientos de deudas (F3), resumen de movimientos por período (F6).

## Requisitos

### F2-R1 · Ganancia o pérdida en un asset

1. Desde la fila de un asset (acción **Gain/loss**) o su detalle: monto > 0, fecha (por defecto hoy, no
   futura), nota opcional (≤ 200 caracteres).
2. La ganancia suma al valor del asset y la pérdida resta, en la misma operación que guarda el movimiento.
3. Una pérdida mayor que el valor actual se rechaza: `409 insufficient-balance` —
   *"Bitcoin is worth $1,000.00: a loss can't be larger than that."*
4. Toast "Gain recorded" / "Loss recorded" con **Undo**.

### F2-R2 · Depósito o retiro en un asset

1. Igual que R1 con **Deposit** (plata nueva que entra al asset) y **Withdrawal** (plata que sale).
2. Un retiro mayor que el valor actual → `409 insufficient-balance`.

> En la UI, R1 y R2 son un solo diálogo "Record a change" con selector **Gain · Loss · Deposit ·
> Withdrawal** y una explicación corta de cada uno ("Deposit: new money you put in").

### F2-R3 · Transferir entre plataformas

1. Diálogo **Transfer** accesible desde: la acción de fila de un asset (origen preseleccionado), la
   tarjeta y el detalle de una plataforma (origen = esa plataforma) y el detalle de un asset.
2. Origen y destino se eligen en dos niveles: **plataforma → asset**. Si la plataforma tiene un solo
   asset, se elige solo. El destino puede ser un asset existente o **"A new asset on…"** (nombre, clase y
   plataforma; por defecto el nombre y la clase del origen).
3. Monto > 0, **comisión** opcional ≥ 0 y ≤ monto, fecha, nota. El origen baja `monto`; el destino sube
   `monto − comisión`.
4. Validaciones: origen ≠ destino (`"Pick a different destination"`); monto ≤ valor del origen
   (`409 insufficient-balance`); un destino nuevo respeta las reglas y la cuota de holdings.
5. Todo o nada: si algo falla, ningún valor cambia y no queda movimiento.
6. El diálogo muestra el saldo disponible del origen, un botón **Max** y la vista previa
   *"Santander · Savings $9,500 → $8,500 · Balanz · USD cash $0 → $998"*.
7. Toast "Transfer recorded" con **Undo**.

### F2-R4 · Editar el valor registra el motivo

1. En Edit asset (F1), si el valor cambia aparece **"What's this change?"** con tres opciones:
   **Market move** (por defecto) → `GAIN`/`LOSS`; **Money in/out** → `DEPOSIT`/`WITHDRAWAL`;
   **Correction** → `ADJUSTMENT` (no cuenta como rendimiento ni como aporte).
2. El movimiento guarda el valor anterior y el nuevo; la fecha es hoy salvo que se elija otra.
3. El cambio de valor y el movimiento se guardan juntos (transacción); si el asset cambió en otro
   dispositivo mientras tanto, el delta se calcula sobre el valor vigente al guardar.

### F2-R5 · Altas y bajas quedan registradas

1. Crear un asset registra `OPENING` con su valor inicial (también si es 0).
2. Borrar un asset registra `CLOSING` con el valor que tenía.
3. El historial sobrevive al borrado: los movimientos muestran el nombre y la plataforma que el asset tenía,
   marcados *"(deleted)"*.

### F2-R6 · Detalle de un asset

1. Clic en una fila de Assets (o en el nombre en el detalle de una plataforma) abre un panel lateral con:
   nombre, plataforma, clase, valor, creado/actualizado, acciones (**Edit**, **Gain/loss**, **Transfer**,
   **Remove**) y su actividad (más nueva primero, **Load more** de a 50).
2. Escape o la ✕ lo cierran y devuelven el foco a la fila.

### F2-R7 · Actividad

1. History suma una sección **Activity** con todos los movimientos (más nuevos primero, de a 50).
2. Filtros: tipo (Gains & losses · Deposits & withdrawals · Transfers · Added & removed · Corrections) y
   asset.
3. Cada fila: ícono y color por tipo, descripción (*"Transfer · Santander Savings → Balanz USD cash"*),
   monto con signo para el asset en cuestión, comisión si hubo, fecha, nota.

### F2-R8 · Deshacer

1. `GAIN`, `LOSS`, `DEPOSIT`, `WITHDRAWAL`, `TRANSFER` y `ADJUSTMENT` se pueden deshacer: se revierte su
   efecto en los valores y el movimiento se borra, todo junto.
2. El efecto se revierte **como delta**, no "volviendo al valor anterior": si después hubo otros
   movimientos, se conservan.
3. No se puede deshacer si un asset involucrado ya no existe (`409 not-revertible`: *"Bitcoin was removed,
   so this can't be undone."*), si un valor quedaría negativo (`409 insufficient-balance`), ni un
   `OPENING`/`CLOSING` (`409 not-revertible`: se deshacen borrando o volviendo a crear el asset).
4. Desde el toast (**Undo**) y desde la actividad (acción **Undo** con confirmación). La lista marca qué
   movimientos se pueden deshacer.

### F2-R9 · Cuota y fechas

1. Hasta **20 000** movimientos por usuario (`409 limit-exceeded`), contados exactamente aunque haya
   pedidos simultáneos. Los `CLOSING` no cuentan: borrar un asset siempre funciona.
2. `occurredAt`: `YYYY-MM-DD` (se guarda 12:00 UTC) o RFC 3339; no posterior a ahora + 24 h ni anterior a
   1970 (`400`). Por defecto, ahora.

## Diseño

### Dominio

```go
type MovementKind string // OPENING, CLOSING, GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER, ADJUSTMENT

type Movement struct {
    Id            MovementId
    UserId        UserId
    Kind          MovementKind
    OccurredAt    time.Time
    Amount        Money       // > 0 (OPENING/CLOSING ≥ 0; ADJUSTMENT = |nuevo − anterior|)
    Fee           Money       // solo TRANSFER
    Holding       *HoldingRef // el asset afectado; en TRANSFER, el origen
    ToHolding     *HoldingRef // TRANSFER: destino
    PreviousValue *Money      // ADJUSTMENT y cambios de valor desde Edit
    NewValue      *Money
    Note          string      // ≤ 200
    CreatedAt     time.Time
}
type HoldingRef struct { Id HoldingId; Name string; Platform PlatformName; AssetClass AssetClass } // al momento del movimiento
```

Efecto sobre los valores (función pura del dominio, usada para aplicar y —con signo inverso— para
deshacer):

| Tipo | Asset (o origen) | Destino |
|---|---|---|
| `OPENING` | `= monto` (alta) | — |
| `CLOSING` | baja del asset | — |
| `GAIN`, `DEPOSIT` | `+ monto` | — |
| `LOSS`, `WITHDRAWAL` | `− monto` (no puede quedar < 0) | — |
| `TRANSFER` | `− monto` (no puede quedar < 0) | `+ (monto − comisión)` |
| `ADJUSTMENT` | `+ (nuevo − anterior)` | — |

### Transacciones

- Puerto `outbound.TransactionManager { WithinTransaction(ctx, fn func(ctx) error) error }`: lo que los
  repositorios hacen con el `ctx` que recibe `fn` se confirma junto o no se confirma. `fn` puede correr más
  de una vez (los conflictos transitorios se reintentan), así que no debe tener efectos fuera de la base.
- Adaptador Mongo: `session.WithTransaction`. Los repositorios **no cambian**: el driver toma la sesión
  del `ctx`.
- Sin replica set, Mongo responde `IllegalOperation` (código 20, *"Transaction numbers are only allowed on
  a replica set member or mongos"*): se traduce a `503 transactions-unavailable` — *"This database
  doesn't support transactions. Run MongoDB as a replica set (see the README)."* Al arrancar, si el
  comando `hello` no informa `setName` (ni `msg: "isdbgrid"`), se loguea una advertencia.
- Local: `compose.yaml` levanta `mongo:7 --replSet rs0` y un *healthcheck* lo inicializa solo
  (`rs.initiate`); `MONGODB_URI` por defecto pasa a `mongodb://localhost:27017/?directConnection=true`.
  Tests: el `Makefile` hace lo mismo con el Mongo descartable y usa `directConnection=true`. Un volumen
  existente de un Mongo standalone sirve tal cual: se reinicia como replica set sin migrar datos.
- Mocks de tests: un `TransactionManager` que llama a `fn(ctx)` directamente.

### Cuota exacta

Documento por usuario en la colección `quotas` (`{ _id: userId, movements: n }`). Toda escritura de un
movimiento que cuenta (todos menos `CLOSING`) hace, dentro de la transacción,
`$inc movements` con filtro `movements < 20000` (*upsert*); si no matchea, la transacción aborta con
`limit-exceeded`. Deshacer resta 1. Dos escrituras simultáneas del mismo usuario chocan en ese documento y
una se reintenta: el conteo es exacto y las escrituras de un usuario quedan serializadas.

### API

#### `POST /api/v1/movements`

```json
{ "kind": "GAIN", "holdingId": "…", "amountUsd": 250, "occurredAt": "2026-10-05", "note": "Dividends" }
{ "kind": "TRANSFER", "fromHoldingId": "…", "toHoldingId": "…", "amountUsd": 1000, "feeUsd": 2 }
{ "kind": "TRANSFER", "fromHoldingId": "…",
  "toNewHolding": { "name": "USD cash", "assetClass": "Cash", "platform": "Balanz" }, "amountUsd": 1000 }
```

- `kind`: `GAIN`, `LOSS`, `DEPOSIT`, `WITHDRAWAL`, `TRANSFER` (los demás tipos los genera el sistema:
  `400` `"kind must be one of GAIN, LOSS, DEPOSIT, WITHDRAWAL, TRANSFER"`).
- Validación (`400`, por campo): `amountUsd` > 0 y ≤ 1e15; `feeUsd` ≥ 0 y ≤ `amountUsd`; ids requeridos
  según el tipo; exactamente uno de `toHoldingId`/`toNewHolding`; origen ≠ destino; `note` ≤ 200;
  `occurredAt` según R9.2.
- `201` → `MovementResponse` (+ `Location`) · `404` holding inexistente o ajeno · `409`
  `insufficient-balance` / `limit-exceeded` · `503` `transactions-unavailable`.

#### `MovementResponse`

```json
{
  "id": "…", "kind": "TRANSFER", "occurredAt": "2026-10-05T12:00:00Z", "createdAt": "2026-10-05T18:31:07Z",
  "amountUsd": 1000, "feeUsd": 2,
  "holding":   { "id": "…", "name": "Savings",  "platform": "Santander", "assetClass": "Cash", "exists": true },
  "toHolding": { "id": "…", "name": "USD cash", "platform": "Balanz",    "assetClass": "Cash", "exists": true },
  "previousValueUsd": null, "newValueUsd": null, "note": null,
  "revertible": true
}
```

`exists` dice si el asset sigue existiendo; `revertible` si hoy se puede deshacer (tipo y existencia; el
saldo se verifica al deshacer).

#### `GET /api/v1/movements`

- Filtros: `holdingId` (como origen o destino), `kind` (lista separada por comas), `from`, `to` (instantes
  o fechas, sobre `occurredAt`), `limit` (50, máx. 200), `cursor`.
- Orden: `occurredAt` desc, `createdAt` desc, `id` desc. Cursor = posición del último ítem (paginación por
  *keyset*, estable aunque entren movimientos nuevos).
- `200` → `{ "items": [MovementResponse], "nextCursor": "…" | null }` · `400` filtros inválidos.

#### `DELETE /api/v1/movements/{id}`

`204` (revertido y borrado) · `404` · `409` `not-revertible` / `insufficient-balance` · `503`.

#### Cambios en endpoints existentes

- `POST /holdings`: además guarda `OPENING`, en la misma transacción. La cuota de holdings se sigue
  respetando exactamente (si la confirmación posterior al alta lo retira, retira también su `OPENING`).
- `DELETE /holdings/{id}`: guarda `CLOSING` y borra el holding en una transacción.
- `PATCH /holdings/{id}`: si `valueUsd` cambia, acepta `valueChangeReason`: `MARKET` (por defecto) |
  `CASH_FLOW` | `CORRECTION`, y opcionalmente `occurredAt` y `note` para el movimiento. Valor + movimiento
  en una transacción; el delta se calcula sobre el valor leído dentro de ella.

### Persistencia

- Colección `movements`: `_id`, `user_id`, `kind`, `occurred_at`, `amount_usd` (texto, escala 2),
  `fee_usd`, `holding {id, name, platform, asset_class}`, `to_holding {…}`, `previous_value_usd`,
  `new_value_usd`, `note`, `created_at`.
- Índices: `{user_id, occurred_at: -1, created_at: -1, _id: -1}` (actividad y períodos);
  `{user_id, holding.id, …}` y `{user_id, to_holding.id, …}` (historial de un asset).
- Colección `quotas`: `{ _id: user_id, movements }`.
- Borrar los datos de una cuenta (README): sumar `movements` y `quotas` a la lista de colecciones.

### Frontend

- `api`: `createMovement`, `getMovements(params)`, `deleteMovement(id)`; `updateHolding` acepta
  `valueChangeReason`, `occurredAt`, `note`.
- Diálogos: `RecordChangeDialog` (selector Gain/Loss/Deposit/Withdrawal, `MoneyInput`, fecha, nota),
  `TransferDialog` (dos niveles plataforma → asset, destino nuevo, Max, vista previa), motivo del cambio en
  `HoldingFormDialog`.
- `HoldingDrawer` (panel lateral, foco atrapado como `Modal`) con acciones y `ActivityList`.
- `ActivityList` reutilizable (asset o general), con "Load more" y Undo; sección Activity en History.
- `DateInput` (fecha nativa, `max` = hoy local), que envía `YYYY-MM-DD`.
- Toasts con **Undo** (5 s) que llaman a `deleteMovement`.
- Platforms: acción **Transfer from here** en tarjetas y detalle.

### Mock API

Mismas reglas: efectos, `insufficient-balance`, `not-revertible`, cuota, `OPENING`/`CLOSING` automáticos,
orden y paginación por cursor, `exists`/`revertible`.

## Tareas

**Backend**
- [ ] Replica set en `compose.yaml` y `Makefile`; README (local, tests, standalone existente).
- [ ] `TransactionManager` (puerto, adaptador Mongo, error 503, advertencia al arrancar) + tests.
- [ ] Dominio `Movement`, `MovementKind`, efectos y reversión (100 % cubierto).
- [ ] `MovementRepository` (guardar, buscar por id, listar con filtros y cursor, borrar) + índices.
- [ ] `quotas` (incremento condicional dentro de la transacción).
- [ ] `MovementService`: crear (4 tipos + transferencia, destino nuevo), listar, deshacer.
- [ ] Holdings: `OPENING`/`CLOSING`/motivo del cambio de valor en transacción.
- [ ] Handlers, `openapi.json`, README (endpoints, colecciones, cuotas).
- [ ] e2e: aislamiento de movimientos (listar, deshacer, transferir con holdings ajenos → `404`).

**Frontend**
- [ ] `api.ts` + mock + tests del mock.
- [ ] `RecordChangeDialog`, `TransferDialog`, motivo en Edit, `DateInput`.
- [ ] `HoldingDrawer`, `ActivityList`, Activity en History, Undo en toasts.
- [ ] Acciones en filas, tarjetas y detalle de plataformas.
- [ ] Tests de flujos.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R1, R2 | efectos y saldo insuficiente (dominio), servicio, handler, e2e | diálogo, toasts, error 409 |
| R3 | transferencia a existente y a nuevo, comisión, origen = destino, atomicidad (falla a mitad → nada cambia, con Mongo real), cuota de holdings | dos niveles, Max, vista previa, destino nuevo |
| R4 | tres motivos, delta sobre el valor vigente | selector de motivo |
| R5 | `OPENING`/`CLOSING`, historial tras borrar (`exists: false`) | "(deleted)" |
| R6, R7 | listado con filtros, orden y cursor | panel, filtros, Load more |
| R8 | deshacer cada tipo, como delta, casos `not-revertible` | Undo desde toast y lista |
| R9 | cuota exacta con pedidos simultáneos, `CLOSING` no cuenta, fechas | fecha por defecto y máximo |

## Decisiones y riesgos

- **Registro híbrido** (D2) en lugar de calcular el valor sumando movimientos: no cambia ninguna lectura
  existente y la historia previa a F2 (holdings sin `OPENING`) no rompe nada.
- **Deshacer como delta**: "volver al valor anterior" pisaría movimientos posteriores.
- **Transacciones obligatorias** (D3): la alternativa sin transacción (escrituras compensatorias) deja
  saldos a medio mover si el proceso muere, y en Vercel puede morir en cualquier momento.
- **Riesgo**: quien corre Mongo local standalone ve `503` al registrar movimientos hasta pasar a replica
  set. Mitigación: mensaje explícito, advertencia al arrancar y README.
