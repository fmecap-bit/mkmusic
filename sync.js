/* =========================================================
   MkMusic — sincronización con Google Drive
   - Fichero mkmusic.json en la carpeta oculta de la app (appDataFolder).
   - Scope único: drive.appdata. No se piden ni guardan contraseñas;
     el token de acceso vive solo en memoria (dura ~1 h).
   - La copia local manda: Drive es respaldo/sincronización entre dispositivos.
   - Fusión por lista y por canción (u = última modificación) + lápidas
     (deleted) para que lo borrado no reaparezca desde otro dispositivo.
   ========================================================= */
const Cloud = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE = 'mkmusic.json';
  const PREF = 'mkmusic.cloud';              // '1' = usuario conectado (nunca el token)
  const GRACE = 90 * 24 * 3600 * 1000;       // las lápidas se conservan 90 días
  const clientId = () => (window.MK_CONFIG && MK_CONFIG.GOOGLE_CLIENT_ID) || '';

  let hooks = { getDoc(){}, applyDoc(){}, onStatus(){}, toast(){} };
  let token = null, expires = 0, fileId = null, tokenClient = null, gisP = null;
  let state = 'off', timer = null, busy = false, again = false, lastPull = 0;

  const getPref = () => { try{ return localStorage.getItem(PREF) === '1'; }catch(e){ return false; } };
  const setPref = v => { try{ v ? localStorage.setItem(PREF,'1') : localStorage.removeItem(PREF); }catch(e){} };
  function setState(s, msg){ state = s; hooks.onStatus(s, msg || ''); }

  /* ---------- Fusión ---------- */
  const su = s => s.u || s.added || 0;

  function mergeDocs(a, b){
    if(!b || !Array.isArray(b.lists)) return a;
    const now = Date.now();
    const dead = new Map();
    [...(a.deleted||[]), ...(b.deleted||[])].forEach(d => {
      if(now - d.at > GRACE) return;
      if(!(dead.get(d.k) >= d.at)) dead.set(d.k, d.at);
    });
    const A = new Map(a.lists.map(l => [l.id, l]));
    const B = new Map(b.lists.map(l => [l.id, l]));
    const ids = [...b.lists.map(l => l.id), ...a.lists.filter(l => !B.has(l.id)).map(l => l.id)];
    const lists = [];

    for(const id of ids){
      const la = A.get(id), lb = B.get(id);
      const dl = dead.get('L:' + id);
      if(dl && dl >= Math.max(la ? la.u||0 : 0, lb ? lb.u||0 : 0)) continue;   // lista borrada

      const base  = !la ? lb : !lb ? la : ((la.u||0) > (lb.u||0) ? la : lb);    // manda nombre y orden
      const other = base === la ? lb : la;
      const songs = new Map();
      const take = s => {
        const t = dead.get('S:' + id + ':' + s.id);
        if(t && t >= su(s)) return;                                             // canción borrada
        const prev = songs.get(s.id);
        if(!prev || su(s) > su(prev)) songs.set(s.id, s);
      };
      base.songs.forEach(take);
      if(other) other.songs.forEach(take);
      lists.push({ id, name: base.name, u: Math.max(la ? la.u||0 : 0, lb ? lb.u||0 : 0), songs: [...songs.values()] });
    }
    return { v: 2, updatedAt: Math.max(a.updatedAt||0, b.updatedAt||0), lists,
             deleted: [...dead].map(([k, at]) => ({k, at})) };
  }

  const canon = d => JSON.stringify([d.lists, (d.deleted||[]).map(x => x.k + x.at).sort()]);

  /* Marca como modificado (u = ahora) lo que cambió desde la última vez.
     Devuelve true si hubo cambios que subir. */
  const sigs = new WeakMap();
  function stamp(S){
    const now = Date.now();
    let changed = false;
    const check = (o, sig) => {
      if(o.u == null){ o.u = now; sigs.set(o, sig); changed = true; }
      else if(!sigs.has(o)) sigs.set(o, sig);
      else if(sigs.get(o) !== sig){ o.u = now; sigs.set(o, sig); changed = true; }
    };
    for(const l of S.lists){
      check(l, l.name + '|' + l.songs.map(s => s.id).join(','));
      for(const s of l.songs) check(s, (s.title||'') + '|' + (s.author||'') + '|' + (s.fav ? 1 : 0));
    }
    return changed;
  }

  /* ---------- Google Identity Services ---------- */
  function loadGis(){
    if(window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if(gisP) return gisP;
    gisP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = res;
      s.onerror = () => { gisP = null; rej(new Error('No se pudo cargar Google. ¿Hay conexión?')); };
      document.head.appendChild(s);
    });
    return gisP;
  }

  /* interactive=true solo desde un toque del usuario (los navegadores bloquean
     la ventana de Google si no). Si ya diste permiso, la ventana se cierra sola. */
  async function getToken(interactive){
    if(token && Date.now() < expires - 60000) return token;
    if(!interactive) throw Object.assign(new Error('auth'), { auth: true });
    await loadGis();
    return new Promise((resolve, reject) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: r => {
          if(r.error){ reject(Object.assign(new Error(r.error_description || r.error), { auth: true })); return; }
          token = r.access_token;
          expires = Date.now() + (Number(r.expires_in) || 3600) * 1000;
          setPref(true);
          resolve(token);
        },
        error_callback: e => reject(Object.assign(new Error(e && e.type || 'auth'), { auth: true }))
      });
      tokenClient.requestAccessToken({ prompt: getPref() ? '' : 'consent' });
    });
  }

  /* ---------- Drive API ---------- */
  async function api(url, opt){
    opt = opt || {};
    const r = await fetch(url, Object.assign({}, opt, {
      headers: Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {})
    }));
    if(r.status === 401){ token = null; throw Object.assign(new Error('Sesión caducada'), { auth: true }); }
    if(!r.ok){
      let m = r.status + '';
      try{ const j = await r.json(); m = (j.error && (j.error.message || j.error.status)) || m; }catch(e){}
      const err = new Error(m); err.status = r.status; throw err;
    }
    return r;
  }

  async function findFile(){
    const q = encodeURIComponent("name='" + FILE + "'");
    const r = await api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1&fields=files(id)&q=' + q);
    const j = await r.json();
    return j.files && j.files[0] ? j.files[0].id : null;
  }
  async function download(id){
    const r = await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media');
    const t = await r.text();
    if(!t.trim()) return null;
    try{ return JSON.parse(t); }catch(e){ throw new Error('El archivo de Drive está dañado'); }
  }
  async function upload(doc){
    const body = JSON.stringify(doc);
    if(fileId){
      await api('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body
      });
      return;
    }
    const b = 'mk' + Math.random().toString(36).slice(2);
    const multi = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) + '\r\n' +
      '--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi
    });
    fileId = (await r.json()).id;
  }

  /* ---------- Sincronización ---------- */
  const pristine = d => d.lists.length === 1 && !d.lists[0].songs.length &&
                        !(d.deleted||[]).length && d.lists[0].name === 'Mi música';

  async function sync(interactive){
    if(!clientId()){ hooks.toast('Falta el Client ID de Google (config.js). Mira docs/GUIA.md.'); return; }
    if(busy){ again = true; return; }
    busy = true; clearTimeout(timer); setState('syncing');
    try{
      await getToken(!!interactive);
      if(!fileId) fileId = await findFile();
      let local = hooks.getDoc();
      const remote = fileId ? await download(fileId) : null;
      if(remote && remote.lists && pristine(local)) local = { v: 2, updatedAt: 0, lists: [], deleted: [] };
      const merged = mergeDocs(local, remote);
      hooks.applyDoc(merged);
      if(!remote || canon(merged) !== canon(remote)) await upload(merged);
      lastPull = Date.now();
      setState('ok', 'Sincronizado a las ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }));
    }catch(e){
      if(e.auth){
        setState('auth', 'Toca ☁ para reconectar con Drive');
        if(interactive) hooks.toast('No se completó el acceso a Google.');
      }else{
        if(e.status === 404) fileId = null;
        setState('error', e.message || 'Error de sincronización');
        hooks.toast('Drive: ' + (e.message || 'error'));
      }
    }finally{
      busy = false;
      if(again){ again = false; schedule(1500); }
    }
  }

  /* Cambios locales → subida con espera (agrupa ráfagas de cambios). */
  function touch(){
    if(!getPref() || !clientId()) return;
    clearTimeout(timer);
    timer = setTimeout(() => sync(false), 5000);
  }

  function schedule(ms){ clearTimeout(timer); timer = setTimeout(() => sync(false), ms); }

  function init(h){
    hooks = Object.assign(hooks, h);
    setState(getPref() && clientId() ? 'auth' : 'off',
             getPref() ? 'Toca ☁ para reconectar con Drive' : '');
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible' && state !== 'off' && token &&
         Date.now() - lastPull > 60000) sync(false);
    });
    addEventListener('online', () => { if(state === 'error' && token) sync(false); });
  }

  function disconnect(){
    const t = token;
    token = null; expires = 0; fileId = null; setPref(false); clearTimeout(timer);
    try{ if(t && window.google && google.accounts) google.accounts.oauth2.revoke(t, () => {}); }catch(e){}
    setState('off');
  }

  return {
    init, stamp, touch, disconnect,
    syncNow: () => sync(true),
    get state(){ return state; },
    get connected(){ return state !== 'off'; },
    get configured(){ return !!clientId(); }
  };
})();
