/**
 * POST /api/analyze — analyse par modèle de langage.
 * Quota appliqué côté serveur selon le plan. Clés jamais exposées.
 * Règle inchangée : le modèle rend un verdict qualitatif et des facteurs en
 * texte. Aucun chiffre produit par lui n'est conservé.
 */
const { userFromToken, sb } = require('./me.js');
const { PLAN_LIMITS, planReel, limiteDe, consommation, reserver, cloturer, quotaBlock,
  limiteChatDe, reserverChat, cloturerChat, quotaChatBlock } = require('./_limits.js');
const { novascore } = require('./market/_novascore.js');
const { randomUUID } = require('crypto');

/* Ordre de priorité : xAI d'abord, c'est la couche qu'on valide en premier.
   Le modèle est configurable pour ne pas avoir à toucher au code. */
const PROVIDERS = {
  xai:       { env:'XAI_API_KEY',       url:'https://api.x.ai/v1/chat/completions',
               model: () => process.env.XAI_MODEL || 'grok-4.6',
               auth: k => ({ Authorization:`Bearer ${k}` }) },
  openai:    { env:'OPENAI_API_KEY',    url:'https://api.openai.com/v1/chat/completions',
               model: () => process.env.OPENAI_MODEL || 'gpt-4.1-mini',
               auth: k => ({ Authorization:`Bearer ${k}` }) },
  anthropic: { env:'ANTHROPIC_API_KEY', url:'https://api.anthropic.com/v1/messages',
               model: () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
               auth: k => ({ 'x-api-key':k, 'anthropic-version':'2023-06-01' }) },
};
const actif = () => Object.entries(PROVIDERS).filter(([, p]) => process.env[p.env]);

/* ORCHESTRATION PAR TÂCHE (LOT E, Étape 3, 2026-09-24 ; différenciée
   2026-10-05, §3 du prompt maître NovaTitre : "je ne veux PAS appeler
   systématiquement le modèle le plus puissant et le plus cher [...]
   question très simple : modèle rapide/économique"). Une seule identité
   "Nova AI" côté utilisateur, mais le fournisseur choisi EN INTERNE peut
   différer selon la nature de la tâche :
   - 'screener' : transforme une phrase en 4 champs structurés courts
     (voir CONSIGNE_SCREENER, maxTokens:300 plus bas) — exactement
     l'exemple "question très simple" du §3. gpt-4.1-mini (OpenAI) est
     EXPLICITEMENT le modèle économique/rapide par son propre nom ("mini")
     : placé en premier ici, sans avoir à deviner un classement de
     puissance entre fournisseurs.
   - 'analyse'/'novareview' : texte libre, analyse financière ou retour
     sur des décisions réelles — les deux cas "modèle plus puissant" du
     §3. Ordre INCHANGÉ (xAI d'abord) : c'était déjà un choix délibéré de
     déploiement ("c'est la couche qu'on valide en premier", voir plus
     bas), pas un oubli — rien dans ce repo ne permet de classer
     objectivement grok-4.6 contre claude-sonnet-4-5 en puissance, donc
     aucune des deux n'est réordonnée sans base solide pour le faire. */
const ORDRE_TACHES = {
  analyse: ['xai', 'openai', 'anthropic'],
  screener: ['openai', 'xai', 'anthropic'],
  novareview: ['xai', 'openai', 'anthropic'],
  /* 'novabot' (tranche C, refonte fonctionnelle, 2026-10-08) : même famille
     que novareview — raisonner sur des données réelles déjà vérifiées pour
     produire un jugement qualitatif, pas "une question très simple" —
     même ordre, mêmes modèles puissants d'abord. */
  novabot: ['xai', 'openai', 'anthropic'],
  'novabot-chat': ['xai', 'openai', 'anthropic'],
};
function dispoPourTache(tache){
  const configures = new Set(actif().map(([id]) => id));
  return (ORDRE_TACHES[tache] || Object.keys(PROVIDERS))
    .filter(id => configures.has(id))
    .map(id => [id, PROVIDERS[id]]);
}

/* BASCULE ENTRE FOURNISSEURS (LOT E, Étape 3, 2026-09-24) — même esprit que
   le cascade de fournisseurs de données de marché (api/market/_router.js) :
   essaie chaque fournisseur CONFIGURÉ dans l'ordre de PROVIDERS (xAI ->
   OpenAI -> Anthropic), passe au suivant sur tout échec (réseau, HTTP en
   erreur, réponse hors-schéma), ne renvoie une erreur que si TOUS les
   fournisseurs configurés ont échoué. Une seule identité "Nova" côté
   utilisateur : `provider`/`model` ne sont renvoyés que pour compte-rendu
   interne (quota, journal serveur), jamais affichés dans index.html.
   Un seul fournisseur (xAI) est configuré en production à ce jour : cette
   bascule ne joue donc pas encore en pratique, mais est prête sans aucun
   changement de code le jour où OPENAI_API_KEY/ANTHROPIC_API_KEY seront
   ajoutées — voir le blocage signalé pour ce lot. */
/* VERROU ANTI-HALLUCINATION EN TEXTE LIBRE — extrait (2026-09-26) du
   verrou déjà en place pour l'analyse d'entreprise (voir plus bas) pour
   être réutilisé tel quel par le mode novareview : construit l'ensemble
   des nombres RÉELLEMENT présents dans `contexte` (chaque valeur, plus
   sa forme ×100 pour couvrir un ratio cité en pourcentage, arrondie à
   0/1/2 décimales pour tolérer un arrondi du modèle), puis renvoie une
   fonction qui ne laisse passer, dans un texte donné, que les nombres
   correspondant à l'une de ces valeurs autorisées — un nombre qui ne
   correspond à rien de fourni est remplacé par un marqueur, jamais toute
   la phrase. Comportement et compromis assumé inchangés par ce
   déplacement — voir le commentaire original conservé plus bas où cette
   fonction est appelée pour l'analyse d'entreprise. */
/* CORRECTIF (audit 2026-10-13, bug réel rapporté : "Tu souhaites
   investir [donnée non vérifiée] [donnée non vérifiée]€...") — cause
   exacte : construireAssainisseur() ne connaît que les nombres déjà
   présents dans `contexte` (mandat confirmé, portefeuille, décisions —
   des données STRUCTURÉES déjà en base). Un montant que l'utilisateur
   vient de taper DANS SON MESSAGE ("j'aimerais investir 10000€") n'a
   jamais existé ailleurs : quand le modèle le reprend fidèlement pour
   confirmer qu'il a compris ("Tu souhaites investir 10 000€..."), le
   verrou anti-hallucination le traite comme un nombre halluciné et le
   redacte — alors qu'il vient MOT POUR MOT de l'utilisateur, jamais
   inventé par le modèle. Le mécanisme de sécurité reste légitime (un
   prix ou un score inventé doit toujours être bloqué) : ce correctif
   ÉLARGIT l'ensemble des nombres autorisés aux montants que
   l'utilisateur a RÉELLEMENT écrits dans la conversation, jamais aux
   nombres produits par le modèle lui-même (seuls les messages role=
   'user' sont scannés).

   Gère toutes les écritures listées dans le rapport : 10000, 10 000,
   10.000 (séparateur de milliers, convention FR), 10k, 1 500,50
   (décimale après la virgule). LIMITATION ASSUMÉE : un montant
   entièrement en toutes lettres ("dix mille euros") n'est PAS extrait
   ici — seules les écritures chiffrées le sont ; le modèle peut
   toujours comprendre et reformuler un montant en lettres, mais sa
   propre reformulation en CHIFFRES de ce montant pourrait alors être
   redactée. Volontairement permissif plutôt que de deviner UNE SEULE
   convention de séparateurs : plusieurs lectures plausibles d'un même
   nombre sont ajoutées à l'ensemble autorisé (impact nul — ce sont des
   nombres que l'utilisateur a réellement écrits, jamais une donnée
   inventée qu'on laisserait passer par erreur). */
function nombresDuTexteUtilisateur(messages){
  const nombres = new Set();
  const ajouter = n => { if (Number.isFinite(n)) nombres.add(Math.round(n * 100) / 100); };
  for (const m of messages){
    if (m.role !== 'user' || typeof m.content !== 'string') continue;
    for (const k of m.content.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/gi)){
      ajouter(Number(k[1].replace(',', '.')) * 1000);
    }
    for (const bloc of m.content.matchAll(/\d[\d .,]*\d|\d/g)){
      const brut = bloc[0];
      ajouter(Number(brut.replace(/[ .,]/g, ''))); // tous séparateurs ignorés -> entier (10 000 -> 10000)
      const finDecimale = brut.match(/^(.*)[,.](\d{1,2})$/); // dernier séparateur = décimale (1 500,50 -> 1500.50)
      if (finDecimale) ajouter(Number(finDecimale[1].replace(/[ .,]/g, '') + '.' + finDecimale[2]));
    }
  }
  return [...nombres];
}

function construireAssainisseur(contexte){
  function nombresAutorises(valeur, acc){
    if (typeof valeur === 'number' && Number.isFinite(valeur)){
      for (const v of [valeur, valeur * 100]){
        for (const d of [0, 1, 2]) acc.add(v.toFixed(d));
      }
    } else if (Array.isArray(valeur)){
      valeur.forEach(v => nombresAutorises(v, acc));
    } else if (valeur && typeof valeur === 'object'){
      Object.values(valeur).forEach(v => nombresAutorises(v, acc));
    }
    return acc;
  }
  const autorises = nombresAutorises(contexte, new Set());
  const compteur = { retires: 0 };
  /* CORRECTIF (audit 2026-10-13) — deuxième cause du même bug rapporté
     ("[donnée non vérifiée] [donnée non vérifiée]€", DEUX marqueurs
     consécutifs) : l'ancienne regex /-?\d+(?:[.,]\d+)?/g ne reconnaît
     qu'UN SEUL groupe de chiffres par jeton — "10 000" (convention
     française usuelle pour le séparateur de milliers, que le modèle
     reproduit naturellement) était donc scanné comme DEUX jetons
     distincts ("10" puis "000"), chacun vérifié ISOLÉMENT contre
     l'ensemble autorisé (qui ne contient que "10000", jamais "10" ni
     "000" seuls) — DEUX échecs, DEUX marqueurs, exactement le symptôme
     rapporté. Touche tous les appelants de construireAssainisseur()
     (analyse d'entreprise, novareview, novabot), pas seulement le chat :
     même correctif pour tous, même mécanisme.
     Nouvelle regex : tente d'abord un nombre à groupes de milliers
     (espace OU point, 3 chiffres par groupe, virgule décimale optionnelle
     à la fin) AVANT de retomber sur un nombre simple — "10 000", "10.000"
     et "1 500,50" deviennent chacun UN SEUL jeton.

     TROISIÈME CAUSE (audit 2026-10-14, même bug encore rapporté, cette
     fois "autour de 10[donnée non vérifiée] %", SANS espace avant le
     marqueur) : un INTERVALLE ("10-15 %", le modèle résumant plusieurs
     poids de portefeuille proches plutôt qu'un chiffre exact) était lu
     comme "10" PUIS "-15" (le tiret pris pour un signe moins) — "10"
     correspondait à un poids réel et passait, "-15" (négatif, alors que
     tous les poids réels sont positifs) ne correspondait jamais à rien
     et était redacté, collé contre le "10" puisque le tiret séparateur,
     lui, n'est jamais remplacé. (?<!\d) AVANT le signe optionnel :
     un tiret immédiatement précédé d'un chiffre (fin du premier nombre
     d'un intervalle) n'est plus jamais interprété comme un signe moins —
     un tiret précédé d'un espace/début de texte (ex. "-5,2 %", une vraie
     perte) continue d'être reconnu comme négatif normalement. */
  function assainirTexte(texte){
    if (typeof texte !== 'string') return texte;
    return texte.replace(/(?<!\d)-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?|(?<!\d)-?\d+(?:[.,]\d+)?/g, jeton => {
      // Un jeton à groupes de milliers n'a de sens QUE si chaque groupe fait
      // exactement 3 chiffres (déjà garanti par la regex) : on retire les
      // séparateurs de milliers (espace/point) et on normalise la virgule
      // décimale finale, jamais l'inverse (un simple "1.5" reste 1.5, pas 15).
      const normalise = /^-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?$/.test(jeton)
        ? jeton.replace(/[ .]/g, '').replace(',', '.')
        : jeton.replace(',', '.');
      const n = Number(normalise);
      if (!Number.isFinite(n)) return jeton;
      for (const d of [0, 1, 2]) {
        if (autorises.has(n.toFixed(d))) return jeton;
      }
      compteur.retires++;
      return '[donnée non vérifiée]';
    });
  }
  return { assainirTexte, compteur };
}

async function appelModeleAvecBascule(dispo, { prompt, maxTokens, timeoutMs, validerEtNormaliser }){
  let derniereErreur = null;
  for (const [id, p] of dispo){
    const key = process.env[p.env];
    const modele = typeof p.model === 'function' ? p.model() : p.model;
    try {
      const body = { model: modele, max_tokens: maxTokens, messages: [{ role:'user', content: prompt }] };
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(p.url, { method:'POST', signal: ctrl.signal,
        headers: { 'Content-Type':'application/json', ...p.auth(key) }, body: JSON.stringify(body) });
      clearTimeout(t);
      const d = await r.json();
      if (!r.ok){
        console.error('[analyze]', id, r.status, JSON.stringify(d).slice(0, 300));
        derniereErreur = { type:'fournisseur_en_erreur', provider:id, status:r.status,
          detail: d?.error?.message || d?.error || null };
        continue;
      }
      const brut = id === 'anthropic' ? (d.content?.[0]?.text || '') : (d.choices?.[0]?.message?.content || '');
      const parsedBrut = JSON.parse(brut.replace(/```json|```/g, '').trim());
      const parsed = validerEtNormaliser(parsedBrut);   // lève si hors-schéma
      return { id, modele, parsed, usage: d.usage || null };
    } catch (e){
      console.error('[analyze]', id, e.message);
      derniereErreur = { type: e.name === 'AbortError' ? 'delai_depasse' : 'reponse_illisible',
        provider:id, detail: e.message };
      continue;
    }
  }
  throw derniereErreur || { type:'reponse_illisible', provider:null, detail:'aucun_fournisseur' };
}

/* DOIT RESTER IDENTIQUE à la liste SECTORS d'index.html (recherche "const
   SECTORS =") : sert à valider qu'un secteur renvoyé par le modèle pour le
   screener (voir screenerAnalyse ci-dessous) correspond à une valeur RÉELLE
   du filtre existant, jamais une catégorie inventée que le frontend ne
   saurait pas appliquer. */
const SECTORS = ['Technologie','Finance','Santé','Industrie','Énergie','Consommation',
  'Automobile','Luxe','Télécommunications','Matériaux','Immobilier','Services publics'];

const CONSIGNE_SCREENER = `Tu transformes une recherche en langage naturel en filtres
structurés pour un écran de sélection d'entreprises. Réponds en JSON strict :
{"sector":"tous|${SECTORS.join('|')}","country":"tous|<nom de pays en français>",
"scoreMin":0,"explanation":"..."}
Règles :
- "sector" doit être EXACTEMENT une des valeurs listées ci-dessus, ou "tous".
- "country" est un nom de pays en français (ex. "États-Unis", "France"), ou "tous"
  si aucun pays n'est mentionné. N'invente pas un pays qui n'est pas raisonnablement
  déduit de la requête.
- "scoreMin" : 0 par défaut. Mets 70 si l'utilisateur cherche une entreprise
  manifestement "solide"/"de qualité"/"rentable", 60 pour "en croissance". Sinon 0.
- "explanation" : une phrase en français résumant les filtres appliqués, pour que
  l'utilisateur puisse vérifier avant de lancer la recherche.
- N'invente aucun autre champ. Si la requête ne permet de déduire aucun filtre
  pertinent, réponds {"sector":"tous","country":"tous","scoreMin":0,"explanation":"Aucun filtre déduit."}`;

const CONSIGNE_NOVA_REVIEW = `Tu commentes un bilan de décisions d'investissement personnelles, dans
l'esprit d'une analyse post-partie d'échecs (chess.com) : tu sépares la qualité du PROCESSUS de
décision du RÉSULTAT financier final.
Réponds en JSON strict : {"resume":"...","points":["...","..."],"lecon":"..."}
Règles absolues :
- Chaque décision listée ci-dessous a DÉJÀ un verdict ("Excellent coup"/"Bon coup"/"Intéressant"/
  "Risqué"/"Erreur à étudier"/"Occasion manquée") calculé par NovaTitre à partir de chiffres réels.
  Tu ne produis JAMAIS toi-même de verdict, de note, ni de nouveau chiffre — tu commentes et
  expliques UNIQUEMENT ce qui est déjà donné ci-dessous.
- N'invente AUCUN chiffre, AUCUNE société, AUCUNE décision qui ne figure pas explicitement dans le
  bilan transmis.
- "resume" : 1 à 2 phrases, ton direct, jamais un discours motivationnel vague.
- "points" : 2 à 4 observations concrètes, chacune ancrée sur UNE décision ou une donnée précise du
  bilan (nom de société, verdict, ou chiffre transmis).
- "lecon" : une phrase actionnable qui se réfère explicitement à une décision précise du bilan,
  jamais un conseil générique de manuel.
- N'utilise jamais "vous devriez acheter/vendre X" — tu commentes des décisions déjà prises,
  jamais une recommandation d'ordre futur.`;

/* NovaBot (tranche C, 2026-10-08, §9/§10/§12 du brief refonte fonctionnelle)
   : ce mode ne reçoit QUE des candidats ayant DÉJÀ franchi le filtre
   déterministe du NovaScore (voir evaluerNovaBot(), js/core.js) — son rôle
   n'est pas de noter l'entreprise (déjà fait, gratuitement, par le moteur
   NovaScore), mais de juger la QUALITÉ de l'opportunité à partir de
   données plus riches (fondamentaux, mandat, contexte du portefeuille) que
   le simple seuil ne regarde pas. §12 : "le LLM ne doit pas contrôler
   directement le portefeuille" — ce mode renvoie une INTENTION
   (action/confidence/reasoning), jamais une transaction ; le Risk Engine
   (novabotRiskCheck(), déterministe, tranche B) reste la seule porte côté
   client avant toute exécution simulée, que ce mode recommande "buy" ou
   non. */
const CONSIGNE_NOVABOT = `Tu es Nova AI, agissant pour le compte de NovaBot — un gestionnaire de
portefeuille simulé qui agit STRICTEMENT selon un mandat, jamais de sa propre initiative.
Réponds en JSON strict : {"action":"buy|watch|reject","confidence":0,"reasoning":"...","keyFactors":["...","..."]}
Règles absolues :
- "action" : "buy" si tu recommandes d'initier ou renforcer cette position maintenant ; "watch" si
  l'opportunité est intéressante mais les conditions ne sont pas encore réunies ; "reject" sinon.
- "confidence" : un entier de 0 à 100, ton niveau de confiance dans cette recommandation.
- Tu ne calcules et ne vérifies RIEN toi-même concernant le mandat (cash minimum, poids maximum,
  secteurs/actifs interdits) — un moteur de risque indépendant de NovaTitre vérifie déjà
  séparément, de façon stricte, chacune de ces contraintes après ta recommandation. Ton rôle est
  UNIQUEMENT de juger la qualité de l'opportunité à partir des données transmises.
- "reasoning" : 2 à 3 phrases en français, concrètes, qui ne citent QUE des chiffres/faits
  explicitement transmis ci-dessous — jamais un chiffre inventé, jamais un objectif de cours.
- "keyFactors" : 1 à 3 éléments précis et courts (ex. "NovaScore 78", "secteur Technologie"),
  chacun directement traçable aux données fournies.
- N'invente aucune donnée (cours, fondamentaux, actualité) absente du contexte transmis.`;

/* NovaBot — conversation (refonte expérience, 2026-10-08). Retour
   utilisateur explicite : "l'élément central doit être la conversation
   avec NovaBot [...] le mandat doit être créé automatiquement à partir de
   la conversation [...] NovaBot doit répondre en utilisant son
   portefeuille, son mandat, ses analyses et ses décisions RÉELLEMENT
   enregistrées". Un seul mode gère les deux moments de la vie de
   NovaBot (avant/après mandat confirmé) plutôt que deux endpoints
   séparés : la conversation ne "bascule" jamais brutalement d'interface,
   elle continue simplement à partir de ce qui est déjà su.
   §12 toujours respecté : ce mode ne fait QUE converser et proposer un
   mandatDraft — jamais écrit directement en base. C'est le CLIENT qui,
   sur confirmation explicite de l'utilisateur (jamais automatique), envoie
   ce brouillon à ?resource=novabot (déjà validé/persisté depuis la
   tranche A). Pas de "tool calling" natif par fournisseur ici (3 APIs
   different) : les données réelles (portefeuille/décisions) sont
   systématiquement injectées dans le contexte par le serveur AVANT
   l'appel, jamais récupérées par le modèle lui-même — plus simple et plus
   robuste qu'une boucle d'outils, pour un résultat équivalent côté
   utilisateur (réponses ancrées dans des données réelles). */
const CONSIGNE_NOVABOT_CHAT = `Tu es Nova, l'IA conversationnelle de NovaBot chez NovaTitre — un
gestionnaire de portefeuille EN SIMULATION UNIQUEMENT (jamais d'argent réel, jamais un ordre
envoyé à un broker). Tu parles en français, ton direct et chaleureux, jamais robotique, jamais de
jargon non expliqué.

Réponds TOUJOURS en JSON strict :
{"reply":"...","mandateDraft":{"initialCapital":null,"objective":null,"riskLevel":null,"horizonYears":null,"hardRules":null,"preferences":null,"autonomyMode":null}|null,"readyToConfirm":false,"newPreferences":null,"mandateAmendment":{"objective":null,"riskLevel":null,"horizonYears":null,"hardRules":null,"cashMinPct":null,"maxPositionPct":null,"maxPositionsCount":null,"maxDrawdownPct":null,"benchmark":null,"notes":null,"autonomyMode":null}|null,"readyToConfirmAmendment":false,"action":null}

DEUX RÔLES SELON "mandateConfirmed" transmis ci-dessous :

1) mandateConfirmed=false : ton objectif est de construire le mandat PAR LA CONVERSATION, jamais
   par un formulaire. Lis le dernier message et déduis-en, SI ELLES Y FIGURENT EXPLICITEMENT :
   - initialCapital (nombre en euros)
   - objective : "growth" (faire croître le capital), "income" (générer des revenus), ou
     "preserve" (préserver le capital)
   - riskLevel : "low", "moderate", ou "high"
   - horizonYears (nombre d'années)
   - hardRules : tableau d'objets {"type":"excluded_sector"|"excluded_asset","value":"..."} pour
     chaque secteur/entreprise que l'utilisateur exclut EXPLICITEMENT (contrainte JAMAIS
     outrepassable, ex. "je refuse l'armement")
   - preferences : tableau d'objets {"type":"investment_style","value":"..."} pour une préférence
     DURABLE mais NON contraignante que l'utilisateur exprime (ex. "je préfère investir à long
     terme", "j'évite plutôt les cryptomonnaies" sans l'exclure formellement) — jamais la même
     chose qu'une hardRule : une préférence peut être nuancée par Nova selon le contexte, une
     hardRule ne peut jamais être franchie
   - autonomyMode : "advice" (propose, demande toujours confirmation), "semi_auto", ou "auto"
   N'invente AUCUNE valeur non mentionnée explicitement ou clairement déductible (ex. "risque
   modéré" -> "moderate"). Si l'utilisateur répond "je ne sais pas" à une notion, explique-la
   simplement en 1-2 phrases puis repose la question dans "reply".
   Si l'utilisateur donne une durée vague ("le plus court possible", "rapidement") plutôt qu'un
   nombre d'années précis : ne déduis PAS horizonYears, demande la durée exacte dans "reply" (ex.
   "quelques semaines, quelques mois, un an ?"). Si l'utilisateur demande un risque "nul" ou
   "totalement sans risque" : explique en une phrase qu'aucun placement n'est réellement sans
   risque et qu'un horizon très court limite encore les options disponibles, AVANT de proposer
   riskLevel "low" comme l'option la plus prudente réellement possible — jamais une promesse de
   risque zéro.
   Une fois initialCapital+objective+riskLevel+horizonYears tous connus (dans ce message ou les
   précédents, voir mandateDraft déjà connu transmis ci-dessous) : pose au maximum 1 question sur
   les exclusions ET 1 question sur l'autonomie si elles ne sont pas déjà connues, PUIS résume le
   mandat complet en une phrase claire dans "reply" et demande confirmation, en mettant
   readyToConfirm=true. Si l'utilisateur n'a pas d'exclusion/préférence d'autonomie à donner,
   n'insiste pas — propose avec des valeurs par défaut prudentes (autonomyMode "advice" si non
   précisé) plutôt que de bloquer la conversation.

2) mandateConfirmed=true : tu réponds aux questions sur le portefeuille/les décisions/le mandat
   RÉELLEMENT transmis ci-dessous ("mandate"/"portfolio"/"recentDecisions"/"specificDecisions").
   "mandateDraft" reste TOUJOURS null dans ce mode (le mandat initial ne se reconstruit jamais
   après coup) — ceci reste ABSOLU pour initialCapital/objective/riskLevel/horizonYears/hardRules/
   autonomyMode via mandateDraft. Pour MODIFIER le mandat une fois confirmé, utilise
   "mandateAmendment" (voir plus bas) — un mécanisme séparé et distinct, jamais mandateDraft.
   "mandate.preferences" (transmis ci-dessous, déjà connues) sert à PERSONNALISER tes réponses —
   une mémoire COMMUNE à toutes les conversations de cet utilisateur, pas seulement celle-ci.
   Si l'utilisateur exprime en passant une NOUVELLE préférence durable et non contraignante (ex.
   "je préfère les actions qui versent un dividende", "cherche/préfère des actions à moins de 5€"),
   note-la dans "newPreferences" (tableau d'objets {"type":"investment_style"|"max_price_eur",
   "value":"..."}, jamais plus de 2 par réponse, null si aucune) — ceci N'EST PAS "mandateAmendment"
   et ne nécessite AUCUNE confirmation (non contraignant, l'utilisateur peut la supprimer à tout
   moment). Un prix plafond ("actions à moins de X€") est TOUJOURS une préférence, jamais un
   mandateAmendment — et précise honnêtement dans "reply" que ce filtre ne s'applique qu'aux
   actions déjà examinées par NovaBot (un petit nombre, pas tout le marché), et que le prix seul
   ne dit rien sur la qualité d'une entreprise. Ne répète JAMAIS dans "newPreferences" une
   préférence déjà listée dans "mandate.preferences".
   N'invente JAMAIS un chiffre, une date, une transaction ou une décision absente de ces données —
   si l'information demandée n'y figure pas (ex. décision trop ancienne non transmise), dis-le
   honnêtement ("je n'ai pas cette décision dans ce que je peux consulter maintenant") plutôt que
   de deviner. Si l'utilisateur demande une analyse que tu ne peux PAS vraiment faire (risque de
   faillite, dilution potentielle, risque de radiation/délistage, liquidité) : dis explicitement
   que NovaBot ne modélise pas ça aujourd'hui, plutôt que de produire une évaluation inventée.

   "mandateAmendment" (modification du mandat DÉJÀ confirmé, 2026-10-15) : UNIQUEMENT quand
   l'utilisateur demande EXPLICITEMENT et SANS AMBIGUÏTÉ de changer une règle contraignante du
   mandat (risque, horizon, exclusions, cash minimum, taille max d'une position, mode d'autonomie,
   etc.) — jamais déduit d'une remarque en passant glissée dans une réponse à une autre question
   (même règle que mandateDraft pendant l'onboarding). Objet avec UNIQUEMENT les champs
   réellement changés (mêmes noms/valeurs que mandateDraft : objective/riskLevel/horizonYears/
   hardRules/autonomyMode, plus cashMinPct/maxPositionPct/maxPositionsCount/maxDrawdownPct/
   benchmark/notes), null sinon. Si "pendingMandateAmendment" (transmis ci-dessous) montre qu'une
   proposition est DÉJÀ en attente de confirmation, ne la reproduis pas sans raison — rappelle-la
   dans "reply" plutôt que d'en recréer une autre, SAUF si l'utilisateur demande explicitement
   autre chose (dans ce cas, décris la nouvelle proposition complète). Tu ne gères ni ne vois
   d'identifiant de proposition : le serveur s'en occupe. "readyToConfirmAmendment":true
   UNIQUEMENT au tour où tu résumes clairement le changement proposé et demandes confirmation.
   Ne mélange JAMAIS un mandateAmendment avec une vente de position ou une fermeture de
   portefeuille — ces opérations n'existent pas ici.

Règles absolues (les deux rôles) :
- "reply" : 1 à 4 phrases, jamais un pavé, jamais de markdown.
- "mandateDraft" : UNIQUEMENT les champs que tu AJOUTES/MODIFIES à partir du dernier message —
  jamais une valeur déjà connue répétée, jamais un champ non mentionné. null si rien de nouveau.
- "readyToConfirm" : true UNIQUEMENT au tour où tu présentes le résumé complet du mandat en
  demandant confirmation.
- Jamais de recommandation d'achat/vente dans cette conversation elle-même (c'est le rôle du
  pipeline de décision NovaBot, pas de ce chat) — tu expliques ce qui a DÉJÀ été décidé, tu ne
  décides PAS quelle action acheter/vendre ici, ni pour quel montant.

"action" (UNIQUEMENT en mandateConfirmed=true, sinon toujours null) : demande explicite au CLIENT
d'exécuter le MÊME pipeline déterministe que les boutons de l'application — toi, le modèle de
langage, ne décides JAMAIS toi-même d'un achat/vente précis ni d'un montant ; tu demandes
seulement au moteur déjà existant de tourner, EXACTEMENT comme si l'utilisateur avait cliqué le
bouton correspondant. Cinq valeurs possibles, un SEUL champ par réponse, null si aucune :
- "run_evaluation" : l'utilisateur demande explicitement de chercher des opportunités, d'évaluer
  son portefeuille, de "lancer" NovaBot ou équivalent ("vas-y", "fais une évaluation", "regarde ce
  qu'il y a à faire") — jamais pour une simple question sur l'état actuel.
- "pause" : l'utilisateur demande explicitement de mettre en pause/arrêter la gestion automatique
  (TEMPORAIRE — reprend quand il veut, le mandat reste intact).
- "resume" : l'utilisateur demande explicitement de réactiver/reprendre la gestion automatique.
- "cancel_mandate" : l'utilisateur demande explicitement d'ANNULER le mandat/d'arrêter
  complètement NovaBot (pas juste une pause) — ex. "annule mon mandat", "arrête complètement
  NovaBot". N'EFFACE JAMAIS les positions déjà détenues ni ne vend rien — dis-le explicitement
  dans "reply" ("tes positions actuelles restent inchangées"). Distinct de "pause" : si le mot de
  l'utilisateur est ambigu entre les deux, demande une clarification plutôt que de deviner.
- "restore_last_mandate_version" : l'utilisateur demande explicitement d'annuler SA DERNIÈRE
  MODIFICATION du mandat et de revenir à la version précédente (ex. "annule le dernier changement",
  "remets mes règles précédentes").
"portfolio.enabled" (transmis ci-dessous) indique l'état RÉEL actuel — ne propose jamais "resume"
si déjà actif, ni "pause" si déjà en pause ; dis-le simplement dans "reply" ("NovaBot est déjà
actif") plutôt que de renvoyer une action sans effet.
N'utilise "action" QUE si la demande est sans ambiguïté — en cas de doute, laisse "action":null et
demande une clarification dans "reply" plutôt que de deviner une intention.`;

const CONSIGNE = `Tu analyses une entreprise cotée à partir des seuls chiffres fournis.
Réponds en JSON strict : {"whatItDoes":"...","verdict":"positif|neutre|negatif|insuffisant","uncertainty":"faible|moyenne|elevee","summary":"...","positive":["..."],"negative":["..."]}
"whatItDoes" : 1 à 2 phrases expliquant simplement ce que fait l'entreprise et
comment elle gagne son argent, en te basant UNIQUEMENT sur son secteur/
industrie/description déjà fournis dans le contexte — jamais un détail
(produit, chiffre, part de marché) qui n'y figure pas explicitement.
Règles absolues :
- N'invente aucun chiffre. Ne cite que ceux du contexte.
- Ne produis aucun objectif de cours, aucune probabilité, aucun pourcentage de réussite.
- Ne recommande jamais d'acheter ou de vendre.
- Si les données manquent, réponds "insuffisant".`;

/**
 * Mode "screener" (§37 du PRD) : remplace le parsing par expressions
 * régulières côté frontend (parseNaturalQuery) par une interprétation
 * réelle du modèle, pour une requête qu'une regex ne peut pas couvrir.
 * Réutilise EXACTEMENT le même mécanisme de quota/réservation que l'analyse
 * d'entreprise ci-dessus (même compteur mensuel) — délibéré : un appel
 * modèle coûte la même chose, quel que soit son objet, et créer un second
 * compteur séparé aurait demandé une nouvelle table Supabase pour un
 * bénéfice pas évident. Le frontend garde le parsing local par regex comme
 * geste instantané/gratuit pour les requêtes simples ; ce mode sert aux
 * requêtes que la regex ne couvre pas.
 */
async function screenerAnalyse(req, res, { user, plan, dispo }){
  const requete = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 300) : '';
  if (!requete) return res.status(400).json({ error: 'requete_vide' });

  const prompt = `${CONSIGNE_SCREENER}\n\nRequête utilisateur : "${requete}"`;

  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop de requêtes lancées en peu de temps. Réessayez dans quelques minutes.", plan });
    }
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  const utilise = resa.used;
  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  let id, modele, parsed;
  try {
    /* Même principe que le schéma de l'analyse d'entreprise : rejet strict
       plutôt que coercition silencieuse. "sector" DOIT être une valeur
       réelle de SECTORS (ou "tous") — jamais une catégorie inventée que le
       frontend ne saurait pas appliquer à state.filters.radarSector. */
    ({ id, modele, parsed } = await appelModeleAvecBascule(dispo, {
      prompt, maxTokens: 300, timeoutMs: 20000,
      validerEtNormaliser: (brut) => {
        if (
          !brut || typeof brut !== 'object' || Array.isArray(brut)
          || (brut.sector !== 'tous' && !SECTORS.includes(brut.sector))
          || typeof brut.country !== 'string'
          || !Number.isFinite(Number(brut.scoreMin))
          || typeof brut.explanation !== 'string'
        ){
          throw new Error('schema_screener_invalide');
        }
        return {
          sector: brut.sector,
          country: brut.country.slice(0, 60),
          scoreMin: [0, 50, 60, 70].includes(Number(brut.scoreMin)) ? Number(brut.scoreMin) : 0,
          explanation: brut.explanation.slice(0, 200),
        };
      },
    }));
  } catch (e){
    await annuler('cancelled');
    return res.status(502).json({ error: e.type || 'reponse_illisible', provider: e.provider ?? null, detail: e.detail });
  }

  await cloturer(sb, reservation, 'ok', { provider:id, model:modele });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ filters: parsed, provider: id, model: modele, quota: quotaBlock(plan, utilise) });
}

/**
 * Mode "novareview" (2026-09-26, retour utilisateur : Nova Review "réalisé
 * avec l'IA") — commente en langage naturel un bilan de décisions déjà
 * calculé par le moteur de verdict déterministe côté client (voir
 * evaluerVente()/evaluerPositionOuverte() dans index.html, LOT H).
 *
 * Ce mode NE calcule AUCUN verdict/chiffre lui-même : le bilan transmis
 * par le client (ses propres transactions, jamais une donnée partagée
 * entre utilisateurs — contrairement à l'analyse d'entreprise, il n'y a
 * personne d'autre à tromper avec une donnée personnelle inexacte) est
 * validé strictement en forme, puis transmis au modèle pour un
 * COMMENTAIRE uniquement — même verrou anti-hallucination
 * (construireAssainisseur) que l'analyse d'entreprise, pour qu'aucun
 * nombre ne puisse être introduit par le modèle en dehors de ceux
 * réellement transmis. Même mécanisme de quota que les autres modes.
 */
function texteBorne(valeur, maxLen){
  if (typeof valeur !== 'string') return null;
  // Retire les caracteres de controle (codes ASCII 0-31 et 127) par filtrage de code plutot que par une classe regex avec echappement unicode litteral, qui avait ete ecrit comme de vrais octets de controle dans ce fichier au lieu d etre conserve comme texte source (corrige le 2026-09-26).
  const nettoye = valeur.split('').filter(c => { const code = c.charCodeAt(0); return code > 31 && code !== 127; }).join('').trim();
  return nettoye ? nettoye.slice(0, maxLen) : null;
}
function nombreBorne(valeur){
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}
const VERDICTS_NOVA_REVIEW = new Set(['Excellent coup', 'Bon coup', 'Intéressant', 'Risqué', 'Erreur à étudier', 'Occasion manquée']);

async function novaReviewAnalyse(req, res, { user, plan, dispo }){
  const brut = req.body?.bilan;
  if (!brut || typeof brut !== 'object') return res.status(400).json({ error: 'bilan_invalide' });

  /* Validation stricte, élément par élément — jamais un objet arbitraire
     du client injecté tel quel dans le prompt. Une décision hors-forme
     est retirée individuellement, jamais tout le bilan. */
  const decisions = (Array.isArray(brut.decisions) ? brut.decisions : []).slice(0, 20)
    .map(d => ({
      nom: texteBorne(d?.nom, 80),
      type: d?.type === 'position_ouverte' ? 'position_ouverte' : 'vente',
      verdict: VERDICTS_NOVA_REVIEW.has(d?.verdict) ? d.verdict : null,
      gainPct: nombreBorne(d?.gainPct),
      regretPct: nombreBorne(d?.regretPct),
      concentrationPct: nombreBorne(d?.concentrationPct),
      raisons: (Array.isArray(d?.raisons) ? d.raisons : []).slice(0, 5)
        .map(r => texteBorne(r, 200)).filter(Boolean),
    }))
    .filter(d => d.nom && d.verdict);
  if (!decisions.length) return res.status(400).json({ error: 'bilan_vide' });

  const contexte = {
    decisions,
    performanceVariationPct: nombreBorne(brut.performanceVariationPct),
    secteursDistincts: nombreBorne(brut.secteursDistincts),
    maxPositionPct: nombreBorne(brut.maxPositionPct),
  };

  const prompt = `${CONSIGNE_NOVA_REVIEW}\n\nBilan :\n${JSON.stringify(contexte, null, 1)}`;

  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop de requêtes lancées en peu de temps. Réessayez dans quelques minutes.", plan });
    }
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  const utilise = resa.used;
  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  let id, modele, parsed;
  try {
    ({ id, modele, parsed } = await appelModeleAvecBascule(dispo, {
      prompt, maxTokens: 700, timeoutMs: 25000,
      validerEtNormaliser: (rep) => {
        if (
          !rep || typeof rep !== 'object' || Array.isArray(rep)
          || typeof rep.resume !== 'string'
          || !Array.isArray(rep.points)
          || typeof rep.lecon !== 'string'
        ){
          throw new Error('schema_novareview_invalide');
        }
        return {
          resume: rep.resume.slice(0, 400),
          points: rep.points.filter(p => typeof p === 'string').slice(0, 4).map(p => p.slice(0, 220)),
          lecon: rep.lecon.slice(0, 300),
        };
      },
    }));
  } catch (e){
    await annuler('cancelled');
    return res.status(502).json({ error: e.type || 'reponse_illisible', provider: e.provider ?? null, detail: e.detail });
  }

  const { assainirTexte } = construireAssainisseur(contexte);
  parsed.resume = assainirTexte(parsed.resume);
  parsed.points = parsed.points.map(assainirTexte);
  parsed.lecon = assainirTexte(parsed.lecon);

  await cloturer(sb, reservation, 'ok', { provider:id, model:modele });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ commentaire: parsed, provider: id, model: modele, quota: quotaBlock(plan, utilise) });
}

/**
 * Mode "novabot" (tranche C, refonte fonctionnelle, 2026-10-08) — second
 * avis qualitatif sur un candidat qui a DÉJÀ franchi le seuil NovaScore
 * déterministe côté client (voir evaluerNovaBot()). Même mécanisme de
 * quota/réservation que les autres modes (voir la note sur screenerAnalyse
 * : un appel modèle coûte la même chose, quel que soit son objet — jamais
 * un second compteur créé pour celui-ci). Le client (js/core.js) borne
 * lui-même le nombre d'appels par passage (NOVABOT_LLM_MAX) : ce endpoint
 * ne limite QUE le quota mensuel déjà existant, jamais la fréquence
 * d'appel en tant que telle.
 */
const NOVABOT_ACTIONS = new Set(['buy', 'watch', 'reject']);
function nombreOuChaineBorne(v, max){
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') return texteBorne(v, max);
  return null;
}
/* Filtre récursif : ne garde que nombres finis/chaînes courtes/booléens
   dans un objet de profondeur arbitraire (fondamentaux dont la forme
   varie selon le fournisseur de données, voir api/market/_providers.js) —
   jamais une clé de type inconnu transmise telle quelle au modèle. */
/* CORRECTIF (V6 §6, trouvé en câblant mandate.preferences dans le
   contexte transmis au modèle) : cette fonction ignorait silencieusement
   TOUTE propriété de type tableau — `!Array.isArray(v)` excluait les
   tableaux de la branche "objet imbriqué" sans jamais leur donner de
   branche à eux. Conséquence réelle, pas seulement théorique :
   mandate.hardRules (exclusions CONTRAIGNANTES de l'utilisateur) et
   mandate.preferences étaient systématiquement supprimés avant d'arriver
   au modèle, dans LES DEUX rôles de CONSIGNE_NOVABOT_CHAT — Nova n'a
   donc jamais réellement "connu" les exclusions de l'utilisateur en
   conversation, malgré une architecture conçue pour les lui transmettre.
   Les éléments d'un tableau sont filtrés un par un (nombre/texte borné/
   objet imbriqué valide), jamais un tableau entier rejeté pour un seul
   élément invalide — même tolérance que pour les objets. */
function sanitiserDonnees(obj, profondeur = 0){
  if (profondeur > 2 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)){
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.length < 200) out[k] = texteBorne(v, 200);
    else if (typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v)){
      const items = v.slice(0, 30).map(item => {
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (typeof item === 'string' && item.length < 200) return texteBorne(item, 200);
        if (item && typeof item === 'object' && !Array.isArray(item)){
          const nested = sanitiserDonnees(item, profondeur + 1);
          return (nested && Object.keys(nested).length) ? nested : null;
        }
        return null;
      }).filter(x => x !== null);
      if (items.length) out[k] = items;
    }
    else if (v && typeof v === 'object'){
      const nested = sanitiserDonnees(v, profondeur + 1);
      if (nested && Object.keys(nested).length) out[k] = nested;
    }
  }
  return out;
}

async function novabotDecisionAnalyse(req, res, { user, plan, dispo }){
  const c = req.body?.candidate;
  if (!c || typeof c !== 'object') return res.status(400).json({ error: 'candidat_invalide' });

  const ticker = texteBorne(c.ticker, 20);
  const novaScore = nombreBorne(c.novaScore);
  if (!ticker || novaScore === null) return res.status(400).json({ error: 'candidat_invalide' });

  const contexte = {
    candidate: {
      ticker, name: texteBorne(c.name, 200), sector: texteBorne(c.sector, 60),
      price: nombreBorne(c.price), currency: texteBorne(c.currency, 8),
      novaScore, fundamentals: sanitiserDonnees(c.fundamentals),
    },
    mandate: sanitiserDonnees(req.body?.mandate),
    portfolio: sanitiserDonnees(req.body?.portfolio),
  };

  const prompt = `${CONSIGNE_NOVABOT}\n\nDonnées :\n${JSON.stringify(contexte, null, 1)}`;

  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop de requêtes lancées en peu de temps. Réessayez dans quelques minutes.", plan });
    }
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  const utilise = resa.used;
  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  let id, modele, parsed, usage;
  const debut = Date.now();
  try {
    ({ id, modele, parsed, usage } = await appelModeleAvecBascule(dispo, {
      prompt, maxTokens: 500, timeoutMs: 25000,
      validerEtNormaliser: (rep) => {
        if (
          !rep || typeof rep !== 'object' || Array.isArray(rep)
          || !NOVABOT_ACTIONS.has(rep.action)
          || !Number.isFinite(Number(rep.confidence))
          || typeof rep.reasoning !== 'string'
          || !Array.isArray(rep.keyFactors)
        ){
          throw new Error('schema_novabot_invalide');
        }
        return {
          action: rep.action,
          confidence: Math.max(0, Math.min(100, Math.round(Number(rep.confidence)))),
          reasoning: rep.reasoning.slice(0, 500),
          keyFactors: rep.keyFactors.filter(f => typeof f === 'string').slice(0, 3).map(f => f.slice(0, 120)),
        };
      },
    }));
  } catch (e){
    await annuler('cancelled');
    return res.status(502).json({ error: e.type || 'reponse_illisible', provider: e.provider ?? null, detail: e.detail });
  }
  const dureeMs = Date.now() - debut;

  const { assainirTexte } = construireAssainisseur(contexte);
  parsed.reasoning = assainirTexte(parsed.reasoning);
  parsed.keyFactors = parsed.keyFactors.map(assainirTexte);

  /* §24 : coût IA — provider/modèle/tokens déjà enregistrés par cloturer()
     (ai_usage, voir api/_limits.js) comme pour tout autre mode ; durée
     renvoyée au client pour qu'il la joigne à novabot_decisions.ai_* (le
     journal de décision NovaBot, pas ai_usage, est l'endroit pertinent
     pour "pourquoi cet appel" — ai_usage reste générique à tous les modes). */
  await cloturer(sb, reservation, 'ok', { provider:id, model:modele,
    tokens_in: usage?.prompt_tokens ?? null, tokens_out: usage?.completion_tokens ?? null });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ decision: parsed, provider: id, model: modele, durationMs: dureeMs, quota: quotaBlock(plan, utilise) });
}

/**
 * Mode "novabot-chat" (refonte expérience, 2026-10-08) — la conversation
 * elle-même. Voir CONSIGNE_NOVABOT_CHAT ci-dessus pour l'architecture
 * complète (pas de tool-calling natif, données réelles injectées par le
 * serveur). L'historique (req.body.messages) est mis en forme en
 * transcript DANS le prompt — appelModeleAvecBascule() envoie un seul
 * message 'user' par appel (partagé avec tous les autres modes), jamais
 * un tableau multi-tours natif par fournisseur ici, pour ne rien changer
 * à cette fonction commune.
 */
const NOVABOT_OBJECTIVES = new Set(['growth', 'income', 'preserve']);
const NOVABOT_RISK_LEVELS = new Set(['low', 'moderate', 'high']);
const NOVABOT_AUTONOMY = new Set(['advice', 'semi_auto', 'auto']);
/* V6 §6 ("mémoire commune") : une préférence est TOUJOURS {type, value},
   jamais contraignante (contrairement à hardRules) — réutilisé pour le
   mandateDraft d'onboarding ET pour newPreferences en conversation
   confirmée (voir novabotChatAnalyse ci-dessous). `max` différent selon
   le contexte : l'onboarding peut en poser plusieurs d'un coup, un tour
   de conversation normal n'en ajoute jamais plus de 2 (déjà imposé au
   modèle dans CONSIGNE_NOVABOT_CHAT, revérifié ici côté serveur). */
function validerPreferences(arr, max){
  if (!Array.isArray(arr)) return null;
  const prefs = arr
    .filter(p => p && typeof p.type === 'string' && typeof p.value === 'string' && p.value.trim())
    .slice(0, max).map(p => ({ type: texteBorne(p.type, 40), value: texteBorne(p.value, 80) }));
  return prefs.length ? prefs : null;
}
/* Extrait le 2026-10-15 (pilotage du mandat depuis le chat) : même liste de
   types de hardRules consommée par le brouillon d'onboarding ET par une
   modification post-confirmation (validerMandateAmendment plus bas) — une
   seule source de vérité plutôt que deux listes qui pourraient diverger. */
function validerHardRules(arr, max){
  if (!Array.isArray(arr)) return null;
  const regles = arr
    .filter(r => r && (r.type === 'excluded_sector' || r.type === 'excluded_asset') && typeof r.value === 'string')
    .slice(0, max).map(r => ({ type:r.type, value: texteBorne(r.value, 60) }));
  return regles.length ? regles : null;
}
function validerMandateDraft(d){
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  if (Number.isFinite(d.initialCapital) && d.initialCapital >= 0) out.initialCapital = d.initialCapital;
  if (NOVABOT_OBJECTIVES.has(d.objective)) out.objective = d.objective;
  if (NOVABOT_RISK_LEVELS.has(d.riskLevel)) out.riskLevel = d.riskLevel;
  if (Number.isFinite(d.horizonYears) && d.horizonYears > 0) out.horizonYears = d.horizonYears;
  const regles = validerHardRules(d.hardRules, 20);
  if (regles) out.hardRules = regles;
  const prefs = validerPreferences(d.preferences, 20);
  if (prefs) out.preferences = prefs;
  if (NOVABOT_AUTONOMY.has(d.autonomyMode)) out.autonomyMode = d.autonomyMode;
  return Object.keys(out).length ? out : null;
}
/* NOUVEAU (2026-10-15, "NovaBot — pilotage complet du mandat depuis le
   chat") : contrairement à validerMandateDraft (onboarding, un objet
   CUMULATIF construit sur plusieurs tours), ceci valide un changement
   PARTIEL proposé en une fois après confirmation du mandat -- seuls les
   champs réellement présents et valides sont gardés, null si le modèle n'a
   en réalité rien proposé de concret (jamais une "modification vide"
   silencieusement acceptée plus loin dans la chaîne). */
function validerMandateAmendment(d){
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  if (NOVABOT_OBJECTIVES.has(d.objective)) out.objective = d.objective;
  if (NOVABOT_RISK_LEVELS.has(d.riskLevel)) out.riskLevel = d.riskLevel;
  if (Number.isFinite(d.horizonYears) && d.horizonYears > 0) out.horizonYears = d.horizonYears;
  const regles = validerHardRules(d.hardRules, 20);
  if (regles) out.hardRules = regles;
  if (Number.isFinite(d.cashMinPct) && d.cashMinPct >= 0 && d.cashMinPct <= 100) out.cashMinPct = d.cashMinPct;
  if (Number.isFinite(d.maxPositionPct) && d.maxPositionPct >= 1 && d.maxPositionPct <= 100) out.maxPositionPct = d.maxPositionPct;
  if (Number.isInteger(d.maxPositionsCount) && d.maxPositionsCount > 0) out.maxPositionsCount = d.maxPositionsCount;
  if (Number.isFinite(d.maxDrawdownPct) && d.maxDrawdownPct >= 0 && d.maxDrawdownPct <= 100) out.maxDrawdownPct = d.maxDrawdownPct;
  if (typeof d.benchmark === 'string' && d.benchmark.trim()) out.benchmark = texteBorne(d.benchmark, 20);
  if (typeof d.notes === 'string' && d.notes.trim()) out.notes = texteBorne(d.notes, 2000);
  if (NOVABOT_AUTONOMY.has(d.autonomyMode)) out.autonomyMode = d.autonomyMode;
  return Object.keys(out).length ? out : null;
}

async function novabotChatAnalyse(req, res, { user, plan, dispo }){
  const messagesIn = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : [];
  const messages = messagesIn
    .map(m => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: texteBorne(m?.content, 2000) }))
    .filter(m => m.content);
  if (!messages.length) return res.status(400).json({ error: 'conversation_vide' });

  const mandateConfirmed = req.body?.mandateConfirmed === true;
  const contexte = {
    mandateConfirmed,
    mandateDraftConnu: mandateConfirmed ? null : sanitiserDonnees(req.body?.mandateDraft),
    mandate: mandateConfirmed ? sanitiserDonnees(req.body?.mandate) : null,
    portfolio: mandateConfirmed ? sanitiserDonnees(req.body?.portfolio) : null,
    recentDecisions: mandateConfirmed && Array.isArray(req.body?.recentDecisions)
      ? req.body.recentDecisions.slice(0, 15).map(d => sanitiserDonnees(d)).filter(Boolean) : null,
    specificDecisions: mandateConfirmed && Array.isArray(req.body?.specificDecisions)
      ? req.body.specificDecisions.slice(0, 10).map(d => sanitiserDonnees(d)).filter(Boolean) : null,
    /* NOUVEAU (2026-10-15) : symétrique de mandateDraftConnu pour
       l'onboarding — indique au modèle qu'une proposition de modification
       est déjà sur la table, en attente de la réponse de cet utilisateur
       (évite de reproposer la même chose ou d'en ignorer l'existence). */
    pendingMandateAmendment: mandateConfirmed ? sanitiserDonnees(req.body?.pendingMandateAmendment) : null,
  };

  const transcript = messages.map(m => `${m.role === 'user' ? 'Utilisateur' : 'Nova'} : ${m.content}`).join('\n');
  const prompt = `${CONSIGNE_NOVABOT_CHAT}\n\nDonnées disponibles :\n${JSON.stringify(contexte, null, 1)}\n\nConversation :\n${transcript}\n\nRéponds au DERNIER message de l'utilisateur.`;

  /* CORRECTIF (V6 §8, bug réel rapporté : "Coucou" consommait une des 5
     analyses mensuelles du plan Découverte) : un message de conversation
     n'est pas une analyse NovaScore — il a son PROPRE quota, bien plus
     généreux, totalement indépendant (voir reserverChat()/_limits.js et
     sql/2026-10-12_nova_chat_quota.sql). Ne touche jamais `ai_usage`. */
  const resa = await reserverChat(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaChatBlock(plan, resa.used ?? limiteChatDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteChatDe(plan)} messages NovaBot inclus ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop de messages envoyés en peu de temps. Réessayez dans quelques minutes.", plan });
    }
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur de messages est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  const utilise = resa.used;
  const annuler = statut => cloturerChat(sb, reservation, statut || 'cancelled');

  let id, modele, parsed, usage;
  try {
    ({ id, modele, parsed, usage } = await appelModeleAvecBascule(dispo, {
      prompt, maxTokens: 500, timeoutMs: 25000,
      validerEtNormaliser: (rep) => {
        if (
          !rep || typeof rep !== 'object' || Array.isArray(rep)
          || typeof rep.reply !== 'string'
          || typeof rep.readyToConfirm !== 'boolean'
        ){
          throw new Error('schema_novabot_chat_invalide');
        }
        return {
          reply: rep.reply.slice(0, 800),
          mandateDraft: mandateConfirmed ? null : validerMandateDraft(rep.mandateDraft),
          readyToConfirm: rep.readyToConfirm === true,
          /* newPreferences : UNIQUEMENT en conversation déjà confirmée (voir
             CONSIGNE_NOVABOT_CHAT, rôle 2) — jamais pendant l'onboarding, où
             les préférences passent par mandateDraft/readyToConfirm comme le
             reste du mandat en construction. */
          newPreferences: mandateConfirmed ? validerPreferences(rep.newPreferences, 2) : null,
          /* mandateAmendment (2026-10-15, "NovaBot — pilotage complet du
             mandat depuis le chat") : contrairement à mandateDraft,
             UNIQUEMENT disponible une fois le mandat confirmé — c'est
             l'inverse exact de la porte mandateDraft ci-dessus (ABSOLUE
             pour mandateDraft après confirmation, ABSOLUE pour
             mandateAmendment avant). Le modèle ne fixe/voit jamais
             l'identifiant de la proposition : il est généré/géré par le
             serveur juste après (voir plus bas), jamais par le modèle. */
          mandateAmendment: mandateConfirmed ? validerMandateAmendment(rep.mandateAmendment) : null,
          readyToConfirmAmendment: rep.readyToConfirmAmendment === true,
          /* action (audit 2026-10-14, "je veux que NovaBot puisse gérer
             tout ce qu'on lui donne automatiquement sans aucun bouton à
             taper [...] comme Claude Code") : liste BLANCHE stricte —
             une valeur hors de cette liste jamais transmise au client, qui
             ne SAIT exécuter que ces actions précises (voir
             novabotTraiterAction(), js/novabot-chat.js). Le modèle ne
             décide JAMAIS d'un achat/vente ni d'un montant ici — il ne
             fait que demander au PIPELINE DÉTERMINISTE déjà existant
             (evaluerNovaBot(), identique au bouton "Évaluer maintenant")
             de tourner, de mettre en pause/reprendre/annuler, ou de
             restaurer la version précédente du mandat (2026-10-15 :
             cancel_mandate/restore_last_mandate_version, jamais une vente
             de position ni une fermeture de portefeuille — ces actions
             n'existent nulle part ici). */
          action: mandateConfirmed && ['run_evaluation', 'pause', 'resume', 'cancel_mandate', 'restore_last_mandate_version'].includes(rep.action)
            ? rep.action : null,
        };
      },
    }));
  } catch (e){
    await annuler('cancelled');
    return res.status(502).json({ error: e.type || 'reponse_illisible', provider: e.provider ?? null, detail: e.detail });
  }

  /* Identité de la proposition gérée par le SERVEUR, jamais par le modèle
     (2026-10-15) : si une proposition était déjà en attente (même id
     renvoyé par le client dans pendingMandateAmendment), on continue la
     MÊME proposition plutôt que d'en recréer une nouvelle à chaque tour —
     sinon un "oui" tardif se rattacherait au mauvais changement. Un
     changement de contenu entre deux tours (le modèle a reformulé sa
     proposition) régénère quand même un nouvel id : la proposition
     affichée doit toujours correspondre exactement à ce que le client va
     effectivement confirmer. */
  let amendmentId = null, amendmentSummary = null, baseMandateId = null;
  if (parsed.mandateAmendment){
    const dejaEnAttente = contexte.pendingMandateAmendment;
    const memeContenu = dejaEnAttente && JSON.stringify(dejaEnAttente.changes) === JSON.stringify(parsed.mandateAmendment);
    amendmentId = memeContenu && typeof dejaEnAttente.id === 'string' ? dejaEnAttente.id : randomUUID();
    amendmentSummary = parsed.reply.slice(0, 300);
    baseMandateId = (contexte.mandate && typeof contexte.mandate.id === 'string') ? contexte.mandate.id : null;
  }

  /* CORRECTIF (audit 2026-10-13) : nombresDuTexteUtilisateur(messages)
     passé À PART de `contexte` (jamais fusionné dedans) — `contexte` est
     aussi sérialisé tel quel DANS LE PROMPT envoyé au modèle (voir plus
     haut), et ces montants bruts extraits du texte utilisateur n'ont pas
     leur place parmi les "Données disponibles" structurées ; le modèle
     voit déjà ces mêmes nombres dans la section Conversation du prompt.
     Ce tableau ne sert qu'à élargir l'ensemble autorisé du verrou
     anti-hallucination, rien d'autre. */
  const { assainirTexte } = construireAssainisseur({ ...contexte, montantsDeclaresParUtilisateur: nombresDuTexteUtilisateur(messages) });
  parsed.reply = assainirTexte(parsed.reply);

  /* cloturerChat() (nova_chat_usage), pas cloturer() (ai_usage) — table
     plus simple, sans colonnes tokens_in/tokens_out (voir sql/2026-10-12_
     nova_chat_quota.sql) : un PATCH avec ces champs échouerait (colonne
     inexistante). usage/coûts du chat restent dans les logs serveur
     uniquement pour l'instant, pas encore une colonne dédiée. */
  await cloturerChat(sb, reservation, 'ok', { provider:id, model:modele });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ...parsed, provider: id, model: modele, quota: quotaChatBlock(plan, utilise),
    amendmentId, summary: amendmentSummary, baseMandateId,
  });
}


module.exports = async (req, res) => {
  if (req.method === 'GET'){
    return res.status(200).json({
      providers: Object.fromEntries(Object.entries(PROVIDERS)
        .map(([k, v]) => [k, { configured: Boolean(process.env[v.env]),
          model: typeof v.model === 'function' ? v.model() : v.model }])),
      active: actif()[0]?.[0] || null,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' });

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  if (!actif().length) {
    return res.status(503).json({ error: 'aucun_modele_configure',
      message: "Aucune clé de modèle n'est configurée sur le serveur." });
  }

  /* ---------- PLAN RÉEL ----------
     Lu dans Supabase. Un plan inconnu, absent ou dont l'abonnement n'est plus
     actif retombe sur free — jamais sur pro ni elite. */
  const { plan } = await planReel(sb, user.id);

  if (req.body?.mode === 'screener'){
    return screenerAnalyse(req, res, { user, plan, dispo: dispoPourTache('screener') });
  }
  if (req.body?.mode === 'novareview'){
    return novaReviewAnalyse(req, res, { user, plan, dispo: dispoPourTache('novareview') });
  }
  if (req.body?.mode === 'novabot'){
    return novabotDecisionAnalyse(req, res, { user, plan, dispo: dispoPourTache('novabot') });
  }
  if (req.body?.mode === 'novabot-chat'){
    return novabotChatAnalyse(req, res, { user, plan, dispo: dispoPourTache('novabot-chat') });
  }
  const dispo = dispoPourTache('analyse');

  const { ticker, exchange, name, country, sector, industry, currency, mode } = req.body || {};
  /* Niveau de langage (§45 du PRD) : ajuste UNIQUEMENT le ton/vocabulaire
     demandé au modèle, jamais le schéma JSON ni les règles anti-
     hallucination (identiques quel que soit le niveau) — validé par le
     même code que le mode "normal", aucune exception de schéma ici. */
  const niveauLangage = mode === 'expert'
    ? "Le lecteur est un investisseur expérimenté : utilise les termes financiers usuels (PER, marge, ROE...) sans les redéfinir."
    : "Le lecteur découvre la Bourse : évite le jargon financier non expliqué, ou explique-le en quelques mots simples dans la même phrase.";
  // Aucune entreprise par défaut : sans identification, aucun appel ne part.
  if (!ticker) return res.status(400).json({ error: 'entreprise_non_identifiee' });

  /* Le dossier financier est récupéré ICI, côté serveur. Le navigateur ne
     transmet plus aucun chiffre : il ne pourrait pas en garantir l'origine. */
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${req.headers.host}`;
  let dossier = null;
  try {
    const r = await fetch(`${base}/api/market/company?ticker=${encodeURIComponent(ticker)}`
      + (exchange ? `&exchange=${encodeURIComponent(exchange)}` : ''));
    dossier = await r.json();
  } catch (e){
    console.error('[analyze] dossier :', e.message);
  }
  if (!dossier || dossier.error || !dossier.market){
    return res.status(424).json({ error: 'donnees_indisponibles',
      message: "Les données financières de cette société n'ont pas pu être récupérées.",
      detail: dossier?.error || dossier?.missing || null, journal: dossier?.journal || null });
  }

  /* IDENTITÉ — fusion serveur-prioritaire.
     dossier.identity vient de /api/market/company, alimenté par les
     fournisseurs financiers réels (EODHD General, etc.) : c'est TOUJOURS la
     source de vérité. Le frontend peut transmettre des métadonnées NON
     FINANCIÈRES déjà connues de NovaBourse (catalogue local, résultat de
     recherche, catalogue runtime restauré après refresh) ; elles ne
     comblent QUE les champs que le serveur n'a réellement pas pu déterminer
     — jamais l'inverse, et jamais un champ financier (aucun prix, aucun
     fondamental, aucun score n'est accepté depuis req.body ici). Chaque
     champ conserve sa provenance dans identitySource pour audit. */
  /* Validation stricte des métadonnées d'identité venant du client, AVANT
     toute utilisation : elles finissent dans le prompt envoyé au modèle, et
     /api/analyze est un endpoint public (authentifié, mais appelable
     directement, pas seulement depuis index.html). Cela réduit la surface
     d'entrée (type, longueur, caractères de contrôle) mais NE constitue PAS
     une protection absolue contre une injection de prompt : un texte court,
     bien formé et dans la limite de longueur peut rester sémantiquement
     problématique. Seule une séparation stricte entre données et
     instructions au niveau du prompt (hors périmètre de ce correctif)
     éliminerait le risque plus complètement.
     Règles appliquées ici : type string strict (un objet/tableau devient
     null, jamais sérialisé) ; caractères de contrôle retirés ; espaces
     superflus retirés ; longueur bornée par champ. Une valeur vide après
     nettoyage devient null — jamais une chaîne vide propagée comme
     "connue". */
  function texteIdentite(valeur, maxLen){
    if (typeof valeur !== 'string') return null;
    const nettoye = valeur.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return nettoye ? nettoye.slice(0, maxLen) : null;
  }
  const identiteClient = {
    name: texteIdentite(name, 120),
    country: texteIdentite(country, 60),
    sector: texteIdentite(sector, 60),
    industry: texteIdentite(industry, 80),
    currency: texteIdentite(currency, 10),
  };
  const identitySource = {};
  const identity = { ...dossier.identity };
  for (const champ of Object.keys(identiteClient)) {
    const valeurServeur = identity[champ];
    const valeurClient = identiteClient[champ];
    if ((valeurServeur === null || valeurServeur === undefined) && valeurClient) {
      identity[champ] = valeurClient;
      identitySource[champ] = 'frontend';
    } else {
      identitySource[champ] = valeurServeur != null ? 'server' : null;
    }
  }
  dossier = { ...dossier, identity };

  /* NovaScore : calculé ICI, par notre moteur, à partir du dossier réel.
     Le modèle le recevra pour l'expliquer — jamais pour le produire. */
  const nova = novascore(dossier);

  /* VERROU DE QUOTA — CORRIGÉ.
     Avant ce correctif, ce verrou ne se déclenchait que si fundamentals ET
     history manquaient TOUS LES DEUX. Une société avec un historique réel
     mais sans fondamentaux (ex. NVIDIA : history OK, fundamentals absents)
     passait donc ce verrou, réservait le quota et appelait le modèle, alors
     même que le moteur NovaScore avait déjà correctement calculé une
     couverture < 40 % et refusé de produire une note (score:null).
     Le verrou se base maintenant directement sur ce que le moteur a déjà
     décidé — score:null ET son signal explicite `refused` (redondants par
     construction dans _novascore.js, vérifié : le seul chemin renvoyant
     score:null est le refus pour couverture insuffisante, qui pose toujours
     refused:'couverture_insuffisante') — plutôt que de dupliquer un second
     seuil arbitraire ici, susceptible de diverger de celui de
     _novascore.js. Aucune réservation, aucun appel au modèle ne doit avoir
     lieu avant ce test. */
  if (nova.score === null || nova.refused){
    return res.status(424).json({
      error: 'insufficient_data',
      message: "Couverture des données insuffisante pour produire un NovaScore "
        + "(minimum 40 % requis). Aucune analyse n'a été consommée.",
      coverage: nova.coverage,
      novaScore: null,
      missing: dossier.missing || [],
      quotaConsomme: false,
      sources: dossier.sources,
      journal: (dossier.journal || []).filter(j => !j.ok),
    });
  }

  const company = dossier.identity?.name || ticker;
  const context = {
    identite: dossier.identity,
    marche: dossier.market,
    fondamentaux: dossier.fundamentals,
    historique: dossier.history ? {
      seances: dossier.history.points,
      premier: dossier.history.ohlcv[0] || null,
      dernier: dossier.history.ohlcv[dossier.history.ohlcv.length - 1] || null,
      clotures: dossier.history.ohlcv.slice(-60).map(x => x.close),
    } : null,
    sources: dossier.sources,
    donneesManquantes: dossier.missing,
    novaScore: nova.score,
    novaDetail: nova.score === null ? null : {
      couverture: nova.coverage, coherence: nova.coherence, confiance: nova.confidence,
      familles: Object.fromEntries(Object.entries(nova.families)
        .map(([k, v]) => [v.label, v.score])),
      metriquesAbsentes: Object.values(nova.families).flatMap(v => v.missing),
    },
  };

  const prompt = `${CONSIGNE}

${niveauLangage}

Entreprise : ${company} (${ticker})
Données disponibles :
${JSON.stringify(context || {}, null, 1)}

Si une donnée n'apparaît pas ci-dessus ou vaut null, elle est INDISPONIBLE :
ne la remplace par aucune estimation, et signale-le dans "negative" si elle est
importante pour juger l'entreprise.

Le NovaScore est calculé par NovaTitre à partir de ces chiffres. Tu peux
l'expliquer ou relever ce qui te semble en tension avec lui, mais tu ne produis
jamais et ne modifies jamais de note.`;

  /* ---------- RÉSERVATION ATOMIQUE ----------
     Postgres compte et insère dans une seule transaction, sous verrou par
     utilisateur : deux clics simultanés ne peuvent pas dépasser la limite.
     Si la réservation est impossible, on s'arrête ici : jamais d'appel au
     fournisseur sans trace de consommation. */
  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop d'analyses lancées en peu de temps. Réessayez dans quelques minutes.",
        plan });
    }
    console.error('[analyze] réservation impossible :', resa.detail || resa.reason);
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  /* reserve_analysis renvoie v_mois + 1 : la réservation qui vient d'être
     insérée est DÉJÀ comptée. On ne rajoute donc rien à cette valeur. */
  const utilise = resa.used;

  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  /* SCHÉMA STRICT — VALIDATION AVANT NORMALISATION.
     Un modèle peut renvoyer un JSON syntaxiquement valide mais qui ne
     respecte pas le contrat attendu (verdict hors énumération, uncertainty
     hors énumération, summary/positive/negative absents ou du mauvais
     type). Une telle réponse est REJETÉE explicitement (throw), pas
     silencieusement coercée en null/[] : si TOUS les fournisseurs
     configurés échouent ainsi, appelModeleAvecBascule relance la dernière
     erreur, le catch ci-dessous annule la réservation ('cancelled') et
     renvoie 502 : aucune analyse n'est donc jamais consommée définitivement
     dans ce cas. Seulement une fois cette validation passée, les champs
     sont bornés en longueur et les éléments non-string filtrés des
     tableaux — ça, c'est de la normalisation, pas une validation de
     conformité. */
  let id, modele, parsed, usage;
  try {
    ({ id, modele, parsed, usage } = await appelModeleAvecBascule(dispo, {
      prompt, maxTokens: 900, timeoutMs: 30000,
      validerEtNormaliser: (brut) => {
        const VERDICTS_AUTORISES = new Set(['positif', 'neutre', 'negatif', 'insuffisant']);
        const INCERTITUDES_AUTORISEES = new Set(['faible', 'moyenne', 'elevee']);
        if (
          !brut || typeof brut !== 'object' || Array.isArray(brut)
          || !VERDICTS_AUTORISES.has(brut.verdict)
          || !INCERTITUDES_AUTORISEES.has(brut.uncertainty)
          || typeof brut.summary !== 'string'
          || !Array.isArray(brut.positive)
          || !Array.isArray(brut.negative)
        ){
          throw new Error('schema_analyse_invalide');
        }
        const listeBornee = (v, maxItems, maxLen) => v
          .filter(x => typeof x === 'string')
          .slice(0, maxItems)
          .map(x => x.slice(0, maxLen));
        return {
          /* Optionnel plutôt que rejeté si absent (contrairement à
             verdict/uncertainty/summary/positive/negative ci-dessus) : un
             modèle qui l'omettrait de temps en temps ne doit pas
             transformer une analyse par ailleurs valide en échec facturé
             au quota. Chaîne vide affichée comme "non fournie", jamais
             devinée. */
          whatItDoes: typeof brut.whatItDoes === 'string' ? brut.whatItDoes.slice(0, 300) : '',
          verdict: brut.verdict,               // déjà validé dans l'énumération ci-dessus
          uncertainty: brut.uncertainty,       // déjà validé dans l'énumération ci-dessus
          summary: brut.summary.slice(0, 600),
          positive: listeBornee(brut.positive, 6, 220),
          negative: listeBornee(brut.negative, 6, 220),
        };
      },
    }));
  } catch (e) {
    console.error('[analyze]', e.provider, e.detail || e.message);
    await annuler('cancelled');
    return res.status(502).json({ error: e.type || 'reponse_illisible',
      provider: e.provider ?? null, detail: e.detail || e.message });
  }

  /* VERROU. Deux filtres, puis une construction explicite de la réponse.
     1. tout champ numérique produit par le modèle est retiré ;
     2. tout champ dont le NOM évoque une note l'est aussi, quel que soit son
        type — « "78/100" » en texte serait sinon passé ;
     3. le NovaScore renvoyé plus bas provient de l'objet du moteur : la
        valeur du modèle n'a aucun chemin vers l'affichage. */
  const INTERDITS = /(^|_)(score|note|rating|novascore|target|objectif|prob|probability|confidence|valuation|price)/i;
  const retires = [];
  for (const k of Object.keys(parsed)) {
    if (typeof parsed[k] === 'number' || INTERDITS.test(k)) {
      retires.push(k); delete parsed[k];
    }
  }

  /* VERROU ANTI-HALLUCINATION EN TEXTE LIBRE.
     Le filtre ci-dessus ne retire qu'un chiffre porté DIRECTEMENT par une
     valeur JSON numérique ou un nom de champ suspect. Il laisse passer un
     chiffre inventé glissé dans une phrase ("summary", "positive[]",
     "negative[]"), ex. {"summary":"Le PER est de 31,4"} sans que 31,4 ne
     figure nulle part dans le contexte réellement transmis au modèle.
     construireAssainisseur() (extrait le 2026-09-26 pour être réutilisé
     par le mode novareview, comportement inchangé — voir sa définition
     plus haut pour le détail du principe et le compromis assumé). */
  const { assainirTexte, compteur: compteurRetires } = construireAssainisseur(context);
  if (typeof parsed.whatItDoes === 'string') parsed.whatItDoes = assainirTexte(parsed.whatItDoes);
  if (typeof parsed.summary === 'string') parsed.summary = assainirTexte(parsed.summary);
  if (Array.isArray(parsed.positive)) parsed.positive = parsed.positive.map(assainirTexte);
  if (Array.isArray(parsed.negative)) parsed.negative = parsed.negative.map(assainirTexte);

  await cloturer(sb, reservation, 'ok', { provider:id, model:modele,
    tokens_in: usage?.prompt_tokens ?? null, tokens_out: usage?.completion_tokens ?? null });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    // Tant qu'aucun fournisseur de marché n'est configuré, l'analyse ne porte
    // pas sur des cotations réelles : le serveur le déclare, le client l'affiche.
    // Vrai uniquement si au moins un fournisseur a réellement répondu.
    marketConnected: Boolean(dossier.sources
      && (dossier.sources.quote || dossier.sources.fundamentals || dossier.sources.history)),
    // Provenance réelle de chaque bloc de données transmis au modèle.
    sources: dossier.sources,
    asOf: dossier.asOf,
    missing: dossier.missing,
    // Motif d'échec de chaque fournisseur : sans lui, un bloc manquant reste
    // inexplicable et le diagnostic prend des heures.
    journal: (dossier.journal || []).filter(j => !j.ok),
    identity: dossier.identity,
    // Provenance de chaque champ d'identité (server = /api/market/company,
    // frontend = complété depuis les métadonnées transmises par le client,
    // null = inconnu des deux côtés). Purement diagnostique.
    identitySource,
    market: dossier.market,
    analysis: parsed, provider: id, model: modele, tokens: usage,
    // Nombre de chiffres en texte libre retirés faute de correspondre à une
    // valeur réellement transmise au modèle (voir verrou anti-hallucination).
    unverifiedNumbersRemoved: compteurRetires.retires,
    // Seule note affichable : celle du moteur. Jamais celle du modèle.
    novascore: {
      engine: nova.engine, score: nova.score, coverage: nova.coverage,
      coherence: nova.coherence, confidence: nova.confidence,
      comparable: nova.comparable ?? false, refused: nova.refused,
      families: Object.fromEntries(Object.entries(nova.families)
        .map(([k, v]) => [k, { label: v.label, score: v.score,
          weight: nova.weightsApplied[k] ?? 0,          // poids appliqué au score
          baseWeight: v.baseWeight,                     // poids théorique
          coverageWeight: v.coverageWeight,             // poids réellement couvert
          missing: v.missing }])),
      computedAt: nova.computedAt,
    },
    numericStripped: retires, quota: quotaBlock(plan, utilise),
  });
};
