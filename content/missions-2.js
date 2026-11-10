/* NOVA MISSIONS — chapitres 4 à 6 */
(() => {
const { B, Q, V, S, O, C, X, T, K, G, L, R, mis } = window.NT_H;
/* allure simplifiée d'un grand indice européen 2019-2021 (pédagogique) */
const COVID = [100,102,104,103,106,108,110,109,112,113,115,116,114,98,72,76,82,85,84,88,86,90,98,104,106,110,113,116,118,120];
/* allure simplifiée 2007-2013 */
const CRISE08 = [100,104,108,112,110,104,96,88,78,64,52,46,44,50,58,62,66,64,70,68,60,58,62,66,70,74,78,80];
window.NT_MISSIONS.push(

/* ===================== 4 · LIRE UNE ENTREPRISE ===================== */
mis('m4-1', 4, 'Chiffre d’affaires ou bénéfice ?', 'Quiz', 3, 'Ne plus confondre ce qu’une entreprise vend et ce qu’elle gagne.', [
  Q('Exemplia (fictive) vend pour 10 M€ et dépense en tout 9,2 M€. Son bénéfice ?', ['10 M€', '0,8 M€', '9,2 M€'], 1, '10 − 9,2 = 0,8 M€. On peut vendre beaucoup et gagner peu.'),
  C('Sa marge nette (bénéfice ÷ chiffre d’affaires), en % ?', 8, 0.2, '%', '0,8 ÷ 10 = 8 % : sur 100 € de ventes, il reste 8 €.'),
  V('Un chiffre d’affaires en hausse signifie toujours un bénéfice en hausse.', false, 'Si les coûts montent plus vite que les ventes, le bénéfice baisse.'),
]),
mis('m4-2', 4, 'La dette sous la loupe', 'Défi', 5, 'Repérer une entreprise trop endettée.', [
  S('Signal rassurant ou signal d’alerte ?', 'Rassurant', 'Alerte', [
    ['La dette baisse depuis 3 ans', 'l', 'L’entreprise se désendette.'],
    ['Elle emprunte pour payer son dividende', 'r', 'Verser plus que ce qu’on gagne n’est pas tenable.'],
    ['Ses bénéfices couvrent largement les intérêts', 'l', 'Elle peut payer sa dette sans difficulté.'],
    ['Sa dette doit être remboursée l’an prochain et elle perd de l’argent', 'r', 'Risque de difficulté pour refinancer.'],
  ]),
  C('Dette 600 M€, bénéfice avant intérêts et impôts 200 M€ par an. En combien d’années ce bénéfice rembourserait-il la dette ?', 3, 0.05, 'ans', '600 ÷ 200 = 3 ans. Plus ce chiffre est élevé, plus l’entreprise est fragile.'),
]),
mis('m4-3', 4, 'Le dividende', 'Simulateur', 3, 'Comprendre d’où vient le dividende et pourquoi il peut baisser.', [
  C('Tu as 40 actions Solaria Foods (fictive), dividende de 0,62 € par action. Combien touches-tu (brut) ?', 24.8, 0.05, '€', '40 × 0,62 = 24,80 € brut, avant impôts.'),
  C('Sur un compte-titres, après 31,4 % de flat tax (2026), il te reste combien ?', 17.01, 0.05, '€', '24,80 × (1 − 0,314) ≈ 17,01 €.'),
  V('Un dividende très élevé est toujours un bon signe.', false, 'Il peut annoncer une baisse future si l’entreprise verse plus qu’elle ne gagne.'),
]),
mis('m4-4', 4, 'Le PER, ou le prix d’un bénéfice', 'Quiz', 5, 'Calculer et interpréter un PER, sans en faire une règle magique.', [
  C('Cours 50 €, bénéfice par action 2,50 €. Quel est le PER ?', 20, 0.1, '', '50 ÷ 2,50 = 20 : le marché paie 20 fois le bénéfice annuel.'),
  Q('Un PER élevé signifie souvent que…', ['le marché attend une forte croissance', 'l’entreprise est forcément trop chère', 'elle ne fait pas de bénéfice'], 0, 'Un PER se compare dans le même secteur. Seul, il ne dit pas si une action est « bonne ».'),
  V('Un PER bas garantit une bonne affaire.', false, 'Il peut refléter des difficultés que le marché anticipe.'),
]),
mis('m4-5', 4, 'Enquête : le signal d’alerte', 'Jeu de rôle', 7, 'Lire le résumé d’une entreprise fictive et trouver ce qui cloche.', [
  B('Dossier « Brillanta » (fictive)', 'Ventes +40 % · pertes depuis 4 ans · dette doublée · le dirigeant vend ses actions · publicités promettant « x10 ».'),
  R('L’enquête', 'Nova Coach', {
    start: { say: 'Quel élément t’inquiète le plus dans ce dossier ?', options: [
      { t: 'Les ventes progressent de 40 %', good: false, next: 'b', fb: 'C’est plutôt positif, pris seul.' },
      { t: 'Pertes répétées et dette qui double', good: true, next: 'a', fb: 'Une entreprise qui perd de l’argent en s’endettant doit trouver de nouveaux financements.' },
    ] },
    a: { say: 'Et la promesse « x10 » dans les publicités ?', options: [
      { t: 'Un signal d’alerte : aucune entreprise sérieuse ne promet ça', good: true, next: 'fin', fb: 'Exact. Les promesses de gains spectaculaires sont un drapeau rouge.' },
      { t: 'Une bonne nouvelle pour les actionnaires', good: false, next: 'fin', fb: 'Personne ne peut promettre une performance.' },
    ] },
    b: { say: 'Regarde aussi les pertes et la dette. Ça change quelque chose ?', options: [
      { t: 'Oui : elle grossit en perdant de l’argent', good: true, next: 'fin', fb: 'Voilà le vrai sujet.' },
    ] },
    fin: { say: 'Bien vu. Ventes en hausse ne veut pas dire entreprise solide : on regarde toujours bénéfices, dette et comportement des dirigeants.', end: true },
  }),
]),
mis('m4-6', 4, 'Lire une actualité sans paniquer', 'Défi', 5, 'Distinguer un fait, une rumeur et une opinion.', [
  S('Fait, ou opinion et rumeur ?', 'Fait', 'Opinion / rumeur', [
    ['« Exemplia publie un chiffre d’affaires de 2,1 Md€ »', 'l', 'Chiffre publié, vérifiable.'],
    ['« Cette action va exploser, crois-moi »', 'r', 'Opinion, sans source.'],
    ['« Selon un compte anonyme, un rachat se prépare »', 'r', 'Rumeur non vérifiée.'],
    ['« La BCE a relevé ses taux de 0,25 point »', 'l', 'Décision officielle.'],
  ]),
  Q('Avant de réagir à une nouvelle, le bon réflexe est…', ['vérifier la source et la date', 'agir tout de suite', 'demander sur un forum'], 0, 'Source, date, chiffres : on vérifie avant de décider.'),
]),
mis('m4-7', 4, 'Les résultats trimestriels', 'Quiz', 3, 'Comprendre pourquoi un cours bouge le jour des résultats.', [
  V('Une entreprise peut voir son cours baisser alors que son bénéfice progresse.', true, 'Si le marché attendait mieux, la déception fait baisser le cours.'),
  Q('Le marché réagit surtout…', ['aux résultats par rapport à ce qui était attendu', 'aux résultats seuls', 'à la couleur du rapport'], 0, 'Ce qui compte, c’est l’écart avec les attentes.'),
]),
mis('m4-8', 4, 'Les secteurs de l’économie', 'Défi', 3, 'Classer les entreprises par secteur.', [
  X('Relie chaque entreprise fictive à son secteur', [['Novix Santé', 'Santé'], ['Banque Brisa', 'Finance'], ['Telcora', 'Télécoms'], ['Maison Lumen', 'Luxe']], 'Connaître le secteur aide à diversifier : des secteurs différents réagissent différemment.'),
  V('En récession, tous les secteurs baissent toujours autant.', false, 'Certains secteurs (alimentation, santé) résistent souvent mieux que d’autres.'),
]),
mis('m4-9', 4, 'Le rachat d’actions', 'Quiz', 3, 'Comprendre pourquoi une entreprise rachète ses propres actions.', [
  Q('Quand une entreprise rachète et annule ses actions…', ['chaque action restante représente une part un peu plus grande', 'le capital disparaît', 'les actionnaires perdent leurs titres'], 0, 'Moins d’actions en circulation : le bénéfice est partagé entre moins de titres.'),
  V('Un rachat d’actions est une façon de rendre de l’argent aux actionnaires.', true, 'Comme le dividende, mais sous une autre forme.'),
]),
mis('m4-10', 4, 'Croissance ou rendement ?', 'Défi', 3, 'Distinguer deux profils d’entreprises.', [
  S('Plutôt « croissance » ou plutôt « rendement » ?', 'Croissance', 'Rendement', [
    ['Réinvestit tout pour grandir, pas de dividende', 'l', 'Typique d’une entreprise en croissance.'],
    ['Activité stable, dividende régulier', 'r', 'Typique d’une valeur de rendement.'],
    ['Ventes +30 % par an, PER élevé', 'l', 'Le marché paie la croissance attendue.'],
  ]),
  V('Une entreprise de croissance est forcément meilleure.', false, 'Les attentes élevées peuvent décevoir. Il n’y a pas de « meilleur » profil en soi.'),
]),
mis('m4-11', 4, 'Défi : la fiche d’enquête', 'Défi', 10, 'Analyser une entreprise fictive de A à Z.', [
  B('Novix Santé (fictive)', 'CA 4 Md€ · bénéfice 400 M€ · dette 800 M€ · cours 96,10 € · bénéfice par action 4,80 € · dividende 2,10 €.'),
  C('Marge nette (en %) ?', 10, 0.2, '%', '400 ÷ 4 000 = 10 %.'),
  C('PER ?', 20, 0.2, '', '96,10 ÷ 4,80 ≈ 20.'),
  C('Rendement du dividende (en %) ?', 2.2, 0.1, '%', '2,10 ÷ 96,10 ≈ 2,2 %.'),
  Q('Avec une dette de 2 ans de bénéfices, Novix est…', ['plutôt peu endettée', 'au bord de la faillite', 'impossible à juger'], 0, '800 ÷ 400 = 2 ans de bénéfices : un niveau généralement raisonnable. À comparer au secteur.'),
]),

/* ===================== 5 · RÉSISTER AUX TEMPÊTES ===================== */
mis('m5-1', 5, 'Mars 2020 : que fais-tu ?', 'Jeu de rôle', 5, 'Vivre un krach réel et comprendre ce qui s’est passé ensuite.', [
  R('Mars 2020', 'Nova Coach', {
    start: { say: 'Mars 2020 : en un mois, le CAC 40 a perdu environ 38 %. Ton portefeuille fictif a fondu d’un tiers. Tu n’as pas besoin de cet argent avant 10 ans. Que fais-tu ?', options: [
      { t: 'Je vends tout pour arrêter les pertes', good: false, next: 'vend', fb: 'Vendre transforme une baisse temporaire en perte définitive.' },
      { t: 'Je ne touche à rien, mon horizon est long', good: true, next: 'garde', fb: 'Avec un horizon long et une épargne de précaution, rester investi est cohérent.' },
      { t: 'J’investis tout, même l’argent du loyer', good: false, next: 'tout', fb: 'Jamais l’argent dont tu as besoin bientôt.' },
    ] },
    vend: { say: 'Après coup : le CAC 40 est revenu à son niveau d’avant-crise environ un an plus tard. Personne ne pouvait le prévoir, mais vendre dans la panique est l’erreur la plus fréquente.', end: true },
    garde: { say: 'Après coup : l’indice est revenu à son niveau d’avant-crise environ un an plus tard. Ce n’était pas garanti, mais ton plan t’a évité la panique.', end: true },
    tout: { say: 'Le marché a rebondi, mais personne ne le savait en mars 2020. Une nouvelle baisse t’aurait obligé à vendre à perte pour payer ton loyer.', end: true },
  }),
  V('Les performances passées garantissent qu’un marché remonte toujours aussi vite.', false, 'Après 2000 ou 2008, il a fallu des années pour retrouver les sommets.'),
]),
mis('m5-2', 5, 'Calme ton ami', 'Jeu de rôle', 5, 'Trouver les bons arguments face à quelqu’un qui panique.', [
  R('Lucas panique', 'Lucas', {
    start: { say: 'J’ai perdu 15 % ! Je vends tout ce soir, c’est fini la bourse.', options: [
      { t: '« Tu avais prévu de garder cet argent combien de temps ? »', good: true, next: 'q2', fb: 'L’horizon de placement change tout.' },
      { t: '« Achète encore plus, ça va forcément remonter ! »', good: false, next: 'faux', fb: 'Personne ne peut garantir une remontée.' },
    ] },
    q2: { say: 'Au moins 10 ans… Mais j’ai peur que ça continue à baisser.', options: [
      { t: '« As-tu besoin de cet argent dans les prochains mois ? »', good: true, next: 'fin', fb: 'Si l’argent n’est pas nécessaire bientôt, une baisse n’oblige pas à vendre.' },
      { t: '« Vends la moitié, tu seras tranquille. »', good: false, next: 'faux', fb: 'Tu décides à sa place : aide-le plutôt à revenir à son plan.' },
    ] },
    fin: { say: 'Non, j’ai mon épargne de côté. Je vais relire mon plan avant de faire quoi que ce soit. Merci !', end: true },
    faux: { say: 'Hmm… je ne suis pas sûr que ça m’aide à réfléchir.', end: true },
  }),
]),
mis('m5-3', 5, 'Les biais qui nous piègent', 'Défi', 5, 'Reconnaître les pièges de notre cerveau.', [
  X('Relie chaque biais à sa description', [['Peur de rater (FOMO)', 'Acheter parce que tout le monde achète'], ['Aversion à la perte', 'Une perte fait plus mal qu’un gain du même montant ne fait plaisir'], ['Excès de confiance', 'Croire qu’on fera mieux que le marché'], ['Biais de confirmation', 'Ne lire que ce qui confirme son avis']], 'Les connaître ne les supprime pas, mais aide à les repérer au bon moment.'),
  Q('Tu refuses de vendre une action en perte « tant qu’elle n’est pas remontée ». Quel biais ?', ['Aversion à la perte', 'FOMO', 'Diversification'], 0, 'On s’accroche pour ne pas « réaliser » la perte, même si la situation de l’entreprise a changé.'),
]),
mis('m5-4', 5, 'Le graphique mystère', 'Simulateur', 3, 'Reconnaître une crise sur un graphique.', [
  G('Allure simplifiée d’un grand indice européen. Quel point correspond à mars 2020 ?', COVID, [{ i: 10, label: 'A' }, { i: 14, label: 'B' }, { i: 26, label: 'C' }], 'B', 'B : la chute brutale du printemps 2020. A est avant la crise, C pendant la reprise de 2021.'),
  V('Sur ce graphique, l’indice finit plus haut qu’avant la crise.', true, 'Dans cet exemple simplifié, oui. Cela n’a rien d’automatique.'),
]),
mis('m5-5', 5, 'Crash test : 2008', 'Simulateur', 7, 'Mesurer ce que vit un portefeuille dans une grande crise.', [
  G('Allure simplifiée d’un indice entre 2007 et 2013. Où se situe le point le plus bas ?', CRISE08, [{ i: 3, label: 'A' }, { i: 12, label: 'B' }, { i: 22, label: 'C' }], 'B', 'B : début 2009, après une chute d’environ 55 % dans cet exemple. Il a fallu des années pour remonter.', '2007', '2013'),
  C('Ton portefeuille de 10 000 € est 100 % en actions et perd 55 %. Combien vaut-il au plus bas ?', 4500, 1, '€', '10 000 × 0,45 = 4 500 €. C’est pour cela que l’horizon et la répartition comptent.'),
  C('Même crise, mais 50 % actions (−55 %) et 50 % obligations (stables). Valeur au plus bas ?', 7250, 1, '€', '5 000 × 0,45 + 5 000 = 7 250 €. Moins de chute, donc plus facile de tenir.'),
]),
mis('m5-6', 5, 'La patience, ça se travaille', 'Quiz', 3, 'Comprendre le temps long, sans promesse de gain.', [
  V('Plus on reste investi longtemps, plus les baisses passagères ont de chances d’être compensées, mais rien n’est garanti.', true, 'Historiquement, le temps a souvent aidé. Ce n’est pas une loi.'),
  Q('Quelle attitude aide le plus à rester patient ?', ['Regarder son portefeuille 20 fois par jour', 'Avoir un plan écrit et une épargne de précaution', 'Suivre les rumeurs'], 1, 'Un plan et un matelas de sécurité évitent les décisions sous le coup de l’émotion.'),
]),
mis('m5-7', 5, 'La bulle', 'Jeu de rôle', 5, 'Reconnaître l’euphorie d’une bulle.', [
  R('Tout le monde en parle', 'Lucas', {
    start: { say: 'Tecnor (fictive) a pris +300 % en un an, tout le monde en parle au bureau ! On met tout dessus ?', options: [
      { t: 'Quand tout le monde en parle, c’est souvent le moment d’être prudent', good: true, next: 'a', fb: 'L’euphorie générale est un signe classique de bulle.' },
      { t: 'Oui, ça va continuer, c’est évident', good: false, next: 'b', fb: 'Les hausses passées ne prédisent pas l’avenir.' },
    ] },
    a: { say: 'Mais si on rate la suite ?', options: [
      { t: 'Si j’en achète, ce sera une petite part de mon portefeuille', good: true, next: 'fin', fb: 'Limiter le poids d’une ligne limite le risque.' },
      { t: 'Alors on met tout, tant pis', good: false, next: 'fin', fb: 'C’est la peur de rater (FOMO) qui parle.' },
    ] },
    b: { say: 'T’es sûr ? Et si ça retombe ?', options: [{ t: 'Bon… je limite à une petite part', good: true, next: 'fin', fb: 'Bonne correction.' }] },
    fin: { say: 'OK, on reste raisonnables. Les bulles finissent souvent par dégonfler, parfois très vite.', end: true },
  }),
]),
mis('m5-8', 5, 'Regarder moins, tenir mieux', 'Quiz', 2, 'Savoir à quelle fréquence regarder son portefeuille.', [
  Q('Pour un placement à 15 ans, à quelle fréquence est-il raisonnable de vérifier ?', ['Toutes les heures', 'Quelques fois par an, pour rééquilibrer', 'Jamais'], 1, 'Trop regarder pousse à réagir aux variations du jour.'),
  V('Les variations quotidiennes disent beaucoup de la valeur d’un placement à 15 ans.', false, 'Sur un horizon long, le bruit quotidien compte peu.'),
]),
mis('m5-9', 5, 'Moyenne à la baisse : piège ou stratégie ?', 'Défi', 5, 'Ne pas confondre investissement régulier et acharnement.', [
  S('Bonne idée ou piège ?', 'Plutôt sain', 'Piège', [
    ['Continuer d’investir chaque mois sur un ETF large pendant une baisse', 'l', 'Discipline d’un plan régulier et diversifié.'],
    ['Racheter sans cesse une action en chute dont l’entreprise va mal', 'r', 'Tu augmentes ta mise sur un problème.'],
    ['Emprunter pour « profiter » de la baisse', 'r', 'Le crédit amplifie les pertes.'],
  ]),
  V('Une action qui a baissé de 80 % ne peut plus baisser.', false, 'Elle peut encore perdre 100 % de sa valeur restante.'),
]),
mis('m5-10', 5, 'L’effet des émotions en chiffres', 'Simulateur', 3, 'Mesurer le coût de « vendre bas, racheter haut ».', [
  C('Tu vends à 70 € après une chute, puis rachètes à 95 € quand c’est remonté. Combien perds-tu par action ?', 25, 0.01, '€', '95 − 70 = 25 € par action, sans compter les frais. C’est le coût de l’émotion.'),
  V('Revendre au plus bas puis racheter plus cher est une erreur fréquente chez les débutants.', true, 'D’où l’intérêt d’un plan écrit à l’avance.'),
]),
mis('m5-11', 5, 'Défi : survivre à 3 krachs', 'Défi', 10, 'Garder son cap face à trois crises simulées.', [
  R('Trois tempêtes', 'Nova Coach', {
    start: { say: 'Krach n°1 : −25 % en deux mois. Ton plan dit « je tiens 15 ans ». Réaction ?', options: [
      { t: 'Je suis mon plan', good: true, next: 'k2', fb: 'Discipline.' },
      { t: 'Je vends la moitié', good: false, next: 'k2', fb: 'Tu fixes une partie de la perte.' },
    ] },
    k2: { say: 'Krach n°2 : une rumeur sur les réseaux annonce « la fin des marchés ». Réaction ?', options: [
      { t: 'Je vérifie les sources avant tout', good: true, next: 'k3', fb: 'Une rumeur n’est pas une information.' },
      { t: 'Je panique et je vends', good: false, next: 'k3', fb: 'C’est exactement ce que cherchent certains manipulateurs.' },
    ] },
    k3: { say: 'Krach n°3 : tu perds ton emploi au même moment. Que fais-tu ?', options: [
      { t: 'J’utilise mon épargne de précaution, pas mes placements', good: true, next: 'fin', fb: 'C’est précisément son rôle.' },
      { t: 'Je vends mes actions au plus bas', good: false, next: 'fin', fb: 'Sans épargne de précaution, on est forcé de vendre au pire moment.' },
    ] },
    fin: { say: 'Tu as traversé trois tempêtes. Retiens : plan écrit, sources fiables, épargne de précaution.', end: true },
  }),
]),

/* ===================== 6 · DÉJOUER LES PIÈGES ===================== */
mis('m6-1', 6, 'Vrai ou arnaque ?', 'Défi', 3, 'Repérer en quelques secondes les signes d’une arnaque.', [
  S('Fiable ou arnaque ?', 'Plutôt fiable', 'Arnaque', [
    ['« Rendement garanti de 8 % par mois, places limitées, réponds vite ! »', 'r', 'Garantie + rendement énorme + urgence : arnaque classique.'],
    ['« Investir comporte un risque de perte en capital. »', 'l', 'Un acteur sérieux rappelle les risques.'],
    ['Un « conseiller » te contacte sur WhatsApp sans que tu l’aies demandé', 'r', 'Le contact non sollicité est un signal d’alerte majeur.'],
    ['La plateforme figure sur le registre officiel REGAFI', 'l', 'Bon réflexe : vérifier avant tout dépôt (et consulter les listes noires).'],
    ['« Paie d’abord des frais de déblocage pour récupérer tes gains »', 'r', 'Payer pour récupérer son argent : arnaque.'],
  ]),
]),
mis('m6-2', 6, 'Les faux influenceurs', 'Défi', 5, 'Reconnaître une publicité déguisée et les promesses interdites.', [
  S('Ce post est-il un signal d’alerte ?', 'OK', 'Alerte', [
    ['« Collaboration commerciale » affiché, risques rappelés', 'l', 'La mention de publicité est obligatoire.'],
    ['« J’ai fait +2 000 € en une semaine, lien en bio »', 'r', 'Gains spectaculaires mis en avant, sans risques : drapeau rouge.'],
    ['« Mon code promo pour trader avec un effet de levier x100 »', 'r', 'La promotion de certains produits à effet de levier est interdite.'],
  ]),
  V('Un influenceur payé par une marque doit l’indiquer clairement.', true, 'Mention « Publicité » ou « Collaboration commerciale » obligatoire (loi de 2023).'),
]),
mis('m6-3', 6, 'Vérifier une plateforme', 'Quiz', 3, 'Savoir où vérifier qu’un acteur est autorisé.', [
  X('Relie chaque outil à son usage', [['REGAFI', 'Vérifier une banque ou un courtier autorisé'], ['ORIAS', 'Vérifier un intermédiaire (conseiller, courtier en assurance…)'], ['Listes noires AMF / ACPR', 'Repérer les sites non autorisés connus']], 'Avant tout dépôt : registres officiels + listes noires.'),
  V('Si un site affiche le logo de l’AMF, c’est la preuve qu’il est autorisé.', false, 'Les escrocs copient les logos. Seuls les registres officiels font foi.'),
]),
mis('m6-4', 6, 'L’usurpation d’identité', 'Défi', 3, 'Repérer un faux site qui imite un vrai établissement.', [
  S('Signal d’alerte ou pas ?', 'Normal', 'Alerte', [
    ['L’adresse du site diffère légèrement du vrai nom', 'r', 'Les faux sites imitent les vrais à une lettre près.'],
    ['On te demande d’envoyer de l’argent vers un compte à l’étranger', 'r', 'Signal d’alerte majeur.'],
    ['Tu passes par l’application officielle que tu utilises déjà', 'l', 'Le bon réflexe : passer par tes canaux habituels.'],
  ]),
  Q('Un « conseiller de ta banque » t’appelle pour un placement urgent. Que fais-tu ?', ['Je raccroche et j’appelle moi-même le numéro officiel', 'Je donne mes codes', 'Je fais le virement tout de suite'], 0, 'On reprend la main : on rappelle soi-même via le numéro officiel.'),
]),
mis('m6-5', 6, 'Démasque l’arnaqueur', 'Jeu de rôle', 7, 'Déjouer un faux conseiller en posant les bonnes questions.', [
  R('Un appel inattendu', '« Marc », conseiller', {
    start: { say: 'Bonjour ! Placement exclusif à 12 % garanti, mais il faut virer 5 000 € avant ce soir.', options: [
      { t: 'Quel est votre numéro sur un registre officiel ?', good: true, next: 'a', fb: 'Excellent réflexe : on vérifie l’autorisation.' },
      { t: 'D’accord, je fais le virement', good: false, next: 'perdu', fb: 'Urgence + garantie élevée : arnaque classique.' },
    ] },
    a: { say: 'Euh… pas besoin, c’est un produit privé, faites-moi confiance.', options: [
      { t: 'Sans registre, je ne vire rien. Au revoir.', good: true, next: 'fin', fb: 'Tu as déjoué l’arnaque.' },
      { t: 'Bon, si vous le dites…', good: false, next: 'perdu', fb: 'Le refus de donner un numéro d’autorisation est un aveu.' },
    ] },
    perdu: { say: 'Dans la vraie vie, l’argent aurait probablement disparu. Rappel : jamais de virement sous la pression.', end: true },
    fin: { say: 'Bravo. Urgence, garantie, refus de vérification : les trois signes réunis.', end: true },
  }),
]),
mis('m6-6', 6, 'Les produits interdits de publicité', 'Quiz', 3, 'Comprendre pourquoi certains produits sont si encadrés.', [
  V('En France, la publicité en ligne pour les options binaires et certains CFD est interdite.', true, 'Ces produits font perdre de l’argent à une large majorité de particuliers.'),
  Q('Pourquoi ces produits sont-ils si dangereux ?', ['Effet de levier : les pertes peuvent être très rapides', 'Ils sont trop simples', 'Ils sont garantis'], 0, 'Le levier multiplie gains ET pertes. Le chapitre 9 t’explique comment ils fonctionnent.'),
]),
mis('m6-7', 6, 'Le schéma de Ponzi', 'Quiz', 3, 'Comprendre la mécanique d’une pyramide financière.', [
  O('Remets la mécanique dans l’ordre', ['On promet un rendement élevé et régulier', 'Les premiers investisseurs sont payés avec l’argent des nouveaux', 'Il faut toujours plus de nouveaux entrants', 'Les entrées ralentissent et tout s’effondre'], 'Aucun vrai rendement : on déplace l’argent jusqu’à l’effondrement.'),
  V('Des « gains » versés régulièrement au début prouvent qu’un placement est sérieux.', false, 'C’est précisément ce que font les pyramides pour attirer.'),
]),
mis('m6-8', 6, 'Les arnaques au « recouvrement »', 'Quiz', 2, 'Éviter d’être victime une deuxième fois.', [
  V('Après une arnaque, une société qui promet de récupérer ton argent contre des frais est souvent une nouvelle arnaque.', true, 'Les escrocs ciblent les victimes une deuxième fois. On s’adresse à la police et aux autorités.'),
  Q('Victime d’une arnaque, que fais-tu en premier ?', ['Porter plainte et prévenir ta banque', 'Payer quelqu’un pour récupérer les fonds', 'Ne rien dire'], 0, 'Plainte, banque, signalement (AMF Épargne Info Service).'),
]),
mis('m6-9', 6, 'Tes données, ton argent', 'Défi', 3, 'Protéger ses accès.', [
  S('Bon réflexe ou danger ?', 'Bon réflexe', 'Danger', [
    ['Activer la double authentification', 'l', 'Elle protège même si ton mot de passe fuite.'],
    ['Donner un code reçu par SMS à quelqu’un qui t’appelle', 'r', 'Jamais : ce code valide une opération.'],
    ['Le même mot de passe partout', 'r', 'Une seule fuite ouvre toutes les portes.'],
  ]),
]),
mis('m6-10', 6, 'Défi : le détecteur d’arnaques', 'Défi', 7, '10 situations, 10 décisions.', [
  S('10 situations : fiable ou arnaque ?', 'Fiable', 'Arnaque', [
    ['Placement « sans risque » à 20 % par an', 'r', 'Impossible.'],
    ['Courtier présent sur REGAFI, frais publiés', 'l', 'Bon signe.'],
    ['« Ton compte sera bloqué si tu ne paies pas une taxe »', 'r', 'Chantage classique.'],
    ['Publicité qui rappelle le risque de perte en capital', 'l', 'Obligatoire chez les acteurs sérieux.'],
    ['Investissement dans du vin, des diamants ou des places de parking « garanti »', 'r', 'Les placements atypiques garantis sont un terrain d’arnaques.'],
    ['Robot de trading qui « gagne à tous les coups »', 'r', 'Personne ne gagne à tous les coups.'],
    ['Site officiel de l’AMF consulté via une recherche directe', 'l', 'Bonne source.'],
    ['Message privé d’un inconnu qui te propose de l’aider à investir', 'r', 'Contact non sollicité.'],
    ['Document d’informations clés (DIC) remis avant souscription', 'l', 'Document obligatoire.'],
    ['« Dernière chance, l’offre ferme dans 10 minutes »', 'r', 'L’urgence sert à t’empêcher de réfléchir.'],
  ]),
]),
);
})();
