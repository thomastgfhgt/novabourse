/* ============================================================
   NOVABOT — mémoire, règles et vrais chiffres (2026-10-21)
   ============================================================
   Retour utilisateur : NovaBot "ne respecte pas les règles", ses
   "réponses sont trop vagues" et "il ne se souvient pas".

   1. Mémoire : le profil que l'utilisateur énonce en conversation
      (risque, horizon, objectif, budget, exclusions, préférences) est
      retenu ici et renvoyé à CHAQUE message, dans toutes les conversations.
      Nova le traite comme une règle (voir CONSIGNE_NOVABOT_PEDAGOGIQUE,
      api/analyze.js). Stocké dans ce navigateur (localStorage).
   2. Vrais chiffres : les entreprises citées dans le message sont
      reconnues et leurs données RÉELLES (cours, variation, secteur, Nova
      Score, ratios) sont jointes à la requête — jamais générées par l'IA.
   Logique uniquement : aucun changement d'interface. */

const NOVABOT_PROFIL_CLE = 'novabot_profil_v1';

function novabotProfilLire(){
  try {
    const p = JSON.parse(localStorage.getItem(NOVABOT_PROFIL_CLE) || 'null');
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}
function novabotProfilEcrire(p){
  try { localStorage.setItem(NOVABOT_PROFIL_CLE, JSON.stringify(p)); } catch { /* navigation privée : mémoire de session seulement */ }
}

const NOVABOT_LIBELLES = {
  riskLevel: { low:'risque faible', moderate:'risque modéré', high:'risque élevé' },
  objective: { growth:'faire croître le capital', income:'générer des revenus', preserve:'préserver le capital' },
};

/* Fusionne ce que Nova a retenu (déjà validé côté serveur, validerProfil). */
function novabotProfilAppliquer(maj){
  if (!maj || typeof maj !== 'object') return;
  if (maj.effacer === true){
    novabotProfilEcrire({});
    toast('Nova a oublié ton profil.');
    return;
  }
  const p = novabotProfilLire();
  const retenu = [];
  if (maj.riskLevel && p.riskLevel !== maj.riskLevel){ p.riskLevel = maj.riskLevel; retenu.push(NOVABOT_LIBELLES.riskLevel[maj.riskLevel]); }
  if (maj.objective && p.objective !== maj.objective){ p.objective = maj.objective; retenu.push(NOVABOT_LIBELLES.objective[maj.objective]); }
  if (Number.isFinite(maj.horizonYears) && p.horizonYears !== maj.horizonYears){ p.horizonYears = maj.horizonYears; retenu.push(`horizon ${maj.horizonYears} an${maj.horizonYears > 1 ? 's' : ''}`); }
  if (Number.isFinite(maj.budgetEUR) && p.budgetEUR !== maj.budgetEUR){ p.budgetEUR = maj.budgetEUR; retenu.push(`budget ${fmt.eur(maj.budgetEUR)}`); }
  const ajouter = (cle, liste, libelle) => {
    if (!Array.isArray(liste)) return;
    const existants = Array.isArray(p[cle]) ? p[cle] : [];
    const vus = new Set(existants.map(x => (x.type + '|' + x.value).toLowerCase()));
    for (const x of liste){
      const k = (x.type + '|' + x.value).toLowerCase();
      if (vus.has(k)) continue;
      vus.add(k);
      existants.push({ type:x.type, value:x.value });
      retenu.push(libelle(x));
    }
    p[cle] = existants.slice(-20);
  };
  ajouter('hardRules', maj.hardRules, x => `jamais ${x.value}`);
  ajouter('preferences', maj.preferences, x => x.value);
  if (!retenu.length) return;
  novabotProfilEcrire(p);
  toast(`Nova a retenu : ${retenu.join(', ')}`);
}

/* ---------- entreprises citées dans le message ---------- */
const NOVABOT_MOTS_COURANTS = new Set(['ETF', 'PER', 'PEA', 'CTO', 'CAC', 'IA', 'AI', 'CEO', 'ROE', 'BPA', 'EPS', 'USA', 'US', 'UE', 'EU',
  'FR', 'OK', 'PME', 'TVA', 'BCE', 'FED', 'PIB', 'IPO', 'OPA', 'AMF', 'SA', 'SAS', 'NAV', 'CA', 'DCA', 'MSCI', 'SP', 'FX', 'EUR', 'USD']);
const NOVABOT_PLACES_PRIORITAIRES = ['NASDAQ', 'NYSE', 'PA', 'DE', 'L', 'AS', 'MI', 'SW', 'MC'];
function novabotRangValeur(s){
  if (state.watchlist.includes(s.id)) return 0;
  if (typeof V2_POPULAIRES === 'object' && [...V2_POPULAIRES.actions, ...V2_POPULAIRES.etf].includes(s.id)) return 1;
  const i = NOVABOT_PLACES_PRIORITAIRES.indexOf(String(s.exchangeCode || '').toUpperCase());
  return i >= 0 ? 2 + i : 50;
}
function novabotEntreprisesCitees(texte){
  const brut = String(texte || '');
  const bas = brut.toLowerCase();
  /* Vocabulaire financier courant : jamais pris pour un sigle boursier
     ("explique-moi un ETF" ne doit pas viser la valeur cotée "ETF"). */
  const sigles = new Set((brut.match(/\b[A-Z][A-Z0-9]{1,5}\b/g) || []).filter(m => !NOVABOT_MOTS_COURANTS.has(m)));
  const parCle = new Map();
  for (const s of stocks){
    if (!s || !s.ticker || !['stock', 'etf', 'crypto'].includes(s.type || 'stock')) continue;
    const base = String(s.ticker).split(/[-/]/)[0];
    let cle = null;
    if (sigles.has(base) && base.length >= 2) cle = 't:' + base;
    else {
      /* Sigle en tête de nom (LVMH, ASML…) : reconnu même si le ticker
         diffère (LVMH = MC à Paris). */
      const tete = String(s.name || '').split(/\s+/)[0];
      if (/^[A-Z]{3,6}$/.test(tete) && !NOVABOT_MOTS_COURANTS.has(tete) && sigles.has(tete)) cle = 't:' + tete;
    }
    if (!cle){
      const nom = v2nomCourt(s.name).toLowerCase();
      if (nom.length >= 4 && bas.includes(nom)){
        const i = bas.indexOf(nom), avant = bas[i - 1], apres = bas[i + nom.length];
        if (!(avant && /[a-zà-ÿ0-9]/.test(avant)) && !(apres && /[a-zà-ÿ0-9]/.test(apres))) cle = 'n:' + nom;
      }
    }
    if (!cle) continue;
    const deja = parCle.get(cle);
    if (!deja || novabotRangValeur(s) < novabotRangValeur(deja)) parCle.set(cle, s);
  }
  return [...new Set(parCle.values())].sort((a, b) => novabotRangValeur(a) - novabotRangValeur(b)).slice(0, 6);
}

const novabotArrondi = (v, d = 2) => Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
function novabotFicheDonnees(s){
  const q = QUOTES.get(s.id) || {};
  const f = s.fundamentals || null;
  const fiche = {
    ticker: s.ticker, nom: v2nomCourt(s.name), type: s.type || 'stock', secteur: s.sector || null,
    pays: s.country || null, devise: s.cur || null, place: s.market || s.exchangeCode || null,
    cours: novabotArrondi(q.price), variationJourPct: novabotArrondi(q.changePercent),
    fraicheurCours: q.freshness || null,
    novaScore: Number.isFinite(s.score) ? s.score : null,
  };
  if (f){
    Object.assign(fiche, {
      per: novabotArrondi(f.pe, 1),
      roePct: Number.isFinite(f.roe) ? novabotArrondi(f.roe * 100, 1) : null,
      margeNettePct: Number.isFinite(f.profitMargin) ? novabotArrondi(f.profitMargin * 100, 1) : null,
      capitalisationMd: novabotArrondi(capEnMilliards(f.marketCap, s.fundamentalsSource), 1),
      rendementDividendePct: novabotArrondi(f.dividendYield, 2),
      croissanceCAPct: novabotArrondi(croissanceSerie(f.revenueSeries), 1),
      plusHaut52s: novabotArrondi(f.week52High), plusBas52s: novabotArrondi(f.week52Low),
      beta: novabotArrondi(f.beta),
    });
  }
  for (const k of Object.keys(fiche)) if (fiche[k] === null || fiche[k] === undefined) delete fiche[k];
  return fiche;
}
const novabotAttendre = (promesse, ms) => Promise.race([promesse, new Promise(r => setTimeout(r, ms))]);

/* Données jointes à la requête NovaBot (mode pédagogique). Au plus 5 s
   d'attente pour récupérer cours et ratios réels ; ce qui n'est pas
   arrivé à temps est simplement absent (Nova le dira), jamais inventé. */
async function novabotEnrichissement(texte){
  const profil = novabotProfilLire();
  if (state.novabot.mandateConfirmed) return {};
  /* Le catalogue complet n'est chargé que si le message nomme
     probablement une entreprise absente du catalogue de démarrage. */
  let citees = novabotEntreprisesCitees(texte);
  if (!citees.length && /[A-Z][a-zà-ÿ]{3,}|\b[A-Z]{2,5}\b/.test(String(texte || '')) && typeof assurerCatalogueGlobal === 'function'){
    await novabotAttendre(Promise.resolve(assurerCatalogueGlobal()), 5000);
    citees = novabotEntreprisesCitees(texte);
  }
  const suivies = state.watchlist.map(id => byId[id]).filter(Boolean).slice(0, 20);
  const aCoter = [...citees, ...suivies].filter(s => !QUOTES.has(s.id));
  const aChiffrer = citees.filter(s => (s.type || 'stock') === 'stock' && s.fundamentalsStatus !== 'loaded').slice(0, 3);
  await novabotAttendre(Promise.all([
    aCoter.length ? chargerCotations(aCoter) : null,
    ...aChiffrer.map(s => chargerFondamentaux(s)),
  ].filter(Boolean)), 5000);
  return {
    profil,
    donneesMarche: citees.map(novabotFicheDonnees),
    listeSuivie: suivies.map(s => {
      const q = QUOTES.get(s.id) || {};
      return { ticker: s.ticker, nom: v2nomCourt(s.name), cours: novabotArrondi(q.price), variationJourPct: novabotArrondi(q.changePercent) };
    }),
  };
}
