// Vérifie le filtre de préférence de prix ("recherche des actions à moins
// de X€", 2026-10-15) — NON contraignant (une préférence, jamais une hard
// rule) : filtré à la DÉCOUVERTE (js/core.js evaluerNovaBot(), api/market/
// extra.js handleNovabotCron), jamais dans novabotRiskCheck()/
// novabotRiskCheckServeur() qui restent strictement réservés aux hard
// rules. Copie fidèle des deux filtres (client + cron serveur — duplication
// déjà documentée et acceptée, voir _novabotEngine.js).

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- filtre côté client (evaluerNovaBot(), js/core.js) ---------- */
// toEUR réel fait une conversion de devise ; ces fixtures sont déjà en EUR, donc identité ici.
const toEUR = (prix) => prix;
function filtreClientPrixPreference(mandate, st, prix){
  const maxPriceEUR = Number(mandate.preferences?.find(p => p.type === 'max_price_eur')?.value);
  const prixPlafond = Number.isFinite(maxPriceEUR) ? maxPriceEUR : null;
  if (prixPlafond !== null && toEUR(prix, st.cur) > prixPlafond) return { filtre:true, motif:'prix' };
  return { filtre:false };
}

/* ---------- filtre côté cron serveur (handleNovabotCron, api/market/extra.js) ---------- */
function filtreCronPrixPreference(mandate, dossierPrix){
  const maxPriceEURPref = Number(mandate.preferences.find(p => p.type === 'max_price_eur')?.value);
  const prixPlafond = Number.isFinite(maxPriceEURPref) ? maxPriceEURPref : null;
  return prixPlafond !== null && dossierPrix > prixPlafond;
}

/* ---------- novabotRiskCheck : copie fidèle, AUCUNE logique de prix ici (régression) ---------- */
function novabotRiskCheck(intent, wallet, mandate){
  const violations = [];
  const secteurInterdit = mandate.hardRules.find(r => r.type === 'excluded_sector' && r.value === intent.sector);
  if (secteurInterdit) violations.push({ type:'secteur_interdit' });
  const actifInterdit = mandate.hardRules.find(r => r.type === 'excluded_asset' && r.value === intent.stockId);
  if (actifInterdit) violations.push({ type:'actif_interdit' });
  return { allowed: violations.length === 0, violations };
}

/* ---------- candidat au-dessus du plafond : écarté côté client ---------- */
{
  const mandate = { preferences:[{ type:'max_price_eur', value:'5' }] };
  const r = filtreClientPrixPreference(mandate, { cur:'EUR' }, 12.5);
  check('un candidat à 12,50€ est écarté par une préférence "max 5€" (client)', r.filtre === true);
}

/* ---------- candidat sous le plafond : jamais filtré ---------- */
{
  const mandate = { preferences:[{ type:'max_price_eur', value:'5' }] };
  const r = filtreClientPrixPreference(mandate, { cur:'EUR' }, 3.2);
  check('un candidat à 3,20€ passe la préférence "max 5€" (client)', r.filtre === false);
}

/* ---------- aucune préférence définie : ne filtre jamais rien ---------- */
{
  const mandate = { preferences:[] };
  const r = filtreClientPrixPreference(mandate, { cur:'EUR' }, 9999);
  check('sans préférence de prix définie, même un candidat très cher n\'est jamais filtré par ce mécanisme', r.filtre === false);
}

/* ---------- parité serveur (cron) : même comportement que le client ---------- */
{
  const mandate = { preferences:[{ type:'max_price_eur', value:'5' }] };
  check('RÉGRESSION DE PARITÉ : le cron écarte aussi un candidat à 12,50€ (même règle que le client)',
    filtreCronPrixPreference(mandate, 12.5) === true);
  check('RÉGRESSION DE PARITÉ : le cron laisse passer un candidat à 3,20€ (même règle que le client)',
    filtreCronPrixPreference(mandate, 3.2) === false);
}

/* ---------- GARDE-FOU : la préférence de prix n'apparaît JAMAIS dans novabotRiskCheck ---------- */
{
  const mandate = { hardRules:[], preferences:[{ type:'max_price_eur', value:'1' }] };
  const intent = { action:'buy', stockId:'AAPL', sector:'Technologie', amountEUR:100 };
  const wallet = { cash:1000, positions:[] };
  const verdict = novabotRiskCheck(intent, wallet, mandate);
  check('GARDE-FOU : une préférence de prix ne produit JAMAIS de violation dans le moteur de risque (réservé aux hard rules)',
    verdict.allowed === true && verdict.violations.length === 0);
}

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length){
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
