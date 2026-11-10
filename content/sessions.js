/* ============================================================
   NOVATITRE — LES SÉANCES DU JOUR (7 minutes)
   ------------------------------------------------------------
   Règle produit : chaque séance courte contient
   1 DÉCOUVERTE (leçon interactive de 90 s), 1 DÉCISION (choisir
   entre 3 placements fictifs), des RETOURS immédiats (questions
   corrigées + simulation sur plusieurs années) et de la PROGRESSION
   (expérience, mission validée, chapitre débloqué).
   Les simulations sont des EXEMPLES : rendements fictifs, jamais
   garantis, recalculables (« Et si les marchés avaient fait autrement ? »).
   Format d'une option de décision :
     w     = part exposée au marché du scénario (0 à 1)
     safe  = rendement annuel de la partie sans risque (%)
     idio  = risque propre en plus (une seule action : élevé)
     fee   = frais annuels (%)
     monthly / capital / start = versements
     mk    = où le placement entre dans le portefeuille fictif
   ============================================================ */
(() => {
const { Q, V, C } = window.NT_H;
const LS = (title, cards) => ({ type: 'lesson', title, cards });
const D = (persona, text, facts, market, years, options, explain) => ({ type: 'decision', persona, q: text, facts, market, years, options, explain });

window.NT_THEMES = [
{ id: 'etf', title: 'Les ETF', ch: 3, rel: 'm3-2', lesson: LS('Un ETF, c’est quoi ?', [
    { k: 'info', viz: 'basket', h: 'Un panier d’entreprises', t: 'Un ETF achète d’un coup toutes les entreprises d’un indice. Une seule ligne, des centaines d’entreprises.' },
    { k: 'guess', h: 'À ton avis…', t: 'Combien d’entreprises dans un ETF « Monde » ?', opts: ['1', 'Environ 1 500', '10'], a: 1, r: 'Environ 1 500 entreprises de pays développés. Si l’une chute, les autres amortissent.' },
    { k: 'info', viz: 'coins', h: 'Peu de frais', t: 'Beaucoup d’ETF coûtent entre 0,1 % et 0,5 % par an. Un fonds classique en banque coûte souvent bien plus.' },
    { k: 'tap', viz: 'down', h: 'Mais attention…', t: 'Un ETF actions est-il garanti ?', hidden: 'Non. Quand tout le marché baisse, l’ETF baisse aussi : −30 % en quelques semaines, c’est déjà arrivé.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Diversifié, peu cher, simple. Fait pour le long terme, pas garanti.' },
  ]),
  questions: [
    Q('Un ETF Monde, c’est…', ['un fonds qui détient de nombreuses entreprises d’un coup', 'une seule grande entreprise', 'un compte d’épargne garanti'], 0, 'Une seule ligne, des centaines d’entreprises.'),
    V('Un ETF actions garantit ton capital.', false, 'Il suit le marché : il peut baisser fortement.'),
    C('1 000 € dans un ETF à 0,2 % de frais par an. Frais la première année ?', 2, 0.01, '€', '1 000 × 0,2 % = 2 €.'),
  ],
  decision: D('Lucas', 'Lucas, 25 ans, a 2 000 € dont il n’aura pas besoin avant 15 ans. Il veut investir simplement. Que choisit-il ?',
    { capital: 2000, horizon: '15 ans' }, { rate: 6, vol: 15 }, 15, [
    { name: 'Une seule action tech', desc: 'Tout sur une entreprise qui fait rêver.', w: 1, idio: 30, fee: 0.1, capital: 2000, mk: 'TEC', fit: false },
    { name: 'Un ETF Monde', desc: '1 500 entreprises en une ligne, frais 0,2 %.', w: 1, fee: 0.2, capital: 2000, mk: 'MON', fit: true },
    { name: 'Un livret', desc: 'Garanti, disponible, rendement d’exemple 2 %.', w: 0, safe: 2, capital: 2000, mk: 'LIV', fit: false },
  ], 'Sur 15 ans, l’ETF Monde est le plus adapté : il accepte des baisses passagères mais vise plus que le livret. L’action seule met tout sur une seule entreprise.') },

{ id: 'compose', title: 'Les intérêts composés', ch: 1, rel: 'm1-3', lesson: LS('L’effet boule de neige', [
    { k: 'info', viz: 'bars', h: 'Tes gains font des gains', t: 'Chaque année, tu gagnes aussi sur les gains des années précédentes. Au début c’est lent, puis ça accélère.' },
    { k: 'guess', h: 'À ton avis…', t: '1 000 € placés à 5 % par an. Après 15 ans, environ ?', opts: ['1 750 €', '2 080 €', '1 150 €'], a: 1, r: '1 000 × 1,05¹⁵ ≈ 2 079 €. Sans les intérêts composés, ce serait 1 750 €.' },
    { k: 'tap', viz: 'clock', h: 'Le vrai secret', t: 'Qu’est-ce qui compte le plus ?', hidden: 'Le temps. Commencer tôt, même petit, bat souvent commencer tard, même plus gros.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Commencer tôt, réinvestir, laisser le temps faire. Rien n’est garanti, mais le temps est ton allié.' },
  ]),
  questions: [
    C('Règle de 72 : à 8 % par an, en combien d’années un placement double-t-il ?', 9, 0.5, 'ans', '72 ÷ 8 = 9 ans.'),
    Q('Qu’est-ce qui renforce le plus l’effet boule de neige ?', ['Laisser le temps faire et réinvestir', 'Retirer ses gains chaque année', 'Changer de placement chaque mois'], 0, 'Les retraits et les frais freinent l’effet.'),
    V('Commencer 10 ans plus tôt peut compter plus que verser un peu plus chaque mois.', true, 'Les premières années ont le plus de temps pour grossir.'),
  ],
  decision: D('Nina', 'Nina, 25 ans, investit pour ses 30 prochaines années dans le même ETF. Elle peut mettre au total 36 000 €. Quelle stratégie ?',
    { capital: 0, horizon: '30 ans' }, { rate: 5, vol: 5 }, 30, [
    { name: '100 € par mois dès maintenant', desc: '30 ans de versements.', w: 1, fee: 0.2, monthly: 100, mk: 'MON', fit: true },
    { name: '150 € par mois, mais dans 10 ans', desc: '20 ans de versements, même total.', w: 1, fee: 0.2, monthly: 150, start: 10, mk: 'MON', fit: false },
    { name: 'Tout garder sur un livret', desc: '100 € par mois, rendement d’exemple 2 %.', w: 0, safe: 2, monthly: 100, mk: 'LIV', fit: false },
  ], 'Même somme versée, mais commencer tôt laisse 10 ans de plus aux intérêts composés. Le livret protège, mais rapporte peu sur 30 ans.') },

{ id: 'inflation', title: 'Inflation et épargne de précaution', ch: 1, rel: 'm1-4', lesson: LS('L’argent qui fond', [
    { k: 'info', viz: 'down', h: 'L’inflation', t: 'Quand les prix montent, chaque euro achète un peu moins. 1 000 € sous le matelas perdent de la valeur.' },
    { k: 'guess', h: 'À ton avis…', t: 'Ton livret rapporte 1 %, l’inflation est à 3 %. Ton pouvoir d’achat…', opts: ['monte', 'baisse', 'ne bouge pas'], a: 1, r: '1 % − 3 % ≈ −2 % par an : tu peux acheter moins.' },
    { k: 'tap', viz: 'shield', h: 'Alors pourquoi un livret ?', t: 'À quoi sert-il quand même ?', hidden: 'À l’argent dont tu peux avoir besoin vite : imprévus, projets proches. Il est garanti et disponible.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Court terme : sécurité. Long terme : il faut viser plus que l’inflation, en acceptant un risque.' },
  ]),
  questions: [
    C('Les prix montent de 3 % sur un an. Un panier de 100 € coûte maintenant ?', 103, 0.5, '€', '100 × 1,03 = 103 €.'),
    V('Un livret garanti est adapté pour l’argent d’un projet dans moins de 2 ans.', true, 'Pas de risque de baisse au mauvais moment.'),
    Q('L’épargne de précaution, c’est souvent…', ['3 à 6 mois de dépenses, disponibles', 'tout son argent en actions', 'un crédit'], 0, 'Elle évite de vendre ses placements au pire moment.'),
  ],
  decision: D('Paul', 'Paul a 5 000 € pour un voyage dans 2 ans. Il ne veut surtout pas avoir moins le jour du départ. Que choisit-il ?',
    { capital: 5000, horizon: '2 ans' }, { rate: 6, vol: 16 }, 2, [
    { name: 'Un ETF Monde', desc: 'Vise plus, mais peut baisser.', w: 1, fee: 0.2, capital: 5000, mk: 'MON', fit: false },
    { name: 'Un livret', desc: 'Garanti, disponible, rendement d’exemple 2 %.', w: 0, safe: 2, capital: 5000, mk: 'LIV', fit: true },
    { name: 'Le compte courant', desc: '0 %, tout de suite disponible.', w: 0, safe: 0, capital: 5000, mk: 'LIV', fit: false },
  ], 'Sur 2 ans, une baisse des marchés peut tomber juste avant le départ. Le livret garantit le capital et rapporte un peu plus que le compte courant.') },

{ id: 'diversif', title: 'La diversification', ch: 3, rel: 'm3-1', lesson: LS('Tous tes œufs dans le même panier ?', [
    { k: 'info', viz: 'one', h: 'Une seule entreprise', t: 'Si elle a un gros problème, tout ton argent en souffre.' },
    { k: 'info', viz: 'basket', h: 'Plusieurs entreprises', t: 'Les mauvaises nouvelles de l’une sont amorties par les autres.' },
    { k: 'guess', h: 'À ton avis…', t: 'Diversifier, ça supprime le risque ?', opts: ['Oui, totalement', 'Non, ça le réduit'], a: 1, r: 'Quand tout le marché baisse, un portefeuille diversifié baisse aussi, mais moins violemment qu’une seule action.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Diversifier par entreprises, secteurs et pays. C’est le seul « repas gratuit » de la finance.' },
  ]),
  questions: [
    Q('Diversifier sert surtout à…', ['répartir le risque', 'supprimer tout risque', 'payer moins d’impôts'], 0, 'On réduit l’impact d’un seul problème.'),
    V('Deux actions du même secteur offrent une bonne diversification.', false, 'Elles réagissent souvent aux mêmes nouvelles.'),
    C('Portefeuille de 4 000 €, dont 2 000 € sur une seule action. Poids de cette action (en %) ?', 50, 0.1, '%', '2 000 ÷ 4 000 = 50 % : beaucoup trop concentré.'),
  ],
  decision: D('Sarah', 'Sarah a 10 000 € pour 10 ans. Elle hésite sur la façon de les répartir.',
    { capital: 10000, horizon: '10 ans' }, { rate: 6, vol: 15 }, 10, [
    { name: 'Tout sur une action', desc: 'Autoria, l’entreprise qu’elle connaît.', w: 1, idio: 30, fee: 0.1, capital: 10000, mk: 'AUT', fit: false },
    { name: '5 actions, 5 secteurs', desc: 'Mieux réparti, mais encore concentré.', w: 1, idio: 12, fee: 0.2, capital: 10000, mk: 'EXP', fit: false },
    { name: 'Un ETF Monde', desc: '1 500 entreprises, tous secteurs, frais 0,2 %.', w: 1, fee: 0.2, capital: 10000, mk: 'MON', fit: true },
  ], 'Même rendement moyen espéré, mais des risques très différents : l’ETF Monde donne le parcours le plus régulier. Relance la simulation : l’action seule peut finir très haut… ou très bas.') },

{ id: 'horizon', title: 'L’horizon de placement', ch: 3, rel: 'm3-5', lesson: LS('Quand auras-tu besoin de l’argent ?', [
    { k: 'info', viz: 'clock', h: 'La question n°1', t: 'Avant de choisir un placement, on se demande QUAND on aura besoin de l’argent.' },
    { k: 'guess', h: 'À ton avis…', t: 'Projet dans 2 ans : beaucoup d’actions ?', opts: ['Oui', 'Non'], a: 1, r: 'Sur 2 ans, une baisse de 30 % peut ne pas avoir le temps de se rattraper.' },
    { k: 'tap', viz: 'bars', h: 'Et sur 20 ans ?', t: 'Que change un horizon long ?', hidden: 'Il laisse le temps de traverser les crises. Historiquement, les actions ont souvent rattrapé leurs baisses sur longue période, sans aucune garantie.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Horizon court : sécurité. Horizon long : on peut accepter plus de variations.' },
  ]),
  questions: [
    Q('Pour un apport immobilier dans 3 ans, on privilégie…', ['des placements sûrs', '100 % d’actions', 'des crypto-actifs'], 0, 'Le capital doit être là le jour J.'),
    V('Plus l’horizon est long, plus on peut accepter des baisses temporaires.', true, 'On a le temps d’attendre la remontée, sans garantie.'),
    Q('Ton horizon de placement, c’est…', ['le moment où tu auras besoin de l’argent', 'le rendement espéré', 'le nom de ta banque'], 0, 'C’est la première question à se poser.'),
  ],
  decision: D('Karim', 'Karim achète un appartement dans 3 ans. Il a 20 000 € d’apport à faire fructifier sans risque de le voir fondre.',
    { capital: 20000, horizon: '3 ans' }, { rate: 6, vol: 17 }, 3, [
    { name: '100 % ETF actions', desc: 'Vise le plus haut rendement.', w: 1, fee: 0.2, capital: 20000, mk: 'MON', fit: false },
    { name: 'Placement sécurisé', desc: 'Capital garanti, rendement d’exemple 2,5 %.', w: 0, safe: 2.5, capital: 20000, mk: 'LIV', fit: true },
    { name: '50 % actions, 50 % obligations', desc: 'Un compromis.', w: 0.5, safe: 3, fee: 0.2, capital: 20000, mk: { MON: 0.5, OBL: 0.5 }, fit: false },
  ], 'Avec un besoin dans 3 ans, la priorité est d’avoir les 20 000 € le jour J. Même un mélange 50/50 peut perdre au mauvais moment.') },

{ id: 'frais', title: 'Les frais', ch: 3, rel: 'm3-10', lesson: LS('Le coût caché', [
    { k: 'info', viz: 'coins', h: 'Les frais, chaque année', t: 'Un fonds prélève des frais chaque année, que tu gagnes ou non.' },
    { k: 'guess', h: 'À ton avis…', t: '1,5 % de frais en plus par an, sur 20 ans, c’est…', opts: ['presque rien', 'souvent plus d’un quart du gain final'], a: 1, r: 'Les frais se composent aussi : ils freinent l’effet boule de neige.' },
    { k: 'tap', viz: 'scale', h: 'Comment comparer ?', t: 'Où trouver les frais d’un fonds ?', hidden: 'Dans son document d’informations clés (DIC) : frais courants, frais d’entrée et de sortie.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'À placement égal, les frais les plus bas gagnent presque toujours sur la durée.' },
  ]),
  questions: [
    C('Frais de 1 % par an sur 15 000 €. Coût la première année ?', 150, 0.5, '€', '15 000 × 1 % = 150 €.'),
    V('Les frais sont prélevés même les années où le fonds baisse.', true, 'Ils sont certains, les gains ne le sont pas.'),
    Q('Où lire les frais d’un fonds ?', ['Dans son document d’informations clés (DIC)', 'Sur les réseaux sociaux', 'Nulle part'], 0, 'Document obligatoire, court et standardisé.'),
  ],
  decision: D('Emma', 'Emma place 10 000 € pour 20 ans sur le même marché mondial. Trois produits, trois niveaux de frais.',
    { capital: 10000, horizon: '20 ans' }, { rate: 6, vol: 12 }, 20, [
    { name: 'Fonds classique en banque', desc: 'Frais 1,8 % par an.', w: 1, fee: 1.8, capital: 10000, mk: 'MON', fit: false },
    { name: 'ETF Monde', desc: 'Frais 0,2 % par an.', w: 1, fee: 0.2, capital: 10000, mk: 'MON', fit: true },
    { name: 'Fonds « intermédiaire »', desc: 'Frais 0,8 % par an.', w: 1, fee: 0.8, capital: 10000, mk: 'MON', fit: false },
  ], 'Même marché, mêmes années : seuls les frais changent. Sur 20 ans, l’écart peut représenter plusieurs milliers d’euros.') },

{ id: 'krach', title: 'Garder son calme dans un krach', ch: 5, rel: 'm5-1', lesson: LS('Quand tout s’écroule', [
    { k: 'info', viz: 'down', h: 'Les krachs arrivent', t: '2000, 2008, 2020 : les marchés ont parfois perdu 30 à 50 %. C’est désagréable, mais pas rare.' },
    { k: 'guess', h: 'À ton avis…', t: 'Vendre en pleine panique…', opts: ['protège toujours', 'transforme une baisse en perte réelle'], a: 1, r: 'Tant qu’on ne vend pas, la perte n’est pas définitive. Vendre au plus bas la fige.' },
    { k: 'tap', viz: 'shield', h: 'Le vrai bouclier', t: 'Qu’est-ce qui aide à tenir ?', hidden: 'Une épargne de précaution, un horizon long, un portefeuille diversifié et des règles écrites AVANT la crise.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'On décide à froid, pas sous l’émotion. Les performances passées ne garantissent rien.' },
  ]),
  questions: [
    V('Les performances passées garantissent les performances futures.', false, 'Elles ne préjugent pas de l’avenir.'),
    C('Tu revends à 70 € et rachètes à 95 €. Perte par action ?', 25, 0.01, '€', '95 − 70 = 25 € : le coût de l’émotion.'),
    Q('Avant une crise, le plus utile est…', ['écrire ses règles à l’avance', 'surveiller les cours toutes les heures', 'suivre les rumeurs'], 0, 'Un plan écrit évite les décisions de panique.'),
  ],
  decision: D('Toi', 'Ton portefeuille de 10 000 € (ETF Monde) vient de perdre 30 % en un mois. Tu as 15 ans devant toi et une épargne de précaution. Que fais-tu ?',
    { capital: 7000, horizon: '5 ans affichés' }, { path: [22, 14, -6, 12, 9] }, 5, [
    { name: 'Tout vendre maintenant', desc: 'Pour « arrêter les frais ».', w: 0, safe: 1, capital: 7000, mk: 'LIV', fit: false },
    { name: 'Ne rien changer', desc: 'Suivre son plan, continuer.', w: 1, fee: 0.2, capital: 7000, mk: 'MON', fit: true },
    { name: 'Vendre la moitié', desc: 'Un peu des deux.', w: 0.5, safe: 1, fee: 0.2, capital: 7000, mk: { MON: 0.5, LIV: 0.5 }, fit: false },
  ], 'Dans cet exemple, le marché remonte ensuite, comme souvent après les grandes crises passées, sans aucune garantie. Celui qui vend au plus bas rate la remontée.') },

{ id: 'repartition', title: 'Actions et obligations', ch: 3, rel: 'm3-7', lesson: LS('Le bon mélange', [
    { k: 'info', viz: 'pie', h: 'Deux moteurs', t: 'Les actions visent la croissance mais bougent beaucoup. Les obligations sont plus calmes et amortissent.' },
    { k: 'guess', h: 'À ton avis…', t: 'À 5 ans de la retraite, 100 % d’actions, c’est…', opts: ['raisonnable', 'souvent trop risqué'], a: 1, r: 'Une grosse baisse juste avant d’avoir besoin de l’argent est difficile à rattraper.' },
    { k: 'tap', viz: 'scale', h: 'Le rééquilibrage', t: 'Ton mélange dérive avec le temps. Que faire ?', hidden: 'Une fois par an, revenir à sa répartition cible : on vend un peu de ce qui a monté, on rachète ce qui a baissé.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Plus l’échéance approche, plus on réduit la part d’actions.' },
  ]),
  questions: [
    Q('Les obligations dans un portefeuille servent souvent à…', ['amortir les baisses', 'garantir de gros gains', 'éviter les impôts'], 0, 'Elles bougent en général moins que les actions.'),
    C('Tu répartis 5 000 € : 60 % actions, 40 % obligations. Combien en obligations ?', 2000, 1, '€', '40 % de 5 000 € = 2 000 €.'),
    V('Rééquilibrer, c’est revenir à sa répartition cible.', true, 'Une fois par an suffit souvent.'),
  ],
  decision: D('Camille', 'Camille, 55 ans, part à la retraite dans 5 ans avec 30 000 € investis. Elle veut encore un peu de croissance, sans grosse frayeur.',
    { capital: 30000, horizon: '5 ans' }, { rate: 6, vol: 16 }, 5, [
    { name: '100 % actions', desc: 'Le maximum de croissance espérée.', w: 1, fee: 0.2, capital: 30000, mk: 'MON', fit: false },
    { name: '40 % actions, 60 % obligations', desc: 'Croissance modérée, baisses amorties.', w: 0.4, safe: 3, fee: 0.2, capital: 30000, mk: { MON: 0.4, OBL: 0.6 }, fit: true },
    { name: '100 % livret', desc: 'Aucun risque, rendement d’exemple 2 %.', w: 0, safe: 2, capital: 30000, mk: 'LIV', fit: false },
  ], 'À 5 ans de l’échéance, un mélange prudent garde un peu de croissance tout en limitant les grosses baisses. Le 100 % livret est sûr mais peut perdre face à l’inflation.') },
];
})();
