/* NOVA MISSIONS — chapitres 10 à 12 (niveau 3 « Lire un graphique » et début du niveau 4 « Trader »)
   Graphiques : générés (données simulées), jamais présentés comme réels. */
(() => {
const { Q, V, S, O, C, X, T, CQ, mis } = window.NT_H;
window.NT_MISSIONS.push(

/* ===================== 10 · LIRE LES BOUGIES ===================== */
mis('m10-1', 10, 'Anatomie d’une bougie', 'Défi', 3, 'Lire ouverture, clôture, plus haut et plus bas dans une bougie.', [
  X('Relie chaque partie à ce qu’elle montre', [
    ['Le corps', 'L’écart entre ouverture et clôture'],
    ['La mèche haute', 'Le plus haut atteint'],
    ['La mèche basse', 'Le plus bas atteint'],
    ['Une bougie verte', 'Clôture au-dessus de l’ouverture'],
  ], 'Une bougie résume une période : d’où le prix est parti, où il a fini, et jusqu’où il est allé.'),
  CQ('La bougie A est verte. Que s’est-il passé pendant cette période ?', { kind: 'up', seed: 4, n: 22, tail: ['bigGreen'] }, { marks: [{ i: -1, label: 'A' }] },
    ['Le cours a clôturé plus haut qu’il n’a ouvert', 'Le cours a clôturé plus bas qu’il n’a ouvert', 'Le cours n’a pas bougé'], 0, 'Verte = clôture > ouverture. Rouge = clôture < ouverture.'),
  V('Une longue mèche basse montre que le prix est descendu, puis que les acheteurs l’ont fait remonter avant la clôture.', true, 'La mèche garde la trace du plus bas, même si le prix est remonté ensuite.'),
]),
mis('m10-2', 10, 'Les unités de temps', 'Quiz', 3, 'Choisir l’unité de temps adaptée à son horizon.', [
  Q('Sur un graphique « 1 jour », chaque bougie représente…', ['une journée de cotation', 'une heure', 'une semaine'], 0, 'On choisit l’unité : 1 minute, 1 heure, 1 jour, 1 semaine… Chaque bougie = une période.'),
  V('Une action peut être en hausse sur le graphique 1 heure et en baisse sur le graphique 1 semaine.', true, 'Ce n’est pas contradictoire : ce sont deux échelles de temps. Regarde toujours l’unité de temps supérieure.'),
  Q('Un investisseur à long terme regarde plutôt…', ['les graphiques hebdomadaires ou mensuels', 'les graphiques 1 minute', 'aucun graphique, jamais'], 0, 'Plus ton horizon est long, plus l’unité de temps doit être grande. Le « bruit » des minutes ne te concerne pas.'),
]),
mis('m10-3', 10, 'Marteau, étoile filante, doji', 'Graphique', 5, 'Reconnaître trois figures de bougies fréquentes.', [
  CQ('Après une baisse, la bougie A a un petit corps en haut et une très longue mèche basse. C’est…', { kind: 'down', seed: 2, n: 20, tail: ['hammer'] }, { marks: [{ i: -1, label: 'A' }] },
    ['un marteau', 'une étoile filante', 'un avalement baissier'], 0, 'Marteau : les vendeurs ont poussé fort, puis les acheteurs ont repris la main. Rebond possible, à confirmer.'),
  CQ('Après une hausse, la bougie A a une très longue mèche haute. C’est…', { kind: 'up', seed: 2, n: 20, tail: ['shooting'] }, { marks: [{ i: -1, label: 'A' }] },
    ['une étoile filante', 'un marteau', 'une cassure'], 0, 'Étoile filante : le prix est monté, puis a été rejeté vers le bas. Signe possible d’essoufflement.'),
  CQ('La bougie A ouvre et clôture presque au même prix. C’est…', { kind: 'up', seed: 2, n: 20, tail: ['doji'] }, { marks: [{ i: -1, label: 'A' }] },
    ['un doji : acheteurs et vendeurs s’équilibrent', 'un krach', 'un signal d’achat garanti'], 0, 'Le doji montre l’indécision. Seul, il ne dit pas dans quel sens le prix va partir.'),
]),
mis('m10-4', 10, 'Les avalements', 'Graphique', 3, 'Repérer un retournement possible quand une bougie « avale » la précédente.', [
  CQ('Après une baisse, la grande bougie verte A englobe toute la bougie rouge d’avant. C’est…', { kind: 'down', seed: 3, n: 20, tail: ['bullEngulf'] }, { marks: [{ i: -1, label: 'A' }] },
    ['un avalement haussier', 'un avalement baissier', 'un doji'], 0, 'Les acheteurs ont effacé toute la séance précédente. Signal de retournement possible, jamais certain.'),
  CQ('Et ici, après une hausse ?', { kind: 'up', seed: 3, n: 20, tail: ['bearEngulf'] }, { marks: [{ i: -1, label: 'A' }] },
    ['un avalement baissier', 'un avalement haussier', 'un marteau'], 0, 'L’inverse : une grande bougie rouge avale la verte précédente.'),
  V('Une seule figure de bougies suffit pour décider d’acheter ou de vendre.', false, 'Une figure est un indice, pas une preuve. On la combine avec le contexte (tendance, support) et un stop.'),
]),
mis('m10-5', 10, 'Les volumes', 'Graphique', 5, 'Utiliser le volume pour juger la force d’un mouvement.', [
  Q('Le volume, c’est…', ['le nombre de titres échangés sur la période', 'la variation du prix en %', 'le nombre d’actionnaires'], 0, 'Barres sous le graphique : plus elles sont hautes, plus il y a eu d’échanges.'),
  CQ('Le cours franchit la résistance R. Qu’est-ce qui rend cette cassure plus crédible ?', { kind: 'breakout', seed: 1, n: 48 }, { vol: true, levels: [{ k: 'hi', label: 'R', color: '#a68cff' }] },
    ['Des volumes nettement plus élevés que d’habitude', 'Des volumes faibles', 'Une bougie rouge'], 0, 'Un mouvement soutenu par beaucoup d’échanges montre une vraie participation.'),
  CQ('Ici, le cours dépasse R avec peu de volume, puis retombe dessous. On appelle ça…', { kind: 'fakeout', seed: 1, n: 48 }, { vol: true, levels: [{ k: 'hi', label: 'R', color: '#a68cff' }] },
    ['une fausse cassure', 'une tendance haussière solide', 'un dividende'], 0, 'Fausse cassure : piège classique. D’où l’importance du stop.'),
]),
mis('m10-6', 10, 'Échelle linéaire ou logarithmique', 'Calcul', 3, 'Comparer des hausses en % sur une longue période.', [
  C('De 10 € à 20 € = +100 %. De 100 € à 200 €, c’est combien en % ?', 100, 0.1, '%', 'Même pourcentage. Sur une échelle logarithmique, ces deux hausses ont la même hauteur.'),
  Q('Sur 20 ans, quelle échelle montre le mieux les variations en % ?', ['logarithmique', 'linéaire', 'ça ne change rien'], 0, 'Échelle log : une même distance = un même %. Utile sur les longues périodes.'),
  V('En échelle linéaire, +10 € paraît aussi grand de 10 € à 20 € que de 100 € à 110 €.', true, 'Pourtant c’est +100 % dans un cas et +10 % dans l’autre.'),
]),
mis('m10-7', 10, 'Défi : lire un graphique', 'Défi', 7, 'Combiner bougies, figures et contexte.', [
  CQ('Le cours est-il au-dessus ou en dessous de sa moyenne des 20 dernières séances (ligne jaune) ?', { kind: 'up', seed: 1, n: 48 }, { ma: [20] },
    ['Au-dessus', 'En dessous'], 0, 'Au-dessus d’une moyenne qui monte : le contexte est plutôt haussier.'),
  X('Relie chaque figure à sa description', [
    ['Marteau', 'Longue mèche basse après une baisse'],
    ['Étoile filante', 'Longue mèche haute après une hausse'],
    ['Doji', 'Ouverture presque égale à la clôture'],
    ['Avalement haussier', 'Grande bougie verte qui englobe la rouge d’avant'],
  ], 'Ce sont des indices de comportement des acheteurs et des vendeurs.'),
  Q('Une figure haussière apparaît sur un support. Que fais-tu ?', ['J’attends une confirmation et je prépare mon stop', 'J’achète tout de suite avec tout mon capital', 'Rien : les bougies ne servent à rien'], 0, 'Indice + confirmation + stop. Jamais tout sur un seul signal.'),
]),

/* ===================== 11 · TENDANCES ET INDICATEURS ===================== */
mis('m11-1', 11, 'Reconnaître une tendance', 'Graphique', 5, 'Distinguer tendance haussière, baissière et range.', [
  CQ('Sommets de plus en plus hauts, creux de plus en plus hauts. C’est…', { kind: 'up', seed: 2, n: 48 }, {},
    ['une tendance haussière', 'une tendance baissière', 'un range (sans tendance)'], 0, 'Tendance haussière = suite de sommets et de creux ascendants.'),
  CQ('Et ce graphique ?', { kind: 'down', seed: 2, n: 48 }, {},
    ['une tendance baissière', 'une tendance haussière', 'un range'], 0, 'Sommets et creux de plus en plus bas.'),
  CQ('Et celui-ci ?', { kind: 'range', seed: 2, n: 48 }, {},
    ['un range : le prix oscille entre deux niveaux', 'une tendance haussière', 'une tendance baissière'], 0, 'Range = le prix rebondit entre un plancher et un plafond.'),
]),
mis('m11-2', 11, 'Supports et résistances', 'Graphique', 3, 'Repérer les zones où le prix réagit souvent.', [
  CQ('Quelle ligne est une résistance ?', { kind: 'range', seed: 1, n: 48 }, { levels: [{ k: 'hi', label: 'A', color: '#a68cff' }, { k: 'lo', label: 'B', color: '#66d0ff' }] },
    ['A', 'B'], 0, 'Résistance = plafond où le prix a buté plusieurs fois. B est un support (plancher).'),
  Q('Un support, c’est…', ['une zone où les acheteurs sont souvent revenus', 'un prix garanti', 'le plus haut historique'], 0, 'C’est une zone, pas un prix exact. Elle peut casser.'),
  V('Un support cassé devient souvent une résistance.', true, 'Les acheteurs piégés veulent souvent revendre « à zéro » quand le prix y revient.'),
]),
mis('m11-3', 11, 'Cassures et fausses cassures', 'Graphique', 5, 'Ne pas se faire piéger par une cassure.', [
  CQ('Que vient-il de se passer ?', { kind: 'breakout', seed: 2, n: 48 }, { vol: true, levels: [{ k: 'hi', label: 'R', color: '#a68cff' }] },
    ['Une cassure de la résistance, avec du volume', 'Une fausse cassure', 'Un krach'], 0, 'Le prix sort du range par le haut, avec des échanges en hausse.'),
  CQ('Et ici ?', { kind: 'fakeout', seed: 2, n: 48 }, { vol: true, levels: [{ k: 'hi', label: 'R', color: '#a68cff' }] },
    ['Une fausse cassure : le prix repasse sous R', 'Une cassure réussie', 'Une tendance baissière depuis le début'], 0, 'Le prix est passé au-dessus, puis est retombé. Ceux qui ont acheté sans stop souffrent.'),
  Q('Pour limiter le risque de fausse cassure, un trader…', ['place un stop et attend parfois une clôture au-dessus du niveau', 'achète encore plus si ça redescend', 'retire son stop'], 0, 'Attendre une clôture filtre une partie des pièges. Le stop limite la perte sur les autres.'),
]),
mis('m11-4', 11, 'Les moyennes mobiles', 'Graphique', 5, 'Lire la tendance avec une moyenne mobile.', [
  Q('Une moyenne mobile 20 séances, c’est…', ['la moyenne des 20 derniers cours de clôture', 'le prix prévu dans 20 séances', 'le plus haut des 20 séances'], 0, 'Elle « lisse » le prix pour voir la direction générale.'),
  CQ('Après le sommet, le cours passe sous sa moyenne mobile 20 (jaune), qui se met à baisser. C’est plutôt…', { kind: 'top', seed: 1, n: 48 }, { ma: [20] },
    ['un signe de faiblesse', 'un signe de force', 'un signal d’achat garanti'], 0, 'Cours sous une moyenne qui baisse : la tendance se dégrade. Ce n’est pas une certitude.'),
  V('Une moyenne mobile réagit avec retard, car elle est calculée sur le passé.', true, 'C’est sa limite : elle confirme, elle ne prédit pas.'),
]),
mis('m11-5', 11, 'Le RSI', 'Graphique', 3, 'Comprendre « suracheté » et « survendu » sans se tromper.', [
  CQ('Le RSI (en bas) est au-dessus de 70. Cela veut dire…', { kind: 'up', seed: 1, n: 48 }, { rsi: true },
    ['le cours a beaucoup monté récemment (« suracheté »), sans signal de vente garanti', 'il faut vendre immédiatement', 'l’entreprise va faire faillite'], 0, 'Le RSI mesure la force des hausses et des baisses récentes, de 0 à 100.'),
  Q('Un RSI sous 30, c’est…', ['« survendu » : forte baisse récente', 'un achat garanti', 'un dividende'], 0, 'Encore un indice, pas une garantie : une baisse peut continuer.'),
  V('Dans une forte tendance, le RSI peut rester au-dessus de 70 pendant longtemps.', true, 'Vendre uniquement parce que le RSI dépasse 70 fait souvent sortir trop tôt.'),
]),
mis('m11-6', 11, 'MACD et bon usage des indicateurs', 'Quiz', 3, 'Savoir ce que mesure un indicateur, et en utiliser peu.', [
  Q('Le MACD compare…', ['deux moyennes mobiles exponentielles (en général 12 et 26 séances)', 'le volume et les dividendes', 'deux entreprises'], 0, 'Quand l’écart entre les deux moyennes grandit, la tendance accélère.'),
  V('Les indicateurs techniques sont calculés à partir des données passées.', true, 'Ils décrivent ce qui s’est passé. Aucun ne voit l’avenir.'),
  Q('Combien d’indicateurs utiliser ?', ['Peu, mais bien compris', 'Le plus possible', 'Il faut en changer chaque semaine'], 0, 'Empiler les indicateurs donne l’illusion de certitude. 2 ou 3 outils maîtrisés suffisent.'),
]),
mis('m11-7', 11, 'Les limites de l’analyse technique', 'Défi', 5, 'Garder la tête froide face aux promesses.', [
  S('Mythe ou réalité ?', 'Mythe', 'Réalité', [
    ['Un indicateur prédit l’avenir à coup sûr', 'l', 'Aucun outil ne prédit l’avenir avec certitude.'],
    ['La plupart des particuliers qui tradent des CFD perdent de l’argent', 'r', 'Les avertissements obligatoires des courtiers indiquent souvent 74 à 89 % de comptes perdants.'],
    ['Un robot qui promet 20 % par mois est fiable', 'l', 'Promesse irréaliste : l’AMF met régulièrement en garde contre ces offres.'],
    ['L’analyse technique aide surtout à décider où entrer, sortir et placer son stop', 'r', 'C’est son meilleur usage : organiser le risque.'],
    ['Les gagnants ont toujours raison', 'l', 'Les bons traders perdent souvent. Ils perdent petit et gagnent plus gros.'],
  ]),
  Q('Le meilleur usage de l’analyse technique ?', ['Définir entrée, sortie et stop', 'Être sûr de gagner', 'Remplacer la gestion du risque'], 0, 'Elle structure la décision. La gestion du risque reste la base.'),
]),
mis('m11-8', 11, 'Défi : analyse complète', 'Défi', 7, 'Lire tendance, niveaux et indicateurs ensemble.', [
  CQ('Dans ce range, où un trader de rebond cherche-t-il plutôt à acheter ?', { kind: 'range', seed: 3, n: 48 }, { levels: [{ k: 'hi', label: 'A', color: '#a68cff' }, { k: 'lo', label: 'B', color: '#66d0ff' }] },
    ['Près de B, avec un stop juste dessous', 'Près de A, sans stop', 'N’importe où'], 0, 'Acheter près du support permet un stop proche, donc un risque faible.'),
  CQ('Tendance, moyenne et RSI : quel résumé est juste ?', { kind: 'down', seed: 1, n: 48 }, { ma: [20], rsi: true },
    ['Tendance baissière, cours sous la moyenne, RSI bas', 'Tendance haussière, RSI au-dessus de 70', 'Range parfait'], 0, 'Tout va dans le même sens : faiblesse. Un RSI bas ne suffit pas à acheter.'),
  X('Relie chaque outil à ce qu’il mesure', [
    ['Volume', 'Nombre de titres échangés'],
    ['Moyenne mobile', 'Direction moyenne du prix'],
    ['RSI', 'Force des hausses et baisses récentes'],
    ['Support', 'Zone où les acheteurs reviennent souvent'],
  ], 'Chaque outil répond à une question différente.'),
]),

/* ===================== 12 · GÉRER LE RISQUE ===================== */
mis('m12-1', 12, 'Le stop-loss', 'Graphique', 5, 'Placer un stop logique, ni trop près ni trop loin.', [
  Q('Un stop-loss, c’est…', ['un ordre qui vend automatiquement si le prix atteint un niveau de perte prévu', 'une garantie de ne jamais perdre', 'un ordre d’achat'], 0, 'Il limite la perte. Tu décides AVANT d’entrer où tu as tort.'),
  CQ('Tu achètes près du support B. Où placer ton stop ?', { kind: 'range', seed: 1, n: 48 }, { levels: [{ k: 'hi', label: 'A', color: '#a68cff' }, { k: 'lo', label: 'B', color: '#66d0ff' }, { k: 'lo', off: -0.025, label: 'S', color: '#ff6b7f' }] },
    ['En S, juste sous le support', 'En A, au-dessus du prix', 'Pas de stop, le support tiendra'], 0, 'Si le support casse, ton idée est fausse : tu sors. Juste en dessous laisse un peu de marge.'),
  V('Un stop peut être exécuté à un prix moins bon que prévu si le cours ouvre en « gap ».', true, 'Si le marché saute ton niveau à l’ouverture, l’ordre s’exécute au premier prix disponible.'),
]),
mis('m12-2', 12, 'La règle des 1 %', 'Calcul', 3, 'Risquer peu par trade pour durer.', [
  C('Capital 10 000 €. Tu risques 1 % par trade. Perte maximale prévue par trade ?', 100, 0.5, '€', '1 % de 10 000 € = 100 €.'),
  C('Après 10 pertes de suite à 1 % chacune, il te reste combien environ ? (10 000 € au départ)', 9044, 20, '€', '10 000 × 0,99¹⁰ ≈ 9 044 €. Tu es toujours là. À 10 % par trade, il resterait environ 3 487 €.'),
  Q('Pourquoi risquer peu par trade ?', ['Pour survivre aux séries de pertes, qui arrivent à tout le monde', 'Pour gagner plus vite', 'C’est une obligation légale'], 0, 'Le premier objectif d’un trader : rester dans la partie.'),
]),
mis('m12-3', 12, 'Calculer sa taille de position', 'Calcul', 5, 'Transformer un risque en euros en nombre de titres.', [
  C('Tu risques 100 €. Achat à 50 €, stop à 48 €. Combien d’actions ?', 50, 0.01, 'actions', 'Risque par action : 50 − 48 = 2 €. 100 ÷ 2 = 50 actions.'),
  C('Même risque de 100 €, mais stop à 45 €. Combien d’actions ?', 20, 0.01, 'actions', '50 − 45 = 5 € par action. 100 ÷ 5 = 20 actions.'),
  V('Plus le stop est loin, plus la position doit être petite pour garder le même risque.', true, 'Taille = risque en € ÷ distance au stop. C’est la formule clé du trader.'),
]),
mis('m12-4', 12, 'Le ratio gain/risque', 'Calcul', 3, 'Viser des gains plus grands que ses pertes.', [
  C('Achat 50 €, stop 48 €, objectif 56 €. Ratio gain/risque ?', 3, 0.05, '', 'Gain visé 6 €, risque 2 € : 6 ÷ 2 = 3.'),
  Q('Avec un ratio de 3, combien de gagnants sur 10 trades suffisent pour ne pas perdre (hors frais) ?', ['3 sur 10', '5 sur 10', '9 sur 10'], 0, '3 gains × 3 = +9, 7 pertes × 1 = −7. Avec 2 gagnants : +6 − 8 = −2.'),
  V('Un bon ratio gain/risque suffit, quel que soit le taux de réussite.', false, 'Il faut les deux ensemble : ratio × taux de réussite. C’est l’espérance (mission suivante).'),
]),
mis('m12-5', 12, 'L’espérance d’une stratégie', 'Calcul', 5, 'Savoir si une méthode gagne en moyenne.', [
  C('Tu gagnes 40 % du temps (2R) et tu perds 60 % du temps (1R). Espérance par trade, en R ?', 0.2, 0.01, 'R', '0,4 × 2 − 0,6 × 1 = +0,2 R par trade en moyenne.'),
  C('Si 1R = 100 €, combien gagnes-tu en moyenne sur 50 trades ?', 1000, 1, '€', '0,2 × 100 € × 50 = 1 000 €, avant frais. En moyenne seulement.'),
  V('Une espérance positive garantit de gagner chaque mois.', false, 'Le hasard crée des séries de pertes. L’espérance se vérifie sur beaucoup de trades.'),
]),
mis('m12-6', 12, 'Le drawdown', 'Calcul', 3, 'Comprendre pourquoi les grosses pertes sont si dures à rattraper.', [
  C('Ton capital baisse de 50 %. Quelle hausse faut-il pour revenir au départ (en %) ?', 100, 0.1, '%', '10 000 → 5 000 : il faut doubler, soit +100 %.'),
  C('Et après une baisse de 20 % ?', 25, 0.1, '%', '8 000 × 1,25 = 10 000. Il faut +25 %.'),
  Q('Le drawdown maximal, c’est…', ['la plus forte baisse du capital depuis un sommet', 'le gain moyen', 'le total des frais'], 0, 'C’est la « douleur » maximale d’une stratégie. On le limite avec un risque par trade faible.'),
]),
mis('m12-7', 12, 'Ordres stop, stop limite, suiveur', 'Simulateur', 5, 'Choisir le bon ordre pour sortir.', [
  X('Relie chaque ordre à son fonctionnement', [
    ['Ordre stop', 'Devient un ordre au marché quand le seuil est touché'],
    ['Stop limite', 'Devient un ordre à cours limité quand le seuil est touché'],
    ['Stop suiveur', 'Suit le cours à distance fixe quand il monte'],
    ['Ordre à cours limité', 'Prix maximum à l’achat, minimum à la vente'],
  ], 'Les noms exacts varient selon les plateformes : lis toujours la fiche d’aide de ton courtier.'),
  V('Un ordre stop limite peut ne pas être exécuté si le prix passe trop vite sous la limite.', true, 'Il protège le prix, pas l’exécution. Le stop simple fait l’inverse.'),
  T('Prends ton bénéfice : vends 10 actions, mais pas en dessous de 46,00 €.', 42.52, { side: 'sell', type: 'limit', qty: 10, minPrice: 46 }, 'Ordre de vente à cours limité à 46 € : il attend dans le carnet que le prix y arrive.'),
]),
mis('m12-8', 12, 'Défi : préparer un trade complet', 'Défi', 10, 'Enchaîner niveau, stop, taille et ratio comme un pro.', [
  O('Remets la préparation d’un trade dans l’ordre', ['Repérer le niveau (ex. support)', 'Placer le stop sous ce niveau', 'Calculer la taille de position', 'Vérifier le ratio gain/risque', 'Passer l’ordre et le noter dans le journal'], 'Le stop vient AVANT la taille : c’est lui qui la détermine.'),
  C('Capital 5 000 €, risque 1 %. Achat 20 €, stop 19 €. Combien d’actions ?', 50, 0.01, 'actions', '1 % = 50 €. Risque par action 1 €. 50 actions (1 000 € investis).'),
  C('Objectif à 23 €. Quel est le ratio gain/risque ?', 3, 0.05, '', 'Gain 3 €, risque 1 € : ratio 3.'),
  Q('Le trade touche ton stop. Que fais-tu ?', ['J’accepte la perte prévue et je le note dans mon journal', 'Je rachète tout de suite le double pour me refaire', 'Je déplace le stop plus bas avant qu’il ne soit touché'], 0, 'Une perte prévue de 1 % n’est pas un échec. C’est le coût du métier.'),
]),
);
})();
