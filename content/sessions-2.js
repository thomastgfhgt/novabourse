/* ============================================================
   NOVATITRE — SÉANCES SUPPLÉMENTAIRES (trading + investissement)
   et LEÇONS D'INTRODUCTION des 15 chapitres.
   Nouveaux réglages du simulateur :
     market.trades {p, R} : une période = un trade (gain R ou perte 1R)
     option.risk  : % du capital risqué par trade
     option.p / option.R : taux de réussite et gain propres à l'option
     option.martingale : double la mise après chaque perte
     option.pause3 : 3 trades de pause après 3 pertes d'affilée
     option.bigLoss {prob, R} : parfois une perte bien plus grosse (pas de stop)
     option.wait  : années sans investir (on attend « le bon moment »)
     option.drag  : rendement retiré chaque année (dividendes dépensés…)
     option.taxEnd : prélèvement à la sortie sur les gains (%)
     option.path  : trajectoire imposée (ex. pyramide qui s'effondre)
   ============================================================ */
(() => {
const { Q, V, C } = window.NT_H;
const LS = (title, cards) => ({ type: 'lesson', title, cards });
const D = (persona, text, facts, market, years, options, explain, unit) => ({ type: 'decision', persona, q: text, facts, market, years, options, explain, unit });

window.NT_THEMES.push(
/* ---------------- TRADING ---------------- */
{ id: 'risque', title: 'Combien risquer par trade ?', ch: 12, rel: 'm12-2', lesson: LS('La règle des 1 %', [
    { k: 'info', viz: 'down', h: 'Les séries de pertes arrivent', t: 'Même une bonne stratégie peut perdre 6, 8, parfois 10 fois de suite. C’est la statistique, pas la malchance.' },
    { k: 'guess', h: 'À ton avis…', t: '10 pertes de suite en risquant 10 % à chaque fois. Il te reste…', opts: ['environ 90 %', 'environ 35 %', '0 %'], a: 1, r: '0,9¹⁰ ≈ 0,35 : il reste environ 35 % du capital. À 1 %, il resterait environ 90 %.' },
    { k: 'info', viz: 'shield', h: 'La règle des 1 %', t: 'Risquer environ 1 % par trade : une mauvaise série coûte quelques %, pas tout ton compte.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Petit risque, toujours. La taille de position se calcule à partir du stop.' },
  ]),
  questions: [
    C('Capital 8 000 €, risque 1 % par trade. Perte maximale prévue ?', 80, 0.5, '€', '1 % de 8 000 € = 80 €.'),
    V('Risquer 10 % par trade permet de gagner plus vite, sans danger.', false, 'Une série de pertes peut détruire le compte.'),
    Q('Taille de position = …', ['risque en € ÷ distance au stop', 'capital ÷ 10', 'au feeling'], 0, 'Le stop décide de la taille, pas l’envie.'),
  ],
  decision: D('Hugo', 'Hugo a une méthode qui gagne 35 % du temps, avec des gains deux fois plus grands que ses pertes (un petit avantage, comme souvent en vrai). Capital fictif : 10 000 €. Combien risquer par trade sur 60 trades ?',
    { capital: 10000, horizon: '60 trades' }, { trades: { p: 0.35, R: 2 } }, 60, [
    { name: '1 % par trade', desc: 'La règle des pros.', capital: 10000, risk: 1, fit: true, mk: 'LIV' },
    { name: '5 % par trade', desc: 'Pour aller plus vite.', capital: 10000, risk: 5, fit: false, mk: 'LIV' },
    { name: '15 % par trade', desc: '« Qui ne risque rien n’a rien. »', capital: 10000, risk: 15, fit: false, mk: 'LIV' },
  ], 'Avec un petit avantage, risquer gros fait souvent fondre le compte : les séries de pertes frappent avant que l’avantage ne joue. À 1 %, Hugo reste dans la partie. Regarde combien de fois chaque choix finit sous le capital de départ.', 'trades') },

{ id: 'ratio', title: 'Le ratio gain/risque', ch: 12, rel: 'm12-4', lesson: LS('Gagner plus que ce qu’on perd', [
    { k: 'info', viz: 'scale', h: 'Le ratio', t: 'Gain visé ÷ perte acceptée. Un ratio de 2 : tu vises 2 € pour 1 € risqué.' },
    { k: 'guess', h: 'À ton avis…', t: 'Avec un ratio de 2, combien de bons trades sur 10 pour ne pas perdre ?', opts: ['Environ 4 sur 10', '8 sur 10', '10 sur 10'], a: 0, r: 'Il suffit d’avoir raison un peu plus d’une fois sur trois.' },
    { k: 'tap', viz: 'coins', h: 'Le piège', t: 'Viser un ratio énorme, c’est mieux ?', hidden: 'Pas forcément : plus l’objectif est loin, moins il est souvent atteint. On regarde les deux ensemble : c’est l’espérance.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Espérance = réussite × gain − échec × perte. Elle doit être positive.' },
  ]),
  questions: [
    C('Entrée 40 €, stop 38 €, objectif 46 €. Ratio gain/risque ?', 3, 0.05, '', 'Gain 6 €, risque 2 € : 3.'),
    Q('L’espérance d’une stratégie, c’est…', ['réussite × gain moyen − échec × perte moyenne', 'le gain maximum', 'le nombre de trades'], 0, 'Elle dit si la méthode gagne en moyenne.'),
    V('Gagner 80 % du temps garantit une stratégie gagnante.', false, 'Si les pertes sont 5 fois plus grosses que les gains, on perd quand même.'),
  ],
  decision: D('Inès', 'Inès compare trois méthodes, avec le même risque de 1 % par trade. Laquelle garde-t-elle pour ses 80 prochains trades ?',
    { capital: 10000, horizon: '80 trades' }, { trades: { p: 0.45, R: 2 } }, 80, [
    { name: 'Petits gains rapides', desc: 'Gagne 55 % du temps, gain = 1 fois le risque.', capital: 10000, risk: 1, p: 0.55, R: 1, fit: false, mk: 'LIV' },
    { name: 'Ratio de 2', desc: 'Gagne 40 % du temps, gain = 2 fois le risque.', capital: 10000, risk: 1, p: 0.40, R: 2, fit: true, mk: 'LIV' },
    { name: 'Le gros coup', desc: 'Gagne 20 % du temps, gain = 3 fois le risque.', capital: 10000, risk: 1, p: 0.20, R: 3, fit: false, mk: 'LIV' },
  ], 'Espérances : A = +0,10 R, B = +0,20 R, C = −0,20 R par trade. La méthode qui gagne le plus souvent n’est pas la meilleure, et celle qui vise le plus gros perd en moyenne.', 'trades') },

{ id: 'revanche', title: 'Après une série de pertes', ch: 13, rel: 'm13-3', lesson: LS('Ne pas vouloir « se refaire »', [
    { k: 'info', viz: 'down', h: 'Le revenge trading', t: 'Après des pertes, l’envie de se refaire vite pousse à prendre plus de risque. C’est le piège n°1.' },
    { k: 'guess', h: 'À ton avis…', t: 'Doubler la mise après chaque perte (« martingale »), c’est…', opts: ['une méthode sûre', 'une façon rapide de tout perdre'], a: 1, r: 'Après 6 pertes, la mise est 64 fois plus grosse. Une série suffit à vider le compte.' },
    { k: 'tap', viz: 'clock', h: 'Le bon réflexe', t: 'Que faire après 3 pertes ?', hidden: 'Garder la même taille, ou faire une pause et relire son journal. Jamais augmenter le risque.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'La taille ne dépend jamais des trades précédents. Une règle de pause protège du mental.' },
  ]),
  questions: [
    Q('Le revenge trading, c’est…', ['reprendre vite un trade pour se refaire', 'une stratégie de tendance', 'un type d’ordre'], 0, 'Un biais à neutraliser par une règle écrite.'),
    C('Mise de 50 € doublée après chaque perte. Mise après 4 pertes ?', 800, 1, '€', '50 → 100 → 200 → 400 → 800 €.'),
    V('Une pause après 3 pertes peut éviter des décisions émotionnelles.', true, 'C’est une règle très courante des traders disciplinés.'),
  ],
  decision: D('Léo', 'Léo vient de perdre 3 trades d’affilée. Quelle règle garde-t-il pour ses 60 prochains trades ? (méthode : 35 % de réussite, gains 2 fois le risque)',
    { capital: 10000, horizon: '60 trades' }, { trades: { p: 0.35, R: 2 } }, 60, [
    { name: 'Doubler après chaque perte', desc: 'Pour se refaire au prochain gain.', capital: 10000, risk: 1, martingale: true, fit: false, mk: 'LIV' },
    { name: 'Garder 1 % quoi qu’il arrive', desc: 'La même taille, toujours.', capital: 10000, risk: 1, fit: true, mk: 'LIV' },
    { name: '1 % et une pause après 3 pertes', desc: 'On souffle, on relit son journal.', capital: 10000, risk: 1, pause3: true, fit: true, mk: 'LIV' },
  ], 'Garder la même taille, avec ou sans pause, laisse la méthode jouer. Doubler la mise transforme une série normale de pertes en catastrophe.', 'trades') },

{ id: 'levier', title: 'L’effet de levier', ch: 9, rel: 'm9-1', lesson: LS('Le levier, une loupe à double tranchant', [
    { k: 'info', viz: 'scale', h: 'Le levier', t: 'Avec un levier de 5, tu es exposé à 5 fois ta mise. Gains ET pertes sont multipliés par 5.' },
    { k: 'guess', h: 'À ton avis…', t: 'Levier 5, le marché baisse de 20 %. Ta mise…', opts: ['baisse de 20 %', 'disparaît', 'monte'], a: 1, r: '5 × 20 % = 100 % : toute la mise est perdue.' },
    { k: 'info', viz: 'down', h: 'Les chiffres officiels', t: 'Sur les CFD, les avertissements obligatoires indiquent souvent 74 à 89 % de comptes de particuliers perdants.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Comprendre le levier pour s’en méfier. Jamais avec de l’argent dont on a besoin.' },
  ]),
  questions: [
    C('Levier 10, marché −4 %. Perte sur la mise (en %) ?', 40, 0.1, '%', '10 × 4 % = 40 %.'),
    V('Avec certains produits à levier, on peut perdre plus que sa mise de départ.', true, 'C’est pourquoi ils sont très encadrés.'),
    Q('Les CFD sont…', ['des produits à levier très risqués', 'des livrets garantis', 'des actions classiques'], 0, 'L’AMF met régulièrement en garde contre ces produits.'),
  ],
  decision: D('Maya', 'Maya place 5 000 € sur un indice d’actions pour 5 ans. Elle hésite à utiliser un levier.',
    { capital: 5000, horizon: '5 ans' }, { rate: 6, vol: 18 }, 5, [
    { name: 'Sans levier', desc: 'Exposition = sa mise.', w: 1, fee: 0.2, capital: 5000, mk: 'MON', fit: true },
    { name: 'Levier 2', desc: 'Exposition = 2 fois la mise, frais de financement.', w: 2, fee: 3, capital: 5000, mk: 'MON', fit: false },
    { name: 'Levier 5', desc: 'Exposition = 5 fois la mise, frais de financement.', w: 5, fee: 4, capital: 5000, mk: 'MON', fit: false },
  ], 'Le levier ne change pas le marché : il amplifie tout. Une seule mauvaise année peut effacer la mise avec un levier de 5 (regarde le « nombre de fois sous la somme versée »).') },

{ id: 'stop', title: 'Le stop-loss', ch: 12, rel: 'm12-1', lesson: LS('Savoir quand on a tort', [
    { k: 'info', viz: 'shield', h: 'Le stop-loss', t: 'Un ordre qui coupe la position si le prix atteint le niveau où ton idée est fausse.' },
    { k: 'guess', h: 'À ton avis…', t: 'Sans stop, « j’attends que ça remonte »…', opts: ['ça remonte toujours', 'une petite perte peut devenir énorme'], a: 1, r: 'Certaines positions ne remontent jamais. Une seule grosse perte efface beaucoup de petits gains.' },
    { k: 'tap', viz: 'scale', h: 'La règle d’or', t: 'On peut déplacer un stop ?', hidden: 'On peut le rapprocher pour protéger un gain. On ne l’éloigne jamais pour « laisser respirer » une perte.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Le stop se décide AVANT d’entrer, derrière un niveau logique.' },
  ]),
  questions: [
    Q('Où placer un stop à l’achat ?', ['Sous un niveau logique (support, dernier creux)', 'Au hasard', 'Au-dessus du prix'], 0, 'Si ce niveau casse, l’idée est fausse.'),
    V('Éloigner son stop quand le prix s’en approche est une bonne pratique.', false, 'C’est l’aversion à la perte qui parle.'),
    C('Tu risques 120 €. Entrée 30 €, stop 27 €. Combien d’actions ?', 40, 0.01, 'actions', '120 ÷ 3 = 40.'),
  ],
  decision: D('Nora', 'Nora a une méthode qui gagne 35 % du temps, avec des gains 2 fois plus grands que ses pertes. Comment gère-t-elle ses pertes sur 60 trades ? (risque 1 %)',
    { capital: 10000, horizon: '60 trades' }, { trades: { p: 0.35, R: 2 } }, 60, [
    { name: 'Stop toujours respecté', desc: 'Chaque perte = 1 fois le risque.', capital: 10000, risk: 1, fit: true, mk: 'LIV' },
    { name: 'Pas de stop, j’attends', desc: 'Parfois la perte devient 4 fois plus grosse.', capital: 10000, risk: 1, bigLoss: { prob: 0.25, R: -4 }, fit: false, mk: 'LIV' },
    { name: 'J’éloigne mon stop', desc: 'Parfois la perte devient 2,5 fois plus grosse.', capital: 10000, risk: 1, bigLoss: { prob: 0.2, R: -2.5 }, fit: false, mk: 'LIV' },
  ], 'Quelques grosses pertes suffisent à rendre une bonne méthode perdante. Le stop respecté garde l’avantage de la méthode.', 'trades') },

/* ---------------- INVESTISSEMENT ---------------- */
{ id: 'dca', title: 'Tout d’un coup ou chaque mois ?', ch: 3, rel: 'm3-6', lesson: LS('Investir régulièrement', [
    { k: 'info', viz: 'bars', h: 'Investir chaque mois', t: 'Mettre la même somme chaque mois : on achète plus de parts quand c’est bas, moins quand c’est haut.' },
    { k: 'guess', h: 'À ton avis…', t: 'Attendre « le bon moment » pour investir…', opts: ['marche à coup sûr', 'fait souvent rater des hausses'], a: 1, r: 'Personne ne connaît le bon moment à l’avance. Attendre, c’est souvent rester sur le côté.' },
    { k: 'tap', viz: 'scale', h: 'Tout d’un coup ?', t: 'Si l’argent est déjà là ?', hidden: 'Investir tout de suite a souvent fait mieux sur la durée, car le marché monte en moyenne. Étaler limite le regret si une baisse arrive juste après. Les deux sont défendables.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Le plus important : commencer, rester investi, et ne pas jouer aux devinettes.' },
  ]),
  questions: [
    C('100 € par mois. Mois 1 : part à 20 €. Mois 2 : part à 25 €. Parts achetées au total ?', 9, 0.05, 'parts', '5 + 4 = 9 parts.'),
    V('Investir chaque mois supprime tout risque de perte.', false, 'Ça lisse le prix d’achat, ça ne supprime pas le risque.'),
    Q('Attendre une baisse pour investir, c’est…', ['essayer de deviner le marché', 'une garantie de gain', 'obligatoire'], 0, 'Le « market timing » réussit rarement de façon régulière.'),
  ],
  decision: D('Jade', 'Jade a 6 000 € à placer sur un ETF Monde pour 10 ans. Comment s’y prend-elle ?',
    { capital: 6000, horizon: '10 ans' }, { rate: 6, vol: 15 }, 10, [
    { name: 'Tout investir maintenant', desc: '6 000 € dès aujourd’hui.', w: 1, fee: 0.2, capital: 6000, mk: 'MON', fit: true },
    { name: '50 € par mois pendant 10 ans', desc: 'Le reste attend sur un compte à 0 %.', w: 1, fee: 0.2, capital: 0, monthly: 50, mk: 'MON', fit: true },
    { name: 'Attendre « la baisse » 3 ans', desc: 'Puis tout investir.', w: 1, fee: 0.2, capital: 6000, wait: 3, safe: 0, mk: 'MON', fit: false },
  ], 'Investir tout de suite ou régulièrement sont deux bons choix (le second limite le regret). Attendre « le bon moment » fait souvent perdre des années de hausse.') },

{ id: 'enveloppes', title: 'Choisir la bonne enveloppe', ch: 8, rel: 'm8-7', lesson: LS('Le même placement, des impôts différents', [
    { k: 'info', viz: 'pie', h: 'Une enveloppe', t: 'PEA, compte-titres, assurance-vie : ce sont des « boîtes » qui changent les impôts, pas le placement lui-même.' },
    { k: 'guess', h: 'À ton avis…', t: 'En 2026, les gains d’un PEA de plus de 5 ans supportent…', opts: ['31,4 %', '18,6 % de prélèvements sociaux', '0 %'], a: 1, r: 'Pas d’impôt sur le revenu, seulement les prélèvements sociaux. Sur un compte-titres : 31,4 %.' },
    { k: 'tap', viz: 'clock', h: 'Le détail qui compte', t: 'Quelle est la condition du PEA ?', hidden: 'Garder le plan au moins 5 ans et n’y mettre que des titres éligibles (actions européennes, certains ETF). Plafond de versements : 150 000 €.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Long terme en actions européennes : PEA. Projets variés et transmission : assurance-vie. Le reste : compte-titres.' },
  ]),
  questions: [
    C('Gain de 5 000 € retiré d’un PEA de plus de 5 ans. Prélèvements sociaux 2026 (18,6 %) ?', 930, 1, '€', '5 000 × 18,6 % = 930 €.'),
    V('Le PEA accepte toutes les actions du monde en direct.', false, 'Il accepte surtout les actions européennes et certains fonds ou ETF éligibles.'),
    Q('Sur un compte-titres en 2026, la flat tax sur les gains est de…', ['31,4 %', '18,6 %', '0 %'], 0, '12,8 % d’impôt + 18,6 % de prélèvements sociaux.'),
  ],
  decision: D('Sofia', 'Sofia investit 10 000 € sur un ETF d’actions européennes éligible au PEA, pour 10 ans. Dans quelle enveloppe ? (simulation simplifiée : impôts calculés à la sortie, règles 2026)',
    { capital: 10000, horizon: '10 ans' }, { rate: 6, vol: 15 }, 10, [
    { name: 'Compte-titres', desc: 'Flat tax 31,4 % sur les gains.', w: 1, fee: 0.2, capital: 10000, taxEnd: 31.4, mk: 'MON', fit: false },
    { name: 'PEA', desc: '18,6 % de prélèvements sociaux après 5 ans.', w: 1, fee: 0.2, capital: 10000, taxEnd: 18.6, mk: 'MON', fit: true },
    { name: 'Assurance-vie, fonds en euros', desc: 'Capital garanti, rendement d’exemple 2,5 %.', w: 0, safe: 2.5, capital: 10000, taxEnd: 17.2, mk: 'LIV', fit: false },
  ], 'Même ETF, mais le PEA laisse plus de gains après impôts. Le fonds en euros protège le capital mais vise beaucoup moins sur 10 ans. À vérifier chaque année : les règles fiscales changent.') },

{ id: 'arnaque', title: 'L’offre trop belle', ch: 6, rel: 'm6-1', lesson: LS('Repérer une arnaque en 10 secondes', [
    { k: 'info', viz: 'coins', h: 'Le signal n°1', t: 'Un rendement élevé ET garanti. Les deux ensemble n’existent pas.' },
    { k: 'guess', h: 'À ton avis…', t: '« 10 % par mois garantis », c’est…', opts: ['une belle opportunité', 'une arnaque presque certaine'], a: 1, r: '10 % par mois, c’est plus de 200 % par an. Aucun placement sérieux ne promet ça.' },
    { k: 'tap', viz: 'shield', h: 'Le réflexe', t: 'Comment vérifier ?', hidden: 'Chercher le nom sur les listes noires de l’AMF et vérifier l’autorisation (REGAFI, ORIAS). Dans le doute : AMF Épargne Info Service.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Garanti + élevé + urgent = arnaque. On ne verse jamais rien sous la pression.' },
  ]),
  questions: [
    Q('Où vérifier qu’un prestataire est autorisé ?', ['Sur les registres officiels (REGAFI, ORIAS) et les listes de l’AMF', 'Dans les avis sur les réseaux sociaux', 'En demandant au vendeur'], 0, 'Les registres officiels font foi.'),
    V('Les premiers « gains » versés prouvent que le placement est sérieux.', false, 'Dans une pyramide, les premiers sont payés avec l’argent des nouveaux.'),
    Q('Un conseiller te presse de décider avant ce soir. C’est…', ['un signal d’alerte', 'normal', 'une preuve de sérieux'], 0, 'L’urgence empêche de réfléchir et de vérifier.'),
  ],
  decision: D('Marc', 'Marc a 3 000 € pour 5 ans. Il reçoit trois propositions.',
    { capital: 3000, horizon: '5 ans' }, { rate: 6, vol: 15 }, 5, [
    { name: '« 10 % par mois garantis »', desc: 'Site inconnu, conseiller très insistant.', capital: 3000, path: [60, 40, -100, 0, 0], mk: 'LIV', fit: false },
    { name: 'Un ETF Monde', desc: 'Chez un courtier autorisé, frais 0,2 %.', w: 1, fee: 0.2, capital: 3000, mk: 'MON', fit: true },
    { name: 'Un livret', desc: 'Garanti, rendement d’exemple 2 %.', w: 0, safe: 2, capital: 3000, mk: 'LIV', fit: true },
  ], 'L’offre miracle verse de faux « gains » au début, puis disparaît avec l’argent. L’ETF et le livret sont deux choix sérieux selon le risque accepté.') },

{ id: 'dividendes', title: 'Réinvestir ses dividendes', ch: 4, rel: 'm4-3', lesson: LS('Le dividende, petit mais puissant', [
    { k: 'info', viz: 'coins', h: 'Le dividende', t: 'Une part du bénéfice versée aux actionnaires. Jamais garantie.' },
    { k: 'guess', h: 'À ton avis…', t: 'Sur 20 ans, réinvestir les dividendes plutôt que les dépenser…', opts: ['change peu', 'change beaucoup'], a: 1, r: 'Les dividendes réinvestis produisent à leur tour des gains : c’est l’effet boule de neige.' },
    { k: 'tap', viz: 'bars', h: 'Distribuant ou capitalisant ?', t: 'Quelle différence pour un ETF ?', hidden: 'Un ETF distribuant te verse les dividendes. Un ETF capitalisant les réinvestit automatiquement.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Pour faire grossir un capital, on réinvestit. Pour un revenu, on encaisse.' },
  ]),
  questions: [
    C('Dividende 1,50 €, cours 50 €. Rendement du dividende (en %) ?', 3, 0.05, '%', '1,50 ÷ 50 = 3 %.'),
    V('Un dividende élevé est toujours un bon signe.', false, 'Il peut être intenable, ou refléter une chute du cours.'),
    Q('Un ETF capitalisant…', ['réinvestit automatiquement les dividendes', 'verse les dividendes chaque mois', 'ne contient pas d’actions'], 0, 'Pratique pour l’effet boule de neige.'),
  ],
  decision: D('Rayan', 'Rayan investit 10 000 € pour 20 ans. Le marché rapporte en partie sous forme de dividendes (environ 2 % par an dans cet exemple). Que fait-il des dividendes ?',
    { capital: 10000, horizon: '20 ans' }, { rate: 7, vol: 14 }, 20, [
    { name: 'Les réinvestir (ETF capitalisant)', desc: 'Tout reste investi.', w: 1, fee: 0.2, capital: 10000, mk: 'MON', fit: true },
    { name: 'Les dépenser chaque année', desc: 'Environ 2 % par an retirés.', w: 1, fee: 0.2, drag: 2, capital: 10000, mk: 'MON', fit: false },
    { name: 'Garder l’argent sur un livret', desc: 'Rendement d’exemple 2 %.', w: 0, safe: 2, capital: 10000, mk: 'LIV', fit: false },
  ], 'Sur 20 ans, les dividendes réinvestis font une grosse différence. Les dépenser n’est pas une erreur si on a besoin d’un revenu, mais le capital grossit beaucoup moins.') },

{ id: 'bulle', title: 'L’action dont tout le monde parle', ch: 5, rel: 'm5-7', lesson: LS('Les bulles', [
    { k: 'info', viz: 'bars', h: 'L’euphorie', t: 'Quand une action monte très vite et que tout le monde en parle, beaucoup achètent par peur de rater la hausse.' },
    { k: 'guess', h: 'À ton avis…', t: 'Une action qui a fait +300 % cette année…', opts: ['va forcément continuer', 'peut aussi chuter très fort'], a: 1, r: 'Les hausses passées ne disent rien de l’avenir. Les bulles finissent souvent par éclater.' },
    { k: 'tap', viz: 'down', h: 'Le FOMO', t: 'Pourquoi c’est dangereux ?', hidden: 'On achète tard, cher, sans plan. Quand ça baisse, on vend en panique : on achète haut, on vend bas.' },
    { k: 'info', viz: 'check', h: 'À retenir', t: 'Un plan écrit et une diversification protègent de l’euphorie.' },
  ]),
  questions: [
    V('Si tout le monde en parle, c’est forcément une bonne affaire.', false, 'C’est souvent le signe d’un engouement déjà avancé.'),
    Q('Le FOMO, c’est…', ['la peur de rater une hausse', 'un type d’ETF', 'une taxe'], 0, 'Un biais qui pousse à acheter trop tard.'),
    C('Une action passe de 50 € à 200 €, puis retombe à 80 €. Baisse depuis le sommet (en %) ?', 60, 0.1, '%', '(200 − 80) ÷ 200 = 60 %.'),
  ],
  decision: D('Zoé', 'Zoé a 4 000 € pour 5 ans. Une action a fait +300 % cette année et inonde les réseaux sociaux.',
    { capital: 4000, horizon: '5 ans' }, { rate: 6, vol: 15 }, 5, [
    { name: 'Tout sur l’action à la mode', desc: '« Elle va encore doubler. »', w: 1, idio: 45, drag: 8, capital: 4000, mk: 'TEC', fit: false },
    { name: 'Un ETF Monde', desc: 'Diversifié, frais 0,2 %.', w: 1, fee: 0.2, capital: 4000, mk: 'MON', fit: true },
    { name: 'Un livret', desc: 'Garanti, rendement d’exemple 2 %.', w: 0, safe: 2, capital: 4000, mk: 'LIV', fit: false },
  ], 'L’action à la mode peut encore monter… ou s’effondrer : regarde la fourchette des 100 évolutions. L’ETF garde de la croissance sans tout miser sur une histoire.') },
);

/* ---------------- LEÇONS D'INTRODUCTION DES CHAPITRES ---------------- */
const intro = (ch, title, cards) => ({ ch, title, cards });
window.NT_INTROS = [
  intro(1, 'Bienvenue dans les premiers pas', [
    { k: 'info', viz: 'coins', h: 'Épargner ou investir', t: 'Épargner, c’est mettre de côté sans risque. Investir, c’est accepter que la valeur varie pour viser plus.' },
    { k: 'guess', h: 'À ton avis…', t: 'Un placement très rentable ET sans risque, ça existe ?', opts: ['Oui', 'Non'], a: 1, r: 'Rendement et risque vont toujours ensemble.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Risque, inflation, intérêts composés, actions, obligations, indices.' } ]),
  intro(2, 'Bienvenue sur ta première plateforme', [
    { k: 'info', viz: 'scale', h: 'Une plateforme de bourse', t: 'Tu y vois le prix des titres, tu passes des ordres d’achat et de vente, tu paies des frais.' },
    { k: 'guess', h: 'À ton avis…', t: 'Un ordre « au marché » garantit-il le prix ?', opts: ['Oui', 'Non'], a: 1, r: 'Il s’exécute tout de suite, au meilleur prix disponible, sans garantie de prix.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Compte, PEA, fiche valeur, carnet d’ordres, frais, heures de bourse.' } ]),
  intro(3, 'Construire un portefeuille', [
    { k: 'info', viz: 'basket', h: 'Ne pas tout miser au même endroit', t: 'Un portefeuille, c’est un ensemble de placements qui se complètent.' },
    { k: 'tap', viz: 'pie', h: 'Le secret', t: 'Qu’est-ce qui compte le plus ?', hidden: 'La répartition (actions, obligations, liquidités) et les frais, bien plus que le choix d’une « pépite ».' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'ETF, diversification, horizon, versements mensuels, rééquilibrage.' } ]),
  intro(4, 'Lire une entreprise', [
    { k: 'info', viz: 'bars', h: 'Derrière une action, une entreprise', t: 'Ventes, bénéfices, dette : ce sont eux qui font la valeur sur la durée.' },
    { k: 'guess', h: 'À ton avis…', t: 'Une entreprise qui vend beaucoup gagne forcément beaucoup ?', opts: ['Oui', 'Non'], a: 1, r: 'Il faut regarder le bénéfice, pas seulement le chiffre d’affaires.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Chiffre d’affaires, marge, dette, dividende, PER, actualité.' } ]),
  intro(5, 'Résister aux tempêtes', [
    { k: 'info', viz: 'down', h: 'Les krachs arrivent', t: 'Les marchés ont déjà perdu 30 à 50 % plusieurs fois. Ce qui compte, c’est ta réaction.' },
    { k: 'tap', viz: 'shield', h: 'Le bouclier', t: 'Qu’est-ce qui protège le mieux ?', hidden: 'Une épargne de précaution, un horizon long et des règles écrites avant la crise.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Krachs, émotions, biais, bulles, patience.' } ]),
  intro(6, 'Déjouer les pièges', [
    { k: 'info', viz: 'shield', h: 'Les arnaques se modernisent', t: 'Faux sites, faux conseillers, faux influenceurs, faux « robots ». Le réflexe : vérifier.' },
    { k: 'guess', h: 'À ton avis…', t: '« Rendement garanti de 15 % par an », c’est…', opts: ['crédible', 'suspect'], a: 1, r: 'Garanti + élevé = signal d’alerte.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Signaux d’alerte, registres officiels, usurpation, pyramides.' } ]),
  intro(7, 'Ma stratégie', [
    { k: 'info', viz: 'clock', h: 'Un plan écrit', t: 'Objectif, montant, horizon, répartition, règles en cas de crise : tout est décidé à froid.' },
    { k: 'tap', viz: 'scale', h: 'Pourquoi écrire ?', t: 'À quoi sert un plan écrit ?', hidden: 'À ne pas décider sous l’émotion quand les marchés s’agitent.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Objectif, répartition, rééquilibrage, bilan annuel.' } ]),
  intro(8, 'Mes enveloppes', [
    { k: 'info', viz: 'pie', h: 'Des boîtes fiscales', t: 'Livret, PEA, assurance-vie, PER, épargne salariale : chacune a ses règles et ses impôts.' },
    { k: 'guess', h: 'À ton avis…', t: 'Le PER bloque-t-il l’argent jusqu’à la retraite ?', opts: ['Oui, sauf cas prévus', 'Non, jamais'], a: 0, r: 'Il est bloqué, sauf exceptions (achat de la résidence principale, accidents de la vie).' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Chaque enveloppe, ses avantages, et la fiscalité 2026.' } ]),
  intro(9, 'Les produits risqués', [
    { k: 'info', viz: 'down', h: 'Comprendre pour s’en méfier', t: 'Levier, CFD, options, crypto : des produits où l’on peut perdre très vite.' },
    { k: 'guess', h: 'À ton avis…', t: 'Levier 10, le marché baisse de 10 %. Ta mise…', opts: ['baisse de 10 %', 'disparaît'], a: 1, r: '10 × 10 % = 100 %.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Levier, CFD, crypto, options, vente à découvert.' } ]),
  intro(10, 'Lire les bougies', [
    { k: 'info', viz: 'bars', h: 'Une bougie', t: 'Elle résume une période : ouverture, clôture, plus haut, plus bas.' },
    { k: 'guess', h: 'À ton avis…', t: 'Une bougie verte signifie…', opts: ['clôture au-dessus de l’ouverture', 'volume en hausse'], a: 0, r: 'Verte : le prix a fini plus haut qu’il n’a commencé.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Bougies, unités de temps, figures, volumes.' } ]),
  intro(11, 'Tendances et indicateurs', [
    { k: 'info', viz: 'bars', h: 'La structure du marché', t: 'Tendance, supports, résistances : les zones où les acheteurs et vendeurs se battent.' },
    { k: 'tap', viz: 'scale', h: 'Les indicateurs', t: 'Un indicateur prédit-il l’avenir ?', hidden: 'Non : il décrit le passé. Il sert à organiser une décision, pas à deviner.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Tendances, supports, cassures, moyennes mobiles, RSI, MACD.' } ]),
  intro(12, 'Gérer le risque', [
    { k: 'info', viz: 'shield', h: 'Le cœur du métier', t: 'Les bons traders ne gagnent pas toujours : ils perdent petit et gagnent plus gros.' },
    { k: 'guess', h: 'À ton avis…', t: 'Après −50 %, quelle hausse faut-il pour revenir au départ ?', opts: ['+50 %', '+100 %'], a: 1, r: 'Les grosses pertes sont très dures à rattraper.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Stop, règle des 1 %, taille de position, ratio, espérance, drawdown.' } ]),
  intro(13, 'Plan, journal et mental', [
    { k: 'info', viz: 'clock', h: 'Le mental fait la différence', t: 'Peur, euphorie, envie de se refaire : un plan et un journal remettent de la raison.' },
    { k: 'tap', viz: 'check', h: 'Le journal', t: 'Que note-t-on ?', hidden: 'La raison du trade, l’entrée, le stop, la sortie, et ce qu’on a ressenti.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Plan, journal, biais, calendrier, styles, frais.' } ]),
  intro(14, 'Stratégies et tests', [
    { k: 'info', viz: 'scale', h: 'Tester avant de risquer', t: 'Une idée se teste sur le passé, frais compris, puis sur une période jamais vue.' },
    { k: 'guess', h: 'À ton avis…', t: '5 trades gagnants sur 5 prouvent qu’une méthode marche ?', opts: ['Oui', 'Non'], a: 1, r: 'Trop peu de trades : le hasard peut l’expliquer.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Familles de stratégies, backtest, statistiques, pièges.' } ]),
  intro(15, 'Dérivés et macroéconomie', [
    { k: 'info', viz: 'pie', h: 'Le grand tableau', t: 'Taux, inflation, banques centrales, devises : ils influencent tous les marchés.' },
    { k: 'tap', viz: 'shield', h: 'Les dérivés', t: 'Une option, c’est quoi ?', hidden: 'Le droit d’acheter (call) ou de vendre (put) à un prix fixé, contre une prime.' },
    { k: 'info', viz: 'check', h: 'Dans ce chapitre', t: 'Futures, options, taux, inflation, devises.' } ]),
];
/* chaque chapitre commence par sa leçon d'introduction (90 s) */
window.NT_INTROS.forEach(x => {
  const m = window.NT_H.mis('i-' + x.ch, x.ch, 'Leçon : ' + x.title, 'Leçon', 2, 'Découvrir l’essentiel du chapitre en 90 secondes.', [{ type: 'lesson', title: x.title, cards: x.cards }]);
  const at = window.NT_MISSIONS.findIndex(mm => mm.ch === x.ch);
  window.NT_MISSIONS.splice(at < 0 ? window.NT_MISSIONS.length : at, 0, m);
});
})();
