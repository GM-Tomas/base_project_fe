# F3 — Deudas

**Estado:** Lista para implementar · **Repos:** backend + frontend · **Depende de:** F2

## Objetivo

Hoy BASE solo ve lo que tenés. Esta fase agrega lo que **debés** —tarjetas, préstamos, hipoteca, plata
que te prestó alguien— en una pestaña propia, y pasa a mostrar el **patrimonio neto real**: assets −
deudas. Pagar una cuota desde una cuenta baja la deuda y la cuenta a la vez, y cada deuda dice cuándo se
termina de pagar.

## Alcance

Pestaña Debts; alta, edición y baja de deudas; pagos (desde un asset o no), cargos e intereses como
movimientos; patrimonio neto con signo en todo el producto; snapshots con assets y deudas; estimación de
cancelación por deuda; línea de patrimonio neto en Estimate.

**Fuera de alcance:** recordatorios de vencimiento por email, deudas en otra moneda (D1), cronograma de
pagos detallado mes a mes (se muestra el resumen).

## Requisitos

### F3-R1 · Pestaña Debts

1. Nuevo ítem **Debts** en la navegación, entre Assets y Estimate.
2. Encabezado: total adeudado, suma de cuotas mensuales, tasa promedio ponderada por saldo y *"Debt-free
   by Mar 2029"* (la cancelación más lejana; si alguna nunca se cancela con su cuota, se dice).
3. Lista: nombre, acreedor, tipo, saldo, tasa anual, cuota, vencimiento (*"Due on the 10th"*) y
   cancelación (*"Paid off in 14 months · Dec 2027"*, *"Never at this payment"*, *"Add a monthly payment to
   see when it's paid off"*, *"Paid off"*).
4. Acciones por fila: **Pay**, **Edit**, **Remove**; clic en la fila abre su detalle (datos, acciones y
   actividad, como el detalle de un asset).
5. Estado vacío: *"Nothing owed. If you have a card balance, a loan or a mortgage, add it to see your real
   net worth."* con **Add a debt**.

### F3-R2 · Alta, edición y baja

1. Campos: nombre (obligatorio, ≤ 120), acreedor (opcional, ≤ 120), tipo (**Credit card · Loan · Mortgage
   · Personal · Other**; por defecto Other), saldo (obligatorio, 0 a 1e15), tasa anual % (opcional, 0 a
   200), cuota mensual (opcional, 0 a 1e15), día de vencimiento (opcional, 1 a 31), notas (opcional, ≤ 500).
2. Alta → toast "Debt added" y movimiento `OPENING` de la deuda. Baja → confirmación (*"Remove Visa? Its
   balance ($1,250) will stop counting against your net worth."*), toast y `CLOSING`.
3. Editar el saldo pregunta el motivo: **Payment** → `DEBT_PAYMENT`, **New charges** → `DEBT_CHARGE`,
   **Interest** → `DEBT_INTEREST`, **Correction** (por defecto) → `ADJUSTMENT`.
4. Hasta **200** deudas por usuario (`409 limit-exceeded`).

### F3-R3 · Pagar una deuda

1. Acción **Pay**: monto (por defecto, la cuota mensual si está cargada; botón **Full balance**), desde un
   asset (opcional: plataforma → asset), fecha, nota.
2. La deuda baja el monto; si se eligió un asset, ese asset baja lo mismo, en la misma transacción.
3. Monto ≤ saldo de la deuda (`409 insufficient-balance`: *"Visa only has $1,250.00 left to pay."*) y, si
   hay asset, ≤ su valor.
4. Toast "Payment recorded" con **Undo**.

### F3-R4 · Cargos e intereses

1. **New charge** (compras con la tarjeta, un préstamo nuevo): la deuda sube; opcionalmente *"Money went
   to"* un asset (un préstamo acreditado en una cuenta), que sube lo mismo.
2. **Interest**: la deuda sube por intereses o cargos financieros.
3. Los dos con fecha, nota y **Undo**.

### F3-R5 · Patrimonio neto = assets − deudas

1. Dashboard: el número principal es el patrimonio neto, con *"Assets $120,000 · Debts $20,000"* debajo.
   Si es negativo se muestra en rojo con signo.
2. Nueva tarjeta **You owe**: total, cantidad de deudas y cuota mensual total; lleva a Debts. Sin deudas:
   *"Nothing owed"*.
3. Los snapshots guardan assets, deudas y neto. Los anteriores a F3 se leen como assets = neto, deudas = 0.
4. YTD se calcula sobre el neto; si la base es ≤ 0 no hay porcentaje (*"no comparable baseline"*).
5. Profile y History usan el neto.

### F3-R6 · Cuándo se cancela cada deuda

1. Amortización mensual: `saldo ← saldo × (1 + tasa/12) − cuota`, hasta llegar a 0 (máximo 600 meses).
2. Resultado por deuda: meses, mes de cancelación (`YYYY-MM`) e intereses totales a pagar.
3. Si la cuota no cubre el interés del mes (o pasan 600 meses): *"Never at this payment"* con aviso.
4. Sin cuota: *"Add a monthly payment to see when it's paid off"*. Con saldo 0: *"Paid off"*.

### F3-R7 · Deudas en la proyección (Estimate)

1. La proyección parte de los **assets** (el portfolio), no del neto.
2. Si hay deudas, el gráfico suma una segunda línea: **net worth** = portfolio proyectado − saldo
   proyectado de las deudas (cada una amortizando con su cuota y su tasa; sin cuota, su saldo queda
   constante).
3. Los hitos se evalúan sobre el **patrimonio neto** proyectado, mes a mes.
4. Sin deudas, Estimate muestra exactamente lo mismo que hoy.

### F3-R8 · Actividad

Los movimientos de deudas aparecen en Activity (filtro **Debts**) y en el detalle de cada deuda, se
pueden deshacer con las reglas de F2.

## Diseño

### Dominio

```go
type DebtKind string // CREDIT_CARD, LOAN, MORTGAGE, PERSONAL, OTHER

type Debt struct {
    Id DebtId; UserId UserId
    Name string; Lender string; Kind DebtKind
    Balance Money
    InterestRatePct *decimal.Decimal // 0..200
    MonthlyPayment  *Money
    DueDay          *int             // 1..31
    Notes string
    CreatedAt, UpdatedAt time.Time
}
```

- Nuevos tipos de movimiento: `DEBT_PAYMENT` (deuda −monto; asset origen opcional −monto),
  `DEBT_CHARGE` (deuda +monto; asset destino opcional +monto), `DEBT_INTEREST` (deuda +monto).
  `OPENING`, `CLOSING` y `ADJUSTMENT` se reutilizan con referencia a la deuda (`Movement.Debt *DebtRef`).
- `model.SignedMoney` (decimal con signo, escala 2) para el patrimonio neto y los snapshots.
  `GrowthPctFrom` devuelve `nil` si la base es ≤ 0.
- `domain/service.DebtPayoff(debt, now)` → `{ status: PAID_OFF | ON_TRACK | NEVER | NO_PAYMENT, months,
  payoffMonth, totalInterest }` y `DebtBalanceAt(debt, month)` para la proyección.

### API

#### Deudas

- `GET /api/v1/debts` → `[DebtResponse]` (por saldo descendente, después nombre).
- `POST /api/v1/debts` → `201 DebtResponse` · `400` · `409 limit-exceeded`.
- `PATCH /api/v1/debts/{id}` (*merge patch*; `null` borra los opcionales; `balanceChangeReason`:
  `PAYMENT` | `CHARGE` | `INTEREST` | `CORRECTION` por defecto, más `occurredAt` y `note`) → `200`.
- `DELETE /api/v1/debts/{id}` → `204` (con `CLOSING`).

```json
{
  "id": "…", "name": "Visa", "lender": "Banco Galicia", "kind": "CREDIT_CARD",
  "balanceUsd": 1250.4, "interestRatePct": 65, "monthlyPaymentUsd": 300, "dueDay": 10, "notes": null,
  "createdAt": "…", "updatedAt": "…",
  "payoff": { "status": "ON_TRACK", "months": 5, "payoffMonth": "2027-03", "totalInterestUsd": 140.2 }
}
```

#### Movimientos

`POST /api/v1/movements` suma:

```json
{ "kind": "DEBT_PAYMENT",  "debtId": "…", "fromHoldingId": "…", "amountUsd": 300, "occurredAt": "2026-10-10" }
{ "kind": "DEBT_CHARGE",   "debtId": "…", "toHoldingId": "…",   "amountUsd": 10000 }
{ "kind": "DEBT_INTEREST", "debtId": "…", "amountUsd": 42.1 }
```

`MovementResponse` suma `debt: { id, name, lender, exists }`. `GET /movements` acepta `debtId`.

#### Resumen, snapshots y estimación (aditivo)

- `GET /wealth/summary`: `assets: { usd }`, `debts: { usd, count, monthlyPaymentUsd }`; `netWorth.usd` =
  assets − deudas (puede ser negativo).
- `SnapshotResponse`: `assetsUsd`, `debtsUsd` (`totalValueUsd` sigue siendo el neto).
- `GET /wealth/estimate`: `principalUsd` = assets; `debtsUsd` actual; cada punto suma `debtBalanceUsd` y
  `netWorthUsd`; los hitos se evalúan sobre el neto mensual.

### Persistencia

- Colección `debts` (montos y tasas como texto decimal); índice `{user_id, created_at}`.
- `net_worth_snapshots`: `assets_usd`, `debts_usd`; `total_value_usd` acepta negativos. Sin campos nuevos
  → assets = total, deudas = 0.
- `movements`: `debt { id, name, lender }`; índice `{user_id, debt.id, occurred_at: -1, …}`.
- `WealthAggregationPort.Breakdown` lee también las deudas (en paralelo con los holdings).

### Frontend

- `DebtsView` (encabezado, lista, estado vacío), `DebtDrawer`, `DebtFormDialog` (con motivo del cambio de
  saldo), `DebtPaymentDialog` (Pay / New charge / Interest).
- Dashboard: neto con assets y deudas, tarjeta **You owe**. Header: subtítulo de Debts.
- Estimate: segunda línea y leyenda cuando hay deudas.
- `ActivityList`: íconos y textos de los tipos de deuda; filtro Debts.

### Mock API

Deudas, pagos, cargos, intereses, `payoff`, resumen con assets/deudas, snapshots y proyección con deudas.

## Tareas

**Backend**
- [ ] `SignedMoney`; snapshots con assets/deudas (lectura de documentos viejos).
- [ ] Dominio `Debt` + `DebtPayoff` + `DebtBalanceAt` (100 % cubierto).
- [ ] `DebtRepository` + `DebtService` (CRUD con `OPENING`/`CLOSING`/motivo del saldo en transacción).
- [ ] Movimientos de deuda (crear, listar por deuda, deshacer).
- [ ] Resumen, YTD con base ≤ 0, proyección con deudas e hitos sobre el neto.
- [ ] Handlers, `openapi.json`, README; e2e de aislamiento de deudas.

**Frontend**
- [ ] `api.ts` + mock + tests.
- [ ] Debts (vista, detalle, diálogos), Dashboard, Estimate, Activity.
- [ ] Tests de flujos.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R1, R2 | CRUD, validaciones, cuota, `OPENING`/`CLOSING`, motivos | vista, encabezado, alta/edición/baja |
| R3, R4 | pago con y sin asset, saldo insuficiente (deuda y asset), cargo a un asset, interés, atomicidad | diálogos, Full balance, Undo |
| R5 | neto con signo, snapshots viejos y nuevos, YTD con base ≤ 0 | hero, tarjeta You owe, negativo en rojo |
| R6 | amortización: casos ON_TRACK, NEVER, NO_PAYMENT, PAID_OFF, tasa 0 | textos de cancelación |
| R7 | serie con deudas, hitos sobre el neto, sin deudas = antes | segunda línea y leyenda |

## Decisiones y riesgos

- **El portfolio es la base de la proyección** (no el neto): proyectar un neto negativo con interés
  compuesto no tiene sentido, y las deudas no "rinden" la tasa del portfolio; se proyectan aparte, con su
  propia tasa y cuota.
- **Motivo por defecto al editar el saldo de una deuda: Correction** — al copiar el saldo del resumen de la
  tarjeta se mezclan cargos, intereses y pagos; el usuario puede elegir el motivo si lo sabe.
- **Riesgo**: el neto puede bajar de golpe en el dashboard al cargar deudas. Es el objetivo; el subtítulo
  "Assets · Debts" lo explica.
