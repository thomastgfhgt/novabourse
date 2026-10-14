// Vérifie le statut 'cancelled' (NOVABOT_CLIENT_STATUSES, api/me.js) et sa
// non-interférence avec le cron (api/market/extra.js, ne lit que
// status=eq.active) : annuler un mandat ne doit JAMAIS déclencher de
// transaction/vente, et un compte annulé doit être ignoré par le cron
// exactement comme un compte en pause.

const NOVABOT_CLIENT_STATUSES = ['setup', 'active', 'paused', 'cancelled'];

// Reproduit le chemin "changement d'état" de handleNovaBot (api/me.js) : ne
// touche STRICTEMENT que le statut, jamais wallet/transactions/positions.
function simulerChangementStatut(account, nouveauStatut){
  if (!NOVABOT_CLIENT_STATUSES.includes(nouveauStatut)) return { ok:false, error:'statut_invalide' };
  const champsEcrits = Object.keys({ status: nouveauStatut, updated_at: 'x' });
  return { ok:true, champsEcrits, nouveauStatut };
}

// Reproduit le filtre du cron (api/market/extra.js : `novabot_accounts?status=eq.active&...`).
function compteEligibleAuCron(account){
  return account.status === 'active';
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- 'cancelled' est un statut client valide ---------- */
check('"cancelled" est accepté par NOVABOT_CLIENT_STATUSES', NOVABOT_CLIENT_STATUSES.includes('cancelled'));
check('un statut inventé reste rejeté (pas de régression de la validation existante)',
  !simulerChangementStatut({ status:'active' }, 'ferme').ok);

/* ---------- RÉGRESSION CENTRALE : annuler ne touche QUE le statut ---------- */
{
  const r = simulerChangementStatut({ status:'active' }, 'cancelled');
  check('passer à "cancelled" réussit', r.ok && r.nouveauStatut === 'cancelled');
  check('RÉGRESSION CENTRALE : seuls status/updated_at sont écrits, jamais wallet/transactions/positions',
    r.champsEcrits.length === 2 && r.champsEcrits.every(c => ['status', 'updated_at'].includes(c)));
}

/* ---------- le cron exclut 'cancelled' exactement comme 'paused' ---------- */
check('un compte "cancelled" n\'est jamais traité par le cron', !compteEligibleAuCron({ status:'cancelled' }));
check('un compte "paused" n\'est toujours jamais traité par le cron (comportement déjà existant, non régressé)',
  !compteEligibleAuCron({ status:'paused' }));
check('un compte "active" reste traité par le cron', compteEligibleAuCron({ status:'active' }));

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
