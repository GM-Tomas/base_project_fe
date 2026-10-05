# F1 — Editar y eliminar

**Estado:** Hecha · **Repos:** backend + frontend · **Depende de:** F0

## Objetivo

Hoy un asset no se puede corregir: para cambiar su valor hay que borrarlo y crearlo de nuevo, y un
snapshot guardado por error queda para siempre. Esta fase da control sobre lo existente: **editar
assets**, **borrar snapshots**, y una tabla de assets que se puede buscar, filtrar, ordenar y totalizar.

## Alcance

Editar nombre, clase, plataforma y valor de un asset; borrar snapshots; tabla de assets con búsqueda,
filtros por clase y plataforma, orden y totales; acciones por fila en Assets, Platforms e History.

**Fuera de alcance:** registrar *por qué* cambió un valor (F2), retorno esperado (F4), renombrar una
plataforma entera (F5).

## Requisitos

### F1-R1 · Editar un asset

1. Cada fila de Assets y del detalle de una plataforma tiene la acción **Edit** (`"Edit Bitcoin"`).
2. Abre el formulario del alta precargado, con título "Edit asset" y botón **Save changes**, deshabilitado
   hasta que algo cambie.
3. Se pueden cambiar nombre, clase, plataforma y valor, con las validaciones y mensajes del alta.
4. Cambiar a una plataforma existente escrita con otra capitalización la guarda como la existente (como el
   alta).
5. Si el asset era el único de su plataforma y pasa a otra, la plataforma vieja desaparece; si su detalle
   estaba abierto, el detalle sigue al asset hasta su nueva plataforma.
6. `updatedAt` cambia y `createdAt` no. Un PATCH que no cambia nada no escribe ni toca `updatedAt`.
7. Al guardar: toast "Changes saved".
8. Si el asset ya no existe (lo borraron desde otro dispositivo), el diálogo muestra el error de la API y
   los datos se recargan.

### F1-R2 · Borrar snapshots

1. Cada fila del historial tiene la acción **Delete** (`"Delete checkpoint of Mar 15, 2026"`).
2. Pide confirmación: *"Delete checkpoint?"* — *"The checkpoint of Mar 15, 2026 ($11,000) will be removed
   from your history."* — botón **Delete** (peligro).
3. Después: toast "Checkpoint deleted". La variación del checkpoint siguiente se recalcula contra el
   anterior que queda, y el YTD del dashboard también si el borrado era su base (lo calcula el backend).
4. Si ya no existía: el error de la API aparece en el diálogo y los datos se recargan.

### F1-R3 · Tabla de assets con control

1. **Búsqueda** por texto en nombre, plataforma y clase, sin distinguir mayúsculas ni acentos ("cafe"
   encuentra "Café").
2. **Filtros**: clase (chips, como hoy) y plataforma (selector *Filter by platform*, "All platforms"). Se
   combinan entre sí y con la búsqueda. Un filtro sobre una clase o plataforma que ya no existe vuelve a
   "All".
3. **Orden** por columna (Name, Class, Platform, Value): clic en el encabezado alterna
   ascendente/descendente; `aria-sort` refleja el estado. Por defecto: valor descendente. (Share ordena igual
   que Value, así que no tiene orden propio.)
4. Columna **Share**: el valor del asset como % del total de assets.
5. **Pie de tabla** con el conjunto filtrado: *"3 assets · $24,570 · 21.4% of your assets"*.
6. Búsqueda, filtros y orden se conservan al ir a otra vista y volver (durante la sesión).
7. El nombre de la plataforma en cada fila lleva al detalle de esa plataforma en Platforms.
8. Acciones por fila: **Edit**, **Remove**.

### F1-R4 · Detalle de una plataforma

1. Cada fila tiene **Edit** y **Remove**.
2. Botón **Add asset here**: abre el alta con la plataforma ya completa.
3. Muestra el total: *"2 assets · $24,570"*.

## Diseño

### API

#### `PATCH /api/v1/holdings/{id}`

```json
{ "name": "Bitcoin (cold wallet)", "assetClass": "Crypto", "platform": "Ledger", "valueUsd": 20150.5 }
```

- Todos los campos son opcionales; uno ausente no cambia. Los cuatro son obligatorios en el holding, así
  que `null` es un error de validación (`"Name is required"`, etc.).
- Mismas normalizaciones y mensajes que `POST /holdings` (espacios, NFC, largos, `valueUsd` entre 0 y
  1e15, `"Value must not be negative"`, `"Value is too large"`).
- La plataforma se guarda con la grafía que ya usan los holdings del usuario (como al crear).
- `200` → `HoldingResponse` actualizado · `400` validación · `404` `"Holding {id} not found"` (también
  si es de otro usuario o el id no es un UUID) · `401`.
- `{}` o valores iguales a los actuales → `200` sin escribir.

#### `DELETE /api/v1/wealth/snapshots/{id}`

- `204` · `404` `"Snapshot {id} not found"` (también ajeno o id inválido) · `401`.

#### CORS

`AllowedMethods` suma `PATCH` y `PUT` (los usan F1 en adelante).

### Dominio y aplicación (backend)

- `inbound.UpdateHoldingCommand { UserId, Id; Name, AssetClass, Platform *string; ValueUsd *float64 }` y
  `HoldingUseCase.UpdateHolding(ctx, cmd) (model.Holding, error)`.
- `outbound.HoldingRepository.FindById(ctx, userId, id) (*model.Holding, error)` — `nil` si no existe o
  es de otro usuario.
- El servicio valida todo antes de tocar la base (como `CreateHolding`), resuelve la grafía de la
  plataforma con `PlatformRepository.Canonical` y guarda con `Save` (el filtro por `user_id` ya impide
  pisar un holding ajeno).
- `SnapshotUseCase.DeleteSnapshot(ctx, userId, id) error` → `404` si `DeleteById` no borró nada.
- Concurrencia: la última escritura gana (los valores son absolutos). F2 pasa los cambios de valor a
  transacciones.
- Handler: el body se decodifica a un DTO con campos *opcionales con presencia*
  (`dto.Optional[T]{ Set, Null, Value }`), para distinguir ausente de `null`.

### Frontend

- `api.updateHolding(id, patch)` y `api.deleteSnapshot(id)`; `WealthContext` expone `updateHolding` y
  `deleteSnapshot` (recargan todo después, como las demás mutaciones).
- `HoldingFormDialog` en modo `edit` (precarga, *dirty tracking*, "Save changes").
- `AssetsView`: barra con búsqueda, chips de clase y selector de plataforma; tabla ordenable; pie con
  totales; acciones por fila. El estado de la tabla (`assetsTable`) vive en `WealthContext` para
  sobrevivir al cambio de vista.
- `PlatformsView`: acciones por fila, "Add asset here", total del detalle; `setView('platforms')` acepta
  una plataforma a abrir (para el link de R3.7).
- `HistoryView`: acción Delete por fila con `ConfirmDialog`.
- `lib/search.ts`: `normalizeForSearch(text)` (NFD, sin diacríticos, minúsculas).

### Mock API

`updateHolding` y `deleteSnapshot` con las mismas reglas, mensajes y grafía de plataformas que la API.

## Tareas

**Backend**
- [x] `HoldingRepository.FindById` (Mongo + mocks) con aislamiento por usuario, y `Update` (sin *upsert*:
  una edición que compite con un borrado responde `404` en vez de resucitar el holding).
- [x] `UpdateHolding` en el servicio + `PATCH /holdings/{id}` con `dto.Optional`.
- [x] `DeleteSnapshot` en el servicio + `DELETE /wealth/snapshots/{id}`.
- [x] CORS con `PATCH` y `PUT`.
- [x] `openapi.json`, catálogo de endpoints del README.
- [x] e2e multi-usuario: PATCH de un holding ajeno y DELETE de un snapshot ajeno → `404` sin cambios.

**Frontend**
- [x] `api.ts` + mock + tests del mock.
- [x] Edit en `HoldingFormDialog`; acciones en Assets y Platforms (`useHoldingActions`); Add asset here.
- [x] Tabla de assets (búsqueda, filtros, orden, Share, pie, link a plataforma, estado persistente).
- [x] Delete checkpoint en History.
- [x] Tests de flujos en `app.test.tsx` y de la lógica en `lib/assetsTable.test.ts`.

## Pruebas

| Requisito | Backend | Frontend |
|---|---|---|
| R1 | servicio (cada campo, grafía, sin cambios, no encontrado), handler (`null` vs ausente, mensajes, 404), Mongo `FindById`, e2e ajeno | edición completa, botón deshabilitado sin cambios, error 404 + recarga |
| R2 | servicio y handler (204/404), e2e ajeno | confirmación, toast, recarga |
| R3 | — | búsqueda sin acentos, filtros combinados, orden y `aria-sort`, Share, pie, estado al volver, link |
| R4 | — | acciones, Add asset here con plataforma, total |

## Decisiones y riesgos

- **PATCH con *merge patch*** en lugar de PUT: la edición desde la tabla o el detalle cambia uno o dos
  campos; PUT obligaría a reenviar todo y a pisar cambios hechos en otro dispositivo a otros campos.
- **Renombrar una plataforma** (todas sus filas a la vez) no es "editar un asset": queda para F5.
