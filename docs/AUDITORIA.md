# MkMusic — auditoría (17/10/2026)

Alcance: `index.html`, `sync.js`, `sw.js`, `config.js`, manifiesto y páginas auxiliares. Método: lectura del código + 40 comprobaciones automáticas en un navegador real (Chromium) con YouTube y Google simulados.
**No verificado** (no se puede desde aquí): el reproductor y el login reales de Google/Drive, las restricciones de la API key en Google Cloud, el comportamiento en iPhone y en el MBUX.

## Resumen
| Severidad | Hallazgos | Corregidos ya | Pendientes |
|---|---|---|---|
| Alto | 4 | 3 | 1 (decisión tuya) |
| Medio | 7 | 3 | 4 |
| Bajo | 5 | 1 | 4 |

## Alto
| # | Hallazgo | Estado |
|---|---|---|
| A1 | **Cuota de YouTube compartida.** Todos los amigos usan tu API key: 10 000 uds/día = ~100 búsquedas nuevas al día entre todos. Un solo usuario podía agotarla. | **Corregido**: tope de 20 búsquedas nuevas/día por dispositivo (`MAX_BUSQUEDAS_DIA` en `config.js`); las repetidas salen de caché y no cuentan. Con más de 5 amigos baja el valor (ver `PROPIETARIO.md`). **Actualización**: cada usuario puede poner su propia clave (Ajustes → *Clave de YouTube propia*): usa su cuota y no tiene tope. Iniciar sesión con Google no reparte la cuota (se cobra al proyecto dueño de la clave). |
| A2 | **Datos externos sin validar** (copia importada y archivo de Drive): los ids y tipos se aceptaban tal cual; un archivo con formas inesperadas dejaba la app inutilizable. No había XSS (todo se pinta con `textContent`), pero sí riesgo de bloqueo y de URLs con ids arbitrarios. | **Corregido**: `cleanLists/cleanDoc` reconstruyen cada campo; ids de vídeo `[\w-]{11}`, textos acotados, duplicados fuera. Probado con un archivo hostil. |
| A3 | **Pérdida del último cambio**: el guardado local esperaba 120 ms; si se cerraba la pestaña justo después, no se guardaba. | **Corregido**: se guarda al ocultar/cerrar (`pagehide`, `visibilitychange`). |
| A4 | **API key pública en el repositorio** (`config.js`). Es inevitable en una web sin servidor; solo la protege la restricción por dominio y por API en Google Cloud. | **Pendiente (tuyo)**: comprueba en Cloud Console → Credenciales que la clave tiene *Sitios web* = `https://fmecap-bit.github.io/*` y *Restringir clave* = solo YouTube Data API v3. Si no estaba restringida, regenérala. Si el repositorio es público, Google puede avisarte de la clave expuesta: es esperable. |

## Medio
| # | Hallazgo | Estado |
|---|---|---|
| M1 | **Modo "Testing" de Google**: máximo 100 usuarios, cada Gmail añadido a mano y el permiso puede caducar cada ~7 días. Para amigos es válido; para más gente no escala. | Pendiente. Publicar la app ("In production") podría evitarlo (`drive.appdata` no es un permiso sensible) pero **no he podido comprobar** si Google pide verificación con un dominio `github.io`. |
| M2 | **Re-login en cada sesión**: el token de Google dura 1 h y no se guarda; hay que tocar ☁ al abrir la app. | Pendiente. Solo se elimina con un servidor (flujo con refresh token). Aceptable. |
| M3 | **Sin Política de Privacidad / enlace a los Términos de YouTube**, necesarios para usar YouTube API Services y para publicar la pantalla de consentimiento. | **Corregido**: `privacidad.html` + enlace en Ajustes. |
| M4 | **Sin Content-Security-Policy.** Reduce el daño de un hipotético XSS futuro. | Pendiente: añadir una CSP con YouTube, Google y ytimg permitidos; hay que probarla con el reproductor real antes de publicarla (si se bloquea algo, no suena). |
| M5 | **Sincronización sin control de versión** (no hay ETag): si dos dispositivos guardan en el mismo segundo, el cambio más antiguo *de la misma canción* puede perderse. Lo demás se fusiona (unión + borrados). | Aceptado. Probado con tests de fusión. |
| M6 | **Sin tests en el repositorio.** Las 40 comprobaciones de esta auditoría no están guardadas como tests. | Pendiente: añadir `tests/` con Playwright y un GitHub Action. |
| M7 | **Despliegue desde una rama de trabajo** (`claude/clever-darwin-xtthlr`) y `docs/preview/` (~3 MB de maquetas) publicado en Pages. | Pendiente: fusionar a `main`, apuntar Pages a `main`, borrar `docs/preview/`. |

## Bajo
| # | Hallazgo | Estado |
|---|---|---|
| B1 | Datos locales ilegibles se sustituían por una lista vacía y se sobrescribían al guardar. | **Corregido**: antes se aparta una copia en `mkmusic.v1.corrupto`. |
| B2 | Contraste insuficiente: estrella apagada 2,8:1 y *placeholder* 3,6:1. | **Corregido** (5,6:1 y 5,0:1). |
| B3 | Botones solo con símbolo sin `aria-label`; **Esc** no cerraba las ventanas con el cursor en un campo. | **Corregido** (parcial: faltan foco atrapado en ventanas y etiquetas en las pestañas). |
| B4 | Lista completa en el DOM (sin virtualizar): 3 000 canciones se pintan en 90 ms; correcto hasta ~10 000. | Aceptado. |
| B5 | Solo en español; no probado en iPhone. | Aceptado / pendiente de prueba real. |

## Decisiones posteriores a la auditoría
- **Creación automática de la clave de YouTube: rechazada.** Requiere el permiso `cloud-platform` (gestionar y borrar todo el Google Cloud del usuario), la aceptación manual de términos de Google y, además, el patrón «un proyecto por usuario para repartir la cuota» probablemente contraviene las políticas de YouTube API Services. Sustituida por: asistente guiado con prueba de la clave, clave sincronizada en el Drive del usuario y «Compartir desde YouTube» (Android) sin cuota.

## Lo que está bien
- Todo texto de terceros se inserta con `textContent`; los `innerHTML` son cadenas fijas.
- Token de Google solo en memoria; scope mínimo (`drive.appdata`).
- Fusión con lápidas probada (unión, borrado, conmutativa e idempotente).
- Service worker solo toca archivos propios, red primero.
- 3 000 canciones: render 90 ms; búsqueda instantánea.
- Flujo completo probado (añadir, mover, favorito, borrar, recargar, exportar/importar, buscar por grupo) sin errores de consola.

## Límites de diseño (no son fallos)
Vídeo siempre visible mientras suena y sin saltar anuncios (política de YouTube); audio posiblemente cortado con la pantalla bloqueada; en el coche depende de la herramienta que duplica la pantalla.

## Siguientes pasos recomendados (por orden)
1. Revisar las restricciones de la API key (A4) — 2 minutos.
2. Fusionar a `main` y apuntar Pages a `main` (M7).
3. Añadir a los amigos como usuarios de prueba (M1) y decidir el valor de `MAX_BUSQUEDAS_DIA`.
4. CSP probada con YouTube real (M4) y tests guardados en el repo (M6).
