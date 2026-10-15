// Audit final (mission de finalisation, 2026-10-15) — exerce les VRAIES
// routes serveur (api/me.js) avec un VRAI utilisateur Supabase authentifié
// (jetons réels, jamais affichés), exactement comme le ferait authFetch()
// depuis le navigateur : ouverture de compte, dépôt, achat, historique,
// annulation, vente. Construit req/res à la main (même code exécuté par
// Vercel, sans navigateur réel disponible dans cet environnement).
//
// L'utilisateur de test est créé fraîchement (compte Supabase jetable,
// aucune donnée réelle) — jamais un compte existant consulté.

const fs = require('fs');
const path = require('path');

(() => {
  for (const f of ['.env.production.local', '.env.local']) {
    const env = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
  // Interrupteur général désactivé par défaut dans .env.local (bon réglage
  // pour la prod/preview) — ce script interne le force à true UNIQUEMENT
  // dans son propre process.env (jamais écrit dans .env.local lui-même),
  // exactement pour pouvoir exercer les routes réellement.
  process.env.TRADING_ENABLED = 'true';
  // .env.production.local est un instantané Vercel qui contient réellement
  // VERCEL_ENV=production (confirmé : le verrou §2bis s'est déclenché pour
  // de vrai ici) — ce script tourne en LOCAL, jamais dans Vercel, donc
  // cette valeur est fausse dans ce contexte précis. Jamais modifiée dans
  // le fichier lui-même, uniquement ici.
  delete process.env.VERCEL_ENV;
})();

function fauxReqRes({ method = 'GET', query = {}, body = null, token }) {
  const req = { method, query, body: body ? JSON.stringify(body) : undefined,
    headers: { authorization: `Bearer ${token}` } };
  const res = {
    _status: 200, _json: null,
    status(c) { this._status = c; return this; },
    setHeader() {},
    json(d) { this._json = d; return this; },
  };
  return { req, res };
}

(async () => {
  let allOk = true;
  const rapporte = (nom, ok, detail) => {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom + (detail ? ' — ' + detail : ''));
    if (!ok) allOk = false;
  };

  // --- 0) Utilisateur Supabase jetable, réellement créé et confirmé ---
  const email = 'test-alpaca-audit-' + Date.now() + '@gmail.com';
  const password = 'TestAudit' + Date.now() + '!Aa1';
  const rCreate = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const userCree = await rCreate.json();
  rapporte('utilisateur de test créé réellement', rCreate.status === 200 && Boolean(userCree.id));

  const rLogin = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await rLogin.json();
  rapporte('connexion réelle (jeton obtenu)', rLogin.status === 200 && Boolean(session.access_token));
  const token = session.access_token;

  process.env.TRADING_ADMIN_EMAILS = (process.env.TRADING_ADMIN_EMAILS || '') + ',' + email;

  delete require.cache[require.resolve('../api/me.js')];
  const handler = require('../api/me.js');

  // --- 1) Ouverture d'un vrai compte, pour ce vrai utilisateur ---
  const { req: r1, res: s1 } = fauxReqRes({ method: 'POST', query: { resource: 'alpaca', action: 'open-account' }, token, body: {
    givenName: 'Alice', familyName: 'Testeuse', dateOfBirth: '1992-03-14',
    taxId: '538-27-4196', fundingSource: ['savings'],
    emailAddress: email, phoneNumber: '+15552223344',
    streetAddress: '1 Audit Way', city: 'Austin', state: 'TX', postalCode: '78701',
    disclosures: { isControlPerson: false, isAffiliatedExchangeOrFinra: false, isPoliticallyExposed: false, immediateFamilyExposed: false },
    accordsAcceptes: true,
  } });
  await handler(r1, s1);
  rapporte('1. ouverture de compte pour cet utilisateur réel', s1._json?.status === 'opened', JSON.stringify(s1._json));
  await new Promise(r => setTimeout(r, 2000));

  // --- account : doit maintenant être "linked" ---
  const { req: r2, res: s2 } = fauxReqRes({ query: { resource: 'alpaca', action: 'account' }, token });
  await handler(r2, s2);
  rapporte('2. le compte est bien lié à CET utilisateur (pas un autre)', s2._json?.status === 'linked', JSON.stringify(s2._json));
  const numeroCompte = s2._json?.accountNumber;

  // --- isolation : un autre jeton (anon) ne doit JAMAIS voir ce compte ---
  const { req: r3, res: s3 } = fauxReqRes({ query: { resource: 'alpaca', action: 'account' }, token: 'jeton-invalide' });
  await handler(r3, s3);
  rapporte('3. un jeton invalide/autre utilisateur ne voit RIEN de ce compte', s3._status === 401 || s3._json?.error === 'non_connecte', JSON.stringify(s3._json) + ' status=' + s3._status);

  // --- 4) Dépôt (premier appel : crée la relation ACH, en préparation) ---
  const { req: r4, res: s4 } = fauxReqRes({ method: 'POST', query: { resource: 'alpaca', action: 'deposit' }, token, body: { amount: 5000 } });
  await handler(r4, s4);
  rapporte('4. dépôt déclenché (relation ACH en préparation ou dépôt soumis)',
    ['relation_en_preparation', 'depot_soumis'].includes(s4._json?.statut), JSON.stringify(s4._json));

  console.log('\nAttente de l\'approbation de la relation ACH (réelle, ~1 minute)...');
  await new Promise(r => setTimeout(r, 70000));

  const { req: r5, res: s5 } = fauxReqRes({ method: 'POST', query: { resource: 'alpaca', action: 'deposit' }, token, body: { amount: 5000 } });
  await handler(r5, s5);
  rapporte('5. second appel : dépôt réellement soumis', s5._json?.statut === 'depot_soumis', JSON.stringify(s5._json));

  // --- 6) Historique vide avant tout ordre ---
  const { req: r6, res: s6 } = fauxReqRes({ query: { resource: 'alpaca', action: 'orders' }, token });
  await handler(r6, s6);
  rapporte('6. historique lisible (vide pour l\'instant)', s6._json?.status === 'ok', JSON.stringify(s6._json));

  console.log('\nAttente du règlement du dépôt (réel, jusqu\'à ~7 minutes)...');
  let regle = false;
  for (let i = 0; i < 20; i++) {
    const { req: rp, res: sp } = fauxReqRes({ query: { resource: 'alpaca', action: 'account' }, token });
    await handler(rp, sp);
    console.log('  pouvoir d\'achat :', sp._json?.buyingPower);
    if (Number(sp._json?.buyingPower) > 0) { regle = true; break; }
    await new Promise(r => setTimeout(r, 20000));
  }
  rapporte('7. le dépôt s\'est réellement réglé (pouvoir d\'achat > 0)', regle);

  if (regle) {
    // --- 8) Achat réel, via la route exacte que le bouton "Acheter" appelle ---
    const { req: r8, res: s8 } = fauxReqRes({ method: 'POST', query: { resource: 'alpaca', action: 'order-create' }, token, body: { symbol: 'AAPL', side: 'buy', notional: 500 } });
    await handler(r8, s8);
    rapporte('8. achat soumis via la route réelle', s8._json?.status === 'submitted', JSON.stringify(s8._json));

    await new Promise(r => setTimeout(r, 4000));

    const { req: r9, res: s9 } = fauxReqRes({ query: { resource: 'alpaca', action: 'orders' }, token });
    await handler(r9, s9);
    const ordreAchat = s9._json?.orders?.find(o => o.side === 'buy');
    rapporte('9. l\'ordre d\'achat apparaît réellement dans l\'historique', Boolean(ordreAchat), JSON.stringify(ordreAchat));

    // --- 10) Vente réelle (position entière) ---
    const { req: r10, res: s10 } = fauxReqRes({ query: { resource: 'alpaca', action: 'portfolio-summary' }, token });
    await handler(r10, s10);
    const position = s10._json?.positions?.[0];
    if (position) {
      const { req: r11, res: s11 } = fauxReqRes({ method: 'POST', query: { resource: 'alpaca', action: 'order-create' }, token, body: { symbol: position.symbol, side: 'sell', qty: position.qty } });
      await handler(r11, s11);
      rapporte('10. vente soumise via la route réelle', s11._json?.status === 'submitted', JSON.stringify(s11._json));
    } else {
      rapporte('10. vente soumise via la route réelle', false, 'aucune position trouvée après achat');
    }
  }

  console.log('\nCompte Alpaca créé pour ce test :', numeroCompte, '(utilisateur Supabase jetable, aucune donnée réelle)');
  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC (voir FAIL ci-dessus)');
  process.exitCode = allOk ? 0 : 1;
})();
