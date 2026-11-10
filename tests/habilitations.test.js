// Tests des règles d'habilitation (5.10 de la V4.2.1). Tests unitaires du module pur :
// les versions serveur et navigateur de ces tests viendront avec HAB-03 et TEST-02.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluer, peutUtiliser } = require('../js/engine/habilitations.js');

const base = { compte: true, majeur: true };
const h1 = { ...base, modulesValides: ['S1', 'S2'], initiationsReussies: ['premier-ordre', 'execution'], rappelRisquesAccepte: true };
const h2 = { ...h1, modulesValides: ['S1', 'S2', 'S4'], initiationsReussies: [...h1.initiationsReussies, 'stop-gap'] };
const h3a = { ...h2, competencesMaitrisees: ['C-I9-01', 'C-I9-03'], initiationsReussies: [...h2.initiationsReussies, 'position-courte'], questionsCritiques100: ['H3a'] };

test('T-H01 / T-H02 : compte neuf, vente à découvert refusée', () => {
  for (const phase of ['E0', 'BETA', 'V1', 'V2']) {
    assert.equal(peutUtiliser(base, 'open_short', { phase }).autorise, false);
  }
});

test('H0 : initiation ouverte dès le début, compte majeur exigé', () => {
  assert.equal(peutUtiliser(base, 'initiation', { phase: 'E0' }).autorise, true);
  assert.equal(peutUtiliser({ compte: true, majeur: false }, 'initiation', { phase: 'E0' }).autorise, false);
});

test('T-H05 : un diagnostic parfait n\'accorde rien', () => {
  const e = { ...base, diagnostic: { D1: 'solide probable', D2: 'solide probable', D4: 'solide probable' } };
  const ev = evaluer(e, 'V2');
  assert.equal(ev.H1.ouvert, false);
  assert.equal(ev.H0.ouvert, true);
});

test('T-H07 : S1 et S2 validés + 2 initiations + rappel accepté → H1 en bêta', () => {
  assert.equal(evaluer(h1, 'BETA').H1.ouvert, true);
  assert.equal(peutUtiliser(h1, 'acheter_comptant', { phase: 'BETA' }).autorise, true);
});

test('H1 jamais avant la bêta (Étape 0 = H0 seulement)', () => {
  const r = peutUtiliser(h1, 'acheter_comptant', { phase: 'E0' });
  assert.equal(r.autorise, false);
  assert.ok(r.conditionsManquantes.some((c) => c.startsWith('phase_E0')));
});

test('T-H08 : initiations réussies sans l\'épreuve S2 → H1 fermée, initiation ouverte', () => {
  const e = { ...h1, modulesValides: ['S1'] };
  const r = peutUtiliser(e, 'acheter_comptant', { phase: 'BETA' });
  assert.equal(r.autorise, false);
  assert.ok(r.conditionsManquantes.includes('module_S2_valide'));
  assert.equal(peutUtiliser(e, 'initiation', { phase: 'BETA' }).autorise, true);
});

test('T-H03 : élève H1 tente un ordre stop → refus avec conditions', () => {
  const r = peutUtiliser(h1, 'ordre_stop', { phase: 'V1' });
  assert.equal(r.autorise, false);
  assert.ok(r.conditionsManquantes.includes('module_S4_valide'));
});

test('T-H15 : revente de 10 titres détenus, pendant la fermeture provisoire → acceptée', () => {
  const r = peutUtiliser(h1, 'vendre_detenu', { phase: 'BETA', fermetureProvisoire: true, quantite: 10, quantiteDetenue: 10, quantiteReservee: 0 });
  assert.equal(r.autorise, true);
});

test('T-H16 : vente de 11 avec 10 détenus → refus en entier, jamais de position courte', () => {
  const r = peutUtiliser(h1, 'vendre_detenu', { phase: 'BETA', quantite: 11, quantiteDetenue: 10, quantiteReservee: 0 });
  assert.equal(r.autorise, false);
  assert.equal(r.raison, 'quantite_superieure_au_disponible');
});

test('T-H17 : 10 détenus, 6 réservés, nouvelle vente de 5 → refus, 4 disponibles', () => {
  const r = peutUtiliser(h1, 'vendre_detenu', { phase: 'BETA', quantite: 5, quantiteDetenue: 10, quantiteReservee: 6 });
  assert.equal(r.autorise, false);
  assert.deepEqual(r.conditionsManquantes, ['disponible_4']);
});

test('Fermeture provisoire : la vente à découvert reste fermée même pour un élève H3a', () => {
  const r = peutUtiliser(h3a, 'open_short', { phase: 'V2', fermetureProvisoire: true });
  assert.equal(r.autorise, false);
  assert.equal(r.raison, 'fermeture_provisoire');
});

test('T-H14 : H2 + I9-01, I9-03, initiation et questions critiques → H3a, sans F6 ni I3', () => {
  assert.equal(peutUtiliser(h3a, 'open_short', { phase: 'V2' }).autorise, true);
  assert.equal(evaluer(h3a, 'V1').H3a.ouvert, false); // pas avant la V2 (C-3)
});

test('T-H04 : élève H3b tente un levier 3 → refus', () => {
  const h3b = { ...h2, competencesMaitrisees: ['C-I9-01', 'C-I9-02'], initiationsReussies: [...h2.initiationsReussies, 'appel-marge'], questionsCritiques100: ['H3b'] };
  assert.equal(peutUtiliser(h3b, 'levier', { phase: 'V2', levier: 2 }).autorise, true);
  assert.equal(peutUtiliser(h3b, 'levier', { phase: 'V2', levier: 3 }).autorise, false);
});

test('T-H18 : élève H4a tente de vendre une option → refus', () => {
  const h4a = { ...h2, competencesMaitrisees: ['C-I9-04'], initiationsReussies: [...h2.initiationsReussies, 'expiration-option'], questionsCritiques100: ['H4a'] };
  assert.equal(peutUtiliser(h4a, 'option_achat', { phase: 'V2' }).autorise, true);
  assert.equal(peutUtiliser(h4a, 'option_vente', { phase: 'V2' }).autorise, false);
});

test('T-H19 : H4b exige aussi le délai de 24 h', () => {
  const tout = {
    ...h2, modulesValides: [...h2.modulesValides, 'TR6'],
    competencesMaitrisees: ['C-I9-01', 'C-I9-02', 'C-I9-04', 'C-TR4-02', 'C-TR4-07'],
    initiationsReussies: [...h2.initiationsReussies, 'appel-marge', 'expiration-option'],
    questionsCritiques100: ['H3b', 'H4a', 'H4b'], epreuvePratiqueH4b: true, heuresDepuisDerniereEpreuveH4b: 10,
  };
  assert.equal(peutUtiliser(tout, 'future', { phase: 'V2' }).autorise, false);
  assert.equal(peutUtiliser({ ...tout, heuresDepuisDerniereEpreuveH4b: 24 }, 'future', { phase: 'V2' }).autorise, true);
});

test('NovaBot : aucune exécution avant la V2 et la décision C-6', () => {
  assert.equal(peutUtiliser(h3a, 'novabot_execution', { phase: 'V2' }).autorise, false);
});

test('T-H09 : des refus répétés ne changent rien (aucun compteur, aucune sanction)', () => {
  for (let i = 0; i < 5; i++) peutUtiliser(base, 'open_short', { phase: 'BETA' });
  assert.equal(peutUtiliser(h1, 'acheter_comptant', { phase: 'BETA' }).autorise, true);
});

test('Entrées invalides : phase inconnue, action inconnue, quantité invalide', () => {
  assert.throws(() => evaluer(base, 'V9'), RangeError);
  assert.equal(peutUtiliser(h1, 'teleporter', { phase: 'BETA' }).autorise, false);
  assert.equal(peutUtiliser(h1, 'vendre_detenu', { phase: 'BETA', quantite: 2.5, quantiteDetenue: 10 }).autorise, false);
});
