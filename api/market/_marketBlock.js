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
const { lire, ecrire } = require('./_cache.js');
const {
  freshnessCotation,
  freshnessHistorique,
  freshnessFondamentaux,
  SOURCE_URL_PROVIDER,
} = require('./_freshness.js');

/* Calcule freshness/sourceUrl/retrievedAt pour un bloc — ajout PUREMENT
   ADDITIF au résultat de chargerBloc() : les appelants existants qui ne
   déstructurent que { data, source } ne sont pas affectés. `source` peut
   être null (tous les fournisseurs ont échoué) : la fraîcheur devient alors
   naturellement null plutôt qu'une valeur inventée. */
function metaBloc(nom, source, auMoment) {
  if (!source) {
    return { freshness: null, sourceUrl: null, retrievedAt: null };
  }

  const freshness =
    nom === 'quote' ? freshnessCotation(source)
    : nom === 'history' ? freshnessHistorique()
    : nom === 'fundamentals' ? freshnessFondamentaux()
    : null;

  return {
    freshness,
    sourceUrl: SOURCE_URL_PROVIDER[source] || null,
    retrievedAt: new Date(auMoment).toISOString(),
  };
}

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
 * @returns {Promise<{data: any, source: string|null}>}
 */
async function chargerBloc({ nom, table, ordre, args, ticker, exchange, frais, journal }){
  if (!frais){
    const hit = lire(nom, ticker, exchange);
    if (hit){
      /* Ne pas réutiliser un historique vide comme s'il s'agissait d'un
         vrai historique — comportement identique à l'ancien company.js. */
      if (nom !== 'history' || historiqueValide(hit.valeur)){
        journal.push({ bloc: nom, provider: hit.source, ok: true, cache: true });
        /* hit.at = horodatage RÉEL de récupération (écrit ci-dessous lors du
           premier appel fournisseur), jamais l'instant du cache hit — une
           donnée servie depuis le cache reste aussi fraîche (ou aussi
           périmée) qu'au moment où elle a été obtenue. */
        return { data: hit.valeur, source: hit.source, ...metaBloc(nom, hit.source, hit.at) };
      }
    }
  }

  const resultat = await cascade(table, ordre, args, journal, nom);
  /* Un seul horodatage, réutilisé pour l'écriture cache ET la réponse :
     évite toute dérive entre le retrievedAt renvoyé maintenant et celui
     qu'un futur cache hit relira (voir _cache.js). */
  const auMoment = Date.now();

  /* On ne met pas un historique vide en cache, pour permettre à une
     requête ultérieure de retenter un fournisseur plutôt que de rester
     bloquée sur []. Comportement identique à l'ancien company.js. */
  const peutEcrire = nom === 'history' ? historiqueValide(resultat.data) : Boolean(resultat.data);
  if (peutEcrire){
    ecrire(nom, [ticker, exchange], resultat.data, resultat.source, auMoment);
  }

  return { ...resultat, ...metaBloc(nom, resultat.source, auMoment) };
}

module.exports = { chargerBloc, historiqueValide };
