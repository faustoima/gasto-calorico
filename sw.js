/* Prato do Dia — service worker mínimo.
   Objetivo: tornar o app instalável no Android e abrir mesmo com internet ruim.
   Estratégia: cache do "casco" (HTML, CSS, JS, ícones) e rede sempre primeiro
   para chamadas de API, que nunca são guardadas em cache. */

const CACHE = "prato-do-dia-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./logo-plano-mestre.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* API e exportações: sempre rede, nunca cache */
  if (url.pathname.includes("/api/") || url.pathname.includes("/port/")) return;

  /* Navegação: tenta a rede e cai para o casco guardado */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("./index.html").then((r) => r || Response.error()),
      ),
    );
    return;
  }

  /* Estáticos: cache primeiro, atualizando em segundo plano */
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
