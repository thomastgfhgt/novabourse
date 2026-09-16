/**
 * api/market/_cache.js — CACHE PARTAGÉ
 *
 * Un seul magasin pour toute la couche marché. Une cotation obtenue par le
 * batch de quotes.js est immédiatement réutilisable par company.js, et
 * inversement. Aucun module ne dépend d'un autre : tous deux dépendent d'ici.
 *
 * Durée de vie sur une instance Vercel : le processus est réutilisé entre deux
 * invocations proches, le cache tient donc quelques minutes. Il n'est ni
 * garanti ni partagé entre régions — c'est un allègement de charge, pas une
 * source de vérité.
 */
const STORE = new Map();

const TTL = {
  quote: 60000,           // 1 min
  fundamentals: 21600000, // 6 h
  history: 43200000,      // 12 h — historique par défaut (n=400 fixe, company.js/history.js sans `period`)
  search: 3600000,        // 1 h
  histp: 43200000,        // 12 h — historique quotidien paramétré par période (mêmes données, cache séparé)
  intraday: 90000,        // 90 s — barres infra-journalières, se périment vite en séance
  news: 900000,           // 15 min
  constituents: 86400000, // 24 h — composition ETF/indice
};

/* Un nom de bloc composite ("histp:1a", "intraday:15min", ...) retombe
   sur le TTL de son préfixe (avant le premier ":") s'il n'a pas d'entrée
   exacte — permet d'ajouter de nouveaux sous-blocs sans toucher à TTL. */
function ttlPour(bloc){
  if (Object.prototype.hasOwnProperty.call(TTL, bloc)) return TTL[bloc];
  const prefixe = String(bloc).split(':')[0];
  return TTL[prefixe] || 60000;
}

const cle = (bloc, ...parts) => `${bloc}:${parts.filter(Boolean).join(':')}`;

function lire(bloc, ...parts){
  const k = cle(bloc, ...parts);
  const hit = STORE.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at >= ttlPour(bloc)){ STORE.delete(k); return null; }
  return hit;               // { at, valeur, source }
}

function ecrire(bloc, parts, valeur, source){
  STORE.set(cle(bloc, ...[].concat(parts)), { at: Date.now(), valeur, source });
  // Garde-fou mémoire : au-delà de 2000 entrées, on purge les plus anciennes.
  if (STORE.size > 2000){
    const vieux = [...STORE.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
    for (const [k] of vieux) STORE.delete(k);
  }
}

const oublier = (bloc, ...parts) => STORE.delete(cle(bloc, ...parts));
const taille = () => STORE.size;

/* ============================================================
   VERROU ANTI-RAFALE (single-flight)
   ============================================================
   Si N requêtes concurrentes demandent exactement la même clé avant que
   la première ait fini (ex : 20 utilisateurs ouvrant le même graphique
   au même instant, cache encore froid), une seule requête part vers le
   fournisseur ; les autres reçoivent le même résultat. Limité à cette
   instance de processus (même limitation documentée que STORE
   ci-dessus) — un allègement, pas une garantie distribuée.
*/
const ENVOL = new Map();

/**
 * @returns {Promise<{value: any, followed: boolean}>} `followed: true`
 *   signifie qu'un appel identique était déjà en vol et que celui-ci en
 *   a simplement récupéré le résultat sans exécuter `fn`.
 */
async function avecVerrou(bloc, parts, fn){
  const k = cle(bloc, ...[].concat(parts));
  const existant = ENVOL.get(k);
  if (existant) return { value: await existant, followed: true };

  const p = (async () => {
    try { return await fn(); }
    finally { ENVOL.delete(k); }
  })();

  ENVOL.set(k, p);
  return { value: await p, followed: false };
}

module.exports = { lire, ecrire, oublier, taille, avecVerrou, TTL };
