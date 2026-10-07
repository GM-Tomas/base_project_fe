# F8 — Color de letra en las miniaturas de plataformas

**Estado:** Hecha · **Repos:** backend + frontend · **Depende de:** F5

## Objetivo

Que la miniatura de una plataforma se pueda armar con **dos colores**: el del fondo (el `color` de F5) y
el de la letra, por separado. Hoy la letra siempre va en el mismo color que el fondo.

## Alcance

Un campo nuevo `textColor` en la personalización de plataformas (API, persistencia, mock), el selector en
el diálogo *Customize* y cómo se dibuja la miniatura.

**Fuera de alcance:** colores de letra para las clases de activo (no tienen miniatura).

## Requisitos

### F8-R1 · Color de letra

1. El diálogo *Customize* de una plataforma tiene dos selectores de color: **Background** (el `color` de
   F5) y **Text** (nuevo), cada uno con su opción *Default*.
2. *Text* en *Default* (`textColor: null`): la miniatura se ve como hoy — fondo tenue (25 % del color sobre
   la superficie) y la letra en el color.
3. *Text* con un color: el fondo es el color **sólido** y la letra el elegido. Lo que se elige es lo que se ve,
   y cualquier par de colores se puede leer.
4. Si el contraste entre letra y fondo es menor a 3:1, el diálogo lo avisa debajo del selector (*"Low
   contrast: the letters may be hard to read"*). Se puede guardar igual.
5. *Reset to default* vuelve letras, fondo y letra a sus defaults.
6. Se ve igual en todos lados (P7): dashboard, Platforms, Assets, panel del asset, pickers y Settings.

### F8-R2 · API

1. `GET /platforms` y `GET /wealth/summary` (`byPlatform[]`) agregan `textColor: string | null`.
2. `PATCH /platforms/{id}` acepta `textColor` (merge patch; `null` vuelve al default), con la misma regla y
   mensaje que `color`: `textColor must be a hex color like #1a2b3c` → `400` con `field: "textColor"`.
3. Una plataforma con solo `textColor` cuenta como personalizada (se guarda y entra en la cuota de D7).
4. Renombrar se lleva el `textColor`; fusionar deja el de la plataforma que queda.

## Diseño

### Dominio y persistencia

`PlatformSettings.TextColor *Color` y `Platform.TextColor *Color`; `Customized()` lo incluye. Mongo:
`text_color,omitempty` en `platform_settings`; uno guardado que no sea un color se lee como `null`.

### Frontend

- `PlatformAvatar` recibe `textColor?: string | null`: con él, fondo sólido `color` y letra `textColor`.
- `platformLook()` (WealthContext) devuelve `textColor`; el dashboard y Platforms lo toman del resumen.
- `PlatformCustomizeDialog`: segundo `ColorPicker`, el patch, el reset y el aviso de contraste
  (`contrastRatio` en `lib/customization.ts`, fórmula de WCAG 2).

### Mock API

`mockCustomization` valida, guarda y devuelve `textColor` con las mismas reglas y mensajes.

## Tareas

**Backend:** modelo → comando y servicio → handler y DTOs → Mongo → resumen → `openapi.json` → README.
**Frontend:** tipos y API → mock → `platformLook` y `PlatformAvatar` → diálogo → README.

## Pruebas

- Modelo: `Customized()` con solo `TextColor`; `WithSettings` lo copia.
- Servicio: guardar, `null`, inválido, se lleva al renombrar.
- Handler: `400` con `field: "textColor"`.
- Mongo: ida y vuelta, y uno inválido guardado se lee como `null`.
- Resumen: `byPlatform[].textColor`.
- Frontend: mock (reglas), avatar (fondo sólido con `textColor`), diálogo (vista previa, guardar, reset,
  aviso de contraste), `contrastRatio`.

## Decisiones y riesgos

- **Fondo tenue por defecto, sólido con letra elegida.** El tenue es el look de hoy y no grita sobre el tema
  oscuro; pero con una letra elegida, un tinte haría que una letra oscura no se lea (negro sobre un tinte
  oscuro). Sólido = lo que elegís es lo que ves.
- **`color` sigue siendo el color de la plataforma** (barras de *Where it lives*), no solo el fondo: no cambia
  de significado y nada existente se ve distinto.

### Decisiones al implementar

- **El contraste se mide también con los colores por defecto.** Son tokens (`var(--…)`): el diálogo lee su
  valor del documento, que el build entrega como `lab()` (en el código son `oklch()`). `contrastRatio`
  entiende hex, `oklch()` y `lab()`; con otro formato no avisa.
