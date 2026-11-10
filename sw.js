/* NovaTitre — service worker de l'école.
   - Un seul cache, au nom versionné : à chaque changement de CACHE, tous
     les autres caches (dont tout reste de l'ancien site) sont effacés.
   - La page est toujours demandée au réseau d'abord : une mise à jour du
     site s'affiche tout de suite. La copie gardée ne sert que hors ligne.
   - Les réponses de /api/ ne sont jamais gardées (comptes, coach, cours). */

const CACHE = 'novatitre-ecole-v1';
const FICHIERS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
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
