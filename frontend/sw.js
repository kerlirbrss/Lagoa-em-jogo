/* Service Worker - Lagoa em Jogo */
/* Cache simples do "shell" da aplicacao para preparacao PWA. */

const CACHE = "lej-cache-v6";
const SHELL = [
  "/",
  "/index.html",
  "/styles/app.css",
  "/scripts/app.js",
  "/admin.html",
  "/scripts/admin.js",
  "/manifest.webmanifest",
  "/icons/lagoa-em-jogo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Nunca armazenar chamadas de API
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Consulte primeiro a versao publicada. O cache fica como fallback offline,
  // assim um F5 depois do deploy nao continua exibindo arquivos antigos.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return Response.error();
      })
  );
});
