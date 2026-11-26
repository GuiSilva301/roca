/* Roça · guarda o sistema no celular para abrir sem internet (no curral).
   - A página (index.html): tenta a internet primeiro; se não vier em 4 s, usa a cópia guardada.
   - Bibliotecas e fontes (Firebase, jsPDF, Google Fonts): usa a cópia guardada; baixa só se não tiver.
   - Dados do Firestore e login NÃO passam por aqui: o próprio Firebase guarda e sincroniza.
   Ao trocar a versão das bibliotecas no index.html, troque também a lista abaixo e a VERSAO. */
const VERSAO = 'roca-2026-11-26';
const LIBS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];
const FIXOS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

async function guardar(cache, url){
  try{ const r = await fetch(url, {mode:'cors'}); if(r.ok) return cache.put(url, r); }catch(e){}
  try{ const r = await fetch(url, {mode:'no-cors'}); return cache.put(url, r); }catch(e){}
}
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    try{ await c.add(new Request('./', {cache:'reload'})); }catch(e){}
    await Promise.all(LIBS.map(u => guardar(c, u)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()) if(k !== VERSAO) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = req.url;
  if(FIXOS.test(url)){
    e.respondWith((async () => {
      const c = await caches.open(VERSAO);
      const achou = await c.match(url);
      if(achou) return achou;
      const r = await fetch(req);
      if(r.ok || r.type === 'opaque') c.put(url, r.clone());
      return r;
    })());
    return;
  }
  const mesmoSite = new URL(url).origin === self.location.origin;
  if(mesmoSite && (req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(url).pathname))){
    e.respondWith((async () => {
      const c = await caches.open(VERSAO);
      const daRede = fetch(url, {cache:'no-store', credentials:'same-origin'}).then(r => { if(r.ok) c.put('./', r.clone()); return r; });
      const guardada = () => c.match('./');
      const espera = new Promise(ok => setTimeout(ok, 4000));
      try{
        const r = await Promise.race([daRede, espera.then(async () => (await guardada()) || daRede)]);
        return r;
      }catch(err){
        const g = await guardada(); if(g) return g; throw err;
      }
    })());
  }
});
