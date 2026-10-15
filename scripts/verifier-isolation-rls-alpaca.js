// Vérification RÉELLE (pas un test mocké) de l'isolation RLS sur les
// tables broker_* (§10 de la mission "Alpaca Sandbox Trading" :
// "Isolation entre deux utilisateurs (RLS + routes serveur)").
//
// broker_accounts/broker_orders/broker_sync_events/broker_errors ont RLS
// activée SANS AUCUNE policy (sql/2026-10-15_broker_accounts.sql) : par
// convention Postgres, cela refuse l'accès à tout rôle sauf service_role,
// quel que soit le jeton présenté (anon OU authenticated) — aucune policy
// ne peut donc jamais accorder par erreur un accès à la ligne d'un autre
// utilisateur. Ce script confirme ce comportement avec la clé anon
// réelle (clé publique, risque nul) contre la base de production —
// résultat attendu : tableau vide, jamais une vraie ligne.
//
// Usage : node scripts/verifier-isolation-rls-alpaca.js

const fs = require('fs');
const path = require('path');

(() => {
  const envPath = path.join(__dirname, '..', '.env.production.local');
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
})();

const TABLES = ['broker_accounts', 'broker_orders', 'broker_sync_events', 'broker_errors'];

(async () => {
  let allOk = true;
  for (const table of TABLES) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    });
    const data = await r.json().catch(() => null);
    const ok = r.status === 200 && Array.isArray(data) && data.length === 0;
    console.log((ok ? 'PASS' : 'FAIL') + ` - ${table} : clé anon ne voit aucune ligne (HTTP ${r.status}, ${JSON.stringify(data)})`);
    if (!ok) allOk = false;
  }
  console.log(allOk ? '\nTOUTES LES TABLES broker_* SONT ISOLÉES (clé anon)' : '\nECHEC — une table laisse passer la clé anon');
  process.exit(allOk ? 0 : 1);
})();
