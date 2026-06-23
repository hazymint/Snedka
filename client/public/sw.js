// Самоуничтожающийся service worker: удаляет старые кэши и перестаёт
// перехватывать запросы. Нет обработчика fetch — браузер грузит всё из сети.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
