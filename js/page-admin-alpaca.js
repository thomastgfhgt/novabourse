/* ---------- STATUT ALPACA (admin, Phase 2/3) ----------
   Page de test de connexion (§2 de la mission "Alpaca Sandbox Trading") —
   visible dans l'UI pour quiconque (comme tout autre écran du Compte),
   mais la vraie protection est CÔTÉ SERVEUR (api/me.js, ?resource=alpaca :
   TRADING_ENABLED + TRADING_ADMIN_EMAILS) — un non-admin voit simplement
   "Accès refusé", jamais une donnée réelle. Rien n'est jamais inventé ici :
   l'état affiché est TOUJOURS la réponse serveur telle quelle.
   Repliée dans api/me.js plutôt que des fichiers api/admin/alpaca-*.js
   séparés : le plafond de 12 fonctions serverless (plan Hobby) était déjà
   atteint EXACTEMENT avant cet ajout (échec de déploiement réel). */
PAGES.alpacaStatus = () => `<div class="page-in">
  <p class="eyebrow">Admin</p>
  <h1 class="title">Statut Alpaca</h1>
  <p class="lead" style="margin-top:10px">Test de connexion au Broker API Sandbox — jamais d'argent réel.</p>
  <div class="card" style="margin-top:22px" id="alpacaStatusCard">
    <p class="small" style="color:var(--ink-4)">Vérification en cours…</p>
  </div>

  <h2 class="h2" style="margin-top:28px">Mon compte Sandbox</h2>
  <p class="lead" style="margin-top:6px">Badge obligatoire — <strong>simulation, argent fictif</strong>, jamais un vrai courtage.</p>
  <div class="card" style="margin-top:14px" id="alpacaAccountCard">
    <p class="small" style="color:var(--ink-4)">Chargement…</p>
  </div>
  ${typeof nbAlpacaBloc === 'function' ? nbAlpacaBloc() : ''}
</div>`;

/* Région renvoyée par le serveur (ALPACA_BROKER_REGION) — choisit le
   formulaire d'ouverture et le mode de financement (2026-10-16). */
let ALPACA_REGION = null;

async function chargerStatutAlpaca(){
  const carte = document.getElementById('alpacaStatusCard');
  if (carte){
    try {
      const r = await authFetch('/api/me?resource=alpaca&action=status');
      const data = await r.json();
      ALPACA_REGION = data.region || null;

      if (r.status === 403){
        carte.innerHTML = `<p class="small">Accès refusé — ce compte n'est pas administrateur.</p>`;
      } else if (data.status === 'disabled'){
        carte.innerHTML = `<p class="small">Fonctionnalité désactivée (TRADING_ENABLED=false).</p>`;
      } else if (data.status === 'connected'){
        carte.innerHTML = `
          <div class="kv"><dt>État</dt><dd style="color:var(--up)">Connecté</dd></div>
          <div class="kv"><dt>Région</dt><dd>${esc(String(data.region || '—'))}</dd></div>
          <div class="kv"><dt>Environnement</dt><dd>${esc(String(data.env || '—'))}</dd></div>
          <div class="kv"><dt>Latence</dt><dd>${esc(String(data.latencyMs ?? '—'))} ms</dd></div>
          <div class="kv"><dt>Permissions vérifiées</dt><dd>${esc((data.permissionsVerified || []).join(', ') || 'aucune')}</dd></div>`;
      } else {
        carte.innerHTML = `<p class="small">Connexion indisponible${data.message ? ` (${esc(String(data.message))})` : ''}.</p>`;
      }
    } catch {
      carte.innerHTML = `<p class="small">Connexion indisponible.</p>`;
    }
  }
  await chargerCompteAlpaca();
}

async function chargerCompteAlpaca(){
  const carte = document.getElementById('alpacaAccountCard');
  if (!carte) return;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=account');
    const data = await r.json();

    if (r.status === 403){
      carte.innerHTML = `<p class="small">Accès refusé.</p>`;
      return;
    }
    if (data.status === 'not_linked' && ALPACA_REGION === 'eu'){
      carte.innerHTML = alpacaFormulaireOuvertureEU();
      return;
    }
    if (data.status === 'not_linked'){
      carte.innerHTML = `
        <p class="small" style="margin-bottom:12px">Aucun compte lié. Deux options : lier le compte de test déjà créé, ou ouvrir un vrai compte Sandbox avec tes propres informations (simulation, aucune donnée réelle transmise à une banque).</p>
        <button class="btn btn-s btn-sm" data-alpaca-lier style="margin-bottom:18px">Lier le compte de test</button>
        ${alpacaFormulaireOuverture()}`;
      return;
    }
    if (data.status === 'linked'){
      carte.innerHTML = `
        <div class="kv"><dt>Numéro de compte</dt><dd>${esc(String(data.accountNumber || '—'))}</dd></div>
        <div class="kv"><dt>Statut</dt><dd>${esc(String(data.accountStatus || '—'))}</dd></div>
        <div class="kv"><dt>Pouvoir d'achat</dt><dd>${esc(String(data.buyingPower ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>
        <div class="kv"><dt>Liquidités</dt><dd>${esc(String(data.cash ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>
        <div class="kv"><dt>Valeur du portefeuille</dt><dd>${esc(String(data.portfolioValue ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>
        ${ALPACA_REGION === 'eu' ? '<div id="alpacaVirementEU" style="margin-top:16px"></div>' : ''}`;
      if (ALPACA_REGION === 'eu') chargerInstructionsVirementEU();
      return;
    }
    carte.innerHTML = `<p class="small">Indisponible${data.message ? ` (${esc(String(data.message))})` : ''}.</p>`;
  } catch {
    carte.innerHTML = `<p class="small">Indisponible.</p>`;
  }
}

function alpacaFormulaireOuverture(){
  return `<div style="margin-top:4px">
    <p class="small" style="font-weight:600;margin-bottom:10px">Ouvrir mon propre compte Sandbox</p>
    <p class="tiny" style="color:var(--ink-4);margin-bottom:14px">Ce Broker API Sandbox est américain : il demande un numéro fiscal au
      format américain (SSN), même pour une simulation. Invente un numéro fictif au format
      XXX-XX-XXXX (jamais une zone 000/666/900+, jamais une suite croissante) — jamais ton vrai numéro.</p>
    <input class="field" id="alpOpenGivenName" type="text" placeholder="Prénom" style="margin-bottom:10px">
    <input class="field" id="alpOpenFamilyName" type="text" placeholder="Nom" style="margin-bottom:10px">
    <input class="field" id="alpOpenDob" type="date" placeholder="Date de naissance" style="margin-bottom:10px">
    <input class="field" id="alpOpenTaxId" type="text" placeholder="Numéro fiscal fictif (XXX-XX-XXXX)" style="margin-bottom:10px">
    <input class="field" id="alpOpenEmail" type="email" placeholder="E-mail" style="margin-bottom:10px">
    <input class="field" id="alpOpenPhone" type="tel" placeholder="Téléphone (+33...)" style="margin-bottom:10px">
    <input class="field" id="alpOpenStreet" type="text" placeholder="Adresse (fictive acceptée)" style="margin-bottom:10px">
    <input class="field" id="alpOpenCity" type="text" placeholder="Ville" style="margin-bottom:10px">
    <input class="field" id="alpOpenState" type="text" placeholder="État américain (ex. CA)" maxlength="2" style="margin-bottom:10px">
    <input class="field" id="alpOpenPostalCode" type="text" placeholder="Code postal américain (ex. 94401)" maxlength="10" style="margin-bottom:14px">

    <p class="tiny" style="font-weight:600;margin-bottom:8px">Déclarations (réponds honnêtement — "Oui" entraîne une vérification manuelle par Alpaca)</p>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="checkbox" id="alpOpenControlPerson"> Je suis dirigeant/administrateur d'une société cotée
    </label>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="checkbox" id="alpOpenFinra"> Je travaille pour une bourse ou un organisme type FINRA
    </label>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="checkbox" id="alpOpenPep"> Je suis une personne politiquement exposée
    </label>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
      <input type="checkbox" id="alpOpenFamily"> Un membre de ma famille proche est politiquement exposé
    </label>

    <label class="small" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:14px">
      <input type="checkbox" id="alpOpenAccords" style="margin-top:3px">
      <span>J'ai lu et j'accepte les accords de compte, de marge et client Alpaca (Sandbox, simulation uniquement).</span>
    </label>

    <button class="btn btn-a btn-sm" data-alpaca-ouvrir>Ouvrir le compte</button>
    <p class="tiny" id="alpOpenErreur" style="color:var(--down);margin-top:10px"></p>
  </div>`;
}

/* ---------- Région EU (2026-10-16) : résident français ----------
   Champs exigés par api/_alpaca/eu.js (validerDonneesCompteEU) — la
   validation qui fait foi reste CÔTÉ SERVEUR, ce formulaire ne fait que
   collecter. Sandbox : aucune donnée transmise à une banque. */
function alpacaOptions(liste){
  return liste.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
}
function alpacaFormulaireOuvertureEU(){
  const champ = (id, type, ph, extra = '') => `<input class="field" id="${id}" type="${type}" placeholder="${esc(ph)}" style="margin-bottom:10px" ${extra}>`;
  const choix = (id, label, opts) => `<label class="tiny" for="${id}" style="display:block;margin-bottom:4px">${esc(label)}</label>
    <select class="field" id="${id}" style="margin-bottom:10px"><option value="">Choisir…</option>${alpacaOptions(opts)}</select>`;
  const coche = (id, txt) => `<label class="small" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px">
    <input type="checkbox" id="${id}" style="margin-top:3px"> <span>${esc(txt)}</span></label>`;
  return `<div style="margin-top:4px">
    <p class="small" style="font-weight:600;margin-bottom:10px">Ouvrir un compte Alpaca Europe (Sandbox)</p>
    <p class="tiny" style="color:var(--ink-4);margin-bottom:14px">Résident fiscal français. Sandbox : utilise des données de test,
      jamais ton vrai numéro fiscal.</p>
    ${champ('alpEuGivenName', 'text', 'Prénom')}
    ${champ('alpEuFamilyName', 'text', 'Nom')}
    ${champ('alpEuDob', 'date', 'Date de naissance')}
    ${choix('alpEuCitizenship', 'Nationalité', [['FRA', 'Française'], ['BEL', 'Belge'], ['CHE', 'Suisse'], ['DEU', 'Allemande'], ['ESP', 'Espagnole'], ['ITA', 'Italienne'], ['PRT', 'Portugaise']])}
    ${champ('alpEuTaxId', 'text', 'Numéro fiscal (13 chiffres)', 'inputmode="numeric"')}
    ${champ('alpEuEmail', 'email', 'E-mail')}
    ${champ('alpEuPhone', 'tel', 'Téléphone (+33...)')}
    ${champ('alpEuStreet', 'text', 'Adresse')}
    ${champ('alpEuPostalCode', 'text', 'Code postal', 'maxlength="5" inputmode="numeric"')}
    ${champ('alpEuCity', 'text', 'Ville')}
    ${choix('alpEuEmployment', 'Situation professionnelle', [['employed', 'Salarié(e) / indépendant(e)'], ['student', 'Étudiant(e)'], ['retired', 'Retraité(e)'], ['unemployed', 'Sans emploi']])}
    ${choix('alpEuFunding', 'Origine principale des fonds', [['employment_income', 'Revenus du travail'], ['savings', 'Épargne'], ['investments', 'Investissements'], ['inheritance', 'Héritage'], ['business_income', "Revenus d'entreprise"], ['family', 'Famille']])}

    <p class="tiny" style="font-weight:600;margin:6px 0 8px">Profil investisseur</p>
    ${choix('alpEuObjective', 'Objectif', [['growth', 'Faire croître mon capital'], ['balance_preserve_wealth_with_growth', 'Croissance prudente'], ['preserve_wealth', 'Préserver mon capital'], ['generate_income', 'Générer des revenus'], ['market_speculation', 'Spéculation']])}
    ${choix('alpEuHorizon', 'Horizon', [['less_than_1_year', "Moins d'1 an"], ['1_to_2_years', '1 à 2 ans'], ['3_to_5_years', '3 à 5 ans'], ['6_to_10_years', '6 à 10 ans'], ['more_than_10_years', 'Plus de 10 ans']])}
    ${choix('alpEuRisk', 'Tolérance au risque', [['conservative', 'Faible'], ['moderate', 'Modérée'], ['significant_risk', 'Élevée']])}
    ${choix('alpEuExperience', 'Expérience en actions', [['none', 'Aucune'], ['1_to_5_years', '1 à 5 ans'], ['over_5_years', 'Plus de 5 ans']])}

    <p class="tiny" style="font-weight:600;margin:6px 0 8px">Déclarations ("Oui" entraîne une vérification manuelle)</p>
    ${coche('alpEuControlPerson', "Je suis dirigeant/administrateur d'une société cotée")}
    ${coche('alpEuFinra', 'Je travaille pour une bourse ou un régulateur de marché')}
    ${coche('alpEuPep', 'Je suis une personne politiquement exposée')}
    ${coche('alpEuFamily', 'Un membre de ma famille proche est politiquement exposé')}
    <div style="height:8px"></div>
    ${coche('alpEuW8ben', 'Je certifie ne pas être une "US person" et signe le formulaire W-8BEN (retenue américaine sur dividendes réduite à 15 % au lieu de 30 %).')}
    ${coche('alpEuAccords', "J'ai lu et j'accepte les accords de compte et client Alpaca. Compte au comptant, sans effet de levier.")}

    <button class="btn btn-a btn-sm" style="margin-top:8px" data-alpaca-ouvrir>Ouvrir le compte</button>
    <p class="tiny" id="alpOpenErreur" style="color:var(--down);margin-top:10px"></p>
  </div>`;
}

function alpacaDonneesFormulaireEU(){
  const val = id => document.getElementById(id)?.value?.trim() || '';
  const coché = id => document.getElementById(id)?.checked === true;
  return {
    givenName: val('alpEuGivenName'),
    familyName: val('alpEuFamilyName'),
    dateOfBirth: val('alpEuDob'),
    countryOfCitizenship: val('alpEuCitizenship'),
    taxId: val('alpEuTaxId'),
    emailAddress: val('alpEuEmail'),
    phoneNumber: val('alpEuPhone').replace(/\s/g, ''),
    streetAddress: val('alpEuStreet'),
    postalCode: val('alpEuPostalCode'),
    city: val('alpEuCity'),
    country: 'FRA',
    employmentStatus: val('alpEuEmployment'),
    fundingSource: val('alpEuFunding') ? [val('alpEuFunding')] : [],
    investmentObjective: val('alpEuObjective'),
    investmentTimeHorizon: val('alpEuHorizon'),
    riskTolerance: val('alpEuRisk'),
    experienceStocks: val('alpEuExperience'),
    disclosures: {
      isControlPerson: coché('alpEuControlPerson'),
      isAffiliatedExchangeOrFinra: coché('alpEuFinra'),
      isPoliticallyExposed: coché('alpEuPep'),
      immediateFamilyExposed: coché('alpEuFamily'),
    },
    w8benCertifie: coché('alpEuW8ben'),
    accordsAcceptes: coché('alpEuAccords'),
  };
}

async function chargerInstructionsVirementEU(){
  const el = document.getElementById('alpacaVirementEU');
  if (!el) return;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=funding-instructions');
    const d = await r.json();
    if (d.status !== 'ok'){ el.innerHTML = ''; return; }
    el.innerHTML = `<p class="small" style="font-weight:600;margin-bottom:8px">Approvisionner le compte (virement EUR)</p>
      ${d.disponible ? `
        <div class="kv"><dt>Bénéficiaire</dt><dd>${esc(String(d.beneficiaire || '—'))}</dd></div>
        <div class="kv"><dt>IBAN</dt><dd class="tabular-nums">${esc(d.iban)}</dd></div>
        ${d.bic ? `<div class="kv"><dt>BIC</dt><dd>${esc(d.bic)}</dd></div>` : ''}`
      : `<p class="tiny" style="color:var(--ink-4);margin-bottom:8px">IBAN communiqué par Alpaca à l'activation du compte de production.</p>`}
      <div class="kv"><dt>Référence obligatoire</dt><dd class="tabular-nums">${esc(d.reference)}</dd></div>
      <p class="tiny" style="color:var(--ink-4);margin-top:8px">Sans cette référence exacte, le virement ne peut pas être crédité.</p>`;
  } catch {
    el.innerHTML = '';
  }
}

async function alpacaOuvrirCompte(){
  const val = id => document.getElementById(id)?.value?.trim() || '';
  const coché = id => document.getElementById(id)?.checked === true;
  const erreurEl = document.getElementById('alpOpenErreur');
  const bouton = document.querySelector('[data-alpaca-ouvrir]');

  const donnees = ALPACA_REGION === 'eu' ? alpacaDonneesFormulaireEU() : {
    givenName: val('alpOpenGivenName'),
    familyName: val('alpOpenFamilyName'),
    dateOfBirth: val('alpOpenDob'),
    taxId: val('alpOpenTaxId'),
    fundingSource: ['employment_income'],
    emailAddress: val('alpOpenEmail'),
    phoneNumber: val('alpOpenPhone'),
    streetAddress: val('alpOpenStreet'),
    city: val('alpOpenCity'),
    state: val('alpOpenState').toUpperCase(),
    postalCode: val('alpOpenPostalCode'),
    disclosures: {
      isControlPerson: coché('alpOpenControlPerson'),
      isAffiliatedExchangeOrFinra: coché('alpOpenFinra'),
      isPoliticallyExposed: coché('alpOpenPep'),
      immediateFamilyExposed: coché('alpOpenFamily'),
    },
    accordsAcceptes: coché('alpOpenAccords'),
  };

  if (bouton) bouton.disabled = true;
  if (erreurEl) erreurEl.textContent = '';
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=open-account', {
      method: 'POST',
      body: JSON.stringify(donnees),
    });
    const data = await r.json();

    if (data.status === 'opened'){
      toast('Compte Sandbox ouvert.');
      await chargerCompteAlpaca();
      return;
    }
    if (data.status === 'validation_error'){
      if (erreurEl) erreurEl.textContent = 'Formulaire incomplet ou invalide : ' + data.erreurs.join(', ');
    } else {
      const detail = data.alpacaBody?.message || data.message || data.status;
      if (erreurEl) erreurEl.textContent = "Alpaca a refusé l'ouverture : " + detail;
    }
    if (bouton) bouton.disabled = false;
  } catch {
    if (erreurEl) erreurEl.textContent = 'Ouverture impossible — réessaie.';
    if (bouton) bouton.disabled = false;
  }
}

async function alpacaLierCompteTest(){
  const bouton = document.querySelector('[data-alpaca-lier]');
  if (bouton) bouton.disabled = true;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=link', {
      method: 'POST',
      body: JSON.stringify({ alpacaAccountId: 'b272cbc1-71b4-41c8-9aa5-26d8a12efcad' }),
    });
    const data = await r.json();
    if (data.status !== 'linked'){
      toast('Liaison impossible : ' + (data.message || data.status || 'erreur inconnue'));
      if (bouton) bouton.disabled = false;
      return;
    }
    toast('Compte lié.');
    await chargerCompteAlpaca();
  } catch {
    toast('Liaison impossible.');
    if (bouton) bouton.disabled = false;
  }
}
