// Reproduit fidelement stocksSuivisPourEvenements()/evenementsSuivis()
// (js/nova.js, §34 du prompt maitre NovaTitre : calendrier resultats/
// dividendes des valeurs suivies/detenues, construit sur _nasdaqCalendar.js)
// pour les verifier sans navigateur.

function stocksSuivisPourEvenements(state, byId){
  const ids = new Set([...state.watchlist, ...state.wallet.positions.map(p => p.id)]);
  const out = [];
  for (const id of ids){
    const st = byId[id];
    if (st && st.type === 'stock') out.push(st);
  }
  return out;
}

function evenementsSuivis(state, byId, aujourdhui){
  const evts = [];
  for (const st of stocksSuivisPourEvenements(state, byId)){
    const f = st.fundamentals;
    if (!f) continue;
    if (f.nextEarningsDate && f.nextEarningsDate >= aujourdhui){
      evts.push({ stockId:st.id, label:st.name, ticker:st.ticker, type:'earnings',
        date:f.nextEarningsDate, estimated:Boolean(f.nextEarningsEstimated) });
    }
    if (f.exDividendDate && f.exDividendDate >= aujourdhui){
      evts.push({ stockId:st.id, label:st.name, ticker:st.ticker, type:'dividend',
        date:f.exDividendDate, paymentDate:f.nextDividendDate || null, amount:f.dividendPerShare ?? null });
    }
  }
  evts.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return evts;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }
const AUJOURDHUI = '2026-10-06';

// ---- filtre par type : seul 'stock' compte, jamais etf/index/crypto ----
{
  const byId = {
    'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL', fundamentals:null },
    'SPY-ARCA': { id:'SPY-ARCA', type:'etf', name:'SPDR S&P 500', ticker:'SPY', fundamentals:null },
  };
  const state = { watchlist:['AAPL-NAS','SPY-ARCA'], wallet:{ positions:[] } };
  const suivis = stocksSuivisPourEvenements(state, byId);
  check('seules les actions (type stock) sont retenues, jamais un ETF', suivis.length === 1 && suivis[0].id === 'AAPL-NAS');
}

// ---- aucun fundamentals chargé -> aucun evenement, jamais une date devinee ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL', fundamentals:null } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[] } };
  check('fundamentals pas encore chargé -> liste vide', evenementsSuivis(state, byId, AUJOURDHUI).length === 0);
}

// ---- resultats a venir : evenement cree, estimated toujours propage ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL',
    fundamentals:{ nextEarningsDate:'2026-10-29', nextEarningsEstimated:true, exDividendDate:null, nextDividendDate:null, dividendPerShare:null } } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[] } };
  const evts = evenementsSuivis(state, byId, AUJOURDHUI);
  check('résultats à venir -> 1 événement "earnings"', evts.length === 1 && evts[0].type === 'earnings' && evts[0].date === '2026-10-29');
  check('estimated propagé tel quel (source Nasdaq toujours algorithmique)', evts[0].estimated === true);
}

// ---- date de resultats PASSEE -> jamais affichee (agenda des PROCHAINS evenements) ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL',
    fundamentals:{ nextEarningsDate:'2026-01-01', nextEarningsEstimated:true, exDividendDate:null, nextDividendDate:null, dividendPerShare:null } } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[] } };
  check('date de résultats déjà passée -> aucun événement (jamais un historique)', evenementsSuivis(state, byId, AUJOURDHUI).length === 0);
}

// ---- dividende a venir : evenement cree avec montant + date de versement ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL',
    fundamentals:{ nextEarningsDate:null, exDividendDate:'2026-11-10', nextDividendDate:'2026-11-13', dividendPerShare:0.27 } } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[] } };
  const evts = evenementsSuivis(state, byId, AUJOURDHUI);
  check('dividende à venir -> 1 événement "dividend" avec montant + date de versement', evts.length === 1
    && evts[0].type === 'dividend' && evts[0].amount === 0.27 && evts[0].paymentDate === '2026-11-13');
}

// ---- les 2 evenements d'une meme valeur coexistent, tries chronologiquement ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL',
    fundamentals:{ nextEarningsDate:'2026-10-29', nextEarningsEstimated:true, exDividendDate:'2026-11-10', nextDividendDate:'2026-11-13', dividendPerShare:0.27 } } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[] } };
  const evts = evenementsSuivis(state, byId, AUJOURDHUI);
  check('résultats ET dividende coexistent pour la même valeur', evts.length === 2);
  check('triés du plus proche au plus lointain (résultats 10/29 avant dividende 11/10)', evts[0].date === '2026-10-29' && evts[1].date === '2026-11-10');
}

// ---- valeur hors couverture Nasdaq (ex. MC-PAR, Euronext) -> jamais d'evenement fabrique ----
{
  // fundamentals.js ne calcule le calendrier que pour 'stock' US-cotées ;
  // pour une valeur hors Nasdaq/NYSE/AMEX, _nasdaqCalendar.js renvoie déjà
  // null au niveau serveur -> stock.fundamentals peut rester sans ces
  // champs (null), jamais une date fabriquée côté client non plus.
  const byId = { 'MC-PAR': { id:'MC-PAR', type:'stock', name:'LVMH', ticker:'MC',
    fundamentals:{ pe:25, roe:0.3, nextEarningsDate:null, exDividendDate:null, nextDividendDate:null, dividendPerShare:null } } };
  const state = { watchlist:['MC-PAR'], wallet:{ positions:[] } };
  check('fundamentals chargés (PER/ROE) mais aucune date calendrier -> aucun événement', evenementsSuivis(state, byId, AUJOURDHUI).length === 0);
}

// ---- watchlist + positions combinees, sans doublon ----
{
  const byId = { 'AAPL-NAS': { id:'AAPL-NAS', type:'stock', name:'Apple Inc', ticker:'AAPL',
    fundamentals:{ nextEarningsDate:'2026-10-29', nextEarningsEstimated:true, exDividendDate:null, nextDividendDate:null, dividendPerShare:null } } };
  const state = { watchlist:['AAPL-NAS'], wallet:{ positions:[{ id:'AAPL-NAS', qty:1 }] } };
  check('même valeur en watchlist ET en position -> 1 seul événement, pas de doublon', evenementsSuivis(state, byId, AUJOURDHUI).length === 1);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
