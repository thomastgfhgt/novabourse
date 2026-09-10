/**
 * POST /api/analyze — analyse par modèle de langage.
 *
 * Quota appliqué côté serveur selon le plan.
 * Clés privées jamais exposées au navigateur.
 *
 * Le NovaScore est calculé exclusivement par le moteur NovaBourse.
 * Le modèle de langage peut l'expliquer, mais ne peut jamais le produire,
 * le modifier ou lui substituer une autre note.
 */

const { userFromToken, sb } = require('./me.js');

const {
  planReel,
  limiteDe,
  reserver,
  cloturer,
  quotaBlock,
} = require('./_limits.js');

const {
  novascore,
} = require('./market/_novascore.js');


/* ============================================================
   FOURNISSEURS IA
   ============================================================ */

/*
 * xAI est prioritaire actuellement.
 *
 * Les modèles restent configurables par variables d'environnement
 * afin de pouvoir les mettre à jour sans modifier le code.
 */
const PROVIDERS = {
  xai: {
    env: 'XAI_API_KEY',
    url: 'https://api.x.ai/v1/chat/completions',

    model: () =>
      process.env.XAI_MODEL
      || 'grok-4.6',

    auth: key => ({
      Authorization: `Bearer ${key}`,
    }),
  },

  openai: {
    env: 'OPENAI_API_KEY',
    url: 'https://api.openai.com/v1/chat/completions',

    model: () =>
      process.env.OPENAI_MODEL
      || 'gpt-4.1-mini',

    auth: key => ({
      Authorization: `Bearer ${key}`,
    }),
  },

  anthropic: {
    env: 'ANTHROPIC_API_KEY',
    url: 'https://api.anthropic.com/v1/messages',

    model: () =>
      process.env.ANTHROPIC_MODEL
      || 'claude-sonnet-4-5',

    auth: key => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
  },
};


/**
 * Fournisseurs réellement disponibles.
 */
const actif = () =>
  Object.entries(PROVIDERS)
    .filter(([, provider]) =>
      Boolean(process.env[provider.env])
    );


/* ============================================================
   CONSIGNE IA
   ============================================================ */

const CONSIGNE = `
Tu analyses une entreprise cotée uniquement à partir des données fournies.

Réponds en JSON strict avec exactement cette structure :

{
  "verdict": "positif|neutre|negatif|insuffisant",
  "uncertainty": "faible|moyenne|elevee",
  "summary": "...",
  "positive": ["..."],
  "negative": ["..."]
}

Règles absolues :

- N'invente aucun chiffre.
- Ne cite que les données réellement présentes dans le contexte.
- Une valeur null est indisponible.
- Ne remplace jamais une donnée absente par une estimation.
- Ne produis aucun objectif de cours.
- Ne produis aucune probabilité de réussite.
- Ne recommande jamais d'acheter ou de vendre.
- Ne produis aucune note, aucun score, aucun rating.
- Ne propose jamais ton propre NovaScore.
- Le NovaScore fourni dans le contexte est calculé par NovaBourse.
- Tu peux expliquer les facteurs qui semblent cohérents ou en tension avec lui.
- Si les données importantes sont insuffisantes, utilise le verdict "insuffisant".
`.trim();


/* ============================================================
   VERROU DE SORTIE IA
   ============================================================ */

/*
 * On n'essaie pas simplement d'interdire certains champs.
 *
 * On fait l'inverse :
 * seules cinq propriétés sont autorisées à sortir du modèle.
 *
 * Ainsi, même si le modèle renvoie :
 *
 * {
 *   "score": 95,
 *   "note": "88/100",
 *   "novascore": 77,
 *   "target": 400
 * }
 *
 * aucun de ces champs n'a de chemin vers analysis.
 */
const CHAMPS_AUTORISES = new Set([
  'verdict',
  'uncertainty',
  'summary',
  'positive',
  'negative',
]);


const VERDICTS = new Set([
  'positif',
  'neutre',
  'negatif',
  'insuffisant',
]);


const INCERTITUDES = new Set([
  'faible',
  'moyenne',
  'elevee',
]);


/*
 * Expressions numériques ressemblant explicitement à une note.
 *
 * On ne retire PAS tous les chiffres présents dans le texte :
 * le modèle reste autorisé à commenter un chiffre financier
 * réellement fourni dans son contexte.
 *
 * En revanche :
 *
 *   95/100
 *   score 95
 *   note : 88/100
 *   NovaScore = 77
 *
 * sont supprimés.
 */
const SCORE_SUR_100 =
  /\b\d{1,3}(?:[.,]\d+)?\s*\/\s*100\b/gi;

const SCORE_NOMME =
  /\b(?:nova\s*score|novascore|score|note|rating)\b\s*(?:[:=]|(?:est|de|à))?\s*\d{1,3}(?:[.,]\d+)?(?:\s*\/\s*100)?/gi;

const OBJECTIF_PROBA =
  /\b(?:target|objectif(?:\s+de\s+cours)?|probabilit[eé]|probability|confidence)\b\s*(?:[:=]|(?:est|de|à))?\s*\d+(?:[.,]\d+)?\s*%?/gi;


/**
 * Nettoyage d'un texte IA.
 */
function nettoyerTexte(value){
  if (typeof value !== 'string'){
    return '';
  }

  return value
    .replace(SCORE_NOMME, '')
    .replace(SCORE_SUR_100, '')
    .replace(OBJECTIF_PROBA, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}


/**
 * Nettoyage d'une liste de facteurs.
 */
function nettoyerListe(value){
  if (!Array.isArray(value)){
    return [];
  }

  return value
    .filter(v =>
      typeof v === 'string'
    )
    .map(nettoyerTexte)
    .filter(Boolean)
    .slice(0, 12);
}


/**
 * Construction explicite de l'analyse autorisée.
 *
 * Aucun autre champ du JSON produit par l'IA n'est conservé.
 */
function verrouillerAnalyse(parsed){
  const src =
    parsed
    && typeof parsed === 'object'
    && !Array.isArray(parsed)
      ? parsed
      : {};

  const retires =
    Object.keys(src)
      .filter(k =>
        !CHAMPS_AUTORISES.has(k)
      );

  let verdict =
    typeof src.verdict === 'string'
      ? src.verdict
          .trim()
          .toLowerCase()
      : '';

  if (!VERDICTS.has(verdict)){
    verdict = 'insuffisant';
  }

  let uncertainty =
    typeof src.uncertainty === 'string'
      ? src.uncertainty
          .trim()
          .toLowerCase()
      : '';

  if (!INCERTITUDES.has(uncertainty)){
    uncertainty = 'elevee';
  }

  const analysis = {
    verdict,

    uncertainty,

    summary:
      nettoyerTexte(
        src.summary
      ),

    positive:
      nettoyerListe(
        src.positive
      ),

    negative:
      nettoyerListe(
        src.negative
      ),
  };

  return {
    analysis,
    removedFields: retires,
  };
}


/* ============================================================
   HANDLER
   ============================================================ */

module.exports = async (req, res) => {

  /* ------------------------------------------------------------
     GET — état des modèles
     ------------------------------------------------------------ */

  if (req.method === 'GET'){
    return res.status(200).json({
      providers:
        Object.fromEntries(
          Object.entries(PROVIDERS)
            .map(([name, provider]) => [
              name,
              {
                configured:
                  Boolean(
                    process.env[
                      provider.env
                    ]
                  ),

                model:
                  typeof provider.model === 'function'
                    ? provider.model()
                    : provider.model,
              },
            ])
        ),

      active:
        actif()[0]?.[0]
        || null,
    });
  }


  if (req.method !== 'POST'){
    return res
      .status(405)
      .json({
        error:
          'methode_non_autorisee',
      });
  }


  /* ------------------------------------------------------------
     AUTHENTIFICATION
     ------------------------------------------------------------ */

  const user =
    await userFromToken(req);

  if (!user){
    return res
      .status(401)
      .json({
        error:
          'non_connecte',
      });
  }


  /* ------------------------------------------------------------
     FOURNISSEUR IA
     ------------------------------------------------------------ */

  const dispo =
    actif();

  if (!dispo.length){
    return res
      .status(503)
      .json({
        error:
          'aucun_modele_configure',

        message:
          "Aucune clé de modèle n'est configurée sur le serveur.",
      });
  }


  /* ============================================================
     PLAN RÉEL
     ============================================================ */

  /*
   * Le plan est lu dans Supabase.
   *
   * Un plan inconnu, absent ou inactif
   * retombe sur FREE dans _limits.js.
   */
  const {
    plan,
  } = await planReel(
    sb,
    user.id
  );


  /* ============================================================
     ENTREPRISE
     ============================================================ */

  const {
    ticker,
    exchange,
  } = req.body || {};


  if (!ticker){
    return res
      .status(400)
      .json({
        error:
          'entreprise_non_identifiee',
      });
  }


  /* ============================================================
     DOSSIER FINANCIER RÉEL
     ============================================================ */

  /*
   * Le navigateur ne transmet aucun chiffre financier.
   *
   * Le serveur reconstruit lui-même le dossier
   * à partir de la couche marché.
   */
  const proto =
    req.headers['x-forwarded-proto']
    || 'https';

  const host =
    req.headers.host;

  const base =
    `${proto}://${host}`;

  let dossier = null;


  try {
    const url =
      `${base}/api/market/company`
      + `?ticker=${encodeURIComponent(ticker)}`
      + (
        exchange
          ? `&exchange=${encodeURIComponent(exchange)}`
          : ''
      );

    const r =
      await fetch(url);

    dossier =
      await r.json();

  } catch (e){
    console.error(
      '[analyze] dossier :',
      e.message
    );
  }


  /*
   * Pas de cotation réelle :
   * aucune analyse IA n'est lancée.
   */
  if (
    !dossier
    || dossier.error
    || !dossier.market
  ){
    return res
      .status(424)
      .json({
        error:
          'donnees_indisponibles',

        message:
          "Les données financières de cette société n'ont pas pu être récupérées.",

        detail:
          dossier?.error
          || dossier?.missing
          || null,

        journal:
          dossier?.journal
          || null,
      });
  }


  /* ============================================================
     NOVASCORE
     ============================================================ */

  /*
   * Calcul déterministe côté serveur.
   *
   * L'objet nova est la SEULE source du NovaScore.
   */
  const nova =
    novascore(dossier);


  const company =
    dossier.identity?.name
    || ticker;


  /* ============================================================
     CONTEXTE TRANSMIS À L'IA
     ============================================================ */

  const context = {
    identite:
      dossier.identity,

    marche:
      dossier.market,

    fondamentaux:
      dossier.fundamentals,

    historique:
      dossier.history
        ? {
            seances:
              dossier.history.points,

            premier:
              dossier.history.ohlcv?.[0]
              || null,

            dernier:
              dossier.history.ohlcv?.[
                dossier.history.ohlcv.length - 1
              ]
              || null,

            clotures:
              Array.isArray(
                dossier.history.ohlcv
              )
                ? dossier.history.ohlcv
                    .slice(-60)
                    .map(x => x.close)
                : [],
          }
        : null,

    sources:
      dossier.sources,

    donneesManquantes:
      dossier.missing,

    /*
     * Le modèle voit le NovaScore officiel
     * uniquement pour pouvoir l'expliquer.
     */
    novaScore:
      nova.score,

    novaDetail:
      nova.score === null
        ? null
        : {
            couverture:
              nova.coverage,

            coherence:
              nova.coherence,

            confiance:
              nova.confidence,

            familles:
              Object.fromEntries(
                Object.entries(
                  nova.families
                )
                  .map(
                    ([, value]) => [
                      value.label,
                      value.score,
                    ]
                  )
              ),

            metriquesAbsentes:
              Object.values(
                nova.families
              )
                .flatMap(
                  value =>
                    value.missing
                    || []
                ),
          },
  };


  /* ============================================================
     PROMPT
     ============================================================ */

  const [
    id,
    provider,
  ] = dispo[0];


  const key =
    process.env[
      provider.env
    ];


  const modele =
    typeof provider.model === 'function'
      ? provider.model()
      : provider.model;


  const prompt =
`${CONSIGNE}

Entreprise : ${company} (${ticker})

Données disponibles :
${JSON.stringify(context, null, 1)}

Si une donnée n'apparaît pas ci-dessus ou vaut null, elle est INDISPONIBLE.
Ne la remplace jamais par une estimation.

Le NovaScore éventuellement présent dans le contexte est calculé par
NovaBourse. Tu peux expliquer les facteurs qui le soutiennent ou semblent
en tension avec lui, mais tu ne produis jamais une autre note et tu ne
modifies jamais le NovaScore.`;



  /* ============================================================
     RÉSERVATION ATOMIQUE DU QUOTA
     ============================================================ */

  /*
   * Postgres compte et insère dans la même transaction.
   *
   * Deux clics simultanés ne peuvent pas dépasser la limite.
   */
  const resa =
    await reserver(
      sb,
      user.id,
      plan
    );


  if (!resa.ok){

    if (
      resa.reason
      === 'quota_exceeded'
    ){
      const q =
        quotaBlock(
          plan,
          resa.used
          ?? limiteDe(plan)
        );

      return res
        .status(429)
        .json({
          error:
            'quota_exceeded',

          message:
            `Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`,

          ...q,
        });
    }


    if (
      resa.reason
      === 'rate_limited'
    ){
      return res
        .status(429)
        .json({
          error:
            'rate_limited',

          message:
            "Trop d'analyses lancées en peu de temps. Réessayez dans quelques minutes.",

          plan,
        });
    }


    console.error(
      '[analyze] réservation impossible :',
      resa.detail
      || resa.reason
    );


    return res
      .status(503)
      .json({
        error:
          'quota_indisponible',

        message:
          "Le compteur d'analyses est momentanément indisponible. Réessayez.",
      });
  }


  const reservation =
    resa.reservationId;


  /*
   * reserve_analysis renvoie déjà le nombre
   * incluant la réservation créée.
   *
   * Aucun +1 ici.
   */
  const utilise =
    resa.used;


  const annuler =
    statut =>
      cloturer(
        sb,
        reservation,
        statut
        || 'cancelled'
      );


  /* ============================================================
     APPEL IA
     ============================================================ */

  let parsed = null;
  let usage = null;


  try {
    const body = {
      model:
        modele,

      max_tokens:
        900,

      messages: [
        {
          role:
            'user',

          content:
            prompt,
        },
      ],
    };


    const ctrl =
      new AbortController();


    const timeout =
      setTimeout(
        () => ctrl.abort(),
        30000
      );


    let r;

    try {
      r =
        await fetch(
          provider.url,
          {
            method:
              'POST',

            signal:
              ctrl.signal,

            headers: {
              'Content-Type':
                'application/json',

              ...provider.auth(
                key
              ),
            },

            body:
              JSON.stringify(
                body
              ),
          }
        );
    } finally {
      clearTimeout(
        timeout
      );
    }


    let d;

    try {
      d =
        await r.json();
    } catch {
      await annuler(
        'cancelled'
      );

      return res
        .status(502)
        .json({
          error:
            'reponse_illisible',

          provider:
            id,

          detail:
            'json_invalide',
        });
    }


    if (!r.ok){
      console.error(
        '[analyze]',
        id,
        r.status,
        JSON.stringify(d)
          .slice(0, 300)
      );


      await annuler(
        'cancelled'
      );


      return res
        .status(502)
        .json({
          error:
            'fournisseur_en_erreur',

          provider:
            id,

          status:
            r.status,

          detail:
            d?.error?.message
            || d?.error
            || null,
        });
    }


    const brut =
      id === 'anthropic'
        ? (
            d.content?.[0]?.text
            || ''
          )
        : (
            d.choices?.[0]
              ?.message
              ?.content
            || ''
          );


    parsed =
      JSON.parse(
        brut
          .replace(
            /```json|```/gi,
            ''
          )
          .trim()
      );


    usage =
      d.usage
      || null;

  } catch (e){

    console.error(
      '[analyze]',
      id,
      e.message
    );


    await annuler(
      'cancelled'
    );


    return res
      .status(502)
      .json({
        error:
          e.name === 'AbortError'
            ? 'delai_depasse'
            : 'reponse_illisible',

        provider:
          id,

        detail:
          e.message,
      });
  }


  /* ============================================================
     VERROU FINAL IA
     ============================================================ */

  /*
   * À partir d'ici, on ne transmet PAS directement parsed.
   *
   * On reconstruit une analyse à partir
   * de la liste blanche de champs autorisés.
   */
  const {
    analysis,
    removedFields,
  } = verrouillerAnalyse(
    parsed
  );


  /* ============================================================
     CLÔTURE DU QUOTA
     ============================================================ */

  await cloturer(
    sb,
    reservation,
    'ok',
    {
      provider:
        id,

      model:
        modele,

      tokens_in:
        usage?.prompt_tokens
        ?? usage?.input_tokens
        ?? null,

      tokens_out:
        usage?.completion_tokens
        ?? usage?.output_tokens
        ?? null,
    }
  );


  /* ============================================================
     RÉPONSE
     ============================================================ */

  res.setHeader(
    'Cache-Control',
    'no-store'
  );


  return res
    .status(200)
    .json({

      /*
       * Vrai seulement si un fournisseur marché
       * a réellement produit au moins un bloc.
       */
      marketConnected:
        Boolean(
          dossier.sources
          && (
            dossier.sources.quote
            || dossier.sources.fundamentals
            || dossier.sources.history
          )
        ),


      sources:
        dossier.sources,

      asOf:
        dossier.asOf,

      missing:
        dossier.missing,

      identity:
        dossier.identity,

      market:
        dossier.market,


      /*
       * Analyse qualitative strictement verrouillée.
       */
      analysis,

      provider:
        id,

      model:
        modele,

      tokens:
        usage,


      /*
       * SEULE NOTE AFFICHABLE.
       *
       * Elle vient exclusivement
       * de _novascore.js.
       */
      novascore: {
        engine:
          nova.engine,

        score:
          nova.score,

        coverage:
          nova.coverage,

        coherence:
          nova.coherence,

        confidence:
          nova.confidence,

        comparable:
          nova.comparable
          ?? false,

        refused:
          nova.refused,

        families:
          Object.fromEntries(
            Object.entries(
              nova.families
            )
              .map(
                ([name, value]) => [
                  name,
                  {
                    label:
                      value.label,

                    score:
                      value.score,

                    /*
                     * Poids redistribué effectivement
                     * utilisé dans la note finale.
                     */
                    weight:
                      nova.weightsApplied?.[
                        name
                      ]
                      ?? 0,

                    /*
                     * Poids théorique maximum.
                     */
                    baseWeight:
                      value.baseWeight,

                    /*
                     * Poids réellement couvert
                     * avant redistribution.
                     */
                    coverageWeight:
                      value.coverageWeight,

                    missing:
                      value.missing,
                  },
                ]
              )
          ),

        computedAt:
          nova.computedAt,
      },


      /*
       * Diagnostic :
       * champs supplémentaires produits par l'IA
       * mais volontairement supprimés.
       */
      numericStripped:
        removedFields,


      quota:
        quotaBlock(
          plan,
          utilise
        ),
    });
};
