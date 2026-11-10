/* NOVA MISSIONS — chapitres 7 à 9 + missions du jour + histoire */
(() => {
const { B, Q, V, S, O, C, X, T, K, G, L, R, mis } = window.NT_H;
window.NT_MISSIONS.push(

/* ===================== 7 · MA STRATÉGIE ===================== */
mis('m7-1', 7, 'Fixer son objectif', 'Défi', 5, 'Transformer une envie en objectif clair : montant, durée, usage.', [
  S('Objectif clair ou trop flou ?', 'Clair', 'Flou', [
    ['« Devenir riche »', 'r', 'Ni montant, ni durée, ni usage.'],
    ['« 15 000 € d’apport dans 6 ans pour un appartement »', 'l', 'Montant, durée, usage : on peut construire un plan.'],
    ['« Un complément de revenus à la retraite, dans 30 ans »', 'l', 'Horizon et usage définis.'],
    ['« Faire comme mon collègue »', 'r', 'Sa situation n’est pas la tienne.'],
  ]),
  C('Objectif : 12 000 € dans 5 ans, sans compter les gains. Combien mettre de côté par mois ?', 200, 1, '€', '12 000 ÷ 60 mois = 200 € par mois. Les éventuels gains sont un bonus, jamais une certitude.'),
]),
mis('m7-2', 7, 'Combien investir ?', 'Simulateur', 5, 'Construire un budget avant d’investir le moindre euro.', [
  O('Remets les priorités dans l’ordre', ['Payer ses dépenses essentielles', 'Constituer une épargne de précaution', 'Investir l’argent dont on n’a pas besoin avant longtemps'], 'Investir sans épargne de précaution oblige souvent à vendre au mauvais moment.'),
  C('Revenus 1 600 €, dépenses 1 250 €. Combien reste-t-il chaque mois pour épargner ?', 350, 1, '€', '1 600 − 1 250 = 350 €. C’est ta capacité d’épargne : on décide ensuite quelle part va à la précaution, quelle part à l’investissement.'),
]),
mis('m7-3', 7, 'Répartir : actions, obligations, liquidités', 'Simulateur', 7, 'Voir comment la répartition change le risque.', [
  S('Pour quel profil cette répartition est-elle la plus cohérente ?', 'Horizon court', 'Horizon long', [
    ['20 % actions, 80 % obligations et liquidités', 'l', 'Peu de variations : cohérent si on a besoin de l’argent bientôt.'],
    ['80 % actions, 20 % obligations', 'r', 'Plus de variations, acceptable si on n’a pas besoin de l’argent avant longtemps.'],
  ]),
  C('Portefeuille de 20 000 € à 70 % actions. Si les actions chutent de 30 % (le reste stable), combien perds-tu ?', 4200, 1, '€', '14 000 € × 30 % = 4 200 € (−21 % au total). Peux-tu le supporter sans vendre ? C’est la vraie question.'),
]),
mis('m7-4', 7, 'Le rééquilibrage', 'Simulateur', 5, 'Revenir à sa répartition cible après une forte variation.', [
  B('Cible 70 / 30', 'Après une baisse, ton portefeuille de 10 000 € contient 6 000 € d’actions et 4 000 € d’obligations.'),
  C('Combien d’euros faut-il basculer des obligations vers les actions pour revenir à 70 / 30 ?', 1000, 1, '€', 'Cible actions : 7 000 €. Il manque 1 000 €. Le rééquilibrage pousse à racheter ce qui a baissé, sans prédire l’avenir.'),
  Q('À quelle fréquence rééquilibrer, en général ?', ['Chaque jour', 'Une à deux fois par an, ou quand l’écart devient important', 'Jamais'], 1, 'Trop souvent coûte des frais, jamais laisse dériver le risque.'),
]),
mis('m7-5', 7, 'Investir chaque mois sur 10 ans', 'Simulateur', 7, 'Simuler un plan régulier, sans promesse.', [
  L('150 € par mois à 5 % par an (exemple). Trouve l’année où tu dépasses 20 000 €.', 0, 5, 1, 25, 20000, 'Environ 10 ans : 18 000 € versés, le reste vient des intérêts composés. Calcul simplifié, taux constant, jamais garanti.', 150),
  V('Ce calcul prouve que tu auras 20 000 € dans 10 ans.', false, 'C’est une illustration. Les rendements réels varient chaque année et peuvent être négatifs.'),
]),
mis('m7-6', 7, 'Les règles en cas de crise', 'Jeu de rôle', 5, 'Écrire à l’avance ce que tu feras quand ça baisse.', [
  R('Préparer la tempête', 'Nova Coach', {
    start: { say: 'Écrivons ta règle n°1. Si ton portefeuille baisse de 20 % :', options: [
      { t: 'Je ne vends pas, je continue mon plan mensuel', good: true, next: 'r2', fb: 'Une règle simple, décidée à froid.' },
      { t: 'Je déciderai sur le moment', good: false, next: 'r2', fb: 'Sur le moment, l’émotion décide à ta place.' },
    ] },
    r2: { say: 'Règle n°2. Si une ligne dépasse 20 % de ton portefeuille :', options: [
      { t: 'Je la ramène à ma limite lors du rééquilibrage', good: true, next: 'fin', fb: 'Tu gardes le risque sous contrôle.' },
      { t: 'Je la laisse grossir, elle monte', good: false, next: 'fin', fb: 'C’est ainsi que le risque devient trop concentré.' },
    ] },
    fin: { say: 'Tes règles sont prêtes. On les relit avant chaque décision importante.', end: true },
  }),
]),
mis('m7-7', 7, 'Gestion passive ou active ?', 'Quiz', 3, 'Comprendre deux grandes approches.', [
  X('Relie', [['Gestion passive', 'Suivre un indice avec des ETF à frais bas'], ['Gestion active', 'Choisir des titres pour tenter de battre un indice'], ['Benchmark', 'L’indice de référence auquel on se compare']], 'Aucune approche ne garantit le résultat. Les frais, eux, sont certains.'),
  V('Battre un indice durablement est facile.', false, 'Beaucoup de fonds actifs n’y parviennent pas sur la durée, notamment à cause de leurs frais.'),
]),
mis('m7-8', 7, 'Le cycle de vie de l’investisseur', 'Défi', 3, 'Adapter sa stratégie selon les étapes de la vie.', [
  X('Relie chaque étape à une priorité raisonnable', [['Premier emploi', 'Épargne de précaution, premiers versements réguliers'], ['Projet immobilier proche', 'Sécuriser l’apport'], ['Approche de la retraite', 'Réduire peu à peu la part la plus risquée']], 'On ajuste le risque à l’horizon de chaque projet.'),
]),
mis('m7-9', 7, 'Écrire son plan d’investissement', 'Jeu de rôle', 10, 'Rédiger ton plan avec Nova Coach.', [
  O('Remets les étapes du plan dans l’ordre', ['Mon objectif (montant, durée)', 'Mon épargne de précaution', 'Ma répartition cible', 'Mon versement mensuel', 'Mes règles en cas de crise', 'Ma date de bilan annuel'], 'Un plan tient en une page. Il protège de tes propres émotions.'),
  R('Relecture', 'Nova Coach', {
    start: { say: 'Ton plan dit 80 % actions, mais tu as besoin de l’argent dans 2 ans. Cohérent ?', options: [
      { t: 'Non, je réduis la part d’actions pour ce projet', good: true, next: 'fin', fb: 'Horizon court = moins de risque.' },
      { t: 'Oui, ça montera bien d’ici là', good: false, next: 'fin', fb: 'Sur 2 ans, une baisse peut ne pas se rattraper.' },
    ] },
    fin: { say: 'Ton plan est prêt. Je ne te dis pas quoi acheter : je t’aide à rester cohérent avec tes propres objectifs.', end: true },
  }),
]),
mis('m7-10', 7, 'Le bilan annuel', 'Quiz', 3, 'Faire le point une fois par an, calmement.', [
  S('À vérifier lors de ton bilan annuel ?', 'Oui', 'Pas utile', [
    ['Ma répartition est-elle encore proche de ma cible ?', 'l', 'C’est le moment de rééquilibrer.'],
    ['Mon objectif ou ma situation ont-ils changé ?', 'l', 'Le plan suit ta vie.'],
    ['Le cours d’hier à 15 h 32', 'r', 'Le bruit quotidien ne compte pas.'],
    ['Les frais que je paie', 'l', 'Ils pèsent chaque année.'],
  ]),
]),
mis('m7-11', 7, 'Défi final : ta stratégie face à 3 crises', 'Défi', 15, 'Tester ta stratégie fictive sur trois époques difficiles.', [
  C('2000-2002 : un portefeuille 100 % actions de 10 000 € perd 50 %. Valeur ?', 5000, 1, '€', '10 000 × 0,5 = 5 000 €.'),
  C('Même période, 60 % actions (−50 %) et 40 % obligations (+10 %). Valeur ?', 7400, 1, '€', '6 000 × 0,5 + 4 000 × 1,1 = 3 000 + 4 400 = 7 400 €.'),
  C('2008 : avec 60 / 40, actions −55 %, obligations +5 %. Valeur pour 10 000 € ?', 6900, 1, '€', '6 000 × 0,45 + 4 000 × 1,05 = 2 700 + 4 200 = 6 900 €.'),
  Q('Qu’est-ce qui t’a le plus protégé dans ces trois crises ?', ['La répartition et le plan', 'La chance', 'Regarder les cours tous les jours'], 0, 'Chiffres d’illustration simplifiés. Ce qui protège : répartition, horizon, épargne de précaution, discipline.'),
]),

/* ===================== 8 · MES ENVELOPPES ===================== */
mis('m8-1', 8, 'Les livrets réglementés', 'Quiz', 3, 'Connaître l’épargne sûre et disponible.', [
  S('Vrai pour un livret réglementé (comme le Livret A) ?', 'Vrai', 'Faux', [
    ['Capital garanti', 'l', 'Tu ne peux pas perdre ce que tu as versé.'],
    ['Argent disponible à tout moment', 'l', 'Idéal pour l’épargne de précaution.'],
    ['Taux fixé librement par ta banque', 'r', 'Le taux des livrets réglementés est fixé par les pouvoirs publics.'],
    ['Peut rapporter 10 % par an', 'r', 'Le taux suit les conditions économiques, loin de tels niveaux.'],
  ]),
  V('Les intérêts du Livret A sont exonérés d’impôt et de prélèvements sociaux.', true, 'C’est l’un de ses avantages. Le plafond de versement est limité.'),
]),
mis('m8-2', 8, 'Le PEA en détail', 'Défi', 5, 'Maîtriser les règles du PEA.', [
  X('Relie', [['Plafond de versements', '150 000 €'], ['Avant 5 ans', 'Un retrait clôture en principe le plan'], ['Après 5 ans', 'Gains exonérés d’impôt, prélèvements sociaux dus'], ['PEA jeunes', 'Pour un jeune majeur rattaché au foyer, 20 000 €']], 'Le PEA récompense la patience. Les gains réalisés à l’intérieur ne comptent pas dans le plafond.'),
  C('Après 5 ans, ton PEA a fait 4 000 € de gains. Prélèvements sociaux en 2026 (18,6 %) ?', 744, 1, '€', '4 000 × 18,6 % = 744 €, sans impôt sur le revenu. Sur un compte-titres, ce serait 31,4 %, soit 1 256 €.'),
]),
mis('m8-3', 8, 'L’assurance-vie', 'Quiz', 5, 'Comprendre fonds euros et unités de compte.', [
  X('Relie', [['Fonds euros', 'Capital garanti par l’assureur, rendement plus modeste'], ['Unités de compte', 'Supports investis (actions, ETF…), risque de perte en capital'], ['Rachat', 'Retrait de tout ou partie de l’épargne']], 'L’assurance-vie n’est pas bloquée : on peut retirer à tout moment, avec une fiscalité qui dépend de l’âge du contrat.'),
  V('Après 8 ans, un abattement annuel s’applique sur les gains retirés (4 600 € pour une personne seule).', true, '9 200 € pour un couple. Les prélèvements sociaux restent dus (17,2 % pour l’assurance-vie).'),
  Q('Une assurance-vie investie en unités de compte…', ['garantit le capital', 'comporte un risque de perte en capital', 'est bloquée 8 ans'], 1, 'Les unités de compte peuvent perdre de la valeur. Et l’assurance-vie n’est pas bloquée.'),
]),
mis('m8-4', 8, 'Le PER, pour la retraite', 'Quiz', 5, 'Comprendre le plan d’épargne retraite.', [
  V('L’argent d’un PER est en principe bloqué jusqu’à la retraite.', true, 'Sauf cas prévus par la loi (achat de la résidence principale, invalidité, surendettement, fin des droits au chômage…).'),
  Q('Quel est l’avantage principal des versements volontaires sur un PER ?', ['Ils peuvent être déduits du revenu imposable, dans une limite', 'Ils sont garantis à 10 %', 'Ils sont disponibles tout de suite'], 0, 'L’impôt est réduit aujourd’hui, mais la sortie sera imposée plus tard. Intéressant surtout si ton taux d’imposition est élevé.'),
]),
mis('m8-5', 8, 'L’épargne salariale', 'Défi', 5, 'Comprendre PEE, intéressement, participation et abondement.', [
  X('Relie', [['Intéressement', 'Prime liée aux performances de l’entreprise'], ['Participation', 'Part des bénéfices redistribuée aux salariés'], ['PEE', 'Plan d’épargne entreprise, bloqué 5 ans'], ['Abondement', 'Somme ajoutée par l’employeur à tes versements']], 'Placée sur le PEE, une prime d’intéressement ou de participation est exonérée d’impôt sur le revenu (dans une limite).'),
  V('L’argent d’un PEE peut être débloqué avant 5 ans dans certains cas (mariage, naissance du 3ᵉ enfant, achat de la résidence principale…).', true, 'La loi prévoit une liste de cas de déblocage anticipé, avec justificatif.'),
]),
mis('m8-6', 8, 'L’abondement, de l’argent offert', 'Simulateur', 3, 'Calculer ce que rapporte l’abondement.', [
  C('Ton employeur abonde 100 % de tes versements jusqu’à 500 €. Tu verses 500 €. Total sur ton PEE ?', 1000, 1, '€', '500 € de ta part + 500 € d’abondement = 1 000 €, avant tout placement. Lis toujours les règles de ton plan.'),
  V('L’abondement est le même dans toutes les entreprises.', false, 'Chaque entreprise fixe ses règles dans un accord.'),
]),
mis('m8-7', 8, 'Quelle enveloppe pour quel projet ?', 'Défi', 5, 'Choisir l’enveloppe selon le projet.', [
  X('Relie chaque projet à une enveloppe cohérente', [['Imprévu de voiture', 'Livret réglementé'], ['Actions européennes sur 10 ans', 'PEA'], ['Retraite avec réduction d’impôt aujourd’hui', 'PER'], ['Épargne long terme souple et transmission', 'Assurance-vie']], 'Pas de bonne enveloppe universelle : tout dépend du projet et de l’horizon.'),
]),
mis('m8-8', 8, 'Déclarer ses placements', 'Quiz', 5, 'Savoir ce qu’on déclare et quand.', [
  S('À déclarer aux impôts l’année suivante ?', 'Oui', 'Non', [
    ['Plus-values réalisées sur un compte-titres', 'l', 'Ton courtier t’envoie un récapitulatif (IFU).'],
    ['Gains dans un PEA sans aucun retrait', 'r', 'Tant que tu ne retires rien, pas d’imposition.'],
    ['Dividendes reçus sur un compte-titres', 'l', 'Imposables (une partie est souvent prélevée à la source).'],
    ['Intérêts du Livret A', 'r', 'Exonérés.'],
  ]),
  Q('Qu’est-ce que l’IFU ?', ['Le récapitulatif annuel envoyé par ton courtier', 'Un impôt nouveau', 'Un type d’ETF'], 0, 'Il reprend dividendes, plus-values et moins-values. Vérifie-le avant de valider ta déclaration.'),
]),
mis('m8-9', 8, 'Moins-values : ne pas les perdre', 'Quiz', 3, 'Utiliser ses pertes sur un compte-titres.', [
  V('Une moins-value sur un compte-titres peut réduire l’impôt sur des plus-values futures pendant 10 ans.', true, 'Elle s’impute sur les plus-values de même nature des 10 années suivantes.'),
  C('Plus-value de 1 500 €, moins-value reportée de 600 €. Gain imposable ?', 900, 1, '€', '1 500 − 600 = 900 €.'),
]),
mis('m8-10', 8, 'Flat tax ou barème ?', 'Simulateur', 5, 'Comprendre l’option pour le barème progressif.', [
  C('Dividende brut de 1 000 € avec la flat tax 2026 (31,4 %). Combien reste-t-il ?', 686, 1, '€', '1 000 × (1 − 0,314) = 686 €.'),
  V('L’option pour le barème progressif s’applique à tous les revenus de placement de l’année, pas à un seul.', true, 'C’est une option globale, révisable chaque année. Elle peut intéresser les foyers peu imposés.'),
]),
mis('m8-11', 8, 'Les frais d’une assurance-vie', 'Simulateur', 3, 'Repérer les frais qui comptent.', [
  S('Est-ce un frais possible ?', 'Oui', 'Non', [
    ['Frais sur versement', 'l', 'Prélevés à chaque versement, parfois nuls en ligne.'],
    ['Frais de gestion annuels', 'l', 'Prélevés chaque année : ce sont ceux qui pèsent le plus.'],
    ['Frais des supports (ETF, fonds)', 'l', 'Ils s’ajoutent aux frais du contrat.'],
  ]),
  C('Frais de gestion de 0,6 % par an sur 20 000 €. Coût annuel ?', 120, 1, '€', '20 000 × 0,6 % = 120 € par an, avant les frais des supports.'),
]),
mis('m8-12', 8, 'Défi : le tour des enveloppes', 'Défi', 7, 'Prouver que tu sais choisir la bonne enveloppe.', [
  S('PEA ou assurance-vie ?', 'PEA', 'Assurance-vie', [
    ['Je veux un fonds en euros à capital garanti', 'r', 'Le fonds euros n’existe qu’en assurance-vie.'],
    ['Je veux des actions européennes avec un avantage fiscal après 5 ans', 'l', 'C’est le cœur du PEA.'],
    ['Je pense à la transmission à mes proches', 'r', 'L’assurance-vie offre un cadre spécifique pour la transmission.'],
  ]),
  C('Gain de 2 000 € retiré d’un PEA de plus de 5 ans : prélèvements sociaux 2026 ?', 372, 1, '€', '2 000 × 18,6 % = 372 €.'),
]),

/* ===================== 9 · PRODUITS RISQUÉS : LES COMPRENDRE ===================== */
mis('m9-1', 9, 'L’effet de levier', 'Simulateur', 5, 'Comprendre pourquoi le levier est si dangereux.', [
  C('Tu investis 1 000 € avec un levier de 10 (exposition 10 000 €). Le marché baisse de 5 %. Combien perds-tu ?', 500, 1, '€', '10 000 × 5 % = 500 €, soit la moitié de ta mise pour une baisse de seulement 5 %.'),
  C('Avec ce levier, quelle baisse du marché efface 100 % de ta mise (en %) ?', 10, 0.1, '%', '−10 % × 10 = −100 %. Le levier multiplie les gains ET les pertes.'),
]),
mis('m9-2', 9, 'Les CFD', 'Quiz', 3, 'Savoir ce qu’est un CFD et pourquoi il est encadré.', [
  V('Un CFD permet de parier sur la variation d’un prix sans posséder le titre, souvent avec un effet de levier.', true, 'C’est un contrat financier complexe.'),
  Q('Que montrent les avertissements obligatoires affichés par les plateformes de CFD ?', ['Qu’une majorité de comptes de particuliers perdent de l’argent', 'Que les gains sont garantis', 'Rien d’utile'], 0, 'Ces pourcentages, affichés par chaque plateforme, sont souvent très élevés.'),
  Q('Pour un investisseur débutant à long terme, les CFD sont…', ['inadaptés', 'indispensables', 'sans risque'], 0, 'Produits spéculatifs à court terme, inadaptés à un projet de long terme.'),
]),
mis('m9-3', 9, 'La crypto : comprendre sans foncer', 'Défi', 5, 'Connaître les risques des crypto-actifs.', [
  S('Vrai ou faux sur les crypto-actifs ?', 'Vrai', 'Faux', [
    ['Leur prix peut varier de plus de 10 % en une journée', 'l', 'La volatilité est très forte.'],
    ['Ils sont garantis comme un livret', 'r', 'Aucune garantie : la perte peut être totale.'],
    ['Le piratage d’une plateforme peut faire perdre ses avoirs', 'l', 'C’est le risque cyber.'],
    ['En France, seuls les prestataires autorisés peuvent proposer ces services', 'l', 'Depuis le règlement européen MiCA, il faut un agrément.'],
  ]),
  V('Promouvoir des crypto-actifs comme un placement sûr est une pratique trompeuse.', true, 'Les risques doivent toujours être présentés.'),
]),
mis('m9-4', 9, 'Les options, en simple', 'Quiz', 3, 'Comprendre le principe d’une option.', [
  X('Relie', [['Option d’achat (call)', 'Droit d’acheter à un prix fixé'], ['Option de vente (put)', 'Droit de vendre à un prix fixé'], ['Prime', 'Le prix payé pour l’option'], ['Échéance', 'La date limite pour exercer']], 'Une option peut perdre 100 % de sa valeur à l’échéance.'),
  V('Les options binaires sont interdites de commercialisation aux particuliers dans l’Union européenne.', true, 'L’Europe les a interdites aux clients particuliers.'),
]),
mis('m9-5', 9, 'Vente à découvert', 'Quiz', 3, 'Comprendre le pari à la baisse.', [
  V('Vendre à découvert, c’est vendre un titre qu’on ne possède pas en espérant le racheter moins cher.', true, 'Si le cours monte, la perte théorique n’a pas de limite.'),
  Q('Pourquoi est-ce particulièrement risqué ?', ['La perte peut dépasser la mise', 'C’est garanti', 'Les frais sont nuls'], 0, 'Un cours peut monter sans limite : la perte aussi.'),
]),
mis('m9-6', 9, 'Le trading intensif', 'Jeu de rôle', 5, 'Prendre du recul sur le trading à court terme.', [
  R('La promesse du « day trading »', 'Lucas', {
    start: { say: 'J’ai vu une vidéo : en tradant 2 heures par jour, on vit de la bourse. On essaie ?', options: [
      { t: 'Les frais et les émotions font perdre la plupart des traders particuliers', good: true, next: 'a', fb: 'Les études des régulateurs montrent que la majorité des particuliers perdent de l’argent en trading intensif.' },
      { t: 'Oui, c’est facile', good: false, next: 'a', fb: 'Ce qui est présenté comme facile l’est rarement.' },
    ] },
    a: { say: 'Et si je teste juste avec mon argent de côté ?', options: [
      { t: 'Teste plutôt dans le simulateur, sans argent réel', good: true, next: 'fin', fb: 'C’est fait pour ça : apprendre sans risque.' },
      { t: 'Mets tout, tu verras bien', good: false, next: 'fin', fb: 'Jamais l’argent de ta sécurité.' },
    ] },
    fin: { say: 'OK, simulateur d’abord. Et je regarde mes frais avant de croire les vidéos.', end: true },
  }),
]),
mis('m9-7', 9, 'Les placements atypiques', 'Défi', 3, 'Reconnaître les placements « exotiques » risqués.', [
  S('Signal d’alerte ?', 'Prudence raisonnable', 'Alerte', [
    ['Vin, montres, diamants avec « rendement garanti »', 'r', 'Les placements atypiques garantis sont souvent des arnaques.'],
    ['Produit avec un document d’information validé et des risques expliqués', 'l', 'Bon signe de transparence, sans garantie de résultat.'],
    ['« Placement sans risque à 15 % »', 'r', 'Impossible.'],
  ]),
]),
mis('m9-8', 9, 'Défi : le bon niveau de risque', 'Défi', 7, 'Faire le tri entre investissement et spéculation.', [
  S('Investissement de long terme ou spéculation ?', 'Long terme', 'Spéculation', [
    ['ETF Monde gardé 15 ans avec des versements réguliers', 'l', 'Démarche de long terme.'],
    ['CFD avec levier x20 sur une heure', 'r', 'Spéculation pure.'],
    ['Crypto achetée parce qu’un influenceur l’annonce « x100 »', 'r', 'Spéculation et risque d’arnaque.'],
    ['Portefeuille actions/obligations rééquilibré chaque année', 'l', 'Discipline de long terme.'],
  ]),
  C('Levier 5, marché −8 %. Perte sur ta mise (en %) ?', 40, 0.1, '%', '5 × 8 % = 40 % de ta mise.'),
]),
);

/* ---------- MISSIONS DU JOUR : une différente chaque jour ----------
   En production : générées chaque matin à partir d'une vraie actualité,
   relues avant publication. Ici, une réserve de 12 missions qui tourne. */
window.NT_DAILY_POOL = [
  mis('d-1', 0, 'Pourquoi les taux font bouger la bourse', 'Mission du jour', 3, 'Comprendre le lien entre les taux des banques centrales et les marchés.', [
    B('L’info du jour (exemple)', 'Une banque centrale relève ses taux : emprunter coûte plus cher, les placements sans risque rapportent plus.'),
    Q('Si les taux montent, le coût d’un emprunt pour une entreprise…', ['baisse', 'augmente', 'ne change pas'], 1, 'Un crédit plus cher peut peser sur les bénéfices futurs.'),
    V('Une annonce de banque centrale permet de prévoir à coup sûr la réaction des marchés.', false, 'Les marchés réagissent aussi à ce qui était déjà anticipé.'),
  ]),
  mis('d-2', 0, 'Résultats meilleurs que prévu, cours en baisse ?', 'Mission du jour', 3, 'Comprendre le rôle des attentes.', [
    V('Une entreprise peut annoncer un bénéfice record et voir son cours baisser.', true, 'Si le marché attendait encore mieux, ou si les perspectives déçoivent.'),
    Q('Ce qui fait le plus bouger un cours le jour des résultats :', ['l’écart avec les attentes', 'la longueur du rapport', 'l’heure de publication'], 0, 'Le marché compare toujours à ce qu’il attendait.'),
  ]),
  mis('d-3', 0, 'L’inflation du mois', 'Mission du jour', 3, 'Relier l’inflation à ton épargne.', [
    C('Les prix montent de 3 % sur un an. Un panier de 200 € coûte maintenant ?', 206, 0.5, '€', '200 × 1,03 = 206 €.'),
    V('Si ton livret rapporte moins que l’inflation, ton pouvoir d’achat baisse.', true, 'Le rendement réel est négatif.'),
  ]),
  mis('d-4', 0, 'Le pétrole et les compagnies aériennes', 'Mission du jour', 3, 'Comprendre qu’une même nouvelle touche les secteurs différemment.', [
    S('Hausse du prix du pétrole : plutôt défavorable ou favorable ?', 'Défavorable', 'Favorable', [
      ['Compagnies aériennes', 'l', 'Le carburant coûte plus cher.'],
      ['Producteurs de pétrole', 'r', 'Ils vendent plus cher.'],
      ['Transporteurs routiers', 'l', 'Coûts en hausse.'],
    ]),
  ]),
  mis('d-5', 0, 'Le dollar monte : et alors ?', 'Mission du jour', 3, 'Comprendre le risque de change.', [
    V('Si tu détiens une action américaine et que le dollar baisse face à l’euro, ta position vaut moins en euros, toutes choses égales par ailleurs.', true, 'C’est le risque de change.'),
    Q('Un ETF Monde acheté en euros est exposé…', ['seulement à l’euro', 'aux devises des pays où il investit', 'à aucune devise'], 1, 'Ses entreprises sont cotées dans de nombreuses devises.'),
  ]),
  mis('d-6', 0, 'Une introduction en bourse', 'Mission du jour', 3, 'Comprendre ce qu’est une IPO.', [
    O('Remets les étapes d’une introduction en bourse dans l’ordre', ['L’entreprise prépare un document d’information', 'Le prix d’introduction est fixé', 'Les investisseurs souscrivent', 'Les actions commencent à s’échanger'], 'Un premier jour en forte hausse ne dit rien de la suite.'),
  ]),
  mis('d-7', 0, 'Le dividende détaché', 'Mission du jour', 3, 'Comprendre ce qui se passe le jour du détachement.', [
    V('Le jour du détachement, le cours baisse mécaniquement d’environ le montant du dividende.', true, 'La valeur sort de l’entreprise pour aller aux actionnaires.'),
    C('Cours 40 €, dividende 1,50 €. Cours théorique après détachement ?', 38.5, 0.05, '€', '40 − 1,50 = 38,50 €, avant les autres mouvements du marché.'),
  ]),
  mis('d-8', 0, 'Une rumeur de rachat', 'Mission du jour', 3, 'Savoir réagir à une rumeur.', [
    S('Bon réflexe ?', 'Oui', 'Non', [
      ['Chercher un communiqué officiel de l’entreprise', 'l', 'Seule source fiable.'],
      ['Acheter tout de suite avant les autres', 'r', 'Les rumeurs servent parfois à manipuler les cours.'],
      ['Vérifier la date et la source', 'l', 'Toujours.'],
    ]),
  ]),
  mis('d-9', 0, 'Le chômage et la bourse', 'Mission du jour', 3, 'Relier économie et marchés.', [
    V('Les marchés réagissent souvent aux chiffres de l’emploi parce qu’ils renseignent sur la santé de l’économie.', true, 'Et sur les décisions possibles des banques centrales.'),
  ]),
  mis('d-10', 0, 'Le spread du matin', 'Mission du jour', 2, 'Réviser le carnet d’ordres.', [
    K('Quel est le spread ?', [[18.38, 900], [18.36, 1200]], [[18.42, 700], [18.44, 1500]], ['0,02 €', '0,04 €', '0,06 €'], 1, '18,42 − 18,38 = 0,04 €.'),
  ]),
  mis('d-11', 0, 'Une arnaque qui circule', 'Mission du jour', 3, 'Reconnaître une arnaque dans l’actualité.', [
    S('Arnaque ?', 'Non', 'Oui', [
      ['Faux site imitant une banque connue', 'r', 'L’usurpation d’identité est très répandue.'],
      ['Livret proposé dans l’appli de ta banque', 'l', 'Canal officiel.'],
      ['« Investis via ce lien reçu par SMS »', 'r', 'Jamais de lien reçu par SMS.'],
    ]),
  ]),
  mis('d-12', 0, 'Les marchés asiatiques', 'Mission du jour', 3, 'Comprendre le décalage horaire des marchés.', [
    V('Quand Paris ouvre, la bourse de Tokyo a déjà terminé sa séance.', true, 'Les marchés se relaient autour du globe.'),
    Q('Pourquoi un indice européen peut-il ouvrir en baisse après une nuit agitée en Asie ?', ['Les nouvelles circulent et les investisseurs réagissent', 'Par obligation légale', 'Par hasard'], 0, 'Les marchés sont liés entre eux.'),
  ]),
];

/* ---------- HISTOIRE : ta première année d'investisseur (1 épisode / jour) ---------- */
window.NT_STORY = [
  mis('s-1', 0, 'Épisode 1 · Le premier salaire', 'Histoire', 5, 'Organiser son argent dès le premier salaire.', [
    B('Septembre', 'Ton premier salaire arrive : 1 650 €. Inès, ton amie, investit depuis deux ans.'),
    O('Inès te conseille un ordre de priorité. Remets-le dans l’ordre.', ['Payer loyer, courses, transports', 'Mettre de côté une épargne de précaution', 'Investir seulement le reste, sur le long terme'], 'Inès sourit : « Tu as compris l’essentiel. »'),
    C('Tes dépenses mensuelles font 1 200 €. 3 mois de précaution, c’est combien ?', 3600, 1, '€', '3 × 1 200 € = 3 600 €. Ce sera ton premier objectif.'),
  ], { teaser: 'Demain : tu choisis ton courtier… et quelqu’un essaie de t’arnaquer.' }),
  mis('s-2', 0, 'Épisode 2 · Le courtier', 'Histoire', 5, 'Choisir un courtier sans tomber dans un piège.', [
    S('Tu compares des plateformes. Garde ou fuis ?', 'Je garde', 'Je fuis', [
      ['Présente sur REGAFI, frais publiés', 'l', 'Solide.'],
      ['« Bonus de 100 % sur ton dépôt » reçu par Instagram', 'r', 'Classique des plateformes non autorisées.'],
      ['Courtier qui propose un PEA et des ETF', 'l', 'Adapté à ton projet.'],
    ]),
    R('Un message privé', '« Kevin », trader', {
      start: { say: 'Salut ! Je gère l’argent de 300 personnes, 15 % par mois. Je t’envoie le lien ?', options: [
        { t: 'Non merci, je ne réponds pas aux contacts non sollicités', good: true, next: 'fin', fb: 'Parfait réflexe.' },
        { t: 'Envoie, je regarde', good: false, next: 'fin', fb: '15 % par mois promis : arnaque assurée.' },
      ] },
      fin: { say: '(Kevin ne répond plus. Inès : « Bien joué, ils essaient avec tout le monde. »)', end: true },
    }),
  ], { teaser: 'Demain : ton tout premier ordre.' }),
  mis('s-3', 0, 'Épisode 3 · Le premier ordre', 'Histoire', 5, 'Passer son premier ordre réel… en simulation.', [
    B('Octobre', 'Ton PEA est ouvert, tu as versé 200 €. Tu veux l’ETF Monde (fictif), coté 31,80 €.'),
    T('Achète 6 parts sans payer plus de 32,00 € la part.', 31.80, { side: 'buy', type: 'limit', qty: 6, maxPrice: 32.00 }, 'Exécuté vers 31,80 € la part : environ 190,80 €. Tu es officiellement investisseur.'),
  ], { teaser: 'Demain : le marché plonge. Lucas t’appelle, paniqué.' }),
  mis('s-4', 0, 'Épisode 4 · La première baisse', 'Histoire', 5, 'Garder son calme pendant une baisse.', [
    B('Décembre', 'Les marchés baissent de 12 % en trois semaines. Ton ETF aussi.'),
    R('Lucas t’appelle', 'Lucas', {
      start: { say: 'T’as vu ?! Je perds 12 % ! Tu vends, toi ?', options: [
        { t: 'Non : mon horizon est de 15 ans et j’ai mon épargne de côté', good: true, next: 'b', fb: 'Tu appliques ton plan.' },
        { t: 'Oui, je vends tout', good: false, next: 'b', fb: 'Tu figerais ta perte.' },
      ] },
      b: { say: 'Et tu continues à investir chaque mois, même maintenant ?', options: [
        { t: 'Oui, mon versement mensuel continue comme prévu', good: true, next: 'fin', fb: 'Discipline : tes versements achètent à un prix plus bas.' },
        { t: 'Non, j’arrête tout', good: false, next: 'fin', fb: 'Ton plan disait l’inverse.' },
      ] },
      fin: { say: 'Bon… je vais relire mon plan. Tu m’as calmé.', end: true },
    }),
  ], { teaser: 'Demain : ton premier dividende… et les impôts.' }),
  mis('s-5', 0, 'Épisode 5 · Le premier dividende', 'Histoire', 3, 'Comprendre la fiscalité d’un dividende selon l’enveloppe.', [
    B('Mars', 'Tu as aussi 20 actions Telcora (fictive) sur un compte-titres. Dividende : 0,45 € par action.'),
    C('Dividende brut total ?', 9, 0.01, '€', '20 × 0,45 = 9 €.'),
    C('Après la flat tax 2026 (31,4 %), il te reste ?', 6.17, 0.02, '€', '9 × 0,686 ≈ 6,17 €. Dans un PEA, sans retrait, rien ne serait prélevé pour l’instant.'),
  ], { teaser: 'Demain : le bilan de ta première année.' }),
  mis('s-6', 0, 'Épisode 6 · Le bilan de l’année', 'Histoire', 5, 'Faire son premier bilan annuel.', [
    S('Ce que tu retiens de ton année', 'Je garde', 'Je jette', [
      ['L’épargne de précaution m’a permis de ne pas vendre pendant la baisse', 'l', 'Leçon n°1.'],
      ['Les messages privés qui promettent 15 % par mois', 'r', 'À ignorer, toujours.'],
      ['Investir chaque mois, même quand ça baisse', 'l', 'Discipline.'],
      ['Regarder les cours 30 fois par jour', 'r', 'Ça n’apporte que du stress.'],
    ]),
    Q('Ta prochaine étape logique ?', ['Écrire mon plan d’investissement (chapitre 7)', 'Tout miser sur une seule action', 'Arrêter d’apprendre'], 0, 'Fin de la saison 1. La suite de l’histoire arrive avec la saison 2.'),
  ], { teaser: 'Saison 2 bientôt : l’appartement, l’assurance-vie et ton premier rééquilibrage.' }),
];
})();
