/* NOVA MISSIONS — chapitres 13 à 15 (fin du niveau 4 « Trader » et niveau 5 « Trader avancé ») */
(() => {
const { Q, V, S, O, C, X, R, CQ, mis } = window.NT_H;
window.NT_MISSIONS.push(

/* ===================== 13 · PLAN, JOURNAL ET MENTAL ===================== */
mis('m13-1', 13, 'Le plan de trading', 'Défi', 3, 'Savoir ce qu’on met dans un plan écrit.', [
  S('Dans ton plan de trading, ou pas ?', 'Pas dans le plan', 'Dans le plan', [
    ['Mon risque maximum par trade', 'r', 'Exemple : 1 % du capital.'],
    ['Une intuition du moment', 'l', 'Le plan sert justement à éviter les décisions d’humeur.'],
    ['Ma perte maximale par jour', 'r', 'Exemple : −3 %, puis j’arrête pour la journée.'],
    ['Mes conditions d’entrée précises', 'r', 'Quoi exactement doit se produire pour entrer.'],
    ['Un conseil lu sur un forum', 'l', 'Une info non vérifiée n’est pas une règle.'],
    ['Les horaires où je trade', 'r', 'Trader fatigué ou pressé coûte cher.'],
  ]),
  Q('Pourquoi écrire son plan à l’avance ?', ['Pour décider à froid, pas sous l’émotion', 'Pour le montrer sur les réseaux', 'Ça ne sert à rien'], 0, 'Pendant un trade, le stress fausse le jugement. Le plan décide à ta place.'),
]),
mis('m13-2', 13, 'Le journal de trading', 'Défi', 3, 'Apprendre de chacun de ses trades.', [
  S('Bonne pratique de journal ?', 'Non', 'Oui', [
    ['Noter la raison de chaque entrée', 'r', 'Tu sauras quelles idées marchent vraiment.'],
    ['Noter seulement les trades gagnants', 'l', 'Les pertes sont la meilleure source d’apprentissage.'],
    ['Noter ce que tu as ressenti', 'r', 'Peur, envie, fatigue : tes émotions laissent des traces.'],
    ['Faire un bilan chaque semaine', 'r', 'C’est là qu’on repère ses erreurs qui reviennent.'],
    ['Effacer les mauvais trades', 'l', 'Un journal honnête vaut de l’or.'],
  ]),
  V('Le journal sert surtout à repérer ses erreurs qui reviennent.', true, 'Ex. : « je perds souvent le vendredi après-midi » → règle : pas de trade le vendredi après-midi.'),
]),
mis('m13-3', 13, 'Les biais du trader', 'Défi', 5, 'Reconnaître les pièges du cerveau.', [
  X('Relie chaque biais à sa description', [
    ['FOMO', 'Peur de rater une hausse : on achète trop tard'],
    ['Revenge trading', 'Reprendre vite un trade pour « se refaire »'],
    ['Excès de confiance', 'Augmenter son risque après quelques gains'],
    ['Aversion à la perte', 'Garder une position perdante en espérant qu’elle remonte'],
  ], 'Tout le monde a ces biais. Les connaître permet d’écrire des règles contre eux.'),
  Q('Après 3 pertes d’affilée, la meilleure réaction ?', ['Faire une pause et relire mon journal', 'Doubler la taille du prochain trade', 'Supprimer mon stop'], 0, 'Une pause casse la spirale. Doubler la mise est le chemin classique vers la grosse perte.'),
  V('Déplacer son stop plus loin pour « laisser respirer » une position perdante est une bonne habitude.', false, 'C’est l’aversion à la perte. On peut rapprocher un stop, jamais l’éloigner.'),
]),
mis('m13-4', 13, 'Le calendrier économique', 'Défi', 3, 'Anticiper les annonces qui font bouger les marchés.', [
  Q('Le calendrier économique sert à…', ['connaître à l’avance les annonces importantes', 'prévoir les cours', 'connaître les dividendes garantis'], 0, 'Dates des décisions de taux, de l’inflation, de l’emploi, des résultats d’entreprises…'),
  S('Cette annonce peut-elle faire bouger les marchés ?', 'Peu probable', 'Oui', [
    ['Décision de taux de la BCE', 'r', 'Les taux influencent toutes les classes d’actifs.'],
    ['Chiffres de l’emploi américain', 'r', 'Très suivis : ils orientent les décisions de la banque centrale américaine.'],
    ['Résultats trimestriels d’une entreprise', 'r', 'Son action peut bouger fortement ce jour-là.'],
    ['Nouvelle couleur du logo d’une marque', 'l', 'Aucun effet sur la valeur de l’entreprise.'],
    ['Chiffre de l’inflation', 'r', 'Il influence les attentes sur les taux.'],
  ]),
  V('Juste avant une grosse annonce, l’écart entre prix d’achat et de vente peut s’élargir.', true, 'Les prix peuvent aussi sauter : beaucoup de traders évitent d’avoir une position à ce moment-là.'),
]),
mis('m13-5', 13, 'Trouver son style', 'Défi', 3, 'Choisir un style compatible avec sa vie.', [
  X('Relie chaque style à sa durée habituelle', [
    ['Scalping', 'Quelques secondes à quelques minutes'],
    ['Day trading', 'Positions fermées le jour même'],
    ['Swing trading', 'Quelques jours à quelques semaines'],
    ['Investissement', 'Plusieurs années'],
  ], 'Plus le style est court, plus les frais et le stress pèsent.'),
  Q('Pour quelqu’un qui travaille en journée, le style le plus réaliste est souvent…', ['le swing trading ou l’investissement', 'le scalping', 'aucun'], 0, 'Le swing se gère le soir, avec des ordres posés à l’avance.'),
]),
mis('m13-6', 13, 'Frais et impôts du trading', 'Calcul', 3, 'Compter tous les coûts avant de juger un résultat.', [
  C('2 € de frais par ordre. 100 trades par an (1 achat + 1 vente chacun). Coût total ?', 400, 0.5, '€', '100 × 2 ordres × 2 € = 400 €. Sans compter le spread.'),
  C('Gain net de 1 000 € sur un compte-titres en 2026 (flat tax 31,4 %). Il te reste ?', 686, 1, '€', '1 000 × (1 − 0,314) = 686 €. Règles 2026, à vérifier chaque année.'),
  V('Trader plus souvent augmente les frais, même si on ne gagne pas plus.', true, 'Les frais sont certains, les gains ne le sont pas.'),
]),
mis('m13-7', 13, 'Jeu de rôle : « Je quitte mon job pour trader »', 'Jeu de rôle', 5, 'Aider quelqu’un à garder les pieds sur terre.', [
  R('Hugo veut devenir trader à plein temps', 'Hugo', {
    start: { say: 'J’ai gagné 800 € ce mois-ci en tradant. Je démissionne et je vis du trading !', options: [
      { t: 'Combien de mois de résultats as-tu, et quel est ton drawdown maximal ?', good: true, next: 'stats', fb: 'Un mois ne prouve rien : il faut des centaines de trades.' },
      { t: 'Génial, fonce !', good: false, next: 'fonce', fb: 'Tu l’encourages à prendre un énorme risque sur un échantillon minuscule.' },
    ] },
    stats: { say: 'Euh… juste ce mois-ci. Et j’ai risqué 10 % par trade.', options: [
      { t: 'Avec 10 % par trade, 5 pertes d’affilée font perdre 41 %. Teste au moins un an avec 1 %, tout en gardant ton job.', good: true, next: 'fin', fb: '0,9⁵ ≈ 0,59 : il resterait 59 % du capital.' },
      { t: 'Alors augmente à 20 % pour aller plus vite.', good: false, next: 'fin2', fb: 'C’est la recette de la ruine.' },
    ] },
    fonce: { say: 'Merci ! … Trois semaines plus tard : j’ai perdu la moitié de mon capital.', end: true },
    fin: { say: 'OK. Je garde mon job, je réduis le risque et je tiens un journal. On fait le bilan dans un an.', end: true },
    fin2: { say: 'Hmm… Je crois que je vais plutôt relire le chapitre « Gérer le risque ».', end: true },
  }),
]),
mis('m13-8', 13, 'Défi : la discipline', 'Défi', 7, 'Réagir comme un trader discipliné.', [
  Q('Tu as atteint ta perte maximale du jour (−3 %). Un « super signal » apparaît.', ['J’arrête pour aujourd’hui, comme prévu', 'Je le prends, c’est trop beau', 'Je le prends avec le double de risque'], 0, 'La règle existe pour ces moments-là.'),
  C('Capital 8 000 €. Perte maximale du jour fixée à 3 %. Montant ?', 240, 0.5, '€', '3 % de 8 000 € = 240 €.'),
  X('Relie chaque situation à la bonne règle', [
    ['Je suis fatigué', 'Je ne trade pas'],
    ['3 pertes d’affilée', 'Pause et relecture du journal'],
    ['Grosse annonce dans 10 minutes', 'Pas de nouvelle position'],
    ['Trade gagnant', 'Je le note aussi, avec la raison'],
  ], 'La discipline, ce sont des règles simples, suivies tout le temps.'),
]),

/* ===================== 14 · STRATÉGIES ET TESTS ===================== */
mis('m14-1', 14, 'Les grandes familles de stratégies', 'Graphique', 5, 'Choisir la stratégie selon le type de marché.', [
  X('Relie chaque stratégie à son idée', [
    ['Suivi de tendance', 'Acheter ce qui monte, couper ce qui baisse'],
    ['Retour à la moyenne', 'Parier sur un retour après un excès'],
    ['Cassure', 'Entrer quand le prix sort d’une zone'],
    ['Investissement passif', 'Acheter un indice large et attendre'],
  ], 'Aucune ne marche tout le temps. Chacune a ses marchés favorables.'),
  CQ('Sur ce graphique, quelle famille est la plus adaptée ?', { kind: 'up', seed: 3, n: 48 }, { ma: [20] },
    ['Suivi de tendance', 'Retour à la moyenne'], 0, 'Marché en tendance : on suit le mouvement.'),
  CQ('Et sur celui-ci ?', { kind: 'range', seed: 3, n: 48 }, {},
    ['Retour à la moyenne', 'Suivi de tendance'], 0, 'Range : acheter bas, vendre haut, avec un stop si ça casse.'),
]),
mis('m14-2', 14, 'Le backtest', 'Défi', 5, 'Tester une idée sur le passé, honnêtement.', [
  Q('Un backtest, c’est…', ['tester une stratégie sur des données passées', 'prédire le futur', 'copier un autre trader'], 0, 'On applique des règles précises au passé pour voir ce qu’elles auraient donné.'),
  O('Remets les étapes d’un backtest honnête dans l’ordre', ['Écrire des règles précises', 'Choisir une longue période de données', 'Appliquer les règles sans tricher', 'Compter les frais', 'Vérifier sur une autre période jamais utilisée'], 'La dernière étape protège du sur-ajustement.'),
]),
mis('m14-3', 14, 'Les pièges des tests', 'Quiz', 3, 'Éviter les résultats trop beaux pour être vrais.', [
  V('Une stratégie avec 15 réglages parfaitement ajustés au passé marchera forcément à l’avenir.', false, 'C’est le sur-ajustement : la stratégie a « appris par cœur » le passé.'),
  Q('Le meilleur test contre le sur-ajustement ?', ['Tester sur une période jamais utilisée pour régler la stratégie', 'Ajouter encore des réglages', 'Garder seulement la meilleure année'], 0, 'On l’appelle test « hors échantillon ».'),
  Q('Tester seulement les entreprises qui existent encore aujourd’hui, c’est…', ['le biais du survivant : les résultats paraissent trop beaux', 'une bonne pratique', 'obligatoire'], 0, 'Les entreprises disparues (faillites) manquent : le passé paraît plus rose.'),
]),
mis('m14-4', 14, 'Les statistiques du trader', 'Calcul', 5, 'Calculer taux de réussite et espérance.', [
  C('Sur 40 trades, 16 sont gagnants. Taux de réussite (en %) ?', 40, 0.1, '%', '16 ÷ 40 = 40 %.'),
  C('Gain moyen 150 €, perte moyenne 60 €, réussite 40 %. Espérance par trade (en €) ?', 24, 0.5, '€', '0,4 × 150 − 0,6 × 60 = 60 − 36 = 24 €.'),
  Q('Facteur de profit = gains totaux ÷ pertes totales. S’il est au-dessus de 1…', ['la stratégie a gagné plus qu’elle n’a perdu', 'elle a perdu de l’argent', 'il n’y a pas de frais'], 0, 'Sous 1 : la stratégie perd. Il faut aussi vérifier la taille de l’échantillon.'),
]),
mis('m14-5', 14, 'Chance ou méthode ?', 'Quiz', 3, 'Ne pas confondre une bonne série avec une bonne stratégie.', [
  Q('5 trades gagnants sur 5. Peut-on conclure que la stratégie marche ?', ['Non, l’échantillon est trop petit', 'Oui, 100 % de réussite', 'Oui, si les gains sont gros'], 0, 'Le hasard peut produire 5 gains de suite. Il faut des dizaines, voire des centaines de trades.'),
  V('Plus on a de trades testés, plus le résultat est fiable.', true, 'La chance « s’efface » sur un grand nombre de trades.'),
  Q('Une stratégie à espérance positive peut-elle connaître 8 pertes de suite ?', ['Oui, c’est normal sur la durée', 'Non, jamais'], 0, 'D’où la règle des 1 % : survivre aux mauvaises séries.'),
]),
mis('m14-6', 14, 'Le risque global', 'Quiz', 3, 'Gérer plusieurs positions comme un portefeuille.', [
  Q('Deux positions très corrélées (ex. deux banques)…', ['risquent de perdre en même temps', 'se protègent l’une l’autre', 'n’ont aucun lien'], 0, 'Deux trades corrélés = presque un seul gros trade.'),
  V('Combiner des stratégies différentes peut lisser les résultats.', true, 'Quand l’une souffre, l’autre peut compenser, mais rien n’est garanti.'),
  Q('Une règle de risque global courante ?', ['Limiter le risque total de toutes les positions ouvertes (ex. 5 %)', 'Aucune limite si chaque trade a un stop', 'Tout miser sur la meilleure idée'], 0, 'Même avec des stops, 10 positions à 1 % = 10 % de risque si tout casse ensemble.'),
]),
mis('m14-7', 14, 'Défi : valider une stratégie', 'Défi', 10, 'Juger une stratégie comme un professionnel.', [
  C('Une stratégie gagne 35 % du temps 3R et perd 65 % du temps 1R. Espérance (en R) ?', 0.4, 0.01, 'R', '0,35 × 3 − 0,65 = +0,40 R.'),
  Q('Son backtest a été fait sur 12 trades, sans frais. Ton avis ?', ['Pas encore fiable : trop peu de trades et frais oubliés', 'Parfait, on peut la lancer avec tout son capital', 'Inutile de tester'], 0, 'Il faut un grand échantillon, les frais, et un test hors échantillon.'),
  X('Relie chaque piège à sa protection', [
    ['Sur-ajustement', 'Test sur une période jamais utilisée'],
    ['Biais du survivant', 'Inclure les entreprises disparues'],
    ['Frais oubliés', 'Compter chaque achat et vente'],
    ['Trop peu de trades', 'Tester sur une longue période'],
  ], 'Un backtest n’est utile que s’il est honnête.'),
  V('Même une stratégie bien testée peut cesser de marcher.', true, 'Les marchés changent. On suit ses statistiques en continu et on réduit le risque si elles se dégradent.'),
]),

/* ===================== 15 · DÉRIVÉS ET MACROÉCONOMIE ===================== */
mis('m15-1', 15, 'Les contrats futures', 'Quiz', 3, 'Comprendre un contrat à terme et son levier.', [
  Q('Un contrat future, c’est…', ['un engagement à acheter ou vendre à un prix fixé, à une date future', 'une action gratuite', 'une assurance-vie'], 0, 'Utilisé pour se couvrir ou pour spéculer, souvent avec effet de levier.'),
  Q('Qui utilise les futures pour se couvrir ?', ['Un producteur de blé qui veut fixer son prix de vente', 'Personne', 'Seulement les banques centrales'], 0, 'Il sécurise son prix, même si le marché baisse avant la récolte.'),
  V('Avec les futures, on peut perdre plus que l’argent déposé au départ.', true, 'Effet de levier : la perte se calcule sur toute la position, pas sur la mise.'),
]),
mis('m15-2', 15, 'Les options : le vocabulaire', 'Défi', 3, 'Connaître call, put, prime et prix d’exercice.', [
  X('Relie chaque mot à sa définition', [
    ['Call', 'Droit d’acheter à un prix fixé'],
    ['Put', 'Droit de vendre à un prix fixé'],
    ['Prime', 'Prix payé pour l’option'],
    ['Prix d’exercice', 'Prix fixé dans le contrat'],
  ], 'Une option est un droit, pas une obligation, pour celui qui l’achète.'),
  V('L’acheteur d’une option ne peut pas perdre plus que la prime payée.', true, 'Au pire, l’option ne vaut plus rien à l’échéance. Le vendeur, lui, peut perdre beaucoup plus.'),
]),
mis('m15-3', 15, 'Calculer une option', 'Calcul', 5, 'Calculer le résultat d’un call à l’échéance.', [
  C('Call, prix d’exercice 50 €, prime 2 €. À l’échéance, l’action vaut 56 €. Gain net par action ?', 4, 0.01, '€', '56 − 50 = 6 € de valeur, moins 2 € de prime = 4 €.'),
  C('Et si l’action finit à 48 € ? Résultat par action (en €) ?', -2, 0.01, '€', 'Le call ne vaut rien (48 < 50) : tu perds la prime, −2 €.'),
  Q('Le vendeur d’un call « à découvert » (sans posséder l’action)…', ['a un risque de perte théoriquement illimité', 'ne risque rien', 'gagne toujours la prime'], 0, 'Si l’action s’envole, il doit livrer à 50 € des actions qui valent beaucoup plus.'),
]),
mis('m15-4', 15, 'Se protéger avec une option', 'Quiz', 3, 'Utiliser une option comme une assurance.', [
  Q('Acheter un put sur des actions que tu possèdes sert à…', ['se protéger contre une baisse, comme une assurance', 'doubler ses gains', 'toucher un dividende'], 0, 'Si l’action chute, le put prend de la valeur et compense une partie de la perte.'),
  V('Une protection a un coût : la prime.', true, 'Comme une assurance : on paie même si rien n’arrive.'),
  Q('Pourquoi les options sont-elles risquées pour un débutant ?', ['Leur valeur varie très vite et peut tomber à zéro à l’échéance', 'Elles sont garanties', 'Elles ne bougent jamais'], 0, 'Le temps joue contre l’acheteur : chaque jour, l’option perd un peu de valeur.'),
]),
mis('m15-5', 15, 'Taux d’intérêt et banques centrales', 'Quiz', 3, 'Comprendre l’effet des taux sur les marchés.', [
  Q('Quand les taux d’intérêt montent, le prix des obligations existantes…', ['baisse', 'monte', 'ne change pas'], 0, 'Les nouvelles obligations rapportent plus : les anciennes valent moins.'),
  Q('Qui fixe les taux directeurs dans la zone euro ?', ['La Banque centrale européenne (BCE)', 'L’AMF', 'Chaque banque commerciale'], 0, 'La BCE, à Francfort. Aux États-Unis : la Réserve fédérale (Fed).'),
  V('Des taux plus élevés rendent souvent les actions de croissance moins attractives.', true, 'Leurs bénéfices sont attendus loin dans le futur : ils « valent » moins aujourd’hui quand les taux montent.'),
]),
mis('m15-6', 15, 'Inflation, pétrole et devises', 'Quiz', 3, 'Relier les grandes nouvelles aux marchés.', [
  Q('Une forte inflation pousse souvent les banques centrales à…', ['monter leurs taux', 'baisser leurs taux', 'fermer la Bourse'], 0, 'Monter les taux freine le crédit et la demande, donc les prix.'),
  Q('Le pétrole augmente fortement. Qui en souffre souvent ?', ['Les compagnies aériennes', 'Les compagnies pétrolières', 'Personne'], 0, 'Le kérosène est un de leurs plus gros coûts.'),
  V('Si l’euro monte face au dollar, un placement en actions américaines vaut moins en euros, toutes choses égales par ailleurs.', true, 'C’est le risque de change. Certains fonds le couvrent, d’autres non.'),
]),
mis('m15-7', 15, 'Défi final : le trader complet', 'Défi', 15, 'Réunir graphique, risque, mental et macro.', [
  CQ('Tendance, volume, niveau : que s’est-il passé ?', { kind: 'breakout', seed: 3, n: 48 }, { vol: true, ma: [20], levels: [{ k: 'hi', label: 'R', color: '#a68cff' }] },
    ['Cassure de résistance avec volume, au-dessus de la moyenne', 'Fausse cassure', 'Tendance baissière'], 0, 'Tous les éléments vont dans le même sens.'),
  C('Capital 12 000 €, risque 1 %. Entrée 60 €, stop 57 €. Combien d’actions ?', 40, 0.01, 'actions', '1 % = 120 €. Risque par action 3 €. 120 ÷ 3 = 40.'),
  C('Objectif à 69 €. Ratio gain/risque ?', 3, 0.05, '', 'Gain 9 €, risque 3 € : ratio 3.'),
  Q('La BCE annonce une décision de taux dans 10 minutes. Ton trade est prêt.', ['J’attends l’annonce, puis je réévalue', 'J’entre tout de suite avec le double de risque', 'Je retire mon stop pour éviter d’être sorti'], 0, 'Autour des annonces, les prix peuvent sauter au-delà des stops.'),
  Q('Qu’est-ce qui fait durer un trader ?', ['Un risque faible par trade, un plan écrit et un journal', 'Un indicateur secret', 'Beaucoup de chance'], 0, 'Pas de secret : de la méthode, de la discipline et du temps.'),
]),
);
})();
