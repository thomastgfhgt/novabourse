/* NOVA MISSIONS — chapitres 1 à 3 (action d'abord, briefs courts) */
(() => {
const { B, Q, V, S, O, C, X, T, K, G, L, R, mis } = window.NT_H;
window.NT_MISSIONS.push(

/* ===================== 1 · PREMIERS PAS ===================== */
mis('m1-1', 1, 'Épargner ou investir ?', 'Défi', 3, 'Faire la différence entre mettre de côté et faire travailler son argent.', [
  S('Range chaque situation', 'Épargne sûre', 'Investissement', [
    ['Le budget du permis de conduire, dans 6 mois', 'l', 'Besoin proche : on ne prend pas de risque.'],
    ['Une somme dont tu n’auras pas besoin avant 15 ans', 'r', 'Long horizon : on peut accepter des variations pour viser plus.'],
    ['L’argent pour un imprévu (voiture en panne)', 'l', 'C’est l’épargne de précaution : disponible et sans risque.'],
    ['Des actions d’une entreprise cotée', 'r', 'Une action peut monter ou baisser : c’est un investissement.'],
  ]),
  V('Avant d’investir, il vaut mieux avoir une épargne de précaution disponible.', true, 'Elle évite de devoir vendre ses placements au mauvais moment en cas d’imprévu.'),
  Q('Investir, c’est…', ['placer son argent en acceptant un risque pour viser plus de rendement', 'mettre son argent à l’abri de toute perte', 'dépenser intelligemment'], 0, 'Investir = accepter que la valeur varie, avec l’espoir d’un meilleur rendement sur la durée. Rien n’est garanti.'),
]),
mis('m1-2', 1, 'Risque et rendement', 'Défi', 3, 'Comprendre qu’un rendement plus élevé va avec un risque plus élevé.', [
  S('Plutôt prudent ou plutôt risqué ?', 'Prudent', 'Risqué', [
    ['Livret d’épargne réglementé', 'l', 'Capital garanti, disponible.'],
    ['Action d’une petite entreprise', 'r', 'Son cours peut varier très fortement.'],
    ['ETF sur un grand indice mondial', 'r', 'Diversifié, mais investi en actions : sa valeur peut baisser.'],
    ['Compte à terme', 'l', 'Taux connu à l’avance, capital garanti.'],
    ['« 10 % par mois garantis »', 'r', 'Promesse impossible : signe classique d’arnaque.'],
  ]),
  V('Un placement « sans risque et très rentable » est un bon signe.', false, 'Rendement élevé et absence de risque ne vont jamais ensemble.'),
]),
mis('m1-3', 1, 'La magie des intérêts composés', 'Simulateur', 5, 'Voir les gains produire eux-mêmes des gains avec le temps.', [
  L('1 000 € placés à 5 % par an (exemple). Bouge le curseur jusqu’au moment où ton capital a doublé.', 1000, 5, 1, 30, 2000, 'Il faut environ 15 ans : 1 000 € × 1,05¹⁵ ≈ 2 079 €. Plus la durée est longue, plus la courbe accélère.'),
  C('Règle de 72 : en combien d’années environ un placement à 6 % par an double-t-il ?', 12, 0.5, 'ans', '72 ÷ 6 = 12 ans. Une approximation utile pour calculer de tête.'),
  Q('Qu’est-ce qui renforce le plus l’effet boule de neige ?', ['Retirer ses gains chaque année', 'Laisser le temps faire et réinvestir', 'Changer de placement chaque mois'], 1, 'Réinvestir et garder longtemps. Les retraits et les frais freinent l’effet.'),
]),
mis('m1-4', 1, 'L’inflation, l’ennemi discret', 'Quiz', 3, 'Comprendre pourquoi un argent qui dort perd de la valeur.', [
  Q('Avec 2 % d’inflation par an pendant 10 ans, 1 000 € sous le matelas achèteront ce que valent aujourd’hui…', ['1 000 €', 'environ 820 €', 'environ 500 €'], 1, '1 000 ÷ 1,02¹⁰ ≈ 820 €. Le billet vaut toujours 1 000 €, mais il achète moins.'),
  C('Ton placement rapporte 1 % et l’inflation est de 3 %. Quel est ton rendement réel approximatif (en %) ?', -2, 0.1, '%', '1 % − 3 % ≈ −2 % : tu perds du pouvoir d’achat.'),
  V('L’inflation, c’est la hausse générale des prix.', true, 'C’est pour cela qu’un argent qui ne rapporte rien perd lentement de sa valeur.'),
]),
mis('m1-5', 1, 'Qu’est-ce qu’une action ?', 'Défi', 3, 'Savoir ce qu’on achète vraiment avec une action.', [
  X('Relie chaque mot à sa définition', [['Action', 'Une part du capital d’une entreprise'], ['Dividende', 'Une part du bénéfice versée aux actionnaires'], ['Cours', 'Le prix de l’action en bourse'], ['Actionnaire', 'Le copropriétaire de l’entreprise']], 'Avec une action, tu deviens copropriétaire : tu peux toucher des dividendes et voter en assemblée générale.'),
  V('Une entreprise est obligée de verser un dividende chaque année.', false, 'Le dividende n’est jamais garanti : il peut être réduit ou supprimé.'),
  Q('Pourquoi le cours d’une action bouge-t-il chaque jour ?', ['L’État le fixe', 'Selon l’offre et la demande des acheteurs et vendeurs', 'Il suit le prix des produits vendus'], 1, 'Le cours reflète ce que les acheteurs et les vendeurs acceptent d’échanger, selon leurs attentes.'),
]),
mis('m1-6', 1, 'Qu’est-ce qu’une obligation ?', 'Quiz', 3, 'Comprendre le prêt à une entreprise ou à un État.', [
  X('Relie', [['Obligation', 'Un prêt à une entreprise ou un État'], ['Coupon', 'Les intérêts versés au prêteur'], ['Échéance', 'La date de remboursement'], ['Émetteur', 'Celui qui emprunte']], 'Avec une obligation, tu prêtes de l’argent : tu touches des intérêts et tu es remboursé à l’échéance… si l’emprunteur peut payer.'),
  Q('Quel est le principal risque d’une obligation ?', ['Que l’emprunteur ne rembourse pas', 'Qu’elle devienne une action', 'Aucun'], 0, 'C’est le risque de défaut. Plus l’emprunteur est fragile, plus il doit offrir un taux élevé.'),
  V('Si les taux d’intérêt montent, le prix des obligations déjà émises a tendance à baisser.', true, 'Les nouvelles obligations rapportent plus : les anciennes, moins rémunératrices, valent moins.'),
]),
mis('m1-7', 1, 'La bourse, comment ça marche ?', 'Défi', 5, 'Le rôle de la bourse, des indices et des courtiers.', [
  O('Remets le trajet d’un ordre dans l’ordre', ['Tu passes un ordre sur ta plateforme', 'Ton courtier le transmet au marché', 'Il rencontre un vendeur au prix demandé', 'Les titres arrivent sur ton compte'], 'Tu ne vas jamais toi-même en bourse : ton courtier agréé fait l’intermédiaire.'),
  Q('Qu’est-ce que le CAC 40 ?', ['Une entreprise', 'Un indice qui suit 40 grandes entreprises cotées à Paris', 'Une banque'], 1, 'Un indice est un panier de référence : il résume l’évolution d’un marché.'),
  V('Une entreprise cotée en bourse peut faire faillite.', true, 'Être coté ne protège de rien : c’est pour cela qu’on diversifie.'),
]),
mis('m1-8', 1, 'Ton épargne de précaution', 'Simulateur', 3, 'Calculer le matelas de sécurité à garder avant d’investir.', [
  C('Tes dépenses sont de 1 100 € par mois. Pour 3 mois de précaution, il te faut combien ?', 3300, 1, '€', '3 × 1 100 € = 3 300 €. Beaucoup visent 3 à 6 mois selon la stabilité de leurs revenus.'),
  S('Où ranger cette épargne ?', 'Adapté', 'Pas adapté', [
    ['Un livret disponible à tout moment', 'l', 'Disponible et sans risque : parfait pour l’imprévu.'],
    ['Des actions', 'r', 'Elles peuvent baisser au moment où tu as besoin de l’argent.'],
    ['Un placement bloqué 5 ans', 'r', 'Une précaution doit être disponible tout de suite.'],
  ]),
]),
mis('m1-9', 1, 'Rendement : ce que ça veut vraiment dire', 'Quiz', 3, 'Calculer un rendement simple.', [
  C('Tu achètes une action 50 €, elle vaut 55 € un an plus tard. Quel est son rendement (en %) ?', 10, 0.1, '%', '(55 − 50) ÷ 50 = 10 %, avant frais et impôts.'),
  C('Elle baisse ensuite de 55 € à 44 €. Quelle est la baisse (en %) ?', 20, 0.2, '%', '(55 − 44) ÷ 55 = 20 %.'),
  V('Après une baisse de 50 %, il suffit d’une hausse de 50 % pour revenir au point de départ.', false, '100 € −50 % = 50 €. Pour revenir à 100 €, il faut +100 %. Les pertes pèsent plus lourd qu’elles n’en ont l’air.'),
]),
mis('m1-10', 1, 'Les grands indices du monde', 'Défi', 3, 'Associer chaque indice à son marché.', [
  X('Relie chaque indice à son marché', [['CAC 40', 'France'], ['S&P 500', 'États-Unis'], ['DAX', 'Allemagne'], ['Nikkei 225', 'Japon']], 'Les indices servent de thermomètre. Beaucoup d’ETF les reproduisent.'),
  V('Le S&P 500 suit environ 500 grandes entreprises américaines.', true, 'C’est l’indice le plus suivi au monde.'),
]),
mis('m1-11', 1, 'Le temps, ton meilleur allié', 'Simulateur', 5, 'Voir l’effet d’un petit versement mensuel sur la durée.', [
  L('Tu mets 50 € par mois à 4 % par an (exemple). Trouve après combien d’années tu dépasses 10 000 €.', 0, 4, 1, 30, 10000, 'Environ 14 ans : 8 400 € versés, le reste vient des intérêts composés. Calcul simplifié (versements regroupés chaque année, taux constant, jamais garanti).', 50),
  Q('Qu’est-ce qui compte le plus pour un petit épargnant qui commence ?', ['Commencer tôt et régulièrement', 'Trouver le placement miracle', 'Attendre d’avoir beaucoup d’argent'], 0, 'La régularité et le temps font l’essentiel du travail.'),
]),
mis('m1-12', 1, 'Défi : premier bilan', 'Défi', 7, 'Prouver que tu maîtrises les bases.', [
  S('Vrai réflexe ou fausse idée ?', 'Bon réflexe', 'Fausse idée', [
    ['Garder une épargne de précaution avant d’investir', 'l', 'C’est la base.'],
    ['Une action ne peut pas perdre plus de 10 %', 'r', 'Elle peut perdre bien plus, jusqu’à 100 % en cas de faillite.'],
    ['Investir l’argent du loyer du mois prochain', 'r', 'Jamais l’argent dont tu as besoin à court terme.'],
    ['Plus le rendement promis est élevé, plus le risque l’est aussi', 'l', 'C’est la règle d’or.'],
  ]),
  C('Combien vaut 2 000 € après une hausse de 10 % puis une baisse de 10 % ?', 1980, 1, '€', '2 000 × 1,1 = 2 200 ; 2 200 × 0,9 = 1 980 €. Une hausse puis une baisse du même pourcentage ne s’annulent pas.'),
  Q('Quel est le facteur le plus puissant des intérêts composés ?', ['La durée', 'La chance', 'Le nombre de placements'], 0, 'Le temps. C’est pourquoi on commence tôt.'),
]),

/* ===================== 2 · MA PREMIÈRE PLATEFORME ===================== */
mis('m2-1', 2, 'Ouvrir son compte', 'Simulateur', 3, 'Connaître les étapes d’ouverture chez un courtier, et pourquoi elles existent.', [
  O('Remets les étapes dans le bon ordre', ['Vérifier que le courtier est autorisé', 'Créer son compte et choisir l’enveloppe (PEA ou compte-titres)', 'Envoyer sa pièce d’identité et un justificatif', 'Déposer de l’argent', 'Passer son premier ordre'], 'On vérifie l’autorisation (registre REGAFI, listes noires de l’AMF), on ouvre, on prouve son identité, on dépose, puis on investit.'),
  V('Une plateforme qui ne demande aucune pièce d’identité est tout aussi sûre.', false, 'Un établissement autorisé est obligé de vérifier ton identité. L’absence de contrôle est un signal d’alerte.'),
]),
mis('m2-2', 2, 'PEA ou compte-titres ?', 'Défi', 5, 'Choisir la bonne enveloppe selon la situation.', [
  S('Quelle enveloppe convient ?', 'PEA', 'Compte-titres', [
    ['Acheter des actions américaines en direct', 'r', 'Les actions hors Union européenne ne sont pas éligibles au PEA en direct.'],
    ['Investir 20 ans dans des actions européennes', 'l', 'Long terme + actions européennes : l’usage typique du PEA.'],
    ['Acheter des obligations', 'r', 'Les obligations ne sont pas éligibles au PEA classique.'],
    ['Profiter d’un cadre fiscal avantageux après 5 ans', 'l', 'Après 5 ans, gains exonérés d’impôt sur le revenu (prélèvements sociaux dus).'],
  ]),
  B('À retenir', 'PEA : actions européennes, plafond de 150 000 € de versements, avantage fiscal après 5 ans. Compte-titres : presque tout, sans plafond, gains taxés à 31,4 % (2026).'),
  V('En principe, un retrait sur un PEA avant 5 ans entraîne sa clôture.', true, 'Sauf exceptions (licenciement, invalidité, création d’entreprise…).'),
]),
mis('m2-3', 2, 'Lire une fiche valeur', 'Simulateur', 5, 'Comprendre chaque chiffre d’une fiche action, comme sur une vraie plateforme.', [
  B('Exemplia (fictive)', 'Cours 42,50 € · +1,2 % · Volume 1,2 M · Capitalisation 8,5 Md€ · Dividende 1,20 €/an.'),
  X('Relie chaque chiffre à ce qu’il mesure', [['Capitalisation', 'Valeur de toutes les actions en bourse'], ['Volume', 'Nombre de titres échangés aujourd’hui'], ['Variation', 'Évolution du cours depuis la veille'], ['Dividende', 'Somme versée par action']], 'Capitalisation = cours × nombre d’actions. Un volume élevé signifie qu’il est facile d’acheter ou de vendre.'),
  C('Dividende 1,20 € et cours 42,50 € : quel est le rendement du dividende (en %) ?', 2.8, 0.15, '%', '1,20 ÷ 42,50 ≈ 2,8 %. Il change avec le cours et n’est jamais garanti.'),
]),
mis('m2-4', 2, 'Le carnet d’ordres et le spread', 'Simulateur', 5, 'Lire un carnet d’ordres et repérer le meilleur prix.', [
  K('Voici le carnet d’Exemplia. Quel est le spread ?', [[42.48, 300], [42.46, 520], [42.44, 410]], [[42.52, 250], [42.54, 600], [42.56, 380]], ['0,02 €', '0,04 €', '0,08 €'], 1, 'Meilleure vente 42,52 € − meilleur achat 42,48 € = 0,04 €. Plus il est petit, moins tu perds à l’aller-retour.'),
  Q('Tu achètes 100 actions au marché. Prix probable ?', ['42,48 €', '42,52 €', '42,56 €'], 1, 'Un achat au marché prend le meilleur vendeur : 42,52 € (250 titres disponibles).'),
  V('Sur une petite entreprise peu échangée, le spread est souvent plus large.', true, 'Moins d’acheteurs et de vendeurs = écart plus grand.'),
]),
mis('m2-5', 2, 'Ton premier ordre au marché', 'Simulateur', 3, 'Passer un ordre comme sur une vraie plateforme.', [
  T('Achète 5 actions Exemplia avec un ordre au marché.', 42.52, { side: 'buy', type: 'market', qty: 5 }, '5 × 42,52 € ≈ 212,60 €, plus les frais. C’est exactement ce que tu ferais sur une vraie plateforme.'),
  V('Un ordre au marché garantit le prix d’exécution.', false, 'Il garantit l’exécution s’il y a des vendeurs, pas le prix. Pour maîtriser le prix : l’ordre à cours limité.'),
]),
mis('m2-6', 2, 'L’ordre à cours limité', 'Simulateur', 5, 'Maîtriser le prix maximum que l’on accepte de payer.', [
  T('Achète 3 actions sans payer plus de 42,50 € chacune.', 42.52, { side: 'buy', type: 'limit', qty: 3, maxPrice: 42.50 }, 'Ton ordre attend dans le carnet à 42,50 € maximum : tu maîtrises le prix, pas le moment.'),
  Q('Le cours est à 42,52 €. Tu places un achat limité à 42,00 €. Que se passe-t-il ?', ['Exécuté tout de suite à 42,52 €', 'Il attend qu’un vendeur accepte 42,00 € ou moins', 'Il est annulé'], 1, 'L’ordre reste en attente selon sa durée de validité. Il peut ne jamais être exécuté.'),
]),
mis('m2-7', 2, 'Vendre avec un ordre limité', 'Simulateur', 3, 'Fixer un prix minimum de vente.', [
  T('Vends 4 actions Exemplia, mais pas en dessous de 43,00 €.', 42.52, { side: 'sell', type: 'limit', qty: 4, minPrice: 43.00 }, 'À la vente, la limite est un prix minimum : l’ordre s’exécute à 43,00 € ou mieux.'),
  V('Un ordre de vente limité à 43 € peut être exécuté à 43,10 €.', true, 'Le limité s’exécute à ton prix ou mieux.'),
]),
mis('m2-8', 2, 'Ce que coûtent vraiment les frais', 'Quiz', 3, 'Calculer les frais d’un ordre et leur effet.', [
  B('Grille fictive', '0,5 % du montant, minimum 5 €, à l’achat ET à la vente.'),
  C('Tu achètes pour 400 €. Combien de frais ?', 5, 0.01, '€', '0,5 % de 400 € = 2 €, mais le minimum est 5 €. Les petits ordres coûtent proportionnellement plus.'),
  C('Achat + revente de 400 € : quel % de ton capital part en frais ?', 2.5, 0.1, '%', '10 € sur 400 € = 2,5 %. L’action doit monter de 2,5 % juste pour rentrer dans tes frais.'),
]),
mis('m2-9', 2, 'Les ordres stop', 'Simulateur', 5, 'Comprendre le seuil de déclenchement.', [
  X('Relie chaque ordre à son effet', [['Au marché', 'Exécuté tout de suite au meilleur prix disponible'], ['Cours limité', 'Exécuté à ton prix ou mieux, sinon il attend'], ['Stop (seuil de déclenchement)', 'Devient un ordre au marché quand un prix est atteint']], 'Le stop sert souvent à limiter une perte : « si le cours tombe à X, vends ».'),
  V('Un ordre stop garantit le prix de vente en cas de chute brutale.', false, 'Une fois déclenché, il s’exécute au marché : en cas de trou de cotation, le prix peut être bien plus bas.'),
]),
mis('m2-10', 2, 'Les autres frais du courtier', 'Défi', 3, 'Repérer tous les frais avant de choisir un courtier.', [
  S('Est-ce un frais possible chez un courtier ?', 'Oui', 'Non', [
    ['Frais de courtage à chaque ordre', 'l', 'Le frais le plus connu.'],
    ['Frais de change sur une action en dollars', 'l', 'Souvent oublié : il s’applique à l’achat et à la vente.'],
    ['Droits de garde', 'l', 'Certains établissements facturent la conservation des titres.'],
    ['Un « bonus garanti » de 20 % sur ton dépôt', 'r', 'Méfiance : ce genre de promesse vient souvent de plateformes non autorisées.'],
  ]),
  Q('Où trouver la grille tarifaire complète ?', ['Dans la brochure tarifaire du courtier', 'Sur les réseaux sociaux', 'Nulle part'], 0, 'Tout courtier autorisé publie ses tarifs. Compare-les avant d’ouvrir.'),
]),
mis('m2-11', 2, 'Les heures de bourse', 'Quiz', 2, 'Savoir quand on peut acheter et vendre.', [
  V('On peut passer un ordre le dimanche, il sera exécuté à l’ouverture du marché.', true, 'L’ordre attend l’ouverture, au prix du moment (au marché) ou à ta limite.'),
  Q('Pourquoi une action peut-elle « ouvrir » à un prix très différent de la veille ?', ['Des nouvelles sont tombées pendant la fermeture', 'La bourse fait une erreur', 'Le courtier le décide'], 0, 'Résultats, annonces, actualité : le prix s’ajuste dès l’ouverture.'),
]),
mis('m2-12', 2, 'Défi : du dépôt au premier ordre', 'Défi', 7, 'Tout le parcours d’un vrai débutant, sans aide.', [
  O('Remets dans l’ordre', ['Vérifier le courtier sur REGAFI', 'Ouvrir un PEA', 'Déposer 300 €', 'Choisir l’ETF Monde', 'Passer un ordre limité'], 'Tu viens de refaire le parcours complet d’un vrai investisseur.'),
  T('Achète 8 parts de l’ETF Monde, sans payer plus de 32,00 € la part.', 31.80, { side: 'buy', type: 'limit', qty: 8, maxPrice: 32.00 }, 'Limite à 32,00 € alors que le cours est à 31,80 € : ton ordre est exécuté au meilleur prix disponible, ici environ 31,80 €.'),
  C('Avec la grille « 0,5 %, minimum 5 € », combien coûte un ordre de 254,40 € ?', 5, 0.01, '€', '0,5 % = 1,27 €, donc le minimum de 5 € s’applique.'),
]),

/* ===================== 3 · CONSTRUIRE MON PORTEFEUILLE ===================== */
mis('m3-1', 3, 'Tous ses œufs dans le même panier ?', 'Défi', 3, 'Comprendre pourquoi diversifier réduit le risque.', [
  S('Ce portefeuille est-il diversifié ?', 'Diversifié', 'Concentré', [
    ['100 % dans une seule action', 'r', 'Si l’entreprise chute, tout chute.'],
    ['Un ETF mondial de 1 500 entreprises', 'l', 'Un seul produit, mais des centaines d’entreprises dans de nombreux pays.'],
    ['5 actions, toutes des banques françaises', 'r', 'Même secteur, même pays : elles réagissent souvent pareil.'],
    ['6 secteurs et 4 zones géographiques', 'l', 'Les chocs ne frappent pas tout en même temps.'],
  ]),
  V('Diversifier supprime tout risque.', false, 'Il réduit le risque propre à une entreprise, pas celui de tout le marché.'),
]),
mis('m3-2', 3, 'Les ETF expliqués', 'Quiz', 5, 'Savoir ce qu’est un ETF et pourquoi il est si utilisé.', [
  X('Relie', [['ETF', 'Un fonds coté qui suit un indice'], ['Frais courants', 'Le coût annuel prélevé par le fonds'], ['Indice', 'Le panier d’entreprises suivi'], ['Réplication', 'La façon de copier l’indice']], 'En une seule ligne, un ETF te donne toutes les entreprises d’un indice, souvent avec des frais faibles.'),
  Q('Un ETF qui suit le CAC 40…', ['cherche à battre le CAC 40', 'cherche à reproduire l’évolution du CAC 40', 'garantit le capital'], 1, 'Il réplique l’indice, à la hausse comme à la baisse, frais déduits.'),
  V('Un ETF peut perdre de la valeur.', true, 'Si l’indice baisse, l’ETF baisse aussi.'),
]),
mis('m3-3', 3, 'Comparer deux ETF', 'Simulateur', 5, 'Comparer deux ETF comme un pro.', [
  B('Deux ETF fictifs sur le même indice', 'ETF A : frais 0,20 %/an. ETF B : frais 0,60 %/an. Même indice, même réplication.'),
  C('Sur 10 000 €, combien coûte l’ETF B de plus que l’ETF A chaque année ?', 40, 0.5, '€', '0,60 % − 0,20 % = 0,40 % de 10 000 € = 40 € par an, chaque année, avant même l’effet composé.'),
  Q('Quel document officiel décrit les risques et les frais d’un fonds ?', ['Le DIC (document d’informations clés)', 'Une publicité', 'Un avis sur un forum'], 0, 'Le DIC est obligatoire. On y trouve l’indicateur de risque (de 1 à 7) et les frais.'),
]),
mis('m3-4', 3, 'Répartir par pays et secteurs', 'Défi', 5, 'Lire la répartition d’un portefeuille.', [
  S('Bonne répartition ou trop concentrée ?', 'Équilibrée', 'Trop concentrée', [
    ['80 % dans la technologie', 'r', 'Un seul secteur domine : un choc sur la tech et tout baisse.'],
    ['Europe, États-Unis, Asie, émergents', 'l', 'Plusieurs zones : les cycles économiques ne sont pas synchronisés.'],
    ['Tout en actions de ton employeur', 'r', 'Double risque : ton salaire et ton épargne dépendent de la même entreprise.'],
  ]),
  Q('Un ETF « Monde » est souvent très exposé à…', ['l’Afrique', 'les États-Unis', 'l’Islande'], 1, 'Les indices mondiaux pèsent les entreprises selon leur taille : les grandes entreprises américaines y prennent une large place.'),
]),
mis('m3-5', 3, 'Ton horizon de placement', 'Défi', 3, 'Associer chaque projet à une durée et à un niveau de risque.', [
  X('Relie chaque projet à l’horizon adapté', [['Vacances l’été prochain', 'Court terme : épargne sûre'], ['Apport immobilier dans 4 ans', 'Moyen terme : prudence'], ['Retraite dans 35 ans', 'Long terme : on peut accepter des variations']], 'Plus l’horizon est long, plus on peut accepter des baisses passagères.'),
  V('On peut investir en actions l’argent d’un projet prévu le mois prochain.', false, 'Une baisse n’aurait pas le temps de se rattraper.'),
]),
mis('m3-6', 3, 'Investir un peu chaque mois', 'Simulateur', 5, 'Découvrir l’investissement programmé et le prix moyen.', [
  B('100 € par mois sur un ETF', 'Mois 1 : part à 20 €. Mois 2 : 25 €. Mois 3 : 16 €.'),
  C('Combien de parts as-tu au total ? (100 ÷ prix chaque mois, arrondi à 0,1)', 15.3, 0.15, 'parts', '5 + 4 + 6,25 = 15,25 parts. Quand le prix baisse, tes 100 € achètent plus de parts.'),
  C('Quel est ton prix moyen par part ? (300 € ÷ nombre de parts)', 19.67, 0.1, '€', '300 ÷ 15,25 ≈ 19,67 €, plus bas que la moyenne des trois prix (20,33 €). Ça ne garantit aucun gain, mais lisse le prix d’achat.'),
  V('Investir chaque mois supprime le risque de perte.', false, 'Ça lisse le prix d’entrée, mais la valeur peut toujours baisser.'),
]),
mis('m3-7', 3, 'Actions et obligations ensemble', 'Quiz', 3, 'Comprendre le rôle de chaque classe d’actifs.', [
  S('Plutôt actions ou plutôt obligations ?', 'Actions', 'Obligations', [
    ['Potentiel de croissance plus élevé sur le long terme', 'l', 'Avec des variations plus fortes.'],
    ['Revenus plus réguliers (coupons)', 'r', 'Avec un risque de défaut de l’émetteur.'],
    ['Copropriété d’une entreprise', 'l', 'C’est la définition d’une action.'],
    ['Prêt remboursé à l’échéance', 'r', 'C’est la définition d’une obligation.'],
  ]),
  V('Mélanger actions et obligations peut réduire les variations d’un portefeuille.', true, 'Elles ne réagissent pas toujours pareil : c’est l’intérêt de les combiner.'),
]),
mis('m3-8', 3, 'Le poids de chaque ligne', 'Simulateur', 3, 'Calculer le poids d’une ligne dans un portefeuille.', [
  C('Portefeuille de 5 000 €, dont 2 000 € sur une seule action. Quel est son poids (en %) ?', 40, 0.1, '%', '2 000 ÷ 5 000 = 40 %. Si elle chute de moitié, ton portefeuille perd 20 %.'),
  C('Elle chute de 50 %. Combien perd ton portefeuille (en %) ?', 20, 0.1, '%', '40 % × 50 % = 20 %. Limiter le poids d’une ligne limite ce genre de choc.'),
]),
mis('m3-9', 3, 'Distribuant ou capitalisant ?', 'Quiz', 3, 'Comprendre ce que deviennent les dividendes d’un ETF.', [
  X('Relie', [['ETF distribuant', 'Verse les dividendes aux porteurs'], ['ETF capitalisant', 'Réinvestit automatiquement les dividendes']], 'Le capitalisant fait jouer les intérêts composés sans action de ta part.'),
  V('Sur un compte-titres, un dividende versé est imposable l’année où il est reçu.', true, 'En 2026 : 31,4 % par défaut (flat tax).'),
]),
mis('m3-10', 3, 'Les frais sur 20 ans', 'Simulateur', 5, 'Voir l’effet des frais sur le long terme.', [
  L('10 000 € à 5 % par an moins 1 % de frais = 4 % net (exemple). En combien d’années dépasses-tu 20 000 € ?', 10000, 4, 1, 30, 20000, 'Il faut environ 18 ans à 4 % net, contre 15 ans à 5 % : 1 % de frais coûte des années.'),
  Q('Quel frais pèse le plus sur 20 ans ?', ['Un frais annuel de 1 % prélevé chaque année', 'Un frais unique de 5 € à l’achat'], 0, 'Un frais annuel se répète et s’accumule : sur 20 ans, il coûte bien plus qu’un frais unique.'),
]),
mis('m3-11', 3, 'Rééquilibrer simplement', 'Simulateur', 5, 'Revenir à sa répartition cible.', [
  B('Ta cible : 60 % actions, 40 % obligations', 'Après une forte hausse, ton portefeuille de 10 000 € contient 7 000 € d’actions et 3 000 € d’obligations.'),
  C('Combien d’euros d’actions faut-il vendre pour revenir à 60 / 40 ?', 1000, 1, '€', 'Cible actions : 6 000 €. 7 000 − 6 000 = 1 000 € à réallouer vers les obligations.'),
  V('Rééquilibrer pousse à vendre un peu de ce qui a monté.', true, 'C’est une discipline : elle évite de laisser le risque grimper sans s’en rendre compte.'),
]),
mis('m3-12', 3, 'Défi : 5 lignes solides', 'Défi', 10, 'Construire et défendre un portefeuille fictif diversifié.', [
  S('Garde ou écarte pour un portefeuille long terme diversifié', 'Je garde', 'J’écarte', [
    ['ETF Monde (fictif)', 'l', 'Base très diversifiée.'],
    ['ETF Obligations (fictif)', 'l', 'Amortit les variations.'],
    ['Une seule action « qui monte beaucoup en ce moment »', 'r', 'Concentration et effet de mode : risque élevé.'],
    ['Novix Santé (fictive)', 'l', 'Un secteur différent du reste.'],
    ['Un produit à effet de levier x10', 'r', 'Inadapté au long terme : les pertes peuvent être très rapides.'],
  ]),
  C('Tu répartis 2 000 € : 50 % ETF Monde, 30 % obligations, 20 % actions. Combien sur les obligations ?', 600, 1, '€', '30 % de 2 000 € = 600 €.'),
  R('Inès teste ton portefeuille', 'Inès', {
    start: { say: 'Ton portefeuille a l’air solide. Mais si les actions baissent de 30 %, tu fais quoi ?', options: [
      { t: 'Je m’en tiens à mon plan et je rééquilibre si besoin', good: true, next: 'ok', fb: 'Un plan écrit à l’avance évite les décisions de panique.' },
      { t: 'Je vends tout et je verrai plus tard', good: false, next: 'ko', fb: 'Vendre au plus bas fige la perte.' },
    ] },
    ok: { say: 'Parfait. C’est exactement pour ça que tu as des obligations : elles t’aident à tenir.', end: true },
    ko: { say: 'Hmm… réfléchis à ton horizon. Si tu n’as pas besoin de cet argent avant 15 ans, pourquoi vendre ?', end: true },
  }),
]),
);
})();
