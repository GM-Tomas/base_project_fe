# F8–F10 — Plan: miniaturas con color de letra, una app más simple y en tu idioma

Estado: **Hecho** (las tres fases). Este documento es el análisis y el orden de las fases; cada una tiene su
spec con requisitos, pruebas y decisiones: [F8](F8-color-de-letra.md), [F9](F9-simplificacion-visual.md),
[F10](F10-idioma.md).

| Fase | Qué | Repos | Tamaño |
|---|---|---|---|
| **F8** | Color de letra de la miniatura de una plataforma, además del fondo | back + front | S |
| **F9** | Simplificación visual: las mismas funciones, menos cosas en pantalla | front | M |
| **F10** | Idioma: español e inglés, elegible | front + 1 campo en back | L |

**Orden:** F8 → F9 → F10. F8 es chica e independiente (puede ir en paralelo con F9). F9 va **antes** que
F10 porque borra texto (subtítulos, frases de ayuda, etiquetas duplicadas): cada string que F9 elimina es
uno que F10 no tiene que extraer ni traducir.

---

## F8 — Color de letra en las miniaturas de plataformas

### Hoy

Una plataforma tiene un solo `color` (`#rrggbb` o `null` = derivado del nombre). `PlatformAvatar` lo usa
dos veces: la letra va en ese color y el fondo es un tinte (25 % del color sobre la superficie). No hay
forma de elegir la letra por separado.

### Qué cambia

- Nuevo campo **`textColor`** (`#rrggbb` o `null`) en la personalización de plataformas.
- `color` sigue siendo **el fondo** (y el color de la plataforma en el resto de la app: barras de "Where
  it lives", etc.). `textColor: null` = como hoy (la letra en el color del fondo). Nadie ve un cambio hasta
  que elige un color de letra.
- El diálogo **Customize** muestra dos selectores: **Fondo** (el actual) y **Letra** (nuevo), con la vista
  previa en vivo. *Reset to default* vuelve los dos.
- Se ve igual en todos lados (P7): dashboard, Platforms, Assets, panel del asset, pickers, Settings.

### Contrato (aditivo, D5)

- `GET /platforms`, `GET /wealth/summary` (`byPlatform[]`): agregan `textColor: string | null`.
- `PATCH /platforms/{id}`: acepta `textColor` (merge patch; `null` vuelve al default). Validación y mensaje
  iguales a `color` (`model.NewColor`, `ErrInvalidColor`).
- Fusionar plataformas: la que queda conserva su `textColor` (como hoy con `color`).

### Dónde se toca

**Backend** (`base_project_go`)
- `domain/model/customization.go` (`PlatformSettings.TextColor`, `IsCustomized`), `domain/model/platform.go`.
- `port/inbound/platform_use_case.go` (`TextColor Change[string]`), `application/service/platform_service.go`
  (aplicar el cambio; `samePlatformSettings` lo compara), `wealth_query_service.go` (lo pasa al resumen).
- `dto/platform_dto.go`, `dto/wealth_summary_dto.go`, `http/platform_handler.go` (validación por campo).
- `mongo_customization_repository.go` (`text_color,omitempty`; uno inválido guardado se ignora, como `color`).
- `openapi.json`, README.

**Frontend** (`base_project_fe`)
- `types/wealth.ts` (`Platform.textColor`, `PlatformBreakdown.textColor`), `lib/api.ts` (`PlatformPatch`).
- `lib/mockCustomization.ts` (valida, guarda, cuenta como personalizada).
- `context/WealthContext.tsx` → `platformLook()` devuelve también `textColor`; los 7 usos de
  `PlatformAvatar` ya pasan por `platformLook` o por el resumen, así que es un solo lugar.
- `ui/PlatformAvatar.tsx`: prop `textColor?`; la letra usa `textColor ?? color`.
- `settings/PlatformCustomizeDialog.tsx`: segundo `ColorPicker` ("Letra"), el patch y el reset.

### Pruebas
Handler (hex inválido → 400 con `field: "textColor"`), servicio (set, `null`, merge), Mongo (ida y vuelta),
mock (mismas reglas), diálogo (vista previa, guardar, reset), avatar (usa `textColor` cuando está).

### Decisión
Sin color de letra, el fondo sigue siendo un **tinte** (el look de hoy). Con color de letra, el fondo es
**sólido**: lo que elegís es lo que ves, y una letra oscura sobre un tinte oscuro no se leería. El diálogo
avisa si el contraste es bajo. Detalle en [F8-color-de-letra.md](F8-color-de-letra.md).

---

## F9 — Simplificación visual (mismas funciones, menos carga)

### Diagnóstico (recorrido de todas las vistas con los datos de demo, desktop 1440 y móvil 375)

**1. Decoración que no informa.**
Grilla de fondo en toda la app (`.app-shell::before`), 8 gradientes y 22 sombras en `globals.css`, esquinas
decorativas y punto pulsante en la tarjeta del patrimonio, tagline "YOUR MONEY, TOGETHER" en el sidebar.

**2. Cajas dentro de cajas.**
Todo es una `card` con borde, hasta un número suelto. El dashboard tiene **7 tarjetas + 1 banner** en la
primera pantalla; History, **7 tarjetas de estadísticas** seguidas.

**3. El acento perdió el significado.**
El turquesa se usa para etiquetas, links, nav activo, botones, gráficos y barras; el magenta para el tag
"Demo data", tipos de plataforma y clases. Más los colores de cada clase y plataforma, más verde/rojo.
Resultado: nada destaca porque todo destaca.

**4. Etiquetas en mayúsculas y color en cada tarjeta.**
"YOUR NET WORTH, RIGHT NOW", "READY TO SPEND", "WHAT YOU'RE HOLDING", "WHERE IT LIVES"… compiten con los
números, que son lo importante.

**5. Texto de ayuda en todos lados.**
Subtítulo bajo cada título de vista ("Here's your full financial picture, today."), frase explicativa en
cada KPI ("Things you own, tracked one by one", "If you keep up the monthly payments"), descripciones largas
en Settings. P8 (números honestos) pide decir de dónde sale cada número, no un párrafo al lado de cada uno.

**6. Información duplicada.**
Las deudas aparecen en la tarjeta del patrimonio ("Assets $107,420 · Debts $9,650") **y** en "You owe".
"Holdings: 7" es un conteo que cabe en una línea. El recordatorio de checkpoint aparece en Dashboard **y**
en History. La vista **Platforms** muestra lo mismo que "Where it lives" del dashboard + el filtro de
plataforma de Assets.

**7. Acciones siempre visibles en cada fila.**
Assets: 4 íconos por fila (±, ⇆, ✎, 🗑) → **28 íconos** con 7 assets. Debts: 3 por fila. Platforms: 2 por
tarjeta. Y todas esas acciones ya están en el panel que se abre al hacer clic en el nombre.

**8. Vistas muy largas.**
History apila: períodos + gráfico + 7 estadísticas + "Why it changed" + tabla de checkpoints + actividad con
7 chips de filtro. Estimate: 3 sliders + monto tipeado + su eco ("= $900.00") + hitos + gráfico + 3 tarjetas
+ el desglose del retorno por clase **y** por asset. Settings: preferencias, clases y plataformas en una
sola página.

### Principios de F9

- **Restar, no rediseñar.** Mismo sistema (Nocturne), mismos componentes; se sacan capas.
- **Ninguna función se pierde.** Cada acción de hoy sigue alcanzable, con a lo sumo un clic más.
- **El acento es para lo accionable** (botones, nav activo, foco). Las etiquetas son neutras.
- **Una explicación, a demanda.** De dónde sale un número va en un ⓘ (tooltip/`title`) o en una línea corta,
  no en un párrafo.
- Lo plegable usa lo nativo: `<details>` para "más", `popover` para menús. Sin dependencias nuevas.

### Pasos (cada uno es un PR que se puede publicar solo)

| Paso | Cambio | Medida de éxito |
|---|---|---|
| **F9.1 Ruido global** | Sin grilla de fondo, gradientes, brillos, esquinas ni punto pulsante. Un solo estilo de tarjeta (superficie + borde de 1px, sin sombra). Etiquetas en minúscula y gris. Tags de tipo y clase neutros (punto de color + texto). Sin subtítulos de vista ni tagline del sidebar. | `globals.css` sin `gradient` decorativos; acento solo en elementos interactivos |
| **F9.2 Dashboard** | La tarjeta del patrimonio absorbe deudas y conteo ("5 plataformas · 7 assets · 2 deudas, $650/mes"). Quedan 2 KPIs: *Ready to spend* y *Expected return*, con su explicación en ⓘ. El recordatorio de checkpoint pasa a una línea discreta solo acá. | 7 tarjetas + banner → **4 tarjetas** |
| **F9.3 Acciones por fila** | Un botón **⋯** por fila/tarjeta (menú con `popover`, siguiendo el patrón de `NewMenu`) en Assets, Debts, Platforms y Settings. Clic en el nombre sigue abriendo el panel con todas las acciones. | Assets: 28 íconos → **7** |
| **F9.4 History** | Pestañas **Resumen · Checkpoints · Actividad** (`SegmentedControl`). Resumen: gráfico + 3 cifras (cambio, anualizado, mayor caída); alto/bajo/mejor/peor tramo en "Más estadísticas" (`<details>`). Los 7 chips de actividad → un `<select>`. | Primera pantalla de History sin scroll en 1440×900 |
| **F9.5 Estimate** | El desglose del retorno (por clase y por asset) plegado bajo "¿De dónde sale el 9.6%?". El eco "= $900.00" solo aparece si el monto se leyó distinto de como se escribió. | Panel izquierdo y gráfico entran sin scroll |
| **F9.6 Settings** | Secciones **General · Clases · Plataformas · Datos**. En *General* van preferencias (y el idioma en F10). Descripciones de una línea. | Cada sección entra en una pantalla |
| **F9.7 Platforms (opcional)** | Plegar la vista Platforms en Assets: "Agrupar por plataforma" + filtro con miniaturas; personalizar queda en Settings y en el ⋯. El nav pasa de 7 a 6 ítems. | Nav: 7 → 6 |

**Tests:** los de UI que buscan íconos por nombre (`Edit X`, `Remove X`) pasan a abrir el ⋯ primero. Cada
PR adjunta capturas antes/después de las vistas que toca (desktop y móvil).

**Decidido:** F9.7 se hace (la vista Platforms se pliega en Assets).

---

## F10 — Idioma (español / inglés)

Reemplaza la decisión **D10** ("UI en inglés") de `00-producto.md`.

### Enfoque

- **Sin librería.** La app es una sola página con vistas en contexto, sin rutas por idioma: no hace falta
  `next-intl` ni middleware. Diccionarios tipados + `Intl` (que ya se usa) alcanzan:
  - `src/i18n/en.ts`: la fuente; strings y funciones para plurales (`assets: (n) => …`).
  - `src/i18n/es.ts`: tipado como `Messages` (= forma de `en`) → **si falta una clave, no compila**.
  - `I18nContext` + `useT()`; `money.ts`, `debts.ts`, `periods.ts`, `movements.ts`, `returns.ts` y
    `HistoryView` dejan de tener `'en-US'` fijo y toman el locale del contexto.
  - `<html lang>` sigue al idioma (accesibilidad).
- **Dónde se guarda:** en las **Preferences** de la cuenta (`language: "auto" | "es" | "en"`, default
  `auto` = idioma del navegador), como la vista inicial y el período de History: vale en todos los
  dispositivos. Se copia en `localStorage` para que la app no arranque en el idioma equivocado y cambie.
  En el login (sin cuenta todavía) manda el navegador, con un selector chico ES/EN al pie.
- **Errores de la API:** el backend sigue respondiendo en inglés. El front traduce por el mensaje (la API y
  el mock comparten los mismos mensajes, D8; muchos ya son constantes en `lib/`, como `COLOR_MESSAGE`). Un
  mensaje sin traducción se muestra como viene. Un test recorre todos los mensajes conocidos y exige su
  traducción.
- **Formato de números y fechas:** siguen al idioma (`es` → `$97.770`, `1 oct 2026`). La moneda sigue
  siendo USD (D1) y los montos se siguen aceptando en cualquier formato (P5).

### Pasos

| Paso | Cambio |
|---|---|
| **F10.1 Infra** | `src/i18n/`, contexto, formatos con locale, `<html lang>`. El harness de tests fija `en`: los tests existentes no cambian. |
| **F10.2 Extracción** | Vista por vista (layout y nav → Dashboard → Assets → Debts → History → Estimate → Settings → diálogos → toasts y confirmaciones). En inglés no cambia nada visible. ~900 literales hoy, menos después de F9. |
| **F10.3 Español** | `es.ts` completo, con el glosario de abajo. Un test de humo renderiza cada vista en `es`. |
| **F10.4 Errores de la API** | Traducción por mensaje con fallback, y su test de cobertura. |
| **F10.5 Selector** | Backend: `language` en Preferences (enum, aditivo; mock igual). Front: *Settings › General › Idioma* (Automático / Español / English) y el selector del login. |

### Glosario de la UI en español (propuesta)

| Inglés | Español |
|---|---|
| Asset | Activo |
| Platform | Plataforma |
| Class | Clase |
| Debt | Deuda |
| Net worth | Patrimonio neto |
| Activity | Actividad |
| Checkpoint / snapshot | Foto |
| Expected return | Retorno esperado |
| Ready to spend | Disponible |
| Estimate | Proyección |

### Fuera de alcance

- **Los datos del usuario no se traducen**: nombres de clases (incluidas las por defecto: *Cash*, *Equity*…),
  tipos de plataforma y notas son datos, y el nombre de una clase es su id (D6). Se pueden renombrar en
  Settings.
- Otros idiomas: la estructura los admite (un archivo más), pero no se piden.
- Mensajes de la API traducidos en el backend (`Accept-Language`): duplicaría cada mensaje en Go y en el
  mock para el mismo resultado.

---

## Riesgos

- **F9 y los tests de UI:** muchos buscan botones por nombre accesible; mover acciones al ⋯ obliga a
  tocarlos. Se hace en el mismo PR de cada paso para que `npm test` nunca quede en rojo.
- **F10 es transversal:** toca casi todos los componentes. Se hace vista por vista, con el inglés como red
  de seguridad (los tests existentes en `en` no cambian), y después de F9 para no traducir lo que se borra.
- **Contraste en F8:** una letra cerca del color de fondo se lee mal. La miniatura es decorativa (el nombre
  siempre está al lado), y la vista previa muestra el resultado antes de guardar.
