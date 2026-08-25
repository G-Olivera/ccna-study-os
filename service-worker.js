// service-worker.js
// Guarda os arquivos estáticos do app (HTML/CSS/JS/ícones) em cache, pra:
// 1. Permitir instalar o app (requisito técnico de todo PWA)
// 2. Abrir mais rápido em visitas repetidas
// 3. Continuar mostrando a interface mesmo sem internet (os dados do Firestore
//    em si precisam de conexão — isso aqui só cobre a "casca" visual do app)
//
// IMPORTANTE: só faz cache de arquivos do PRÓPRIO domínio. Chamadas ao Firebase/
// Gemini (outros domínios, e tudo que não for GET) passam direto pra rede,
// sem interferência — nunca ficam em cache, pra não servir dados desatualizados.

const CACHE_NAME = "ccna-study-os-v11";

const APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "favicon.ico",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "css/styles.css",
  "js/app.js",
  "js/firebase-config.js",
  "js/data-schema.js",
  "js/topology.js",
  "js/utils.js",
  "js/seed-content.js",
  "js/seed-questions.js",
  "js/seed-flashcards.js",
  "js/seed-labs.js",
  "js/srs-engine.js",
  "js/daily-plan.js",
  "js/dashboard.js",
  "js/gamification.js",
  "js/quick-review.js",
  "js/anti-procrastination.js",
  "js/labs.js",
  "js/ai-tutor.js",
  "js/simulado.js",
  "js/planner.js",
  "js/cli-simulator.js",
  "js/timer.js",
  "js/organizer.js",
  "js/reader.js",
  "js/finance.js",
  "js/finance/constants.js",
  "js/finance/period.js",
  "js/finance/categories.js",
  "js/finance/charts.js",
  "js/finance/insights.js",
  "js/finance/recurring.js",
  "js/finance/cards.js",
  "js/finance/budgets.js",
  "js/finance/export.js",
  "js/mfa.js",
  "js/rag.js",
  "js/pdf.min.mjs",
  "js/pdf.worker.min.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn("[SW] Falha ao cachear app shell:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só intercepta GET do mesmo domínio. Tudo que for Firebase/Gemini
  // (outro domínio) ou não-GET passa direto pra rede, sem cache.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const buscarDaRede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          }
          return resp;
        })
        .catch(() => cached);

      // Serve do cache imediatamente se existir (rápido), e atualiza em segundo plano.
      // Se não tiver em cache ainda, espera a rede.
      return cached || buscarDaRede;
    })
  );
});
