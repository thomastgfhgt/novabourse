const { BATCH, HISTORY, KEYS, idDe, ajusterPenceQuote } = require('./_providers.js');
const { lire, ecrire, avecVerrou } = require('./_cache.js');
const { freshnessCotation, FRESHNESS, SOURCE_URL_PROVIDER } = require('./_freshness.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { resolveOrdre, noterResultat } = require('./_router.js');
const { statutMarche } = require('./_marketHours.js');

/* CoinGecko en tête : gratuit, sans clé, et BATCH.coingecko exclut déjà
   lui-même tout ce qui n'est pas type==='crypto' (voir _providers.js) —
   l'inclure sans condition ici ne retire donc rien aux autres types.
   Frankfurter/Eulerpool en DERNIER (BATCH.frankfurter/BATCH.eulerpool
   excluent déjà eux-mêmes tout ce qui n'est pas leur type respectif) :
   qualité/couverture inférieures aux fournisseurs payants pour ce qu'ils
   couvrent déjà (voir leur documentation dans _providers.js), jamais un
   premier choix. */
const ORDRE = ['coingecko', 'twelvedata', 'eodhd', 'finnhub', 'frankfurter', 'eulerpool', 'eulerpool_fx'];
const MAX_SYMBOLES = 120;

/* CORRECTIF (audit routage multi-actifs — bug de production confirmé) :
   cette route ne connaissait AUCUN type d'instrument avant ce correctif —
   elle traitait chaque symbole comme une action, quel que soit son type
   réel. Conséquence directe et vérifiée en production : crypto/forex/
   index/commodity passaient TOUS par BATCH.eodhd avec un symbole construit
   pour les actions (ex. "BTC/USD.US"), qui échoue toujours (404), et par
   Finnhub avec un ticker que ce fournisseur ne reconnaît jamais dans ce
   format — les rendant ENTIÈREMENT dépendants de Twelve Data seul. Un
   simple HTTP 429 (quota) chez Twelve Data — confirmé en production le
   jour de cet audit — suffisait alors à rendre indisponible la classe
   d'actif entière, pas un symbole en particulier.
   Format accepté : "TICKER@EXCHANGE@TYPE" (EXCHANGE et TYPE optionnels).
   Rétrocompatible : un appelant existant qui n'envoie pas TYPE obtient
   'stock' par défaut, comportement inchangé pour toute action déjà
   fonctionnelle. */
const TYPES_CONNUS = new Set(['stock', 'etf', 'forex', 'crypto', 'index', 'commodity']);

function normaliserSymbole(raw) {
  if (typeof raw !== 'string') return null;
  const valeur = raw.trim();
  if (!valeur || valeur.length > 100) return null;
  const morceaux = valeur.split('@');
  if (morceaux.length > 3) return null;
  const ticker = String(morceaux[0] || '').trim().toUpperCase();
  const exchange = String(morceaux[1] || '').trim().toUpperCase();
  const typeBrut = String(morceaux[2] || '').trim().toLowerCase();
  /* CORRECTIF (audit multi-actifs) : troisième occurrence indépendante du
     même bug, déjà corrigé dans search.js et company.js — confirmé
     empiriquement ici aussi avant correction : normaliserSymbole('EUR/USD@')
     renvoyait null, donc parseSymboles() éliminait silencieusement TOUTES
     les paires Forex/Crypto avant même le premier appel réseau. C'est la
     cause exacte du "—" observé sur Marchés pour Forex/Crypto. Le "/" est
     ajouté au jeu de caractères autorisés, rien d'autre ne change. */
  if (!ticker || ticker.length > 30 || !/^[A-Z0-9._/-]+$/.test(ticker)) return null;
  if (exchange && (exchange.length > 40 || !/^[A-Z0-9 ._-]+$/.test(exchange))) return null;
  const type = TYPES_CONNUS.has(typeBrut) ? typeBrut : 'stock';
  return { ticker, exchange, type };
}

function parseSymboles(raw) {
  const valeurs = String(raw || '').split(',');
  const uniques = new Map();
  for (const valeur of valeurs) {
    const symbole = normaliserSymbole(valeur);
    if (!symbole) continue;
    uniques.set(idDe(symbole), symbole);
    if (uniques.size >= MAX_SYMBOLES) break;
  }
  return [...uniques.values()];
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const demandes = parseSymboles(req.query?.symbols);
  if (!demandes.length) return res.status(400).json({ error: 'symbols_manquant' });

  const keys = KEYS();
  if (!keys.twelvedata && !keys.eodhd && !keys.finnhub && !keys.coingecko && !keys.frankfurter && !keys.eulerpool) {
    return res.status(200).json({
      quotes: [], connected: false, source: null, sources: [], partial: true,
      missing: demandes.map(idDe), reason: 'aucun_fournisseur_configure', journal: [],
    });
  }

  const journal = [];
  const trouve = new Map();
  const aChercher = [];
  const fresh = req.query?.fresh === '1';

  if (fresh) {
    aChercher.push(...demandes);
  } else {
    for (const valeur of demandes) {
      const hit = lire('quote', valeur.ticker, valeur.exchange);
      if (hit) {
        /* Cache = valeur brute fournisseur (jamais convertie) : le
           correctif pence/LSE (voir _providers.js) s'applique à CHAQUE
           lecture, cache ou fraîche, jamais une seule fois à l'écriture —
           évite tout risque de double conversion. */
        trouve.set(idDe(valeur), {
          ...ajusterPenceQuote(valeur.ticker, valeur.exchange, hit.valeur), source: hit.source, cached: true,
          /* Fraîcheur recalculée depuis le fournisseur (pure fonction, pas
             besoin de la persister) ; retrievedAt = horodatage RÉEL de la
             récupération d'origine (hit.at), jamais l'instant du cache hit. */
          freshness: freshnessCotation(hit.source),
          sourceUrl: SOURCE_URL_PROVIDER[hit.source] || null,
          retrievedAt: new Date(hit.at).toISOString(),
          /* Indice contextuel additif (section 23) : "cette place est
             probablement en séance maintenant", jamais un remplacement de
             `freshness` ci-dessus qui reste la seule source de vérité sur
             la fraîcheur réelle de CETTE cotation précise. */
          marketStatus: statutMarche(valeur.exchange, valeur.type).status,
        });
      } else {
        aChercher.push(valeur);
      }
    }
  }

  let reste = [...aChercher];

  for (const nom of ORDRE) {
    if (!reste.length) break;
    if (!keys[nom]) {
      journal.push({ provider: nom, ok: false, reason: 'cle_absente' });
      continue;
    }
    const limite = Number(BATCH.limite?.[nom]);
    if (!Number.isFinite(limite) || limite <= 0) {
      journal.push({ provider: nom, ok: false, reason: 'limite_invalide' });
      continue;
    }
    const maxLots = nom === 'finnhub' ? 1 : Math.ceil(reste.length / limite);
    let numeroLot = 0;

    while (reste.length && numeroLot < maxLots) {
      numeroLot++;
      const lot = reste.slice(0, limite);
      if (!lot.length) break;

      try {
        /* Verrou anti-rafale (section "quotes : batch avant tout" du
           cahier des charges) : si une autre invocation demande EXACTEMENT
           le même lot pour le même fournisseur pendant que celui-ci est
           déjà en vol (ex. deux utilisateurs ouvrant Marchés au même
           instant, cache encore froid), une seule requête externe part
           réellement — la seconde attend et réutilise le résultat. Même
           mécanisme que _marketBlock.js (avecVerrou), appliqué ici au
           lot batch plutôt qu'à un bloc individuel. Clé = fournisseur +
           identifiants du lot triés (ordre stable, jamais dépendant de
           l'ordre d'arrivée des deux requêtes concurrentes). */
        const idsLotTries = lot.map(idDe).sort();
        const { value: map, followed } = await avecVerrou(
          'quoteBatch', [nom, ...idsLotTries], () => BATCH[nom](lot, keys[nom])
        );
        const idsLot = new Set(lot.map(idDe));
        const typeParId = new Map(lot.map(valeur => [idDe(valeur), valeur.type]));
        const auMoment = Date.now();
        if (followed) {
          journal.push({ provider: nom, lot: numeroLot, ok: true, demandes: lot.length, dedupe: true });
        }
        for (const [id, quote] of map) {
          if (!idsLot.has(id)) continue;
          trouve.set(id, {
            ...ajusterPenceQuote(quote.ticker, quote.exchange, quote), source: nom, cached: false,
            freshness: freshnessCotation(nom),
            sourceUrl: SOURCE_URL_PROVIDER[nom] || null,
            retrievedAt: new Date(auMoment).toISOString(),
            marketStatus: statutMarche(quote.exchange, typeParId.get(id)).status,
          });
          ecrire('quote', [quote.ticker, quote.exchange], quote, nom, auMoment);
        }
        const avant = reste.length;
        reste = reste.filter(valeur => !map.has(idDe(valeur)));
        const obtenus = avant - reste.length;
        journal.push({ provider: nom, lot: numeroLot, ok: true, demandes: lot.length, obtenus, restants: reste.length });

        if (obtenus === 0) break;

        const idsTestes = new Set(lot.map(idDe));
        const nonTestes = reste.filter(valeur => !idsTestes.has(idDe(valeur)));
        if (!nonTestes.length) break;
        const dejaTestes = reste.filter(valeur => idsTestes.has(idDe(valeur)));
        reste = [...nonTestes, ...dejaTestes];

      } catch (error) {
        journal.push({ provider: nom, lot: numeroLot, ok: false, demandes: lot.length, reason: error.status ? `HTTP ${error.status}` : error.message });
        break;
      }
    }
  }

  /* DERNIER REPLI : dernière clôture connue, dérivée de l'historique
     quotidien — jamais un cours "temps réel"/"différé" inventé.
     Diagnostiqué en production (voir rapport) : plusieurs indices
     régionaux (OSEBX, XU100, RTSI, TA35...) ont un historique quotidien
     EODHD réel et exploitable (/eod/ répond) mais aucune cotation
     instantanée chez aucun fournisseur branché (/real-time/ ne couvre pas
     ces places précises) — l'instrument n'est pas "indisponible", il n'a
     simplement pas de flux en direct chez nos fournisseurs actuels. Ne
     JAMAIS confondre "aucun fournisseur de cotation en direct" et "aucune
     donnée du tout" (cahier des charges, section 4).
     Fenêtre volontairement courte (5 jours calendaires) : on ne veut que
     les deux derniers points réels (clôture + clôture précédente, pour la
     variation) — jamais tout l'historique juste pour une "cotation".
     Freshness marquée END_OF_DAY, jamais DELAYED : ce n'est PAS un flux
     avec un délai de quelques minutes, c'est la clôture d'une séance déjà
     terminée, potentiellement plus ancienne — jamais présenté comme plus
     frais que ça. Pas de mise en cache directe sous 'quote' (qui
     recalculerait une fraîcheur DELAYED erronée depuis le seul nom du
     fournisseur au prochain cache hit) : le cache 'history'/'histp' de
     chargerBloc suffit à éviter les appels répétés. */
  if (reste.length) {
    for (const valeur of reste) {
      const ordreHistorique = resolveOrdre('history', valeur.ticker, valeur.exchange, valeur.type);
      if (!ordreHistorique.some(p => keys[p])) continue;

      let h;
      try {
        h = await chargerBloc({
          nom: 'history', table: HISTORY, ordre: ordreHistorique,
          args: [valeur.ticker, valeur.exchange, 5, valeur.type],
          ticker: valeur.ticker, exchange: valeur.exchange, frais: false, journal,
        });
      } catch {
        continue;
      }
      noterResultat('history', valeur.ticker, valeur.exchange, valeur.type, h.source);
      if (!historiqueValide(h.data)) continue;

      const dernier = h.data[h.data.length - 1];
      const precedent = h.data.length >= 2 ? h.data[h.data.length - 2] : null;
      const change = precedent ? dernier.close - precedent.close : null;
      const changePercent = (precedent && precedent.close) ? (change / precedent.close) * 100 : null;

      trouve.set(idDe(valeur), ajusterPenceQuote(valeur.ticker, valeur.exchange, {
        symbol: idDe(valeur),
        ticker: valeur.ticker,
        exchange: valeur.exchange,
        price: dernier.close,
        change,
        changePercent,
        currency: null,
        timestamp: new Date(dernier.date).toISOString(),
        source: h.source,
        cached: false,
        derivedFromHistory: true,
        freshness: FRESHNESS.END_OF_DAY,
        sourceUrl: SOURCE_URL_PROVIDER[h.source] || null,
        retrievedAt: h.retrievedAt || new Date().toISOString(),
        marketStatus: statutMarche(valeur.exchange, valeur.type).status,
      }));
      journal.push({ provider: h.source, ok: true, derivedFromHistory: true, ticker: valeur.ticker });
    }
  }

  const ids = demandes.map(idDe);
  const quotes = ids.filter(id => trouve.has(id)).map(id => trouve.get(id));
  const missing = ids.filter(id => !trouve.has(id));
  const sources = [...new Set(quotes.map(quote => quote.source).filter(Boolean))];

  /* Alimente la même mémoire de routage que company.js/history.js/
     fundamentals.js/news.js (voir _router.js) : un fournisseur qui vient
     de répondre ici pour un instrument précis sera essayé en premier la
     prochaine fois que CET instrument est demandé via les routes
     unitaires — même quand la découverte a eu lieu ici, en lot. */
  for (const valeur of demandes) {
    const trouvee = trouve.get(idDe(valeur));
    if (trouvee?.source) noterResultat('quote', valeur.ticker, valeur.exchange, valeur.type, trouvee.source);
  }

  return res.status(200).json({
    quotes,
    connected: quotes.length > 0,
    source: sources.length === 1 ? sources[0] : null,
    sources,
    partial: missing.length > 0,
    missing,
    journal,
  });
};

module.exports.parseSymboles = parseSymboles;
module.exports.normaliserSymbole = normaliserSymbole;
