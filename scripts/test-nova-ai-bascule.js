// Reproduit fidelement appelModeleAvecBascule() (api/analyze.js, LOT E,
// 2026-09-24) pour verifier la logique de bascule entre fournisseurs sans
// appel reseau reel : passe au fournisseur suivant sur tout echec (HTTP en
// erreur, reponse hors-schema, timeout), ne renvoie une erreur que si TOUS
// les fournisseurs fournis ont echoue.
async function appelModeleAvecBascule(dispo, { validerEtNormaliser, fetchMock }) {
  let derniereErreur = null;
  for (const [id, p] of dispo) {
    try {
      const r = await fetchMock(id, p);
      if (!r.ok) {
        derniereErreur = { type: 'fournisseur_en_erreur', provider: id, status: r.status };
        continue;
      }
      const parsedBrut = r.json();
      const parsed = validerEtNormaliser(parsedBrut);
      return { id, parsed };
    } catch (e) {
      derniereErreur = { type: 'reponse_illisible', provider: id, detail: e.message };
      continue;
    }
  }
  throw derniereErreur || { type: 'reponse_illisible', provider: null, detail: 'aucun_fournisseur' };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }
const validerToujoursOk = (brut) => brut;
const validerSchemaStrict = (brut) => {
  if (!brut || brut.verdict === undefined) throw new Error('schema_invalide');
  return brut;
};

(async () => {
  // Cas 1 : le premier fournisseur repond correctement -> jamais essaye un second.
  {
    let appeles = [];
    const r = await appelModeleAvecBascule([['xai', {}], ['openai', {}]], {
      validerEtNormaliser: validerToujoursOk,
      fetchMock: async (id) => { appeles.push(id); return { ok: true, json: () => ({ verdict: 'positif' }) }; },
    });
    check('1er fournisseur OK -> reponse directe', r.id === 'xai' && r.parsed.verdict === 'positif');
    check('1er fournisseur OK -> le 2e n\'est jamais appele', appeles.length === 1);
  }

  // Cas 2 : le premier echoue (HTTP en erreur), le second repond -> bascule reelle.
  {
    let appeles = [];
    const r = await appelModeleAvecBascule([['xai', {}], ['openai', {}]], {
      validerEtNormaliser: validerToujoursOk,
      fetchMock: async (id) => {
        appeles.push(id);
        if (id === 'xai') return { ok: false, status: 500 };
        return { ok: true, json: () => ({ verdict: 'neutre' }) };
      },
    });
    check('1er en erreur HTTP -> bascule vers le 2e', r.id === 'openai' && appeles.join(',') === 'xai,openai');
  }

  // Cas 3 : le premier renvoie un JSON hors-schema -> bascule aussi (pas seulement sur erreur reseau).
  {
    const r = await appelModeleAvecBascule([['xai', {}], ['anthropic', {}]], {
      validerEtNormaliser: validerSchemaStrict,
      fetchMock: async (id) => {
        if (id === 'xai') return { ok: true, json: () => ({ pasDeVerdict: true }) };
        return { ok: true, json: () => ({ verdict: 'insuffisant' }) };
      },
    });
    check('reponse hors-schema -> bascule aussi (pas seulement une erreur reseau)',
      r.id === 'anthropic' && r.parsed.verdict === 'insuffisant');
  }

  // Cas 4 : tous les fournisseurs echouent -> leve la DERNIERE erreur, jamais un succes invente.
  {
    try {
      await appelModeleAvecBascule([['xai', {}], ['openai', {}]], {
        validerEtNormaliser: validerToujoursOk,
        fetchMock: async (id) => ({ ok: false, status: id === 'xai' ? 500 : 503 }),
      });
      check('tous en echec -> doit lever une erreur', false);
    } catch (e) {
      check('tous en echec -> leve la derniere erreur (celle du dernier fournisseur essaye)',
        e.provider === 'openai' && e.status === 503);
    }
  }

  // Cas 5 : liste vide -> erreur immediate, jamais un appel fantome.
  {
    try {
      await appelModeleAvecBascule([], { validerEtNormaliser: validerToujoursOk, fetchMock: async () => ({ ok: true, json: () => ({}) }) });
      check('liste vide -> doit lever une erreur', false);
    } catch (e) {
      check('liste vide -> aucun_fournisseur', e.provider === null && e.detail === 'aucun_fournisseur');
    }
  }

  let allOk = true;
  for (const [name, ok] of results) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
    if (!ok) allOk = false;
  }
  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
