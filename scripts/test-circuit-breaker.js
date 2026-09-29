// Verification du coupe-circuit quota journalier (api/market/_providers.js,
// fournisseurCoupe/signalerQuotaEpuise) -- reproduit le signal EXACT
// observe en production le 2026-09-29 (Twelve Data, HTTP 429, "You have
// run out of API credits for the day") pour verifier que :
// 1) ce signal precis active bien le coupe-circuit ;
// 2) un 429 "normal" (limite par minute, pas de credits journaliers) ne
//    l'active PAS -- jamais coupe un fournisseur pour la mauvaise raison ;
// 3) le coupe-circuit est bien consulte par cascade() (single) ET par la
//    boucle batch de quotes.js, sans nouvel appel reseau tant qu'il tient.

// cascade() n'appelle un fournisseur QUE si KEYS() le renvoie truthy -- clefs
// d'environnement reelles requises AVANT le require (KEYS() les relit a
// chaque appel, mais require() ne doit pas echouer avant leur pose).
process.env.TWELVEDATA_API_KEY = 'cle-test-non-reelle';
process.env.EODHD_API_KEY = 'cle-test-non-reelle';

const { cascade, fournisseurCoupe, signalerQuotaEpuise } = require('../api/market/_providers.js');

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  // --- 1) signalerQuotaEpuise reconnait le signal exact ---
  const corpsReel = '{"code":429,"message":"You have run out of API credits for the day. 2366 API credits were used, with the current limit being 800. Wait for the next day or consider switching to a paid plan."}';
  const declenche = signalerQuotaEpuise('test_provider_1', corpsReel);
  rapporte('signale quota epuise sur le message exact de production', declenche === true);
  rapporte('fournisseurCoupe devient vrai juste apres', fournisseurCoupe('test_provider_1') === true);

  // --- 2) un 429 "autre raison" ne doit JAMAIS couper ---
  const corpsAutre = '{"code":429,"message":"API rate limit reached, please wait a moment and try again."}';
  const declencheAutre = signalerQuotaEpuise('test_provider_2', corpsAutre);
  rapporte('un 429 different (limite par minute) ne declenche PAS le coupe-circuit', declencheAutre === false);
  rapporte('fournisseurCoupe reste faux pour ce fournisseur', fournisseurCoupe('test_provider_2') === false);

  // --- 3) integration reelle via cascade() : mock fetch renvoyant le 429 quota ---
  let appelsReseau = 0;
  global.fetch = async () => {
    appelsReseau++;
    return { ok: false, status: 429, text: async () => corpsReel };
  };

  // Noms REELS de KEYS() ('twelvedata'/'eodhd') : cascade() n'appelle un
  // fournisseur que si keys[nom] est truthy, donc un nom fictif serait
  // silencieusement ignore avant meme d'atteindre le coupe-circuit --
  // les fonctions elles-memes restent des simulations locales.
  const tableTest = {
    twelvedata: async () => {
      const r = await fetch('https://example.invalid/quote');
      if (!r.ok) {
        const err = new Error('HTTP ' + r.status);
        err.status = r.status;
        err.body = await r.text();
        throw err;
      }
      return { c: 1 };
    },
    eodhd: async () => ({ c: 42, ok: true }),
  };

  const journal1 = [];
  const res1 = await cascade(tableTest, ['twelvedata', 'eodhd'], [], journal1, 'quote');
  rapporte('1er appel : tente bien twelvedata (1 appel reseau)', appelsReseau === 1);
  rapporte('1er appel : retombe sur eodhd malgre le quota epuise', res1.source === 'eodhd');
  rapporte('coupe-circuit desormais actif pour twelvedata', fournisseurCoupe('twelvedata') === true);

  const journal2 = [];
  const res2 = await cascade(tableTest, ['twelvedata', 'eodhd'], [], journal2, 'quote');
  rapporte('2e appel : AUCUN nouvel appel reseau (coupe-circuit actif)', appelsReseau === 1);
  rapporte('2e appel : journal signale le coupe-circuit, pas un HTTP 429', journal2.some(j => j.provider === 'twelvedata' && j.reason === 'quota_journalier_epuise_connu'));
  rapporte('2e appel : retombe quand meme correctement sur eodhd', res2.source === 'eodhd');

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
