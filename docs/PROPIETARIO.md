# MkMusic — guía del propietario (para compartirla con amigos)

El manual para tus amigos es `docs/MANUAL-AMIGOS.pdf` (o `.html`). Esta guía es para ti.

## Cómo funciona el reparto
Tus amigos abren **tu** dirección (`https://fmecap-bit.github.io/mkmusic/`). Usan **tu** Client ID de Google y **tu** API key de YouTube. Cada uno guarda sus listas en **su propio** Drive y en su dispositivo; tú no ves sus datos.

## Alta de un amigo (2 minutos, una vez por persona)
1. <https://console.cloud.google.com> → proyecto `MkMusic` → **Google Auth Platform → Público (Audience)**.
2. En *Usuarios de prueba* → **Añadir usuarios** → su Gmail → Guardar.
3. Avísale: ya puede pulsar ☁. (Sin este paso verá «Acceso bloqueado / access_denied»; la app sigue funcionando sin sincronizar.)
Límite: 100 usuarios en modo prueba. Para quitar a alguien, bórralo de la lista (conserva sus datos locales y su archivo de Drive).

## Cuota de búsquedas
- La clave de YouTube tiene 10 000 unidades/día; cada búsqueda nueva cuesta 100 → **~100 búsquedas al día entre todos**.
- Cada dispositivo tiene un tope (`MAX_BUSQUEDAS_DIA` en `config.js`, 20 por defecto). Las repetidas salen de caché y no cuentan.
- Regla práctica: `amigos × dispositivos × tope ≤ 100`. Con más de 5 dispositivos activos, baja el valor a 10.
- Para ver el consumo: Cloud Console → APIs y servicios → YouTube Data API v3 → Cuotas. Se renueva a medianoche (hora del Pacífico).

## Comprobaciones de seguridad (hazlas una vez)
- **API key**: Credenciales → tu clave → *Restricciones de aplicaciones* = Sitios web `https://fmecap-bit.github.io/*`; *Restricciones de API* = solo YouTube Data API v3. Si no estaba así, restríngela (o crea otra y cambia `config.js`).
- El Client ID (`config.js`) es público por diseño; no hay ningún secreto en el repositorio.

## Actualizar la app
Cualquier cambio en la rama publicada llega a todos a la vez (la app descarga la versión nueva al abrirla; si no, cerrarla y abrirla). Recomendado: trabajar en una rama, probar y fusionar a `main`.

## Si algo falla en Google
| Síntoma | Causa |
|---|---|
| Un amigo: `access_denied` | No está en usuarios de prueba |
| Todos: búsqueda «cuota agotada» | Se agotó la cuota del día (espera a mañana) |
| Todos: `API key not valid` / `referer blocked` | Restricción de dominio mal escrita o clave regenerada |
| Un amigo: pide permiso cada semana | Efecto del modo prueba; considera publicar la app (ver `AUDITORIA.md`, M1) |

## ¿Y si prefieren su propia copia?
Es posible (copiar el repositorio, activar Pages y crear su propio proyecto de Google con `docs/GUIA.md`), pero es técnico y cada uno gestionaría sus claves. Para amigos no técnicos, lo razonable es compartir la tuya.
