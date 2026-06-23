// Service worker: оффлайн-оболочка. API и загруженные файлы НЕ кэшируются.
// ВАЖНО: при значимых изменениях оболочки поднимай версию кэша (menu-vN → menu-v(N+1)),
// иначе у уже установленных PWA в кэше останется старый index.html.
const CACHE = "menu-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Никогда не кэшируем динамику — иначе список и рецепты "застынут"
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) return;

  // Навигация: сеть-первой, при успехе дозаписываем свежую оболочку в кэш,
  // при оффлайне — отдаём оболочку из кэша
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Статика: сначала кэш, затем сеть (с дозаписью в кэш)
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
    )
  );
});
