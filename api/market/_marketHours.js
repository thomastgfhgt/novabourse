/**
 * api/market/_marketHours.js — STATUT DE SÉANCE PAR PLACE
 *
 * Répond à une question simple : "cette place est-elle probablement en
 * séance en ce moment ?" — jour ouvré + créneau horaire local de la place,
 * rien de plus.
 *
 * LIMITES ASSUMÉES ET DOCUMENTÉES (jamais présentées comme plus précises
 * qu'elles ne le sont, section 27 du cahier des charges — pas de fausse
 * précision) :
 *   - AUCUN calendrier de jours fériés par place. Un jour férié local est
 *     un jour où le marché est en réalité fermé mais où cette fonction
 *     répondra "closed" seulement grâce au fuseau horaire s'il tombe hors
 *     séance, ou pourrait répondre "open" à tort si l'horaire tombe dans
 *     la fenêtre normale. Un vrai calendrier par place (jours fériés
 *     locaux, séances écourtées) est un chantier à part entière, pas
 *     improvisé ici.
 *   - Horaires arrondis à la minute la plus proche connue publiquement
 *     pour chaque place, PAS vérifiés en direct contre un flux officiel.
 *   - N'a jamais valeur de remplacement pour `freshness`
 *     (api/market/_freshness.js), qui reste la SEULE source de vérité sur
 *     "cette cotation est-elle en direct/différée/clôture" — ce module
 *     n'ajoute qu'un indice contextuel supplémentaire ("la place est
 *     probablement ouverte en ce moment"), jamais une promesse de
 *     fraîcheur.
 *
 * Aucune dépendance ajoutée : Intl.DateTimeFormat (natif Node/V8) suffit
 * pour convertir une heure UTC vers le fuseau local de chaque place, y
 * compris le passage heure d'été/hiver.
 */

/**
 * `open`/`close` en HH:MM, heure LOCALE de la place. `days` = jours ISO
 * ouvrés (1 = lundi ... 5 = vendredi ; aucune place couverte ici n'ouvre
 * le week-end). Sources : horaires publics standards de chaque place,
 * arrondis — voir limites ci-dessus.
 */
const HORAIRES = {
  NASDAQ: { tz: 'America/New_York', open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] },
  NYSE: { tz: 'America/New_York', open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] },
  'NYSE ARCA': { tz: 'America/New_York', open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] },
  US: { tz: 'America/New_York', open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] },
  TO: { tz: 'America/Toronto', open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] },
  AU: { tz: 'Australia/Sydney', open: '10:00', close: '16:00', days: [1, 2, 3, 4, 5] },
  L: { tz: 'Europe/London', open: '08:00', close: '16:30', days: [1, 2, 3, 4, 5] },
  PA: { tz: 'Europe/Paris', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  AS: { tz: 'Europe/Amsterdam', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  BR: { tz: 'Europe/Brussels', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  LS: { tz: 'Europe/Lisbon', open: '08:00', close: '16:30', days: [1, 2, 3, 4, 5] },
  DE: { tz: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  MI: { tz: 'Europe/Rome', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  MC: { tz: 'Europe/Madrid', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  SW: { tz: 'Europe/Zurich', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  ST: { tz: 'Europe/Stockholm', open: '09:00', close: '17:30', days: [1, 2, 3, 4, 5] },
  CO: { tz: 'Europe/Copenhagen', open: '09:00', close: '17:00', days: [1, 2, 3, 4, 5] },
  HE: { tz: 'Europe/Helsinki', open: '10:00', close: '18:30', days: [1, 2, 3, 4, 5] },
  OL: { tz: 'Europe/Oslo', open: '09:00', close: '16:30', days: [1, 2, 3, 4, 5] },
};

/* Types sans "séance" au sens boursier classique : crypto (24/7), forex
   (quasi-continu hors week-end, pas modélisé ici faute de convention
   simple et fiable), indices/commodités (dérivés de plusieurs places,
   jamais une seule séance). `unknown` plutôt qu'un horaire deviné. */
const TYPES_SANS_SEANCE = new Set(['crypto', 'forex', 'index', 'commodity']);

/**
 * Décompose une date UTC en {annee, mois, jour, heure, minute, jourISO}
 * dans le fuseau `tz` donné, via Intl (aucune dépendance externe).
 */
function decomposerDansFuseau(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const JOURS_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    jourISO: JOURS_ISO[parts.weekday],
    heure: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function versMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * @param {string} exchangeCode - code canonique NovaBourse (voir SUFFIX
 *   dans _providers.js), ex. 'NASDAQ', 'PA', 'L'.
 * @param {string} type - assetType NovaBourse ('stock' par défaut).
 * @param {Date} [maintenant] - injectable pour les tests, défaut = now().
 * @returns {{status:'open'|'closed'|'unknown', localTime:string|null, timezone:string|null}}
 */
function statutMarche(exchangeCode, type = 'stock', maintenant = new Date()) {
  if (TYPES_SANS_SEANCE.has(type)) {
    return { status: 'unknown', localTime: null, timezone: null };
  }

  const horaire = HORAIRES[String(exchangeCode || '').toUpperCase()];
  if (!horaire) {
    return { status: 'unknown', localTime: null, timezone: null };
  }

  const { jourISO, heure, minute } = decomposerDansFuseau(maintenant, horaire.tz);
  const minutesCourantes = heure * 60 + minute;
  const localTime = `${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (!horaire.days.includes(jourISO)) {
    return { status: 'closed', localTime, timezone: horaire.tz };
  }

  const ouverture = versMinutes(horaire.open);
  const fermeture = versMinutes(horaire.close);
  const enSeance = minutesCourantes >= ouverture && minutesCourantes < fermeture;

  return { status: enSeance ? 'open' : 'closed', localTime, timezone: horaire.tz };
}

module.exports = { statutMarche, HORAIRES, decomposerDansFuseau };
