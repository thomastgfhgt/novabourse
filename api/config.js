/**
 * GET /api/config
 *
 * Retourne uniquement des valeurs publiques nécessaires au frontend :
 * l'adresse Supabase et la clé « anon ». Elles sont publiques par
 * conception ; leur sécurité repose sur les politiques RLS côté Supabase.
 *
 * GET /api/config?format=js renvoie la même chose sous forme de script
 * (window.NT_SB = {...}), chargé par index.html AVANT le code du site :
 * la connexion est prête dès le démarrage, et ces valeurs restent dans
 * les variables Vercel, jamais dans le dépôt.
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

  /*
   * no-store évite qu'un ancien état de configuration reste visible
   * après une modification des variables Vercel.
   */
  res.setHeader('Cache-Control', 'no-store');

  const config = {
    supabaseUrl: process.env.SUPABASE_URL || null,

    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY || null,
  };

  if (req.query?.format === 'js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

    /* JSON.stringify protège contre toute valeur inattendue ; « < » est
       échappé pour ne jamais pouvoir fermer une balise. */
    const sur = JSON.stringify({ url: config.supabaseUrl, key: config.supabaseAnonKey })
      .replace(/</g, '\\u003c');

    return res.status(200).send(`window.NT_SB = ${sur};\n`);
  }

  return res.status(200).json(config);
};
