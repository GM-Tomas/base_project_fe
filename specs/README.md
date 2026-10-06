# Specs — BASE Wealth

Desarrollo guiado por specs (*Spec-Driven Development*): cada fase se describe acá **antes** de
implementarla y se implementa siguiendo su spec. Si al implementar aparece algo que la spec no prevé,
primero se actualiza la spec (y se anota en su sección *Decisiones*), después el código.

Estas specs cubren los dos repositorios:

- **Frontend** (este repo): `base_project_fe` — Next.js, vistas, diálogos, mock API de los previews.
- **Backend**: [`GM-Tomas/base_project_go`](https://github.com/GM-Tomas/base_project_go) — API REST en Go,
  dominio, MongoDB. Su `README` apunta acá.

## Índice

| Doc | Contenido |
|---|---|
| [00-producto.md](00-producto.md) | Visión, principios de UX, glosario, modelo de dominio objetivo, decisiones transversales y convenciones de API. |
| [F0-fundaciones-ux.md](F0-fundaciones-ux.md) | Componentes de UI reutilizables (diálogos accesibles, confirmaciones, toasts, inputs de montos) y mejoras rápidas sobre lo que ya existe. |
| [F1-editar-y-eliminar.md](F1-editar-y-eliminar.md) | Editar assets, borrar snapshots, tabla de assets con búsqueda, filtros, orden y totales. |
| [F2-movimientos.md](F2-movimientos.md) | Ganancias, pérdidas, depósitos, retiros y transferencias entre plataformas; actividad y deshacer. Transacciones en MongoDB. |
| [F3-deudas.md](F3-deudas.md) | Pestaña de deudas, pagos desde un asset, patrimonio neto = assets − deudas, proyección de cancelación. |
| [F4-retorno-esperado-y-proyeccion.md](F4-retorno-esperado-y-proyeccion.md) | Retorno anual esperado por asset, promedio ponderado del portfolio y proyección basada en él. Preferencias. |
| [F5-personalizacion.md](F5-personalizacion.md) | Clases de activo (crear, renombrar, borrar, color, liquidez, retorno por defecto) y miniaturas de plataformas (letras, color, tipo, renombrar). Vista Settings. |
| [F6-historial-por-periodos.md](F6-historial-por-periodos.md) | Períodos de análisis en History, estadísticas, desglose del cambio, checkpoints pasados. |
| [F7-ux-global.md](F7-ux-global.md) | Responsive/móvil, modo privacidad, acciones rápidas y atajos, exportar datos, snapshot automático. |

## Estado

| Fase | Estado | Backend | Frontend |
|---|---|---|---|
| F0 — Fundaciones de UX | Hecha | — | ✔ |
| F1 — Editar y eliminar | Hecha | ✔ | ✔ |
| F2 — Movimientos | Hecha | ✔ | ✔ |
| F3 — Deudas | Hecha | ✔ | ✔ |
| F4 — Retorno esperado y proyección | Hecha | ✔ | ✔ |
| F5 — Personalización | Hecha | ✔ | ✔ |
| F6 — Historial por períodos | Hecha | ✔ | ✔ |
| F7 — UX global | Lista para implementar | ✔ | ✔ |

Estados posibles: *Borrador* → *Lista para implementar* → *En curso* → *Hecha*.

## Cómo está escrita cada spec

1. **Objetivo** — qué problema resuelve y por qué.
2. **Alcance** y **fuera de alcance**.
3. **Requisitos** con ID (`F2-R3`) y **criterios de aceptación** verificables (`F2-R3.2`). Cada criterio
   tiene al menos un test automatizado que lo cubre.
4. **Diseño** — dominio (reglas e invariantes), API (contrato exacto), persistencia, frontend (pantallas,
   componentes, estados vacíos y de error) y mock API de los previews.
5. **Tareas** — checklist por repo, en el orden en que se implementan.
6. **Pruebas** — qué se prueba y dónde.
7. **Decisiones y riesgos** — alternativas descartadas y por qué.

## Proceso por fase

1. Se revisa la spec de la fase (y se corrige si hace falta).
2. **Backend primero**, con cambios de contrato **aditivos**: el frontend en producción tiene que seguir
   funcionando contra el backend nuevo (ver [D5](00-producto.md#decisiones-transversales)).
3. **Frontend y mock API** después: el mock (`src/lib/mockApi.ts`) aplica las mismas reglas y mensajes que
   la API, porque los previews de Vercel corren sobre él.
4. Se actualizan `openapi.json`, los READMEs y el estado de esta tabla.
5. Commit y push de los dos repos; el estado de la fase pasa a *Hecha*.

### Definición de terminado (vale para todas las fases)

- Todos los criterios de aceptación de la fase tienen tests y pasan.
- `go test ./...` (con `MONGO_TEST_URI`) y `npm test` en verde; cobertura ≥ 85 % en los dos repos
  (`make test-coverage`, `npm run test:coverage`).
- Aislamiento multi-usuario: cada recurso nuevo está cubierto por el e2e de dos usuarios del backend
  (`internal/infrastructure/app/multiuser_test.go`): nadie ve ni modifica lo de otro, y un recurso ajeno
  responde `404` como uno inexistente.
- `openapi.json` describe exactamente lo que el frontend consume; el catálogo de endpoints del README del
  backend está al día.
- El mock API reproduce las reglas nuevas (validaciones, mensajes, cuotas).
- `npm run build` compila sin errores de tipos.

### Orden de despliegue

El backend se despliega antes que el frontend en cada fase (sus cambios son aditivos). Las ramas de las
dos partes de una misma fase se mergean juntas: primero `base_project_go`, después `base_project_fe`.
