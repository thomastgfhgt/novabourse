// NovaTitre — règles d'habilitation (ticket HAB-01, dossier V4.2.1, sections 5.1 à 5.4 et 5.9).
// Module pur : il calcule une décision à partir d'un état. Il n'écrit rien.
// En production, seule la décision calculée par le serveur compte (5.7) ; le navigateur s'en sert pour l'affichage.
// Le diagnostic, l'IA, l'abonnement et les QCM isolés n'accordent jamais une habilitation (5.1).

(function () {
'use strict';

const PHASES = ['E0', 'BETA', 'V1', 'V2'];
// Niveau le plus haut qui peut s'ouvrir dans chaque phase (5.2).
const NIVEAU_MAX_PAR_PHASE = { E0: 'H0', BETA: 'H1', V1: 'H2', V2: 'H4b' };
const ORDRE_NIVEAUX = ['H0', 'H1', 'H2', 'H3a', 'H3b', 'H4a', 'H4b'];

// Conditions de chaque niveau (5.2). Chaque condition est une fonction pure de l'état.
const NIVEAUX = {
  H0: { requiert: [], conditions: [['compte_majeur', (e) => e.compte === true && e.majeur === true]] },
  H1: { requiert: ['H0'], conditions: [
    ['module_S1_valide', (e) => has(e.modulesValides, 'S1')],
    ['module_S2_valide', (e) => has(e.modulesValides, 'S2')],
    ['initiation_premier_ordre', (e) => has(e.initiationsReussies, 'premier-ordre')],
    ['initiation_execution', (e) => has(e.initiationsReussies, 'execution')],
    ['rappel_risques_accepte', (e) => e.rappelRisquesAccepte === true],
  ] },
  H2: { requiert: ['H1'], conditions: [
    ['module_S4_valide', (e) => has(e.modulesValides, 'S4')],
    ['initiation_stop_gap', (e) => has(e.initiationsReussies, 'stop-gap')],
  ] },
  H3a: { requiert: ['H2'], conditions: [
    ['I9-01_maitrisee', (e) => has(e.competencesMaitrisees, 'C-I9-01')],
    ['I9-03_maitrisee', (e) => has(e.competencesMaitrisees, 'C-I9-03')],
    ['initiation_position_courte', (e) => has(e.initiationsReussies, 'position-courte')],
    ['questions_critiques_H3a', (e) => has(e.questionsCritiques100, 'H3a')],
  ] },
  H3b: { requiert: ['H2'], conditions: [
    ['I9-01_maitrisee', (e) => has(e.competencesMaitrisees, 'C-I9-01')],
    ['I9-02_maitrisee', (e) => has(e.competencesMaitrisees, 'C-I9-02')],
    ['initiation_appel_marge', (e) => has(e.initiationsReussies, 'appel-marge')],
    ['questions_critiques_H3b', (e) => has(e.questionsCritiques100, 'H3b')],
  ] },
  H4a: { requiert: ['H2'], conditions: [
    ['I9-04_maitrisee', (e) => has(e.competencesMaitrisees, 'C-I9-04')],
    ['initiation_expiration_option', (e) => has(e.initiationsReussies, 'expiration-option')],
    ['questions_critiques_H4a', (e) => has(e.questionsCritiques100, 'H4a')],
  ] },
  H4b: { requiert: ['H3b', 'H4a'], conditions: [
    ['module_TR6_valide', (e) => has(e.modulesValides, 'TR6')],
    ['TR4-02_maitrisee', (e) => has(e.competencesMaitrisees, 'C-TR4-02')],
    ['TR4-07_maitrisee', (e) => has(e.competencesMaitrisees, 'C-TR4-07')],
    ['epreuve_pratique_H4b', (e) => e.epreuvePratiqueH4b === true],
    ['questions_critiques_H4b', (e) => has(e.questionsCritiques100, 'H4b')],
    ['delai_24h_ecoule', (e) => typeof e.heuresDepuisDerniereEpreuveH4b === 'number' && e.heuresDepuisDerniereEpreuveH4b >= 24],
  ] },
};

// Action du simulateur -> niveau exigé (5.2, 5.4).
const ACTIONS = {
  initiation: 'H0', marches_lecture: 'H0',
  acheter_comptant: 'H1', vendre_detenu: 'H1', ordre_marche: 'H1', ordre_limite: 'H1', annuler_ordre: 'H1',
  ordre_stop: 'H2', ordre_stop_limite: 'H2', portefeuille_supplementaire: 'H2',
  open_short: 'H3a', levier: 'H3b', option_achat: 'H4a', option_vente: 'H4b', future: 'H4b', turbo: 'H4b',
};
// Fermés pour tous pendant la fermeture provisoire (5.9). La revente de titres détenus n'en fait jamais partie.
const FERMEES_PROVISOIREMENT = new Set(['open_short', 'levier', 'option_achat', 'option_vente', 'future', 'turbo', 'novabot_execution']);

function has(liste, v) { return Array.isArray(liste) && liste.includes(v); }

function verifierPhase(phase) {
  if (!PHASES.includes(phase)) throw new RangeError(`phase inconnue : ${phase}`);
}

/** Évalue tous les niveaux : { niveau: { ouvert, manquantes[] } }. */
function evaluer(etat, phase) {
  verifierPhase(phase);
  const max = ORDRE_NIVEAUX.indexOf(NIVEAU_MAX_PAR_PHASE[phase]);
  const res = {};
  for (const niv of ORDRE_NIVEAUX) {
    const def = NIVEAUX[niv];
    const manquantes = def.conditions.filter(([, f]) => !f(etat || {})).map(([nom]) => nom);
    for (const r of def.requiert) if (!res[r].ouvert) manquantes.unshift(`niveau_${r}`);
    if (ORDRE_NIVEAUX.indexOf(niv) > max) manquantes.push(`phase_${phase}_ne_permet_pas_${niv}`);
    res[niv] = { ouvert: manquantes.length === 0, manquantes };
  }
  return res;
}

/**
 * Décide si une action est permise.
 * contexte : { phase, fermetureProvisoire, quantite, quantiteDetenue, quantiteReservee, levier }
 * Renvoie { autorise, raison, conditionsManquantes }.
 */
function peutUtiliser(etat, action, contexte = {}) {
  const phase = contexte.phase;
  verifierPhase(phase);
  if (action === 'novabot_execution') {
    return refus('novabot_execution_fermee_avant_V2', ['phase_V2', 'decision_C-6']);
  }
  const niveau = ACTIONS[action];
  if (!niveau) return refus('action_inconnue', []);
  if (contexte.fermetureProvisoire === true && FERMEES_PROVISOIREMENT.has(action)) {
    return refus('fermeture_provisoire', ['tests_5.10_en_production']);
  }
  const ev = evaluer(etat, phase);
  if (!ev[niveau].ouvert) return refus(`niveau_${niveau}_requis`, ev[niveau].manquantes);

  if (action === 'vendre_detenu') {
    const q = contexte.quantite;
    const detenue = contexte.quantiteDetenue || 0;
    const reservee = contexte.quantiteReservee || 0;
    if (!Number.isInteger(q) || q <= 0) return refus('quantite_invalide', []);
    const disponible = detenue - reservee;
    // Refus en entier, jamais réduit ni transformé en position courte (5.4).
    if (q > disponible) return refus('quantite_superieure_au_disponible', [`disponible_${Math.max(disponible, 0)}`]);
  }
  if (action === 'levier') {
    const l = contexte.levier;
    if (typeof l !== 'number' || l <= 1) return refus('levier_invalide', []);
    if (l > 2 && !ev.H4b.ouvert) return refus('niveau_H4b_requis', ev.H4b.manquantes);
  }
  return { autorise: true, raison: 'ok', conditionsManquantes: [] };
}

function refus(raison, conditionsManquantes) {
  return { autorise: false, raison, conditionsManquantes };
}

const API = { evaluer, peutUtiliser, NIVEAUX, ACTIONS, NIVEAU_MAX_PAR_PHASE, FERMEES_PROVISOIREMENT };
// Node (tests, serveur) et navigateur (window.NovaEngine) avec le même code.
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else (globalThis.NovaEngine = globalThis.NovaEngine || {}).habilitations = Object.freeze(API);
})();
