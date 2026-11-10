/* NovaTitre — service worker de l'école.
   v2 (version découpée du site) : la page, les styles, les scripts et le
   contenu des cours sont gardés pour l'usage hors ligne.
   - Un seul cache, au nom versionné : à chaque changement de CACHE, tous
     les autres caches (dont tout reste de l'ancien site) sont effacés.
   - La page est toujours demandée au réseau d'abord : une mise à jour du
     site s'affiche tout de suite. La copie gardée ne sert que hors ligne.
   - Les réponses de /api/ ne sont jamais gardées (comptes, coach, cours). */

const CACHE = 'novatitre-ecole-v2';
const FICHIERS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/css/style.css',
  '/css/old.css',
  '/js/engine/calc.js',
  '/js/engine/habilitations.js',
  '/js/vendor/three.min.js',
  '/js/gl.js',
  '/content/data.js',
  '/content/market-real.js',
  '/content/missions-1.js',
  '/content/missions-2.js',
  '/content/missions-3.js',
  '/content/missions-4.js',
  '/content/missions-5.js',
  '/content/missions-6.js',
  '/content/missions-7.js',
  '/js/candles.js',
  '/content/cours.js',
  '/content/exams.js',
  '/content/variants.js',
  '/content/sessions.js',
  '/content/sessions-2.js',
  '/content/realdata.js',
  '/js/ai.js',
  '/js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  /* La page d'accueil est rangée sous '/' quels que soient ses paramètres
     (?paiement=ok…) ; toute autre adresse sous elle-même. */
  const cle = url.pathname === '/' ? '/' : url.pathname;

  // Réseau d'abord ; copie gardée si le réseau répond, copie servie s'il ne répond pas.
  e.respondWith(
    fetch(req)
      .then(rep => {
        if (rep.ok && rep.type === 'basic') {
          const copie = rep.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(cle, copie)));
        }
        return rep;
      })
      .catch(() => caches.match(cle)
        .then(r => r || (req.mode === 'navigate' ? caches.match('/') : null))
        .then(r => r || Response.error()))
  );
});
