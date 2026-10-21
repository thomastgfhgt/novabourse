/* ============================================================
   PAGES LÉGALES (2026-10-21)
   ============================================================
   Mentions légales, conditions générales d'utilisation et de vente,
   politique de confidentialité. Rédigées à partir de ce que le site fait
   RÉELLEMENT (prestataires, données, stockage local) — à faire valider par
   un professionnel du droit avant ouverture au public.

   Les informations d'identité de l'éditeur sont regroupées dans
   LEGAL_INFOS : tant qu'une valeur vaut null, la page affiche
   « à compléter ». */

const LEGAL_INFOS = {
  raisonSociale: null,        // ex. "NovaTitre SAS"
  formeJuridique: null,       // ex. "SAS au capital de 1 000 €"
  siren: null,                // ex. "123 456 789"
  rcs: null,                  // ex. "RCS Paris"
  siege: null,                // adresse du siège
  directeurPublication: null, // nom du directeur de la publication
  email: null,                // adresse de contact
  tva: null,                  // n° de TVA intracommunautaire (si applicable)
  dateMaj: '21 octobre 2026',
};
const legalVal = k => LEGAL_INFOS[k] ? esc(LEGAL_INFOS[k]) : '<em style="color:#ff8fd0">à compléter</em>';

const LEGAL_PAGES = {
  mentions: { titre: 'Mentions légales', corps: () => `
    <h3>Éditeur du site</h3>
    <p>${legalVal('raisonSociale')}, ${legalVal('formeJuridique')}<br>
      SIREN ${legalVal('siren')} · ${legalVal('rcs')}<br>
      Siège : ${legalVal('siege')}<br>
      TVA intracommunautaire : ${legalVal('tva')}<br>
      Contact : ${legalVal('email')}</p>
    <h3>Directeur de la publication</h3>
    <p>${legalVal('directeurPublication')}</p>
    <h3>Hébergement</h3>
    <p>Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis — vercel.com.<br>
      Base de données et authentification : Supabase Inc., 970 Toa Payoh North #07-04, Singapour — supabase.com.</p>
    <h3>Nature du service</h3>
    <p>NovaTitre est un service d'information et d'analyse financière à but pédagogique. NovaTitre ne fournit aucun conseil
      en investissement personnalisé, ne reçoit aucun ordre de bourse et ne détient aucun fonds de ses utilisateurs.
      Investir comporte un risque de perte en capital.</p>
    <h3>Propriété intellectuelle</h3>
    <p>Les textes, graphismes, logos et le code du site sont la propriété de l'éditeur, sauf mention contraire. Les logos
      d'entreprises et les données de marché appartiennent à leurs détenteurs respectifs.</p>` },

  cgu: { titre: "Conditions générales d'utilisation et de vente", corps: () => `
    <h3>1. Objet</h3>
    <p>Les présentes conditions régissent l'utilisation de NovaTitre (novatitre.com), édité par ${legalVal('raisonSociale')},
      et la souscription de ses offres payantes. Créer un compte ou utiliser le service vaut acceptation de ces conditions.</p>
    <h3>2. Le service</h3>
    <p>NovaTitre affiche des cours, des courbes, des données financières d'entreprises, un score de qualité (Nova Score) et
      des analyses produites avec l'aide de modèles d'intelligence artificielle (Nova AI, NovaBot, Nova Review, Nova News,
      Nova Event). Ces contenus sont fournis à titre d'information et de pédagogie.</p>
    <h3>3. Absence de conseil en investissement</h3>
    <p>Aucun contenu de NovaTitre ne constitue un conseil en investissement personnalisé, une recommandation d'achat ou de
      vente, ni une sollicitation. Les décisions d'investissement relèvent de la seule responsabilité de l'utilisateur.
      Investir comporte un risque de perte en capital ; les performances passées ne préjugent pas des performances futures.</p>
    <h3>4. Données de marché et intelligence artificielle</h3>
    <p>Les données de marché proviennent de fournisseurs tiers. Elles peuvent être différées (jusqu'à 15 minutes ou plus selon
      la place), incomplètes ou erronées ; l'âge de chaque cours est indiqué lorsqu'il est connu. Les textes générés par
      intelligence artificielle peuvent contenir des erreurs et doivent être vérifiés.</p>
    <h3>5. Compte</h3>
    <p>L'utilisateur crée un compte avec Google ou une adresse e-mail. Il est responsable de la confidentialité de ses accès
      et doit avoir au moins 18 ans. L'éditeur peut suspendre un compte en cas d'usage abusif ou frauduleux.</p>
    <h3>6. Offres et prix</h3>
    <p>L'offre Découverte est gratuite. Les offres Pro (9,99 € par mois) et Elite (19,99 € par mois) sont des abonnements
      mensuels TTC, payables par carte via Stripe, renouvelés automatiquement chaque mois jusqu'à résiliation. Le contenu de
      chaque offre est décrit sur la page Offres au moment de la souscription.</p>
    <h3>7. Résiliation</h3>
    <p>L'abonnement est résiliable à tout moment depuis Compte → Gérer mon abonnement. La résiliation prend effet à la fin de
      la période mensuelle en cours ; aucun prorata n'est remboursé pour la période entamée.</p>
    <h3>8. Droit de rétractation</h3>
    <p>Conformément à l'article L221-28 du Code de la consommation, l'utilisateur qui demande l'accès immédiat au service
      payant reconnaît que son exécution commence dès la souscription et renonce à son droit de rétractation de 14 jours pour
      la période en cours.</p>
    <h3>9. Responsabilité</h3>
    <p>L'éditeur s'efforce d'assurer la disponibilité et l'exactitude du service sans pouvoir les garantir. Sa responsabilité
      ne saurait être engagée pour une perte financière résultant d'une décision d'investissement de l'utilisateur.</p>
    <h3>10. Données personnelles</h3>
    <p>Voir la politique de confidentialité.</p>
    <h3>11. Droit applicable et litiges</h3>
    <p>Les présentes conditions sont soumises au droit français. En cas de litige, l'utilisateur consommateur peut recourir
      gratuitement à un médiateur de la consommation (${legalVal('mediateur')}) avant toute action judiciaire.</p>
    <h3>12. Contact</h3>
    <p>${legalVal('email')}</p>` },

  confidentialite: { titre: 'Politique de confidentialité', corps: () => `
    <h3>Responsable du traitement</h3>
    <p>${legalVal('raisonSociale')}, ${legalVal('siege')} — ${legalVal('email')}.</p>
    <h3>Données collectées et finalités</h3>
    <ul>
      <li><b>Compte</b> : adresse e-mail, nom et photo transmis par Google si vous l'utilisez — pour vous identifier (exécution du contrat).</li>
      <li><b>Abonnement</b> : offre, statut et identifiants de paiement Stripe — pour gérer votre abonnement. NovaTitre ne voit ni ne stocke vos numéros de carte.</li>
      <li><b>Conversations NovaBot et analyses Nova AI</b> : vos messages et les réponses, ainsi que le profil que vous indiquez à NovaBot (risque, horizon, budget, exclusions) — pour fournir le service et vous répondre de façon cohérente.</li>
      <li><b>Utilisation</b> : nombre d'analyses et de messages consommés — pour appliquer les limites de votre offre.</li>
      <li><b>Préférences locales</b> : liste de suivi, réglages, cache des cours et profil NovaBot sont enregistrés dans le stockage de votre navigateur.</li>
    </ul>
    <h3>Prestataires (sous-traitants)</h3>
    <ul>
      <li>Supabase — comptes et base de données.</li>
      <li>Vercel — hébergement du site (États-Unis).</li>
      <li>Google — connexion avec un compte Google.</li>
      <li>Stripe — paiement des abonnements.</li>
      <li>OpenAI, Anthropic et xAI — génération des analyses et des réponses de Nova (le contenu de vos messages et les données de marché utiles leur sont transmis ; États-Unis).</li>
      <li>Fournisseurs de données de marché (Yahoo Finance, Twelve Data, Finnhub, EODHD, CoinGecko, Eulerpool) — seuls des symboles boursiers leur sont envoyés, jamais vos données personnelles.</li>
      <li>Financial Modeling Prep (logos d'entreprises), Google Fonts (polices) et unpkg (bibliothèque de graphiques) — votre navigateur les contacte directement, ce qui leur transmet votre adresse IP.</li>
    </ul>
    <p>Certains prestataires sont situés hors de l'Union européenne ; les transferts reposent sur les clauses contractuelles
      types de la Commission européenne ou le cadre de protection des données UE–États-Unis.</p>
    <h3>Cookies et traceurs</h3>
    <p>NovaTitre n'utilise ni cookie publicitaire ni outil de mesure d'audience. Le stockage local du navigateur sert uniquement
      au fonctionnement du service (session de connexion, préférences) : il ne nécessite pas de consentement.</p>
    <h3>Durée de conservation</h3>
    <p>Les données du compte sont conservées tant que le compte est actif, puis supprimées dans un délai de 3 ans après la
      dernière activité. Les données de facturation sont conservées 10 ans (obligation comptable).</p>
    <h3>Vos droits</h3>
    <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
      données. Écrivez à ${legalVal('email')}. Vous pouvez aussi saisir la CNIL (cnil.fr). Pour effacer les données de ce
      navigateur : Compte → Effacer mes données locales.</p>
    <p style="margin-top:18px" class="tiny">Dernière mise à jour : ${esc(LEGAL_INFOS.dateMaj)}.</p>` },
};
LEGAL_INFOS.mediateur = null; // médiateur de la consommation (obligatoire pour la vente aux particuliers)

function legalHtml(id){
  const p = LEGAL_PAGES[id];
  if (!p) return '';
  return `<div class="legal-doc"><h1 class="title">${esc(p.titre)}</h1>${p.corps()}</div>`;
}

/* Pages de l'application (Compte → Aide et transparence). */
PAGES.mentions = () => `<button class="btn btn-g btn-sm" data-back>← Retour</button>${legalHtml('mentions')}`;
PAGES.cgu = () => `<button class="btn btn-g btn-sm" data-back>← Retour</button>${legalHtml('cgu')}`;
PAGES.confidentialite = () => `<button class="btn btn-g btn-sm" data-back>← Retour</button>${legalHtml('confidentialite')}`;

/* Écran de connexion : lisibles AVANT de créer un compte, dans un panneau. */
document.addEventListener('click', e => {
  const l = e.target.closest('[data-legal]');
  if (!l) return;
  e.preventDefault();
  openSheet(legalHtml(l.dataset.legal));
});
