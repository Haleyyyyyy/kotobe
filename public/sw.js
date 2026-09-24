/* Cache the public shell and immutable assets only. Never intercept Supabase requests.
   Private data lives in an account-scoped IndexedDB cache; reviews in a durable outbox. */
const CACHE='kotoba-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/offline.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'])));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kotoba-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return response;}).catch(async()=>await caches.match(req)||await caches.match('/')||await caches.match('/offline.html')));}
 else if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icon-')){event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return response;})));}
});
