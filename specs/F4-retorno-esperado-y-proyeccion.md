# F4 — Retorno esperado y proyección ponderada

**Estado:** Hecha · **Repos:** backend + frontend · **Depende de:** F3

## Objetivo

Que cada asset diga **cuánto rinde por año, aproximadamente**, y que la proyección use el **promedio
ponderado** de esos rendimientos en lugar de un porcentaje inventado: un plazo fijo al 4 %, un ETF al 8 % y
cripto al 15 % pesan según cuánto tenés en cada uno. El resto de los parámetros (aporte mensual, años) se
mantienen, se suman hitos propios y opciones avanzadas, y la configuración se recuerda.

## Alcance

Retorno esperado por asset (alta, edición, carga masiva), retorno del portfolio y su desglose, Estimate
basado en él con opción de usar uno propio, hitos editables, inflación y aumento del aporte (opcionales),
preferencias guardadas en el backend.

**Fuera de alcance:** retorno por defecto por clase (F5; esta fase deja el cálculo preparado),
proyección asset por asset con su propia tasa (se usa el promedio ponderado, como se pidió).

## Requisitos

### F4-R1 · Retorno esperado por asset

1. Campo **Expected yearly return** (%) en alta y edición: opcional, −100 a 100, hasta 2 decimales, acepta
   `7,5` o `7.5`. Ayuda: *"Roughly how much it grows in a year. Leave empty if you don't know (counts as
   0%)."*
2. Columna **Return/yr** en Assets (ordenable; "—" si no tiene) y dato en el detalle del asset.

### F4-R2 · Retorno del portfolio

1. `weightedPct = Σ(valorᵢ × rᵢ) / Σ valorᵢ` sobre todos los assets; los que no tienen retorno cuentan como
   0 %. Sin assets (o todos en 0): `null`.
2. `coveragePct` = % del valor del portfolio que tiene retorno cargado.
3. `annualUsd` = Σ(valorᵢ × rᵢ) / 100: cuánto rendiría en un año.
4. Dashboard: tarjeta **Expected return** — *"7.8% / yr"*, *"≈ $9,360 a year"*, *"Based on 90% of your
   portfolio"* (si no es 100 %, link **Set returns**).
5. Desglose por clase y por asset: aporte de cada uno al retorno en puntos (`valorᵢ × rᵢ / total`),
   ordenado de mayor a menor, en Estimate.

### F4-R3 · Estimate basado en el portfolio

1. Selector **Yearly growth: Portfolio · Custom**. *Portfolio* (por defecto) usa `weightedPct` y lo dice:
   *"Your portfolio: 7.8% (weighted by value)"*.
2. Mover el slider pasa a *Custom*; **Use my portfolio** vuelve.
3. Si el portfolio no tiene retornos cargados, *Portfolio* usa 0 % y avisa con link a **Set returns**.
4. Aporte mensual (0 a 10 000 en el slider, o escrito a mano hasta 1e9) y años (1 a 50).

### F4-R4 · Hitos propios

1. **Edit milestones**: hasta 5 montos (por defecto 150 000 y 250 000, como hoy), ordenados.
2. Cada hito muestra su estado (*"already there"*, *"Mar 2031"*, *"not within 12y at this pace"*).

### F4-R5 · Opciones avanzadas (plegadas)

1. **Inflation** (0 a 50 %, por defecto 0): con > 0, el gráfico permite ver los valores en *"today's
   dollars"* (deflactados mes a mes).
2. **Raise contributions each year** (0 a 50 %, por defecto 0): el aporte mensual crece ese % cada 12 meses.
3. Con ambos en 0 la proyección es idéntica a la actual.

### F4-R6 · Carga masiva de retornos

1. Diálogo **Set expected returns** (desde Assets, la tarjeta del dashboard y Estimate): todos los assets
   agrupados por clase, un campo por asset y **Apply to class** para aplicar el mismo % a todos los de una
   clase.
2. Guarda todo junto (una transacción) y muestra el nuevo retorno del portfolio.

### F4-R7 · Preferencias guardadas

1. Aporte, años, modo (Portfolio/Custom), retorno propio, hitos, inflación y aumento del aporte se
   guardan en el backend y se recuperan en cualquier dispositivo.
2. Se guardan solos (con *debounce* de 1 s) al cambiar; un error de guardado no interrumpe la vista (toast).

### F4-R8 · Gráfico legible

1. Eje Y con 4–5 valores compactos (*$250k*, *$1.2M*) y eje X con años.
2. Tooltip por año: valor proyectado, total aportado, ganancia acumulada (y neto si hay deudas).

## Diseño

### Dominio y API

- `Holding.ExpectedReturnPct *decimal.Decimal` (−100..100). `POST`/`PATCH /holdings` aceptan
  `expectedReturnPct` (`null` lo borra). `HoldingResponse` suma `expectedReturnPct` y
  `effectiveReturnPct` (el propio; en F5, el propio o el de su clase).
- `PUT /api/v1/holdings/expected-returns` — carga masiva:

  ```json
  { "items": [ { "holdingId": "…", "expectedReturnPct": 8 }, { "holdingId": "…", "expectedReturnPct": null } ] }
  ```

  Hasta 1000 ítems; todo o nada (transacción); `404` si algún id no existe o es ajeno; `200` →
  `[HoldingResponse]` de los actualizados.
- `GET /wealth/summary` suma `expectedReturn: { weightedPct, coveragePct, annualUsd }`.
- `GET /wealth/estimate`:
  - `yieldPct` pasa a ser **opcional**: sin él, se usa el retorno del portfolio (o 0). Rango ampliado a
    −100..100 (más permisivo: compatible).
  - Nuevos opcionales: `milestones` (lista separada por comas, ≤ 5, 0..1e15; sin él, 150 000 y 250 000),
    `inflationPct` (0..50), `contributionGrowthPct` (0..50).
  - Respuesta suma `yieldSource` (`PORTFOLIO` | `CUSTOM`), `portfolioYieldPct`, `inflationPct`,
    `contributionGrowthPct` y, por punto, `realFutureValueUsd` y `realNetWorthUsd` (deflactados; iguales a
    los nominales con inflación 0).
- El cálculo pasa a una simulación mensual (`saldo ← saldo × (1 + r/12) + aporteₘ`) que con aumento e
  inflación en 0 coincide con la fórmula cerrada actual (test de equivalencia).

#### Preferencias

- `GET /api/v1/preferences` → valores guardados o los de por defecto:

  ```json
  { "estimate": { "contributionUsd": 900, "years": 12, "yieldMode": "PORTFOLIO", "customYieldPct": 9,
                  "milestonesUsd": [150000, 250000], "inflationPct": 0, "contributionGrowthPct": 0 } }
  ```

- `PUT /api/v1/preferences` reemplaza el documento entero, validado (mismos rangos que la estimación);
  campos desconocidos se ignoran. Colección `preferences` (`_id = user_id`).

### Frontend

- `PercentInput` (acepta coma o punto, rango, vista previa).
- `HoldingFormDialog`: campo de retorno. Assets: columna Return/yr. Dashboard: tarjeta Expected return.
- `ExpectedReturnsDialog` (carga masiva).
- Estimate: selector Portfolio/Custom, aporte editable, años hasta 50, hitos (`MilestonesDialog`),
  avanzadas, desglose, ejes y tooltip. `estimateParams` sale de las preferencias (no más estado efímero).

### Mock API

Retornos por asset, carga masiva, `expectedReturn` del resumen, estimación con los parámetros nuevos,
preferencias en memoria.

## Tareas

**Backend**
- [x] `expectedReturnPct` en modelo, Mongo, DTOs, POST/PATCH; `effectiveReturnPct`.
- [x] Carga masiva en transacción.
- [x] `ExpectedReturn` del portfolio en el resumen.
- [x] Simulación mensual (equivalencia con la fórmula actual), inflación, aumento del aporte, hitos.
- [x] Preferencias (repo, servicio, handlers); e2e de aislamiento.
- [x] `openapi.json`, README.

**Frontend**
- [x] `api.ts` + mock + tests.
- [x] Campo y columna de retorno, tarjeta del dashboard, carga masiva.
- [x] Estimate (selector, hitos, avanzadas, desglose, ejes, tooltip) con preferencias.
- [x] Tests de flujos.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R1 | validación −100..100, `null` borra, persistencia | campo con coma/punto, columna, orden |
| R2 | ponderado, cobertura, sin assets → `null`, negativos | tarjeta y textos |
| R3 | `yieldPct` ausente usa el portfolio, `yieldSource` | selector, volver a Portfolio, aviso sin retornos |
| R4 | hitos propios, > 5 → 400 | diálogo de hitos |
| R5 | equivalencia con 0/0, inflación, aumento del aporte | avanzadas, *today's dollars* |
| R6 | masiva atómica, id ajeno → 404 sin cambios | Apply to class, guardado |
| R7 | GET por defecto, PUT validado, aislamiento | guardado con debounce, recuperación |

## Decisiones y riesgos

- **Sin retorno = 0 %** (no "se excluye"): el efectivo rinde 0 de verdad, y excluirlo inflaría el retorno.
  La cobertura deja claro cuánto del portfolio está estimado.
- **Promedio ponderado sobre el total**, como se pidió. Proyectar cada asset con su tasa da otro número
  (el compuesto de un promedio no es el promedio de los compuestos); si se quiere, es una opción futura.
- **Preferencias en el backend** y no en `localStorage`: se comparten entre dispositivos y F7 las reutiliza.
- **Simulación mensual en la API** (`float64`, redondeo a centavos en cada punto): cada mes rinde la tasa
  anual/12 y después entra el aporte (anualidad vencida), así que sin aumento coincide con la fórmula
  cerrada anterior; hay un test de equivalencia de 50 años en la API y en el mock (`src/lib/projection.ts`).
- **Hitos sobre el neto nominal**, también cuando el gráfico muestra dólares de hoy: "Mar 2031" es cuándo el
  saldo llega a ese monto en esa fecha.
- **El slider de crecimiento va de −10 % a 30 %** (la API acepta −100 a 100): cubre los casos reales sin que
  cada paso sea imperceptible. Inflación y aumento del aporte son campos de porcentaje (0 a 50) dentro de
  **More options**, plegado salvo que alguno tenga valor.
- **Preferencias**: si no se pueden leer, Estimate arranca con los valores por defecto (no hay pantalla de
  error); si no se pueden guardar, un toast lo dice y el próximo cambio las vuelve a mandar; al cerrar sesión
  se guarda lo pendiente. `PUT /preferences` reemplaza el documento entero (lo que falta toma su valor por
  defecto): F7 tiene que mandar el documento completo, como ya hace el frontend.
- **Carga masiva**: cada ítem tiene que traer `expectedReturnPct` (`null` lo borra) para que un campo que falta
  no borre un retorno sin querer; un `holdingId` repetido es `400`; un id que no es UUID, `404` como uno
  ajeno. Los que no cambian no se escriben. Cambiar un retorno no registra movimiento.
- **Dashboard**: *Ready to spend* y *Locked in* pasan a ser una sola tarjeta (*"86% · 14% locked in"*) para
  dejar lugar a **Expected return**.
- **Redondeo como la API**: el frontend redondea "mitad lejos del cero" sobre el número escrito (1.005 → 1.01),
  como `decimal` en Go, y no sobre su valor binario.
- **Return/yr** ordena dejando al final los assets sin retorno, en los dos sentidos.
- **Estimate se recalcula cuando cambian los datos** (un asset nuevo cambia el punto de partida), no solo los
  parámetros.
