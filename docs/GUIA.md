# MkMusic — guía de puesta en marcha (paso a paso)

Resultado: app instalable en Android y PC, con tus listas sincronizadas en una carpeta oculta de tu Google Drive.
Tiempo: ~20 min. Solo hay que hacer **una vez** los pasos 1 a 3.

> Los nombres de menú de Google Cloud cambian de vez en cuando. Si algo no coincide, busca el equivalente; la lógica es la misma.

## 1. Publicar la app (GitHub Pages)

1. En GitHub abre el repo `fmecap-bit/mkmusic` → **Settings → Pages**.
2. *Source*: **Deploy from a branch**. Rama: `main` (tras fusionar esta rama) o `claude/clever-darwin-xtthlr` mientras pruebas. Carpeta: `/ (root)`. Guardar.
3. Tras 1–2 min tendrás la URL: `https://fmecap-bit.github.io/mkmusic/`
4. Apunta el **origen** (solo dominio, sin ruta ni barra final): `https://fmecap-bit.github.io`

No necesitas la carpeta `C:\Users\Usuario\Documents\MKMUSIC` para usar la app; sirve de copia de trabajo (descarga el ZIP del repo para actualizarla).

## 2. Google Cloud: permiso para usar tu Drive

1. <https://console.cloud.google.com> con la cuenta `fmecap@gmail.com` → selector de proyectos → **Proyecto nuevo** → nombre `MkMusic` → Crear.
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → **Habilitar**.
3. **Google Auth Platform** (o *APIs y servicios → Pantalla de consentimiento OAuth*) → Comenzar:
   - Nombre de la app: `MkMusic` · correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Correo de contacto: el tuyo → Crear.
4. **Acceso a los datos (Data Access) → Añadir o quitar permisos** → marca solo
   `https://www.googleapis.com/auth/drive.appdata` ("ver, crear y borrar sus propios datos de configuración en Drive") → Guardar.
   *No añadas otros permisos.*
5. **Público (Audience)**:
   - Estado *Testing*: añade como **usuarios de prueba** `fmecap@gmail.com` (y cualquier otra cuenta que vaya a usarla). En este estado Google puede volver a pedirte permiso cada ~7 días.
   - Alternativa: **Publicar app** (*In production*). `drive.appdata` no es un permiso sensible, así que en principio no exige verificación. (Si Google te pidiera verificarla, vuelve a *Testing*.)
6. **Clientes → Crear cliente**:
   - Tipo: **Aplicación web** · nombre `MkMusic web`.
   - **Orígenes autorizados de JavaScript**: `https://fmecap-bit.github.io` y, si probarás en local, `http://localhost:8000`.
   - **URI de redireccionamiento**: déjalo vacío.
   - Crear → copia el **ID de cliente** (`123456-abc.apps.googleusercontent.com`). El secreto no se usa; ignóralo.

## 3. Pegar el ID en la app

1. Abre `config.js` (en GitHub: lápiz de editar) y pon el ID entre las comillas:
   ```js
   GOOGLE_CLIENT_ID: '123456-abc.apps.googleusercontent.com'
   ```
2. Guarda/commit. Pages se actualiza en 1–2 min. (El Client ID es público; no es una contraseña.)

## 4. Primer uso

1. Abre `https://fmecap-bit.github.io/mkmusic/` → toca **☁** → elige tu cuenta → acepta el permiso.
2. Añade una canción (＋ Añadir, pega un enlace de YouTube). A los ~5 s el ☁ pasa a verde = subido.
3. Abre la app en el otro dispositivo, toca ☁ y verás las mismas listas.

Estados del ☁: gris = sin conectar · amarillo parpadeante = sincronizando · verde = al día · amarillo fijo = **toca para reconectar** · rojo = error (el mensaje sale en pantalla).

## 4b. Buscador de YouTube (API key)

El buscador usa la YouTube Data API v3. Necesita una **API key** (gratis, 1 paso más en el mismo proyecto de Google Cloud):

1. **APIs y servicios → Biblioteca** → **YouTube Data API v3** → **Habilitar**.
2. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
3. En la clave → **Restricciones**:
   - *Restricciones de aplicaciones*: **Sitios web (referentes HTTP)** → añade `https://fmecap-bit.github.io/*` (y `http://localhost:8000/*` si pruebas en local).
   - *Restricciones de API*: **Restringir clave** → solo **YouTube Data API v3**.
4. Copia la clave y pégala en `config.js` en `YOUTUBE_API_KEY`.

Notas:
- La clave queda visible en el código de la web (es inevitable en una app sin servidor). **Las restricciones del paso 3 son lo que la protege**; sin ellas cualquiera podría gastarte la cuota.
- Cuota gratuita: 10 000 unidades/día; cada búsqueda cuesta 100 → **~100 búsquedas al día**. Los resultados se guardan 24 h en el dispositivo, y solo se busca al pulsar *Buscar*.
- Se filtran vídeos que no permiten reproducirse fuera de YouTube. "Solo música" limita a la categoría Música; desmárcalo si no aparece lo que buscas (p. ej. directos subidos como "Entretenimiento").
- Si se agota la cuota, la app lo avisa y sigues pudiendo pegar enlaces.

## 5. Instalar como app

- **Android (Chrome)**: menú ⋮ → **Instalar aplicación** / *Añadir a pantalla de inicio*.
- **PC (Chrome o Edge)**: icono de instalar en la barra de direcciones (o menú → *Instalar MkMusic*).

## 6. Prueba local opcional

En PowerShell, dentro de `C:\Users\Usuario\Documents\MKMUSIC` (necesita Python instalado):

```
python -m http.server 8000
```

y abre `http://localhost:8000`. Nunca abras `index.html` con doble clic (`file://`): Google y YouTube lo rechazan.

## Limitaciones conocidas (sin rodeos)

- **Reconexión cada sesión**: el token de Google dura ~1 h y no se guarda. Al abrir la app o pasada la hora, ☁ se pone amarillo y hay que tocarlo (la ventana de Google se cierra sola). Evitarlo exigiría un servidor.
- **Segundo plano**: con YouTube, el audio puede cortarse al bloquear la pantalla (muy habitual en móvil). No hay forma legítima de garantizarlo con el reproductor de YouTube.
- **Reproductor siempre visible**: la política de YouTube exige un reproductor visible de ≥200×200 px, por eso se eliminó el botón "Ocultar vídeo".
- **Conflictos**: se fusionan por canción (gana el cambio más reciente) y lo borrado no reaparece. Si dos dispositivos editan a la vez sin conexión, puede perderse el cambio más antiguo de la *misma* canción.
- **Copia de seguridad**: Ajustes → *Exportar copia* sigue disponible; úsala de vez en cuando.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `origin_mismatch` / `redirect_uri_mismatch` | El origen del paso 2.6 no coincide exactamente (sin `/mkmusic`, sin `/` final, `https`). |
| "Acceso bloqueado: la app no ha completado la verificación" | Tu cuenta no está en *usuarios de prueba* (paso 2.5). |
| `Drive: Google Drive API has not been used…` / 403 | No habilitaste Drive API (paso 2.2) o tardó unos minutos en propagarse. |
| "Falta la API key de YouTube" | `YOUTUBE_API_KEY` vacío en `config.js` (sección 4b). |
| Búsqueda: `API key not valid` / `referer ... blocked` | La restricción de dominio no coincide (`https://fmecap-bit.github.io/*`) o la API no está habilitada. |
| Toast "Falta el Client ID" | `config.js` vacío o Pages aún no se ha actualizado (recarga forzada: Ctrl+F5). |
| ☁ rojo al volver a tener conexión | Toca ☁ para reintentar. |
| Cambios no aparecen en la app instalada | Cierra y reabre la app; el service worker usa "red primero". |
