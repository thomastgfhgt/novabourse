/* ============================================================
   NOVATITRE — EXAMENS ET PRÉPA CERTIFICATION AMF
   ------------------------------------------------------------
   Examen de niveau : questions tirées au hasard parmi les missions
   du niveau (QCM, vrai/faux, calcul, graphique), chiffres variés,
   chrono, 80 % pour valider.
   Prépa AMF : entraînement NON OFFICIEL sur les grands thèmes de
   l'examen. L'examen officiel (QCM de 120 questions) se passe dans
   un organisme certifié par l'AMF.
   ============================================================ */
(() => {
const { Q, V } = window.NT_H;
window.NT_EXAM_CFG = { secondsPerQuestion: 60, pass: 0.8, finalQuestions: 30, defiSessions: 4, defiMinScore: 70, defiAvg: 75 };

window.NT_AMF = [
  Q('L’Autorité des marchés financiers (AMF) est…', ['une autorité publique indépendante', 'une banque', 'une association de courtiers'], 0, 'Elle veille à la protection de l’épargne, à l’information des investisseurs et au bon fonctionnement des marchés.'),
  Q('Qui supervise principalement les banques et les assurances en France ?', ['L’ACPR, adossée à la Banque de France', 'L’AMF seule', 'Le ministère de la Culture'], 0, 'ACPR : Autorité de contrôle prudentiel et de résolution.'),
  Q('Une information privilégiée est une information…', ['précise, non publique, et susceptible d’influencer le cours', 'publiée dans la presse', 'sans lien avec un émetteur'], 0, 'Les trois critères sont cumulatifs.'),
  V('Utiliser une information privilégiée pour acheter un titre est un délit d’initié.', true, 'C’est un abus de marché, sanctionné administrativement et pénalement.'),
  Q('Diffuser une fausse rumeur pour faire monter un cours, c’est…', ['une manipulation de marché', 'une stratégie autorisée', 'du conseil en investissement'], 0, 'La diffusion d’informations fausses ou trompeuses est un abus de marché.'),
  Q('À qui une banque déclare-t-elle un soupçon de blanchiment ?', ['À Tracfin', 'À l’AMF Épargne Info Service', 'Au client concerné'], 0, 'Tracfin est la cellule française de renseignement financier. Le client ne doit pas être prévenu.'),
  Q('Une personne politiquement exposée (PPE) implique…', ['des mesures de vigilance renforcées', 'aucune vérification', 'un refus automatique'], 0, 'Lutte contre le blanchiment : le risque est jugé plus élevé.'),
  Q('Selon MIF 2, les clients sont classés en…', ['non professionnels, professionnels, contreparties éligibles', 'jeunes et seniors', 'petits et grands'], 0, 'Les clients non professionnels bénéficient de la protection la plus forte.'),
  Q('Avant de fournir un conseil en investissement, le prestataire doit…', ['évaluer l’adéquation : connaissances, situation financière, objectifs, capacité à subir des pertes', 'seulement vérifier l’âge', 'rien de particulier'], 0, 'C’est le test d’adéquation. Les préférences en matière de durabilité sont aussi recueillies.'),
  V('Un prestataire doit agir de manière honnête, loyale et professionnelle, au mieux des intérêts de ses clients.', true, 'Principe général des règles de bonne conduite.'),
  Q('Face à un conflit d’intérêts, le prestataire doit…', ['l’identifier, le prévenir ou le gérer, et en informer le client s’il persiste', 'l’ignorer s’il est petit', 'le cacher'], 0, 'L’information du client est le dernier recours, pas la solution par défaut.'),
  Q('La « meilleure exécution » oblige le prestataire à…', ['prendre les mesures suffisantes pour obtenir le meilleur résultat possible pour le client', 'exécuter toujours au plus bas prix', 'n’utiliser qu’une seule bourse'], 0, 'Prix, coûts, rapidité, probabilité d’exécution… sont pris en compte.'),
  Q('Un FCP (fonds commun de placement)…', ['n’a pas de personnalité morale', 'est une société anonyme', 'est une banque'], 0, 'La SICAV, elle, est une société : les porteurs en sont actionnaires.'),
  Q('Avant de souscrire à un produit d’investissement packagé, le client particulier reçoit…', ['un document d’informations clés (DIC)', 'rien', 'uniquement une publicité'], 0, 'Règlement PRIIPs : document court et standardisé.'),
  Q('Garantie des dépôts du FGDR : montant par déposant et par établissement ?', ['100 000 €', '10 000 €', 'Illimité'], 0, 'Pour les titres, la garantie est distincte : jusqu’à 70 000 €.'),
  Q('Un conseiller en investissements financiers (CIF) doit notamment…', ['être immatriculé à l’ORIAS et adhérer à une association agréée par l’AMF', 'seulement avoir un site internet', 'être agréé par la BCE'], 0, 'Vérifier l’ORIAS est un réflexe de base.'),
  Q('Euronext Paris (compartiments A, B, C) est…', ['un marché réglementé', 'un forum de discussion', 'un système non encadré'], 0, 'Euronext Growth, lui, est un système multilatéral de négociation (SMN).'),
  Q('En 2026, le règlement-livraison des actions en Europe se fait en principe…', ['deux jours après la négociation (J+2)', 'le jour même', 'un mois après'], 0, 'Un passage à J+1 est prévu dans l’Union européenne en octobre 2027.'),
  V('Les conversations téléphoniques liées à des ordres de clients doivent être enregistrées.', true, 'Obligation issue de MIF 2.'),
  Q('Un OPCVM (fonds « UCITS »)…', ['doit respecter des règles de diversification', 'peut tout investir dans une seule action', 'n’est pas réglementé'], 0, 'C’est une protection pour l’investisseur.'),
  Q('Quand les taux d’intérêt montent, une obligation à taux fixe déjà émise…', ['perd de la valeur', 'gagne de la valeur', 'ne bouge jamais'], 0, 'Les nouvelles obligations rapportent davantage.'),
  Q('Un actionnaire dispose en principe…', ['d’un droit de vote et d’un droit au dividende s’il est décidé', 'd’un remboursement garanti', 'd’un intérêt fixe'], 0, 'Le dividende dépend de la décision de l’assemblée générale.'),
  Q('Règlement SFDR : un fonds « article 9 »…', ['a un objectif d’investissement durable', 'ignore l’environnement', 'est forcément sans risque'], 0, 'Article 8 : il promeut des caractéristiques environnementales ou sociales.'),
  Q('Lors d’une offre au public de titres, le prospectus est…', ['approuvé par l’autorité compétente (en France, l’AMF)', 'facultatif dans tous les cas', 'rédigé par l’AMF'], 0, 'L’approbation ne vaut pas avis sur la qualité de l’investissement.'),
  Q('Un émetteur détenant une information privilégiée le concernant doit en principe…', ['la rendre publique dès que possible', 'la garder secrète indéfiniment', 'la donner à ses meilleurs clients'], 0, 'Un report est possible dans des conditions strictes.'),
  V('Le démarchage bancaire et financier ne peut être exercé que par des personnes habilitées.', true, 'Le démarcheur doit pouvoir justifier de son habilitation.'),
  Q('Le profil d’un client non professionnel inclut notamment…', ['sa capacité à subir des pertes et sa tolérance au risque', 'son signe astrologique', 'sa couleur préférée'], 0, 'Ces éléments servent à proposer des produits adaptés.'),
  V('Le gel des avoirs consiste à bloquer les fonds de personnes visées par des mesures de sanction.', true, 'Les établissements doivent consulter les listes nationales et européennes.'),
  Q('La Commission des sanctions de l’AMF peut…', ['prononcer des sanctions pécuniaires et disciplinaires', 'emprisonner directement', 'rien'], 0, 'Les peines de prison relèvent du juge pénal.'),
  Q('Un produit complexe vendu sans conseil à un client non professionnel nécessite…', ['l’évaluation du caractère approprié (connaissances et expérience)', 'aucune vérification', 'un notaire'], 0, 'Si le produit n’est pas approprié, le client doit être averti.'),
];
})();
