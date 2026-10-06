// Reproduit fidelement assurerIdentitesConnues() (js/core.js, correctif
// 2026-10-06 : byId ne contenait pas de facon fiable les ids
// watchlist/positions sur un chargement "froid") pour la verifier sans
// navigateur, avec un searchRemote()/ensureRuntimeStock() simules.

function remoteId(ticker, exchangeCode){
  const t = String(ticker || '').toUpperCase().trim();
  const e = String(exchangeCode || '').toUpperCase().trim();
  return e ? `${t}-${e}` : t;
}

function makeEnv(searchResults){
  const byId = {};
  const stocks = [];
  const runtimeCatalog = {};
  let searchCalls = 0;

  async function searchRemote(q){
    searchCalls++;
    const hits = searchResults[q] || [];
    return hits.map(x => ({ id: remoteId(x.ticker, x.exchangeCode), meta: x }));
  }
  function ensureRuntimeStock(meta){
    const id = remoteId(meta.ticker, meta.exchangeCode);
    if (byId[id]) return byId[id];
    const s = { id, name: meta.name || meta.ticker, ticker: meta.ticker };
    stocks.push(s);
    byId[id] = s;
    runtimeCatalog[id] = meta;
    return s;
  }

  const identitesConnuesEnCours = new Set();
  function assurerIdentitesConnues(state){
    const ids = new Set([...state.watchlist, ...state.wallet.positions.map(p => p.id)]);
    const manquants = [...ids].filter(id => id && !byId[id] && !identitesConnuesEnCours.has(id));
    if (!manquants.length) return null;
    manquants.forEach(id => identitesConnuesEnCours.add(id));
    return Promise.all(manquants.map(async (id) => {
      const ticker = String(id).split('-')[0];
      if (!ticker || ticker.length < 2) return false;
      try {
        const hits = await searchRemote(ticker);
        const hit = hits.find(h => h.id === id);
        if (hit){ ensureRuntimeStock(hit.meta); return true; }
      } catch {}
      return false;
    })).then(resultats => resultats.some(Boolean));
  }

  return { byId, stocks, runtimeCatalog, assurerIdentitesConnues, getSearchCalls: () => searchCalls };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

(async () => {
  // ---- id watchlist absent de byId -> resolu via searchRemote ----
  {
    const env = makeEnv({ AAPL: [{ ticker: 'AAPL', exchangeCode: 'NAS', name: 'Apple Inc' }] });
    const state = { watchlist: ['AAPL-NAS'], wallet: { positions: [] } };
    const changement = await env.assurerIdentitesConnues(state);
    check('id watchlist manquant -> résolu (changement=true)', changement === true);
    check('byId contient bien AAPL-NAS après résolution', !!env.byId['AAPL-NAS']);
    check('persisté dans runtimeCatalog (plus besoin de ré-essayer au prochain boot)', !!env.runtimeCatalog['AAPL-NAS']);
  }

  // ---- id position absent de byId -> resolu aussi ----
  {
    const env = makeEnv({ JPM: [{ ticker: 'JPM', exchangeCode: 'NYS', name: 'JPMorgan Chase & Co' }] });
    const state = { watchlist: [], wallet: { positions: [{ id: 'JPM-NYS', qty: 5 }] } };
    const changement = await env.assurerIdentitesConnues(state);
    check('id position manquant -> résolu', changement === true && !!env.byId['JPM-NYS']);
  }

  // ---- id deja dans byId -> aucun appel reseau ----
  {
    const env = makeEnv({});
    env.byId['AAPL-NAS'] = { id: 'AAPL-NAS', name: 'Apple Inc' };
    const state = { watchlist: ['AAPL-NAS'], wallet: { positions: [] } };
    const changement = await env.assurerIdentitesConnues(state);
    check('id déjà résolu -> aucun appel réseau, retourne null', changement === null && env.getSearchCalls() === 0);
  }

  // ---- aucun resultat de recherche ne matche l'id exact -> pas de faux positif ----
  {
    // searchRemote("AAPL") renvoie un résultat sur une AUTRE place (Toronto)
    // que celle réellement détenue (NASDAQ) : ne doit jamais matérialiser
    // un id différent de celui demandé.
    const env = makeEnv({ AAPL: [{ ticker: 'AAPL', exchangeCode: 'TO', name: 'Apple Inc (Toronto)' }] });
    const state = { watchlist: ['AAPL-NAS'], wallet: { positions: [] } };
    const changement = await env.assurerIdentitesConnues(state);
    check('aucun résultat avec l\'id EXACT demandé -> rien matérialisé (pas de faux positif)', changement === false && !env.byId['AAPL-NAS']);
  }

  // ---- watchlist + positions combinees, sans doublon d'appel ----
  {
    const env = makeEnv({ AAPL: [{ ticker: 'AAPL', exchangeCode: 'NAS', name: 'Apple Inc' }] });
    const state = { watchlist: ['AAPL-NAS'], wallet: { positions: [{ id: 'AAPL-NAS', qty: 1 }] } };
    await env.assurerIdentitesConnues(state);
    check('même id en watchlist ET en position -> un seul appel searchRemote (Set, pas de doublon)', env.getSearchCalls() === 1);
  }

  // ---- ticker trop court (<2 caracteres apres split) -> jamais recherche ----
  {
    const env = makeEnv({});
    const state = { watchlist: ['F-NYS'].map(id => id.split('-')[0].length < 2 ? id : id) , wallet: { positions: [] } };
    // Cas réel : un id dont la partie avant "-" fait 1 caractère (ticker "F").
    const state2 = { watchlist: ['F-NYS'], wallet: { positions: [] } };
    await env.assurerIdentitesConnues(state2);
    check('ticker à 1 caractère après split -> aucun appel réseau tenté', env.getSearchCalls() === 0);
  }

  // ---- aucun id manquant du tout -> retourne null immediatement ----
  {
    const env = makeEnv({});
    const state = { watchlist: [], wallet: { positions: [] } };
    const changement = await env.assurerIdentitesConnues(state);
    check('aucun id suivi/détenu -> retourne null, aucun appel', changement === null && env.getSearchCalls() === 0);
  }

  let allOk = true;
  for (const [name, ok] of results) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
    if (!ok) allOk = false;
  }
  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
