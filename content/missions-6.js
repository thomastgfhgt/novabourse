/* NOVA MISSIONS — compléments trading : étapes en plus, jeux de rôle, missions du jour, banque d'examen.
   Chargé après missions-5.js. */
(() => {
const { Q, V, S, C, X, R, CQ, mis } = window.NT_H;
const add = (id, ...steps) => { const m = window.NT_MISSIONS.find(x => x.id === id); if (m) m.steps.push(...steps); };

/* ---------- missions rallongées (une vraie action en plus) ---------- */
add('m10-2', CQ('Ce graphique montre 48 séances. Sur cette période, la tendance est plutôt…', { kind: 'up', seed: 5, n: 48 }, {},
  ['haussière', 'baissière', 'plate'], 0, 'Sommets et creux montent. Sur une autre unité de temps, l’image pourrait être différente.'));
add('m10-6', C('Une action passe de 40 € à 50 €. Hausse en % ?', 25, 0.1, '%', '(50 − 40) ÷ 40 = 25 %.'));
add('m11-6', CQ('Moyenne courte (jaune) et moyenne longue (bleue) : laquelle réagit le plus vite ?', { kind: 'top', seed: 2, n: 60 }, { ma: [10, 30] },
  ['La moyenne courte (jaune)', 'La moyenne longue (bleue)', 'Elles réagissent pareil'], 0, 'Moins de séances dans le calcul = réaction plus rapide, mais plus de faux signaux.'));
add('m12-6', V('Limiter son risque à 1 % par trade aide surtout à éviter les grosses baisses du capital.', true, 'Les petites pertes se rattrapent ; les grosses presque jamais.'));
add('m14-3', Q('Une stratégie a rapporté +300 % sur 2 ans dans un backtest, avec 15 réglages. Ta réaction ?', ['Méfiance : probable sur-ajustement, je teste hors échantillon', 'J’y mets tout mon capital', 'Je l’achète à son auteur'], 0, 'Un résultat trop beau est souvent un résultat trop ajusté.'));
add('m14-6', C('5 positions ouvertes, chacune avec 1,5 % de risque. Risque total si tout touche le stop (en %) ?', 7.5, 0.05, '%', '5 × 1,5 % = 7,5 % : au-dessus d’une limite courante de 5 %.'));
add('m15-1', C('Un contrat future représente 10 000 € de blé. Le prix baisse de 4 %. Perte sur le contrat ?', 400, 1, '€', '10 000 × 4 % = 400 €, même si tu n’as déposé que 1 000 € de marge.'));
add('m15-5', V('Une baisse des taux directeurs rend en général le crédit moins cher.', true, 'Les banques empruntent moins cher et prêtent souvent moins cher.'));
add('m15-6', Q('Une hausse rapide du dollar pèse souvent sur…', ['les entreprises très endettées en dollars hors des États-Unis', 'personne', 'uniquement les touristes'], 0, 'Leur dette en dollars coûte plus cher à rembourser.'));

/* ---------- nouveaux jeux de rôle trading ---------- */
window.NT_MISSIONS.push(
mis('m12-9', 12, 'Jeu de rôle : « Mets tout en levier ! »', 'Jeu de rôle', 5, 'Expliquer simplement le danger du levier.', [
  R('Léo veut utiliser un levier de 20', 'Léo', {
    start: { say: 'J’ai 2 000 €. Avec un levier de 20, je contrôle 40 000 €. Si ça monte de 5 %, je gagne 2 000 € !', options: [
      { t: 'Et si ça baisse de 5 % ? Tu perds aussi 2 000 € : toute ta mise.', good: true, next: 'calc', fb: '40 000 × 5 % = 2 000 € : la mise entière.' },
      { t: 'Bonne idée, c’est rapide.', good: false, next: 'boum', fb: 'Le levier multiplie aussi les pertes.' },
    ] },
    calc: { say: 'Ah… Mais je mettrai un stop.', options: [
      { t: 'Un stop peut sauter en cas de gap. Et avec un levier 20, le moindre bruit le touche. Commence sans levier, avec 1 % de risque.', good: true, next: 'fin', fb: 'Taille de position et stop, pas levier maximum.' },
      { t: 'Alors c’est sans risque.', good: false, next: 'boum', fb: 'Un stop ne garantit pas le prix d’exécution.' },
    ] },
    boum: { say: 'Deux jours plus tard : −6 % à l’ouverture. Mon compte est à zéro.', end: true },
    fin: { say: 'OK. Je m’entraîne d’abord dans la salle de marché, sans levier.', end: true },
  }),
  C('Levier 20, mise 2 000 €. Le marché baisse de 3 %. Perte (en €) ?', 1200, 1, '€', '40 000 × 3 % = 1 200 € : 60 % de la mise.'),
]),
mis('m13-9', 13, 'Jeu de rôle : le vendeur de signaux', 'Jeu de rôle', 5, 'Démasquer une offre de « signaux gagnants ».', [
  R('Un « coach » te contacte sur un réseau social', 'Max', {
    start: { say: 'Rejoins mon groupe VIP : 90 % de trades gagnants, 300 € par mois. Regarde mes captures de gains !', options: [
      { t: 'Montre-moi l’historique complet et vérifiable, pertes comprises. Et ton autorisation AMF ?', good: true, next: 'q', fb: 'Des captures se truquent. Un historique audité, rarement.' },
      { t: 'Super, je paie tout de suite.', good: false, next: 'arnaque', fb: 'Promesse + urgence + pas de preuve : signaux d’alerte.' },
    ] },
    q: { say: 'Pas le temps pour ça, l’offre se termine ce soir !', options: [
      { t: 'L’urgence est un signal d’arnaque classique. Je refuse et je vérifie les listes de l’AMF.', good: true, next: 'fin', fb: 'Excellent réflexe.' },
      { t: 'Bon, d’accord, je ne veux pas rater ça.', good: false, next: 'arnaque', fb: 'C’est le FOMO qu’il exploite.' },
    ] },
    arnaque: { say: 'Un mois plus tard : les signaux perdent, le groupe disparaît, impossible de se faire rembourser.', end: true },
    fin: { say: 'Max t’a bloqué. Tu as gardé tes 300 €… et ton capital.', end: true },
  }),
  S('Signal d’alerte ou pratique sérieuse ?', 'Sérieux', 'Alerte', [
    ['« 90 % de trades gagnants garantis »', 'r', 'Personne ne peut garantir un taux de réussite.'],
    ['Historique complet avec les pertes', 'l', 'C’est ce qu’on attend d’un acteur sérieux.'],
    ['« Offre valable ce soir seulement »', 'r', 'L’urgence empêche de réfléchir.'],
    ['Captures d’écran de gains', 'r', 'Faciles à truquer ou à choisir.'],
  ]),
]),
);

/* ---------- missions du jour : trading ---------- */
window.NT_DAILY_POOL.push(
  mis('d-13', 0, 'La séance qui ouvre en « gap »', 'Mission du jour', 3, 'Comprendre pourquoi un stop peut être exécuté plus bas que prévu.', [
    V('Si une action clôture à 50 € et ouvre le lendemain à 45 €, un stop placé à 48 € s’exécute vers 45 €.', true, 'Il n’y a eu aucun échange entre 50 et 45 € : c’est un gap.'),
    C('Tu détiens 100 actions, stop à 48 €, ouverture à 45 €. Perte en plus de ce qui était prévu (en €) ?', 300, 1, '€', '(48 − 45) × 100 = 300 € de plus. D’où l’intérêt d’un risque par trade modeste.'),
  ]),
  mis('d-14', 0, 'Les résultats tombent ce soir', 'Mission du jour', 3, 'Gérer une position avant une publication importante.', [
    Q('Une entreprise publie ses résultats ce soir. Tu as une position. Une option prudente ?', ['Réduire la taille ou sortir avant, si mon plan le prévoit', 'Doubler la position', 'Retirer mon stop'], 0, 'Les publications peuvent créer des gaps importants.'),
    V('Une bonne nouvelle peut faire baisser une action si le marché attendait encore mieux.', true, 'Le cours réagit à l’écart avec les attentes, pas seulement au chiffre.'),
  ]),
  mis('d-15', 0, 'Volatilité en hausse', 'Mission du jour', 3, 'Adapter sa taille quand le marché s’agite.', [
    Q('Le marché devient deux fois plus agité. Pour garder le même risque en euros…', ['j’éloigne mon stop et je réduis ma taille', 'je garde la même taille et un stop serré', 'j’augmente ma taille'], 0, 'Plus de bruit = stop plus loin = moins de titres.'),
    C('Risque 100 €. Stop à 2 € avant, à 4 € maintenant. Combien d’actions maintenant ?', 25, 0.01, 'actions', '100 ÷ 4 = 25 actions (contre 50 avant).'),
  ]),
  mis('d-16', 0, 'Le chiffre de l’inflation', 'Mission du jour', 3, 'Relier une annonce aux marchés.', [
    Q('L’inflation sort plus haute que prévu. Réaction fréquente des marchés obligataires ?', ['Les taux montent, les prix des obligations baissent', 'Les obligations montent toujours', 'Aucune réaction'], 0, 'Le marché anticipe des taux plus élevés.'),
    V('Les mouvements autour d’une annonce peuvent être très rapides, dans les deux sens.', true, 'D’où la règle : pas de nouvelle position juste avant.'),
  ]),
);

/* ---------- banque d'examen supplémentaire (niveaux 3 à 5) ---------- */
window.NT_EXAM_EXTRA = {
  3: [
    Q('Une longue mèche haute sur une bougie montre…', ['que le prix a été rejeté vers le bas après être monté', 'une clôture au plus haut', 'un volume nul'], 0, 'Les vendeurs ont repris la main pendant la période.'),
    Q('Un range, c’est…', ['un marché qui oscille entre un support et une résistance', 'une forte tendance', 'un krach'], 0, 'Pas de direction nette.'),
    V('Une moyenne mobile 200 séances réagit plus lentement qu’une moyenne 20.', true, 'Plus de données = plus lisse = plus lent.'),
    Q('Une cassure est plus crédible quand…', ['le volume augmente nettement', 'le volume baisse', 'elle a lieu un dimanche'], 0, 'Le volume montre une vraie participation.'),
    V('Un RSI sous 30 garantit un rebond.', false, 'Il indique une forte baisse récente, rien de plus.'),
    Q('Une tendance baissière se reconnaît à…', ['des sommets et des creux de plus en plus bas', 'des sommets de plus en plus hauts', 'un volume stable'], 0, 'Lecture de base de la structure.'),
    Q('Sur un graphique « 1 semaine », chaque bougie représente…', ['une semaine', 'un jour', 'une heure'], 0, 'L’unité de temps définit la période de chaque bougie.'),
    V('Un doji montre surtout de l’indécision.', true, 'Ouverture ≈ clôture : équilibre entre acheteurs et vendeurs.'),
    C('Une action passe de 80 € à 60 €. Baisse en % ?', 25, 0.1, '%', '(80 − 60) ÷ 80 = 25 %.'),
    Q('Ce qu’on fait d’une figure de bougies seule ?', ['On la confirme avec le contexte et on prépare un stop', 'On achète immédiatement', 'On l’ignore toujours'], 0, 'Indice, pas certitude.'),
    V('Le MACD est calculé à partir de moyennes mobiles exponentielles.', true, 'En général 12 et 26 séances, avec une ligne de signal à 9.'),
    Q('Un support cassé…', ['devient souvent une résistance', 'disparaît pour toujours', 'garantit une hausse'], 0, 'Changement de rôle fréquent.'),
  ],
  4: [
    C('Capital 6 000 €, risque 1 %. Entrée 30 €, stop 28 €. Combien d’actions ?', 30, 0.01, 'actions', '60 € ÷ 2 € = 30 actions.'),
    C('Entrée 40 €, stop 38 €, objectif 46 €. Ratio gain/risque ?', 3, 0.05, '', '6 ÷ 2 = 3.'),
    C('Réussite 50 %, gain moyen 1,5R, perte 1R. Espérance (en R) ?', 0.25, 0.01, 'R', '0,5 × 1,5 − 0,5 × 1 = 0,25 R.'),
    C('Après −25 %, quelle hausse pour revenir au départ (en %) ?', 33.3, 0.2, '%', '75 × 1,333 ≈ 100.'),
    V('On peut rapprocher un stop, jamais l’éloigner.', true, 'Règle d’or du trader discipliné.'),
    Q('Le revenge trading, c’est…', ['reprendre vite un trade pour « se refaire » après une perte', 'une stratégie de tendance', 'un type d’ordre'], 0, 'Un biais à combattre par une règle de pause.'),
    Q('Un ordre stop limite…', ['peut ne pas être exécuté si le prix passe trop vite', 'est toujours exécuté', 'n’existe pas'], 0, 'Il protège le prix, pas l’exécution.'),
    Q('La perte maximale par jour sert à…', ['s’arrêter avant que les émotions prennent le dessus', 'gagner plus', 'payer moins d’impôts'], 0, 'Une règle d’arrêt évite la spirale.'),
    Q('Pour quelqu’un qui travaille la journée, le style le plus adapté est souvent…', ['le swing trading', 'le scalping', 'le day trading'], 0, 'Il se gère le soir avec des ordres posés.'),
    C('3 € de frais par ordre, 40 trades (achat + vente). Frais totaux ?', 240, 0.5, '€', '40 × 2 × 3 = 240 €.'),
    V('Un journal de trading doit contenir aussi les trades perdants.', true, 'C’est là qu’on apprend le plus.'),
    Q('Avant une décision de taux de la BCE, une règle prudente est…', ['ne pas ouvrir de nouvelle position juste avant', 'tripler sa taille', 'retirer ses stops'], 0, 'Les prix peuvent sauter au-delà des stops.'),
  ],
  5: [
    C('Réussite 30 %, gain moyen 3R, perte 1R. Espérance (en R) ?', 0.2, 0.01, 'R', '0,3 × 3 − 0,7 = 0,2 R.'),
    Q('Le sur-ajustement, c’est…', ['une stratégie trop réglée sur le passé', 'une stratégie trop simple', 'un type d’option'], 0, 'Elle échoue souvent sur des données nouvelles.'),
    Q('Le biais du survivant fait paraître un backtest…', ['meilleur qu’en réalité', 'pire qu’en réalité', 'identique'], 0, 'Les entreprises disparues manquent.'),
    V('Un facteur de profit de 0,8 signifie que la stratégie a perdu de l’argent.', true, 'Gains totaux < pertes totales.'),
    Q('Un put acheté protège contre…', ['une baisse du sous-jacent', 'une hausse', 'l’inflation uniquement'], 0, 'C’est une assurance contre la baisse.'),
    C('Call au prix d’exercice 100 €, prime 4 €. L’action finit à 110 €. Gain net par action ?', 6, 0.01, '€', '10 − 4 = 6 €.'),
    C('Put au prix d’exercice 50 €, prime 3 €. L’action finit à 42 €. Gain net par action ?', 5, 0.01, '€', '50 − 42 = 8 €, moins 3 € de prime = 5 €.'),
    Q('Le vendeur d’une option…', ['peut perdre beaucoup plus que la prime encaissée', 'ne risque rien', 'gagne toujours'], 0, 'D’où le risque élevé de la vente d’options.'),
    Q('Quand les taux montent, les actions de croissance…', ['sont souvent sous pression', 'montent toujours', 'ne bougent pas'], 0, 'Leurs bénéfices lointains valent moins aujourd’hui.'),
    V('Deux stratégies très corrélées offrent une bonne diversification.', false, 'Elles perdent souvent en même temps.'),
    Q('Un échantillon fiable pour juger une stratégie, c’est…', ['des dizaines à des centaines de trades', '3 trades', '1 bonne semaine'], 0, 'Le hasard s’efface sur un grand nombre.'),
    Q('Un future sert notamment à…', ['se couvrir contre une variation de prix', 'toucher un dividende garanti', 'éviter tout risque'], 0, 'Exemple : un producteur fixe son prix de vente.'),
  ],
};
})();
