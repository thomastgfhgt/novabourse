// NovaTitre — moteur de calcul (ticket CALC-01, dossier V4.2.1, section 7.5).
// Module pur : aucune entrée-sortie, aucun appel réseau, aucun état.
// Utilisé par le navigateur (affichage) et par le serveur (décision), avec les mêmes tests.
// Les résultats ne sont jamais arrondis ici : l'arrondi se fait seulement à l'affichage (arrondir()).

(function () {
'use strict';

function verifierNombre(nom, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`${nom} doit être un nombre fini`);
  }
}

function verifierPositif(nom, v) {
  verifierNombre(nom, v);
  if (v <= 0) throw new RangeError(`${nom} doit être strictement positif`);
}

/** Variation en pourcentage de b vers a : (a / b − 1) × 100. */
function variation_pct(a, b) {
  verifierNombre('a', a);
  verifierPositif('b', b);
  return (a / b - 1) * 100;
}

/** Variation absolue : a − b. */
function variation_abs(a, b) {
  verifierNombre('a', a);
  verifierNombre('b', b);
  return a - b;
}

/** Marge en pourcentage : x / ca × 100. */
function marge_pct(x, ca) {
  verifierNombre('x', x);
  verifierPositif('ca', ca);
  return (x / ca) * 100;
}

/** Frais d'un ordre : max(montant × taux, minimum). taux en fraction (0,005 = 0,5 %). */
function frais_ordre(montant, taux, minimum) {
  verifierPositif('montant', montant);
  verifierNombre('taux', taux);
  verifierNombre('minimum', minimum);
  if (taux < 0 || minimum < 0) throw new RangeError('taux et minimum doivent être positifs ou nuls');
  return Math.max(montant * taux, minimum);
}

/** Coût du spread pour un aller-retour : quantite × (ask − bid). */
function cout_spread(quantite, ask, bid) {
  verifierPositif('quantite', quantite);
  verifierPositif('ask', ask);
  verifierPositif('bid', bid);
  if (ask < bid) throw new RangeError('ask doit être supérieur ou égal à bid');
  return quantite * (ask - bid);
}

/** Prix de revient unitaire : somme(quantite × prix + frais) / somme(quantite). */
function pru(lots) {
  if (!Array.isArray(lots) || lots.length === 0) throw new TypeError('lots doit être une liste non vide');
  let cout = 0;
  let qte = 0;
  for (const lot of lots) {
    verifierPositif('quantite', lot.quantite);
    verifierPositif('prix', lot.prix);
    const frais = lot.frais === undefined ? 0 : lot.frais;
    verifierNombre('frais', frais);
    if (frais < 0) throw new RangeError('frais doit être positif ou nul');
    cout += lot.quantite * lot.prix + frais;
    qte += lot.quantite;
  }
  return cout / qte;
}

/** Plus-value (ou moins-value) latente : q × (prix − pru). */
function plus_value_latente(q, prix, prixRevient) {
  verifierPositif('q', q);
  verifierPositif('prix', prix);
  verifierPositif('pru', prixRevient);
  return q * (prix - prixRevient);
}

/** Intérêts composés : c × (1 + r)^n. r en fraction, n en années. */
function interets_composes(c, r, n) {
  verifierPositif('c', c);
  verifierNombre('r', r);
  if (r <= -1) throw new RangeError('r doit être supérieur à −1');
  verifierNombre('n', n);
  if (n < 0) throw new RangeError('n doit être positif ou nul');
  return c * Math.pow(1 + r, n);
}

/** Taille de position : capital × risque / ecart_stop. risque en fraction. */
function taille_position(capital, risque, ecartStop) {
  verifierPositif('capital', capital);
  verifierPositif('risque', risque);
  if (risque >= 1) throw new RangeError('risque doit être inférieur à 1 (fraction du capital)');
  verifierPositif('ecart_stop', ecartStop);
  return (capital * risque) / ecartStop;
}

/** Levier : exposition / capital. */
function levier(exposition, capital) {
  verifierNombre('exposition', exposition);
  if (exposition < 0) throw new RangeError('exposition doit être positive ou nulle');
  verifierPositif('capital', capital);
  return exposition / capital;
}

/** Perte maximale d'une position courte : non bornée. Ne renvoie jamais un nombre. */
function perte_max_courte() {
  return Object.freeze({ bornee: false, libelle: 'perte possible sans limite' });
}

/** Arrondi pour l'affichage seulement (2 décimales par défaut). */
function arrondir(v, decimales = 2) {
  verifierNombre('v', v);
  const f = Math.pow(10, decimales);
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
}

/** Format français pour l'affichage : virgule décimale, espace insécable fine pour les milliers. */
function formater(v, decimales = 2) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(arrondir(v, decimales));
}

const API = {
  variation_pct, variation_abs, marge_pct, frais_ordre, cout_spread, pru,
  plus_value_latente, interets_composes, taille_position, levier, perte_max_courte,
  arrondir, formater,
};
// Node (tests, serveur) et navigateur (window.NovaEngine) avec le même code.
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else (globalThis.NovaEngine = globalThis.NovaEngine || {}).calc = Object.freeze(API);
})();
