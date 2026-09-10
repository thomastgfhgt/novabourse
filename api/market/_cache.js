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
  history: 43200000,      // 12 h
  search: 3600000,        // 1 h
};

const cle = (bloc, ...parts) => `${bloc}:${parts.filter(Boolean).join(':')}`;

function lire(bloc, ...parts){
  const k = cle(bloc, ...parts);
  const hit = STORE.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at >= (TTL[bloc] || 60000)){ STORE.delete(k); return null; }
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

module.exports = { lire, ecrire, oublier, taille, TTL };
