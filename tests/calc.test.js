// Tests du moteur de calcul : vecteurs des sections 7.5 et 10.7 de la V4.2.1.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/engine/calc.js');

const r2 = (v) => c.arrondir(v, 2);

test('vecteurs de 7.5', () => {
  assert.equal(r2(c.variation_pct(416161, 391035)), 6.43);
  assert.equal(r2(c.variation_abs(1102.5, 1050)), 52.5);
  assert.equal(r2(c.marge_pct(112010, 416161)), 26.92);
  assert.equal(c.frais_ordre(2000, 0.005, 1), 10);
  assert.equal(r2(c.cout_spread(10, 100.2, 100.0)), 2);
  assert.equal(c.pru([{ quantite: 10, prix: 50 }, { quantite: 10, prix: 60 }]), 55);
  assert.equal(c.plus_value_latente(20, 58, 55), 60);
  assert.equal(r2(c.interets_composes(1000, 0.05, 10)), 1628.89);
  assert.equal(c.taille_position(10000, 0.01, 2), 50);
  assert.equal(c.levier(20000, 10000), 2);
});

test('perte maximale d\'une position courte : jamais un nombre', () => {
  const p = c.perte_max_courte();
  assert.equal(p.bornee, false);
  assert.equal(typeof p.libelle, 'string');
  assert.equal(typeof p, 'object');
});

test('vecteurs de 10.7 (Apple FY2025, Microsoft FY2026)', () => {
  assert.equal(r2(c.marge_pct(133050, 416161)), 31.97);
  assert.equal(r2(c.marge_pct(123216, 391035)), 31.51);
  assert.equal(r2(c.marge_pct(93736, 391035)), 23.97);
  assert.equal(r2(c.variation_pct(112010, 93736)), 19.5);
  assert.equal(r2(c.marge_pct(155237, 331839)), 46.78);
  assert.equal(r2(c.marge_pct(128528, 281724)), 45.62);
  assert.equal(r2(c.marge_pct(133749, 331839)), 40.31);
  assert.equal(r2(c.marge_pct(101832, 281724)), 36.15);
  assert.equal(r2(c.variation_pct(331839, 281724)), 17.79);
  assert.equal(r2(c.variation_pct(155237, 128528)), 20.78);
  assert.equal(r2(c.variation_pct(133749, 101832)), 31.34);
  assert.equal(r2(c.variation_pct(128786, 105452)), 22.13);
  assert.equal(r2(c.variation_abs(4963, -3620)), 8583);
  assert.equal(r2(c.marge_pct(8583, 133749 - 101832)), 26.89);
});

test('compétence C-S3-01 : part du capital (500 / 2 000 000)', () => {
  assert.equal(c.arrondir(c.marge_pct(500, 2000000), 3), 0.025);
});

test('fiches S1 et S2 (20.2)', () => {
  assert.equal(r2(c.interets_composes(10000, 0.05, 20)), 26532.98);
  assert.equal(r2(c.interets_composes(10000, 0.04, 20)), 21911.23);
  assert.equal(r2(c.variation_pct(1.04, 1.02)), 1.96);
  assert.equal(r2(c.variation_pct(1000, 500)), 100); // −50 % demande +100 %
});

test('entrées invalides refusées', () => {
  assert.throws(() => c.variation_pct(1, 0), RangeError);
  assert.throws(() => c.marge_pct('10', 100), TypeError);
  assert.throws(() => c.marge_pct(10, NaN), TypeError);
  assert.throws(() => c.frais_ordre(-5, 0.005, 1), RangeError);
  assert.throws(() => c.cout_spread(10, 99, 100), RangeError);
  assert.throws(() => c.pru([]), TypeError);
  assert.throws(() => c.interets_composes(1000, -1, 5), RangeError);
  assert.throws(() => c.taille_position(10000, 1.5, 2), RangeError);
  assert.throws(() => c.levier(-1, 100), RangeError);
});

test('formatage français pour l\'affichage', () => {
  const s = c.formater(1628.894627, 2);
  assert.match(s, /^1\s?628,89$/u);
});
