// Retirement worker for older installs. No precache and no fetch interception:
// Vite's content-hashed assets use the browser/CDN HTTP cache instead.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("sunbird-shell-")).map(key => caches.delete(key))))
      .then(() => self.registration.unregister()),
  );
});
