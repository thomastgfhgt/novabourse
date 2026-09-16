/**
 * api/market/_marketBlock.js — ORCHESTRATION COMMUNE D'UN BLOC DE DONNÉES
 *
 * Extrait tel quel de la fonction interne `bloc()` de company.js (aucun
 * changement de comportement) pour être réutilisé par company.js,
 * history.js et fundamentals.js sans dupliquer cette logique trois fois.
 *
 * Séparation volontaire, conservée telle que demandée :
 *   _providers.js   = communication et normalisation des fournisseurs
 *   _cache.js       = cache
 *   _marketBlock.js = orchestration d'un bloc (CE FICHIER) :
 *       lecture cache -> appel cascade -> journal -> écriture cache
 *       -> retour { data, source }
 *
 * Ne touche à aucune cascade, à aucun provider, à aucun ordre existant.
 */

const { cascade } = require('./_providers.js');
const { lire, ecrire, avecVerrou } = require('./_cache.js');

/* Dupliquée intentionnellement en une ligne plutôt qu'importée de
   company.js : c'est une règle de validation générique du bloc "history"
   (un historique vide compte comme indisponible), pas une règle propre à
   la route company. Les deux endroits qui en ont besoin (ici et
   company.js) restent donc indépendants l'un de l'autre. */
function historiqueValide(data){
  return Array.isArray(data) && data.length > 0;
}

/**
 * Charge un bloc de données (quote / fundamentals / history) avec cache,
 * cascade de fournisseurs et journal — comportement identique à l'ancien
 * `bloc()` interne de company.js.
 *
 * @param {object} p
 * @param {string} p.nom - 'quote' | 'fundamentals' | 'history'
 * @param {object} p.table - table de fournisseurs (QUOTE/FUNDAMENTALS/HISTORY)
 * @param {string[]} p.ordre - ordre de cascade pour ce bloc
 * @param {any[]} p.args - arguments transmis à chaque fournisseur
 * @param {string} p.ticker
 * @param {string|null} p.exchange
 * @param {boolean} p.frais - true = contourne le cache en lecture
 * @param {object[]} p.journal - tableau partagé, alimenté par cascade()
 * @param {any[]} [p.cacheParts] - segments de clé de cache additionnels
 *   (ex: [période, intervalle] pour un historique paramétré) — vide par
 *   défaut, donc AUCUN changement de clé pour les appels existants
 *   (company.js, fundamentals.js, l'historique par défaut de history.js).
 * @returns {Promise<{data: any, source: string|null}>}
 */
async function chargerBloc({ nom, table, ordre, args, ticker, exchange, frais, journal, cacheParts = [] }){
  const parts = [ticker, exchange, ...cacheParts];

  /* Un tableau vide (historique/intraday sans aucune ligne exploitable)
     ne doit jamais être resservi comme s'il s'agissait d'une vraie
     série — qu'il vienne du cache ou d'un appel frais. Détection par
     forme de la donnée plutôt que par nom de bloc : couvre 'history'
     comme les nouveaux blocs 'histp'/'intraday' sans les énumérer. */
  const valide = data => Array.isArray(data) ? historiqueValide(data) : Boolean(data);

  if (!frais){
    const hit = lire(nom, ...parts);
    if (hit && valide(hit.valeur)){
      journal.push({ bloc: nom, provider: hit.source, ok: true, cache: true });
      return { data: hit.valeur, source: hit.source };
    }
  }

  /* Verrou anti-rafale : si une requête identique est déjà en vol pour
     cette même clé, on attend son résultat plutôt que de relancer un
     appel fournisseur redondant. cascade() n'alimente alors QUE le
     journal du tout premier appelant (fermeture sur sa référence) : on
     complète ici le journal des appelants suivants avec une entrée de
     diagnostic explicite (`followed`, jamais déduit par heuristique),
     pour ne jamais laisser croire qu'aucun appel n'a eu lieu. */
  const { value: resultat, followed } = await avecVerrou(nom, parts, () => cascade(table, ordre, args, journal, nom));
  if (followed){
    journal.push({ bloc: nom, provider: resultat.source, ok: Boolean(resultat.data), dedupe: true });
  }

  if (valide(resultat.data)){
    ecrire(nom, parts, resultat.data, resultat.source);
  }

  return resultat;
}

module.exports = { chargerBloc, historiqueValide };
