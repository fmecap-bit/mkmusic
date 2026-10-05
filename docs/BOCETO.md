# MkMusic — boceto de arquitectura

Estado actual del repo: prototipo de un solo archivo (`index.html`, 919 líneas), listas propias sobre el reproductor oficial de YouTube (IFrame API), datos en `localStorage`, exportación/importación JSON manual. `mkmusic.html` es una copia idéntica de `index.html` (borrar una).

> **Actualizado:** decisiones tomadas = YouTube, Android + PC, carpeta oculta (`drive.appdata`), PWA estática. Implementado: login Google (OAuth), sync con Drive, PWA, logo. Pasos de puesta en marcha en `docs/GUIA.md`.

## 1. Cambios sobre la petición original (puntos críticos)

| Petición | Problema | Alternativa |
|---|---|---|
| Pedir usuario y contraseña de YouTube y guardarlos | Google **no permite** login con contraseña desde apps de terceros (solo OAuth 2.0; los WebView embebidos están bloqueados). Aunque fuera posible: guardar contraseñas de Google en tu app/Drive es un riesgo de seguridad grave y viola los términos de la API. | **Google Identity Services (OAuth)**: botón "Iniciar sesión con Google". La app recibe un token, nunca la contraseña. El navegador ya recuerda la sesión. |
| "Música de YouTube o Google" | "Google" no tiene API pública de vídeo/audio. Programable Search da solo 100 consultas/día gratis y devuelve enlaces, no streams. | YouTube (IFrame + Data API) + catálogos de música libre (sección 4). |
| Oír "gratis" sin ver el vídeo | Ocultar/encoger el reproductor (hoy el prototipo lo pliega a 4 px) incumple la política de YouTube (mínimo 200×200 px visible). Extraer solo el audio (yt-dlp, Invidious, Piped) incumple sus ToS y es frágil. | Mantener el reproductor visible (modo miniatura ≥200×200) o usar fuentes con licencia libre para audio puro. |
| JSON en Google Drive | Viable. | Ver sección 3. |

## 2. Arquitectura propuesta (sin servidor)

```
┌──────────────── Navegador / PWA ────────────────┐
│ UI (listas, favoritos, búsqueda, cola)          │
│ Player: YouTube IFrame API  | <audio> (libres)  │
│ Store local (localStorage/IndexedDB) ← fuente   │
│        │  sync con debounce + merge             │
│ Google Identity Services (token OAuth, 1 h)     │
└───────┬───────────────────────────┬─────────────┘
        │ Drive API v3              │ YouTube Data API v3
        ▼                           ▼
 appDataFolder/mkmusic.json    search / mis playlists
```

- **Offline-first**: la copia local manda; Drive es sincronización, no dependencia.
- **Scopes mínimos**: `drive.appdata` (carpeta oculta de la app; no requiere verificación de Google) y `youtube.readonly` (solo si se importan playlists propias; es sensible → pantalla de "app sin verificar" en modo pruebas, hasta 100 usuarios).
- **Nunca** guardar tokens ni credenciales en el JSON de Drive.

## 3. Base de datos JSON en Drive

Fichero `mkmusic.json` en `appDataFolder` (el usuario no lo ve en su Drive; si se quiere visible/editable a mano usar `drive.file` y una carpeta "MkMusic").

```json
{
  "v": 2,
  "updatedAt": "2026-10-05T16:00:00Z",
  "lists": [
    { "id": "a1b2", "name": "Mi música", "updatedAt": "…",
      "songs": [
        { "id": "dQw4w9WgXcQ", "src": "yt", "title": "…", "author": "…",
          "fav": true, "addedAt": "…", "updatedAt": "…" }
      ] }
  ],
  "deleted": [ { "id": "x9y8", "at": "…" } ],
  "settings": { "shuffle": false, "repeat": "all" }
}
```

Reglas de sincronización:
1. Al abrir: descargar → merge con local → subir si cambió.
2. Merge por `id` + `updatedAt` (gana el más reciente); borrados con *tombstones* (`deleted`) para que no "resuciten".
3. Subir con debounce (≥5 s) y usando `If-Match`/`modifiedTime` para detectar escrituras concurrentes desde otro dispositivo.
4. El token dura ~1 h y en modo solo-navegador no hay refresh token: renovar con `requestAccessToken({prompt:''})` (silencioso si hay sesión).
5. Guardar `resume` (última canción/segundo) solo en local; sincronizarlo en Drive genera escrituras constantes.

## 4. Fuentes de música/vídeo

| Fuente | Coste | Uso | Notas |
|---|---|---|---|
| YouTube IFrame API | Gratis | Reproducir | Algunos vídeos bloquean el embed (el prototipo ya los salta). Sin audio en segundo plano fiable en móvil. |
| YouTube Data API v3 | Gratis con cuota 10 000 uds/día | Buscar, importar playlists | `search.list` cuesta 100 uds → ~100 búsquedas/día. `videos.list`/`playlistItems.list` cuestan 1. Hoy se evita con oEmbed (sin clave). |
| Jamendo API | Gratis (clave) | Audio completo, CC | Streaming real, segundo plano OK. |
| Audius API | Gratis | Audio | Catálogo independiente. |
| Internet Archive | Gratis | Audio/vídeo dominio público | Sin clave. |
| Free Music Archive / Wikimedia Commons | Gratis | Audio CC | Catálogo menor. |

Recomendación: abstraer el reproductor (`Provider` con `play/pause/seek/onEnd`) para que una canción tenga `src: "yt" | "jamendo" | "archive"`.

## 5. Formas de ejecutarlo

| Opción | Cómo | Pros | Contras | Veredicto |
|---|---|---|---|---|
| **A. PWA estática** (GitHub Pages / Netlify / Cloudflare Pages) | Publicar la carpeta, "Añadir a pantalla de inicio" | Coste 0, multi-dispositivo, OAuth con origen `https` válido, actualización instantánea | Audio se corta con pantalla bloqueada (sobre todo iOS) con YouTube | **Recomendada** para empezar |
| B. Local (`python3 -m http.server`) | `localhost:8000` | Rápido para desarrollar; `localhost` vale como origen OAuth | Solo un equipo. **No abrir con `file://`**: Google OAuth no funciona y YouTube suele rechazar el embed sin Referer válido (error 153). | Solo desarrollo |
| C. App Android empaquetada (TWA/Bubblewrap o Capacitor) | Envolver la PWA | Icono, tienda, mejor integración | Mismo límite de segundo plano con YouTube; con fuentes libres (`<audio>` + Media Session) sí funciona | Fase 2 si se usa audio libre |
| D. Escritorio (Tauri/Electron) | Envolver la PWA | Segundo plano sin problema, atajos multimedia | Servir en origen `http://localhost` para YouTube/OAuth; más mantenimiento | Opcional |
| E. Con backend mínimo (Cloudflare Workers / Cloud Run) | Flujo OAuth "code" | Refresh tokens (sin re-login), caché de metadatos y búsquedas (ahorra cuota) | Coste/operación, guardar secretos, más superficie de ataque | Solo si la cuota o el re-login molestan |
| F. Hospedado en Google Apps Script | Web app + DriveApp | Sin clave OAuth propia, acceso a Drive trivial | Iframe sandbox: el reproductor de YouTube da problemas; UX limitada | Descartada |

## 6. Plan por fases

1. **Limpieza** (½ día): borrar `mkmusic.html`, separar CSS/JS, devolver el reproductor plegado a ≥200×200 px, esquema v2 con `updatedAt`.
2. **Login Google + sync Drive** (1–2 días): GIS token model, `drive.appdata`, merge y tombstones, indicador de estado de sincronización.
3. **Búsqueda e importación** (1 día): YouTube Data API (con aviso de cuota) e importar playlists propias.
4. **Proveedores libres** (1–2 días): Jamendo/Archive con `<audio>` + Media Session API (controles en pantalla de bloqueo).
5. **Empaquetado** (según elegido): PWA con `manifest` + service worker; luego TWA/Tauri.

## 7. Decisiones que necesito de ti

1. ¿Prioridad: **YouTube** (vídeo visible, catálogo enorme) o **audio con segundo plano** (catálogo libre)? Define si bastan A o hace falta C/D.
2. ¿Dispositivo principal: Android, iPhone o PC? iOS es el más restrictivo.
3. ¿Quieres poder abrir el JSON a mano en Drive (`drive.file`) o prefieres carpeta oculta (`drive.appdata`, recomendado)?
4. Para el paso 2 hace falta crear un **Client ID OAuth** en Google Cloud Console (tipo "Web", orígenes autorizados = tu URL); no es posible automatizarlo desde aquí.
