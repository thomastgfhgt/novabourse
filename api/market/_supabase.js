/**
 * api/market/_supabase.js — ACCÈS POSTGREST DÉDIÉ AU CATALOGUE MARCHÉ
 *
 * Module volontairement séparé de api/me.js : le catalogue marché n'a rien
 * à voir avec l'authentification/les quotas, et ne doit jamais dépendre de
 * ce fichier (ni l'inverse). Toujours la clé service_role — jamais la clé
 * anon — car ces tables n'ont aucune policy RLS (voir sql/*.sql).
 *
 * Utilisé à la fois par api/market/catalog.js (route Vercel) et par
 * scripts/lib/catalogImport.js (script CLI local) : mêmes variables
 * d'environnement, même comportement, qu'on soit exécuté par Vercel ou par
 * `node scripts/import-catalog.js` en local.
 */

const SB = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configure() {
  return Boolean(SB && SERVICE);
}

async function sb(path, init = {}) {
  if (!SB || !SERVICE) {
    throw new Error('supabase_non_configure');
  }

  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });

  if (!r.ok) {
    const error = new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    error.status = r.status;
    throw error;
  }

  if (r.status === 204) return [];

  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

module.exports = { sb, configure };
