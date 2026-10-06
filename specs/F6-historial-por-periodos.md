# F6 — Historial por períodos de análisis

**Estado:** Hecha · **Repos:** backend + frontend · **Depende de:** F2, F3

## Objetivo

Poder mirar **un período** —el último mes, este año, los últimos 3 años o un rango propio— y entender
**cuánto cambió el patrimonio y por qué**: cuánto fue rendimiento de las inversiones, cuánto fue ahorro
(aportes y retiros), cuánto fueron assets o deudas que se empezaron o dejaron de seguir. También cargar
**checkpoints del pasado** para que la historia arranque antes de empezar a usar BASE.

## Alcance

Selector de período (con rango propio), gráfico y tabla filtrados, estadísticas del período, desglose del
cambio con los movimientos, checkpoints manuales hacia atrás, ejes del gráfico, recordatorio de snapshot.

**Fuera de alcance:** snapshots automáticos (F7), comparar dos períodos lado a lado.

## Requisitos

### F6-R1 · Selector de período

1. Arriba de History: **1M · 3M · 6M · YTD · 1Y · 3Y · All · Custom**. Por defecto **1Y** (o el guardado en
   preferencias en F7).
2. **Custom** abre dos fechas (*From*, *To*); *To* no puede ser anterior a *From* ni futura.
3. El período aplica al gráfico, la tabla de checkpoints, las estadísticas, el desglose y la sección
   Activity (F2).
4. Los períodos se calculan en la hora local del navegador (YTD = desde el 1 de enero local; 1M = mismo
   día del mes anterior).

### F6-R2 · Gráfico y tabla del período

1. Se muestran los checkpoints dentro del período. Si el período llega a hoy, se agrega el punto **Today**
   con el patrimonio actual (interruptor *"Include today's value"*, activado por defecto).
2. Ejes: Y con 4–5 valores compactos; X con fechas (inicio, intermedias, fin). Línea punteada con el valor
   inicial del período.
3. Sin checkpoints en el período: *"No checkpoints in this period"* con **Show all time**.

### F6-R3 · Estadísticas del período

1. **Inicio**: el checkpoint más reciente en o antes del comienzo del período; si no hay, el primero dentro
   del período. **Fin**: el último dentro del período, o *Today* si está incluido.
2. **Cambio** en $ y % (el % solo si el inicio es > 0).
3. **Anualizado** (*"Annualized change"*): `(fin/inicio)^(365.25/días) − 1`, solo si el período tiene ≥ 90
   días y ambos valores son > 0; aclara que incluye aportes.
4. **Máximo** y **mínimo** con sus fechas; **mayor caída** (*max drawdown*: la peor baja desde un máximo
   previo, en % y $); **mejor** y **peor** variación entre checkpoints consecutivos.

### F6-R4 · Por qué cambió (desglose)

1. Con los movimientos entre la fecha del inicio y la del fin (las mismas de R3), el cambio se separa en:
   - **Investments** (rendimiento): ganancias − pérdidas − comisiones de transferencias − intereses de
     deudas.
   - **Saving** (flujo de plata): depósitos − retiros + pagos de deudas hechos sin usar un asset − cargos
     de deudas que no fueron a un asset.
   - **Added & removed**: altas − bajas de assets; bajas − altas de deudas.
   - **Corrections**: ajustes (con signo).
   - **Not recorded**: cambio total − la suma de lo anterior (lo que pasó sin registrarse como movimiento).
2. Se muestra como barras horizontales con signo (positivo verde, negativo rojo), con montos.
3. Las transferencias entre assets y los pagos de deuda hechos desde un asset no cambian el patrimonio
   (salvo la comisión): no suman en ninguna categoría, pero se cuentan en *"N transfers"*.

### F6-R5 · Checkpoints del pasado

1. **Add a past checkpoint**: fecha (pasada), patrimonio neto, opcionalmente assets y deudas (si se cargan,
   el neto = assets − deudas y se calcula solo), nota (≤ 200).
2. Se marcan como *manual* en la tabla (ícono y tooltip). Se pueden borrar como cualquier checkpoint.
3. Mismas reglas que los automáticos: uno por segundo, cuota de 5000.

### F6-R6 · Recordatorio

1. Si el último checkpoint tiene más de 30 días (o no hay ninguno y hay assets), History y Dashboard
   muestran *"It's been 34 days since your last checkpoint"* con **Save a snapshot** y **Dismiss** (se
   oculta hasta el próximo día).

## Diseño

### API

#### `GET /api/v1/movements/summary?from=&to=`

`from`/`to` como en `GET /movements` (`to` por defecto ahora, `from` por defecto el inicio de los tiempos).

```json
{
  "from": "2025-10-05T00:00:00Z", "to": "2026-10-05T18:00:00Z", "count": 42, "transfers": 6,
  "totalsUsd": { "GAIN": 6000, "LOSS": 900, "DEPOSIT": 9000, "WITHDRAWAL": 1000, "TRANSFER_FEES": 12,
                 "OPENING": 3000, "CLOSING": 700, "ADJUSTMENT": 45,
                 "DEBT_OPENING": 0, "DEBT_CLOSING": 0, "DEBT_PAYMENT_EXTERNAL": 300, "DEBT_PAYMENT_FROM_ASSET": 900,
                 "DEBT_CHARGE_EXTERNAL": 150, "DEBT_CHARGE_TO_ASSET": 0, "DEBT_INTEREST": 40 },
  "netWorthEffectUsd": { "investments": 5048, "saving": 8150, "addedRemoved": 2300, "corrections": 45 }
}
```

Las reglas de R4 viven en el dominio (`service.MovementsEffect`), no en el frontend.

#### `POST /api/v1/wealth/snapshots` (aditivo)

Body opcional. Sin body (o `{}`), como hoy: guarda el patrimonio actual (`source: "AUTO"`). Con body:

```json
{ "capturedAt": "2025-12-31", "totalValueUsd": 81000, "assetsUsd": 95000, "debtsUsd": 14000, "note": "From my spreadsheet" }
```

- `capturedAt` y `totalValueUsd` obligatorios juntos; `capturedAt` pasado (≤ ahora) y ≥ 1970;
  `totalValueUsd` −1e15..1e15; `assetsUsd`/`debtsUsd` ≥ 0, ambos o ninguno, y si vienen,
  `totalValueUsd = assetsUsd − debtsUsd` (`400` si no). `note` ≤ 200.
- `409` si ya hay uno en ese segundo; `409 limit-exceeded` con 5000.
- `SnapshotResponse` suma `source` (`AUTO` | `MANUAL`) y `note`.

### Frontend

- `lib/periods.ts`: rangos de cada preset en hora local, punto de inicio/fin, estadísticas (cambio,
  anualizado, máximo, mínimo, *drawdown*, mejor/peor), con tests de tabla.
- `HistoryView`: `PeriodSelector`, `HistoryChart` (ejes, línea base, Today), `PeriodStats`,
  `ChangeBreakdown` (barras con signo), tabla filtrada, `Activity` filtrada por el período.
- `PastCheckpointDialog`; `SnapshotReminder` (Dashboard e History; *Dismiss* en `localStorage` por día).

### Mock API

`getMovementsSummary` con las mismas reglas; `createSnapshot` con body manual y sus validaciones.

## Tareas

**Backend**
- [x] `MovementsEffect` (dominio, 100 % cubierto) + `GET /movements/summary` (agregación por tipo en Go).
- [x] Snapshots manuales (`source`, `note`) y validaciones.
- [x] `openapi.json`, README; e2e de aislamiento del resumen.

**Frontend**
- [x] `lib/periods.ts` + tests.
- [x] Selector, gráfico con ejes, estadísticas, desglose, Activity del período.
- [x] Checkpoint pasado, recordatorio.
- [x] Mock + tests de flujos.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R1 | — | rangos de cada preset (bordes de mes, años bisiestos, hora local), Custom |
| R2 | — | puntos del período, Today, ejes, vacío |
| R3 | — | inicio/fin, %, anualizado (≥ 90 días), máximo/mínimo, *drawdown*, mejor/peor |
| R4 | efecto por categoría de cada tipo, transferencias y pagos internos neutros, rango de fechas | barras y *Not recorded* |
| R5 | validaciones, neto = assets − deudas, duplicado, cuota, `source` | diálogo, marca *manual* |
| R6 | — | 30 días, Dismiss por día |

## Decisiones y riesgos

- **Estadísticas de checkpoints en el frontend** (ya tiene todos los snapshots, máx. 5000) y **desglose de
  movimientos en el backend** (pueden ser 20 000; no se bajan para sumarlos).
- **"Annualized change", no "return"**: sobre el patrimonio incluye aportes; el rendimiento puro es la
  barra *Investments* del desglose.
- **Riesgo**: la categoría *Not recorded* puede ser grande si el usuario no registra movimientos; es
  información útil (le muestra cuánto falta registrar), con un texto que lo explica.

### Decisiones al implementar

**Backend**

- **Agregación en Mongo, reglas en el dominio**: `GET /movements/summary` agrupa con un `$group` por *forma*
  (`kind`, si es de una deuda, si toca un asset) y suma montos, comisiones y `new − previous` como `decimal`
  (`$convert`, sin pérdida de centavos); `service.MovementsEffect` reparte esos grupos en los 16 *buckets* y
  calcula el efecto. Nunca se bajan los movimientos para sumarlos.
- **`from`/`to` en la respuesta** son los límites que se usaron (por defecto 1970 y ahora; una fecha sola es el
  día entero en UTC). `from` posterior a `to` → `400` *"from must not be after to"*.
- **`transfers`** cuenta las transferencias, los pagos de deuda hechos desde un asset y los cargos que fueron a
  un asset: los tres mueven plata sin cambiar el patrimonio.
- **Ajustes**: suman `newValue − previousValue`; los de una deuda con el signo invertido (más deuda, menos
  patrimonio).
- **Body vacío = snapshot de hoy**: un `POST /wealth/snapshots` con `{}` (o sin ningún campo) guarda el
  patrimonio actual, como sin body. Con algún campo es uno del pasado y se valida entero.
- **Un checkpoint del pasado con solo el neto** guarda assets = neto (o deudas = −neto si es negativo), para que
  la tabla y el *tooltip* puedan mostrar de qué estaba hecho sin inventar más.
- **`source` de los snapshots viejos**: los documentos sin `source` se leen como `AUTO`.

**Frontend**

- **El período vive en `WealthContext`** (`historyPeriod`): se mantiene al cambiar de vista mientras la app está
  abierta y vuelve a *1Y* al cambiar de cuenta. Guardarlo en preferencias queda para F7.
- **Custom arranca con las fechas del período que se estaba viendo**; con fechas que no forman un período
  (falta una, fin antes del inicio, fin futuro) se ve todo el historial y se dice por qué
  (*"…: showing all time."*).
- **"Include today's value"** solo aparece cuando el período llega a hoy (en un Custom que termina antes no
  hay punto *Today*).
- **Eje X en el tiempo**: cada checkpoint se dibuja en su fecha, no a intervalos iguales. Cuando el inicio de
  la medición es un checkpoint anterior al período, no se dibuja como punto: queda la línea punteada y la
  leyenda *"Start: $X on <fecha>"*.
- **Lectura del gráfico**: con el mouse (el punto más cercano) o con el foco y las flechas, Home y End. El
  *tooltip* muestra el neto, assets y deudas si había deudas, y el cambio desde el punto anterior; los
  checkpoints manuales se ven huecos y dicen *"added by hand"*; *Today* lleva un halo.
- **Estadísticas en dos filas de cuatro** (*Change* ocupa dos). Montos y % con signo tipográfico (`−`), y sin
  signo cuando redondean a cero (`formatSignedCurrency`, `formatSignedPercentage`).
- **El desglose pide el resumen entre los instantes exactos** del inicio y del fin (los mismos de las
  estadísticas) y se vuelve a pedir cuando cambian los datos (`dataVersion`). *Not recorded* se redondea a
  centavos.
- **Sin checkpoints en el período** pero con uno anterior y el valor de hoy, igual se muestran las
  estadísticas y el desglose (*"It went from $X to $Y."*). Sin ningún checkpoint se ve *"No checkpoints yet"*
  aunque haya valor de hoy.
- **Checkpoint del pasado**: se manda el **mediodía local** del día elegido como instante (o ahora, si es hoy y
  todavía es de mañana), para que caiga en ese día en el huso del usuario. La casilla *"I know what I owned and
  owed"* cambia el neto por dos campos y muestra el neto calculado en vivo. El neto acepta negativos
  (`parseSignedAmount`: `-2.500`, `−$500`; un segundo `-` es un error de tipeo).
- **Recordatorio**: en History no repite el botón *Save a snapshot* (está en la tarjeta de abajo). *Dismiss*
  se guarda por navegador y por día; si el navegador no deja guardar, se oculta solo en esa visita.
- **Activity del período**: `from` es el inicio del período; `to` solo cuando el período no llega a hoy (el
  final de su último día), así lo recién registrado aparece sin recargar.

