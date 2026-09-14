/**
 * DIAGNOSTIC TEMPORAIRE — à supprimer après usage, ainsi que la variable
 * Vercel SEARCH_DEBUG_SECRET une fois le test terminé.
 *
 * Objectif UNIQUE : voir la réponse BRUTE de chaque provider SEARCH pour
 * "Hermès", "Hermes", "RMS" — avant toute normalisation par _providers.js
 * ou search.js — afin de savoir factuellement :
 *   - quel provider produit HERM / HERMAO / HMI / HERMESC1
 *   - quel exchange brut accompagne HMI
 *   - si un provider renvoie RMS/RMS.PA
 *   - quels champs d'identité (ISIN, MIC...) existent réellement en sortie
 *
 * Ne modifie ni n'appelle _providers.js ni search.js — requêtes HTTP
 * directes et indépendantes, pour voir la réponse AVANT toute transformation.
 *
 * Protection : Authorization: Bearer <SEARCH_DEBUG_SECRET> UNIQUEMENT
 * (jamais de paramètre d'URL — même raison que pour le diagnostic SimFin :
 * un secret dans l'URL peut fuiter via historique/logs/referer).
 *
 * SIMFIN_API_KEY, EODHD_API_KEY, etc. ne sont jamais renvoyées ni logguées.
 */

async function appelBrut(url, headers){
  try {
    const r = await fetch(url, { headers: headers || {} });
    const texte = await r.text();
    let corps = null;
    try { corps = JSON.parse(texte); } catch { /* non-JSON */ }
    return { httpStatus: r.status, ok: r.ok, corps: corps ?? texte.slice(0, 1000) };
  } catch (e) {
    return { httpStatus: null, ok: false, erreurReseau: e.message };
  }
}

async function diagnostiquerProvider(provider, q, cle){
  if (!cle) return { skipped: true, raison: 'cle_absente' };

  if (provider === 'eodhd'){
    return appelBrut(`https://eodhd.com/api/search/${encodeURIComponent(q)}?api_token=${cle}&fmt=json&limit=20`);
  }
  if (provider === 'twelvedata'){
    return appelBrut(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=20&apikey=${cle}`);
  }
  if (provider === 'finnhub'){
    return appelBrut(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${cle}`);
  }
  return { skipped: true, raison: 'provider_inconnu' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET'){
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const secretAttendu = process.env.SEARCH_DEBUG_SECRET;
  if (!secretAttendu){
    return res.status(500).json({ error: 'SEARCH_DEBUG_SECRET absente de cet environnement' });
  }
  const enTeteAuth = req.headers['authorization'] || '';
  const secretFourni = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : null;
  if (secretFourni !== secretAttendu){
    return res.status(401).json({ error: 'secret_invalide_ou_absent' });
  }

  const cles = {
    eodhd: process.env.EODHD_API_KEY || null,
    twelvedata: process.env.TWELVEDATA_API_KEY || null,
    finnhub: process.env.FINNHUB_API_KEY || null,
  };

  const requetes = ['Hermès', 'Hermes', 'RMS'];
  const resultat = {};

  for (const q of requetes){
    resultat[q] = {
      eodhd: await diagnostiquerProvider('eodhd', q, cles.eodhd),
      twelvedata: await diagnostiquerProvider('twelvedata', q, cles.twelvedata),
      finnhub: await diagnostiquerProvider('finnhub', q, cles.finnhub),
    };
  }

  return res.status(200).json(resultat);
  // Aucune clé (`cles.*`) n'apparaît à aucun moment ci-dessus.
};
