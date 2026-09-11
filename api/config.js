/**
 * GET /api/config — valeurs PUBLIQUES uniquement.
 * L'URL Supabase et la clé anon sont publiques par conception : elles sont
 * protégées par les politiques RLS. Aucun secret ne transite ici.
 */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    /* Trois fournisseurs peuvent servir le marché. Ne tester que Finnhub
       déclarait « non connecté » alors qu'EODHD ou Twelve Data répondait. */
    marketConnected: Boolean(process.env.EODHD_API_KEY
      || process.env.TWELVEDATA_API_KEY
      || process.env.MARKET_API_KEY
      || process.env.FINNHUB_API_KEY),
    aiConnected: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.XAI_API_KEY),
    annualBilling: false,
  });
};
