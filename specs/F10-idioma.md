# F10 — Idioma

**Estado:** Hecha · **Repos:** frontend + backend (un campo en Preferences) · **Depende de:** F7, F9

## Objetivo

Elegir el idioma de la app: **español** o **inglés**. Reemplaza la decisión D10 ("UI en inglés") de
[00-producto.md](00-producto.md).

## Alcance

Todo el texto de la interfaz, los números y las fechas, los errores que muestra la app (incluidos los de la
API y del login), el selector en *Settings › General* y en el login, y la preferencia en el backend.

**Fuera de alcance:** traducir datos del usuario (nombres de clases, también las por defecto; tipos de
plataforma; notas), otros idiomas, mensajes de la API traducidos en el backend, y los archivos exportados
(CSV y JSON quedan en inglés: son un formato estable para planillas y scripts).

## Requisitos

### F10-R1 · Dónde se elige
1. *Settings › General › Idioma*: **Automático / English / Español**. Se guarda en las Preferences de la cuenta
   (`language`, default `auto`) y vale en todos los dispositivos.
2. El login tiene su propio selector (todavía no hay cuenta): vale para ese dispositivo.
3. *Automático* es el idioma del navegador (español si empieza con `es`, si no inglés). Si la cuenta está en
   *Automático*, manda lo que se eligió en el dispositivo (en el login, por ejemplo); Settings muestra eso.
4. El dispositivo guarda una copia (`localStorage`), así la app abre en su idioma antes de que lleguen las
   preferencias, y otra pestaña que lo cambia lo cambia acá también.

### F10-R2 · Qué cambia con el idioma
1. Todo el texto de la interfaz, sin recargar ni perder lo que está en pantalla.
2. Números y fechas como se escriben en ese idioma: `es` usa el formato de Argentina (`$97.770`,
   `$1.234,50`, `9,6%`, `15 ene 2026`). La moneda sigue siendo USD (D1) y los montos se siguen aceptando en
   cualquier formato (P5).
3. `<html lang>` sigue al idioma.
4. Lo que la API (o Supabase, al entrar) rechaza se muestra en el idioma: cada mensaje que un usuario puede
   ver tiene su traducción; uno que no está queda en inglés.

### F10-R3 · API
`GET/PUT /preferences` agregan `language: "auto" | "en" | "es"` (default `auto`; otro valor → `400` con
`field: "language"`, `language must be one of auto, en, es`). Aditivo (D5).

## Diseño

- **Sin librería**: la app es una sola página sin rutas por idioma. `src/i18n/en.ts` es la fuente (strings y
  funciones para lo que lleva números o nombres); `src/i18n/es.ts` está tipado con su forma, así que una clave
  que falta o sobra no compila.
- `src/lib/i18n.ts`: el idioma como el modo privacidad (un store por dispositivo): `useT()` en componentes,
  `messages()` e `intlLocale()` en lo que se arma fuera de React (formatos, descripciones de movimientos,
  deudas, períodos). `WealthContext` incluye el idioma en lo que calcula.
- `src/i18n/apiErrors.ts`: los mensajes de la API en español, exactos o por patrón (con el nombre o el monto
  adentro); se aplica en `ApiError`, el único lugar por donde pasan todos.
- Backend: `model.Language`, `ParseLanguage`, el campo en el DTO, el handler, el servicio y Mongo
  (`language,omitempty`; uno inválido guardado se lee como `auto`).

### Glosario

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
| Dashboard | Inicio |
| Settings | Ajustes |

El castellano es rioplatense (voseo), como el resto del producto.

## Pruebas

- `lib/i18n.test.ts`: idioma del navegador, elegido, guardado, entre pestañas, sin storage; todas las claves
  de `en` tienen su texto en español (salvo una lista de iguales a propósito); cada frase se arma en los dos
  idiomas; formatos de números y fechas en español.
- `i18n/apiErrors.test.ts`: cada mensaje de la API que puede ver un usuario se traduce; varios juntos; uno
  desconocido queda igual.
- `test/i18n.test.tsx`: la app en el idioma de la cuenta (vistas, menú ⋯, pestañas, Settings), cambiarlo desde
  Settings (se guarda y cambia en el momento), el idioma del dispositivo con la cuenta en automático, un error
  de la API en español, y el login con su selector y el error de Supabase en español.
- Backend: modelo, servicio, handler (incluido el error por campo), Mongo (ida y vuelta y valor inválido) y el
  e2e de dos usuarios.

## Decisiones y riesgos

- **Los datos no se traducen.** El nombre de una clase es su id (D6) y lo escribió el usuario; las clases por
  defecto se pueden renombrar. Los tipos de plataforma que se ofrecen sí están en el idioma (son sugerencias),
  y el tipo vacío (`Other` en la API) se muestra traducido.
- **`$` y no `US$`** en español: toda la app es en dólares (D1) y el campo dice *(USD)*.
- **Las fechas en español** salen como las escribe el navegador (`15 ene 2026`, o `15 de ene de 2026`
  según su versión de ICU).
- **Los tests existentes siguen en inglés**: cada test arranca en el idioma del navegador (jsdom: inglés).
