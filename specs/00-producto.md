# 00 — Producto: visión, principios y decisiones transversales

## Visión

BASE es un tablero personal de patrimonio. Responde cuatro preguntas:

1. **¿Cuánto tengo y cuánto debo?** — assets, deudas y patrimonio neto (assets − deudas), hoy.
2. **¿Dónde está?** — por plataforma (bancos, brokers, exchanges, billeteras) y por clase de activo.
3. **¿Cómo se movió?** — historial del patrimonio por períodos y la actividad que lo explica (ganancias,
   pérdidas, aportes, retiros, transferencias, pagos de deudas).
4. **¿Hacia dónde voy?** — proyección basada en el retorno esperado de cada asset, los aportes mensuales y
   las deudas.

Cada persona usa su propia cuenta y ve solo sus datos (aislamiento estricto en el backend).

El objetivo de esta etapa: **control total y fácil**. Todo lo que se puede crear se puede editar y borrar;
los cambios de valor quedan registrados; las acciones están a mano y se explican solas.

## Principios de UX

| # | Principio | En la práctica |
|---|---|---|
| P1 | **Control total** | Todo lo que se crea se puede editar y borrar. Lo destructivo pide confirmación nombrando qué se pierde; lo que se puede deshacer, se ofrece deshacer. |
| P2 | **La acción está donde está el dato** | Cada fila y tarjeta tiene sus acciones (botones con ícono y menú ⋯). Los diálogos llegan con lo obvio ya elegido (la plataforma que estás mirando, la fecha de hoy). |
| P3 | **Feedback inmediato** | Toast al guardar o borrar; errores en línea con el mensaje de la API; botones en estado "Saving…" mientras esperan. |
| P4 | **Teclado y accesibilidad** | Diálogos con Escape, foco atrapado y devuelto al cerrar; nombres accesibles en todos los controles; contraste AA. |
| P5 | **Formularios tolerantes** | Montos en cualquier formato habitual (`1.234,56`, `1,234.56`, `$ 1234`), con vista previa de cómo se interpretó. Porcentajes con coma o punto. |
| P6 | **Estados vacíos que enseñan** | Cada vista vacía explica qué va ahí y ofrece el botón para empezar. |
| P7 | **Coherencia visual** | La miniatura y el color de una plataforma o clase son los mismos en todas las vistas. |
| P8 | **Números honestos** | Cada número derivado dice de dónde sale ("based on 90% of your portfolio", "since your first snapshot"). |

La interfaz sigue en **inglés**, como hoy (D10). Las specs están en castellano.

## Glosario

| Término | UI | Definición |
|---|---|---|
| Asset / holding | *Asset* | Una posición que tenés en una plataforma, con su valor en USD (p. ej. "Bitcoin" en "Binance"). |
| Plataforma | *Platform* | Dónde está un holding. Existe mientras tenga holdings; su nombre no distingue mayúsculas. |
| Clase de activo | *Class* | Categoría de un holding (Cash, Equity, Crypto…). Define si es líquido y un retorno esperado por defecto. |
| Deuda | *Debt* | Lo que debés: tarjeta, préstamo, hipoteca, a una persona. Tiene saldo y, opcionalmente, tasa y cuota. |
| Patrimonio neto | *Net worth* | Total de assets − total de deudas. Puede ser negativo. |
| Movimiento | *Activity* | Un cambio registrado en el valor de un holding o deuda: ganancia, pérdida, depósito, retiro, transferencia, pago… |
| Snapshot / checkpoint | *Checkpoint* | Foto del patrimonio en un instante. Se guarda a mano, automáticamente (F7) o se carga hacia atrás (F6). |
| Retorno esperado | *Expected return* | % anual aproximado que esperás de un holding (puede ser negativo: un auto se deprecia). |
| Retorno del portfolio | *Portfolio return* | Promedio de los retornos esperados ponderado por el valor de cada holding. |

## Modelo de dominio objetivo (al terminar F7)

```
Usuario (sub del JWT de Supabase)
├── Holding        id, name, assetClass, platform, valueUsd, expectedReturnPct?, createdAt, updatedAt
├── Debt           id, name, lender?, kind, balanceUsd, interestRatePct?, monthlyPaymentUsd?, dueDay?, notes?
├── Movement       id, kind, occurredAt, amountUsd, feeUsd?, holding?, toHolding?, debt?,
│                  previousValueUsd?, newValueUsd?, note?, createdAt          (registro inmutable; se puede deshacer)
├── Snapshot       id, capturedAt, totalValueUsd (neto, con signo), assetsUsd, debtsUsd, source AUTO|MANUAL, note?
├── PlatformSettings   clave de la plataforma → type, avatarText, color          (personalización)
├── AssetClassSettings nombre de la clase → color, liquid, expectedReturnPct, hidden (personalización)
└── Preferences    estimate (aporte, años, hitos, modo de retorno…), autoSnapshot, defaultView…
```

- Las **plataformas** siguen derivándose de los holdings (no son documentos propios); la personalización
  se guarda aparte y se aplica cuando la plataforma existe.
- Las **clases** son la unión de las clases por defecto (configuración), las creadas por el usuario y las
  que usan sus holdings; la personalización se guarda por nombre.
- El **valor actual** de holdings y deudas se guarda en el propio documento (lecturas rápidas, como hoy).
  Cada cambio de ese valor escribe además un **Movement**, en la misma transacción (D2, D3).

## Decisiones transversales

| ID | Decisión | Por qué / alternativas descartadas |
|---|---|---|
| D1 | **Una sola moneda: USD**, como hoy. | Multi-moneda (ARS, cotizaciones MEP/blue) es una fase propia: tipos de cambio, fuentes, históricos. Queda en el backlog. |
| D2 | **Registro híbrido**: el holding/deuda guarda su valor actual y cada cambio de valor deja un `Movement`. | *Event sourcing puro* (valor = suma de movimientos) obligaba a reescribir todas las lecturas y agregaciones, con montos guardados como texto que Mongo no suma. El híbrido conserva las lecturas actuales y agrega trazabilidad. |
| D3 | **Transacciones de MongoDB** para toda escritura que toca más de un documento (valor + movimiento, transferencias, renombrar plataformas/clases). Requieren *replica set*: Atlas ya lo es; en local y en tests se usa un replica set de un nodo (`compose.yaml`, `Makefile`). Sin replica set esas operaciones responden `503 transactions-unavailable` con un mensaje que dice cómo resolverlo; el resto de la API sigue andando. | Escrituras compensatorias (*sagas*) sin transacción dejan estados intermedios si el proceso muere a mitad, y Vercel congela procesos sin aviso. |
| D4 | **Patrimonio neto con signo.** `Money` sigue siendo ≥ 0 (valores de holdings, deudas, movimientos); el patrimonio neto y los snapshots usan un tipo con signo. El % de crecimiento solo se calcula si la base es > 0. | Deudas mayores que los assets son un caso real (p. ej. al empezar con una hipoteca). |
| D5 | **Contrato compatible hacia atrás.** Cada fase solo **agrega** campos y endpoints; nada que el frontend en producción use cambia de forma o desaparece. El backend se despliega primero. | Los dos repos se despliegan por separado en Vercel. |
| D6 | **IDs de plataformas y clases derivados del nombre** (`base64url` sin padding de su clave normalizada). Cambian si cambia el nombre (renombrar devuelve el nuevo). | No son documentos propios: una plataforma existe mientras tenga holdings. Un nombre en la URL se rompe con `/` y espacios. |
| D7 | **Cuotas por usuario** (todas las cuentas comparten la base): holdings 1000 y snapshots 5000 (existentes); movimientos 20 000; deudas 200; clases creadas/personalizadas 100; plataformas personalizadas 1000. Al superarlas: `409 limit-exceeded`, como hoy. | Una cuenta no puede crecer sin límite y degradar a las demás. |
| D8 | **Las reglas de negocio viven en el dominio del backend** y el mock API del frontend las replica (mismos límites y mensajes). | Los previews de Vercel corren solo sobre el mock. |
| D9 | **Fechas**: los movimientos tienen `occurredAt` elegido por el usuario (por defecto, ahora). Se acepta `YYYY-MM-DD` (se guarda a las 12:00 UTC de ese día, para que ningún huso horario lo corra de día) o un instante RFC 3339. No puede ser posterior a ahora + 24 h ni anterior a 1970. Todo se guarda en UTC. | Registrar hoy algo que pasó la semana pasada es el caso común. |
| D10 | **UI en inglés** (como hoy). | Cambiar el idioma no fue pedido; i18n queda en el backlog. |
| D11 | **El frontend recarga todo tras cada cambio** (como hoy, `refresh()`), sin actualizaciones optimistas. | App personal de poco tráfico: siempre mostrar lo que el servidor guardó es más simple y confiable. |

## Convenciones de API (para todas las fases)

- **Errores** RFC 9457 (`application/problem+json`) como hoy. Slugs nuevos:
  - `insufficient-balance` (409): el movimiento dejaría un holding o una deuda por debajo de 0.
  - `not-revertible` (409): ese movimiento no se puede deshacer (y por qué).
  - `transactions-unavailable` (503): la base no soporta transacciones (D3).
  - `class-exists`, `platform-exists` (409): renombrar sobre un nombre existente sin confirmar el merge.
  - `class-in-use` (409): borrar una clase con holdings sin decir adónde moverlos.
- **PATCH** = *merge patch*: un campo ausente no cambia; `null` borra un campo opcional; `null` en un
  campo obligatorio es un error de validación. `{}` no cambia nada y responde `200`.
- **Montos**: números JSON en USD; se redondean a 2 decimales (half-up). Máximo `1e15` por valor.
- **Porcentajes**: números con hasta 2 decimales; cada campo define su rango.
- **Listas largas** (movimientos): paginación por cursor — `?limit=` (por defecto 50, máximo 200) y
  `?cursor=` (opaco); la respuesta trae `{ "items": [...], "nextCursor": "…" | null }`.
- **Identidad**: el usuario sale del JWT; ningún endpoint acepta un id de usuario (si viene, se ignora). Un
  recurso de otro usuario responde `404` igual que uno inexistente.
- **CORS**: se agregan `PATCH` y `PUT` a los métodos permitidos (F1).

## Backlog (fuera de estas fases)

- Multi-moneda (ARS/USD con cotizaciones) e importación de datos (CSV/JSON).
- Cotizaciones automáticas (cripto, acciones) para actualizar valores sin cargarlos a mano.
- Logos de plataformas como imagen (hoy la CSP bloquea imágenes remotas; habría que subirlas).
- Metas de ahorro con seguimiento, presupuesto y gastos.
- Acciones masivas en la tabla de assets (seleccionar varios → borrar / cambiar clase).
- Hogares: compartir un tablero entre dos cuentas ("Your money, together").
- Recordatorios por email de vencimientos de deudas; snapshots automáticos del lado del servidor (cron).
