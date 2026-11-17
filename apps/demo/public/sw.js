/* Galato · funciona sem internet: guarda o app no aparelho.
   Rede primeiro (sempre a versão nova quando há internet); sem internet, usa a cópia guardada. */
const CACHE = "galato-app-v2";
const CORE = ["./", "./index.html", "./assets/app.js", "./assets/index.css", "./galato-logo.png", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest", "./bg-curves.svg", "./bg-curves-gray.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; // dados: o app cuida (fila offline)
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // ignora o cache do navegador: sempre busca a versão publicada mais nova
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      return Response.error();
    }
  })());
});
