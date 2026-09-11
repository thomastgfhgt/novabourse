/**
 * GET /api/config
 *
 * Retourne uniquement des valeurs publiques nécessaires au frontend.
 *
 * L'URL Supabase et la clé anon sont publiques par conception.
 * Leur sécurité repose sur les politiques RLS côté Supabase.
 *
 * Aucun secret serveur ne doit être exposé ici.
 */

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: 'methode_non_autorisee',
    });
  }

  const marketConnected = Boolean(
    process.env.EODHD_API_KEY
    || process.env.TWELVEDATA_API_KEY
    || process.env.MARKET_API_KEY
    || process.env.FINNHUB_API_KEY
  );

  const aiConnected = Boolean(
    process.env.OPENAI_API_KEY
    || process.env.ANTHROPIC_API_KEY
    || process.env.XAI_API_KEY
  );

  /*
   * Cette configuration est très légère.
   * no-store évite qu'un ancien état de configuration reste visible
   * après une modification des variables Vercel.
   */
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,

    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY || null,

    stripePublishableKey:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,

    marketConnected,

    aiConnected,

    annualBilling: false,
  });
};
