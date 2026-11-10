/* ============================================================
   NOVATITRE — ACTUALITÉ RÉELLE (instantané daté et sourcé)
   ------------------------------------------------------------
   Semaine de bourse du 26 au 30 octobre 2026, relevée le 1er novembre 2026.
   Chaque chiffre vient d'une source citée. Rien n'est inventé.
   Sur le vrai site : remplacer cet instantané par un flux d'actualité
   et de cours sous licence (window.NT_REAL_ENDPOINT), relu avant publication.
   Usage pédagogique : rejouer des événements PASSÉS. Ce ne sont pas des
   conseils et cela ne prédit rien.
   ============================================================ */
window.NT_REAL = (() => {
  const SRC = {
    tsat: { t: 'BFM Bourse / Tradingsat, clôture du 30/10/2026', u: 'https://www.tradingsat.com/cac-40-FR0003500008/actualites/cac-40-avec-la-hausse-de-sanofi-en-soutien-le-cac-40-termine-a-l-equilibre-ce-vendredi-et-reprend-24-sur-la-semaine-1172883.html' },
    recap: { t: 'Boursorama, récap de la semaine du 26 au 30/10/2026', u: 'https://www.boursorama.com/bourse/actualites/une-semaine-sur-les-marches-le-recap-du-26-au-30-octobre-e3614eae44adcae1a0ba94fe0c33e47e' },
    bce: { t: 'Boursorama, décision de la BCE du 29/10/2026', u: 'https://www.boursorama.com/bourse/actualites/la-bce-laisse-ses-taux-inchanges-christine-lagarde-demissionnera-en-fevrier-4b93d0d00ca65173c613cbd6936af2c2' },
    bceSept: { t: 'Auguste Patrimoine, hausse de la BCE du 10/09/2026', u: 'https://www.auguste-patrimoine.fr/blog/hausse-taux-bce-septembre-2026' },
    lvmh: { t: 'France Épargne, ventes de LVMH au 3e trimestre 2026', u: 'https://www.france-epargne.fr/news/lvmh-la-mode-et-la-maroquinerie-reculent-de-5-au-troisieme-trimestre-sous-les-attentes' },
  };
  /* Les grands chiffres de la semaine */
  const MARKET = {
    asOf: '30/10/2026', week: 'du 26 au 30 octobre 2026',
    cac: { close: 7969.42, day: -0.01, week: 2.4, src: 'tsat' },
    cacDays: [['lun. 26', 7847.32, 0.83], ['mar. 27', 7887.14, 0.51], ['mer. 28', 7886.96, 0], ['jeu. 29', 7970, 1.05], ['ven. 30', 7969.42, -0.01]],
    brent: { price: 113.91, day: 2.8, src: 'tsat' }, eurusd: { v: 1.1197, src: 'tsat' },
    bce: { depot: 2.5, src: 'bce' }, oat10: { v: 4.9, src: 'recap' },
  };
  /* Les événements, jour par jour (réactions réelles) */
  const EVENTS = [
    { id: 'banques', day: 'lun. 26/10', co: 'BNP Paribas', sector: 'Banque', head: 'Moody’s maintient la note de la France. Le taux à 10 ans de l’État retombe à 4,90 %.', move: 2.43, extra: 'Société Générale +2,03 %, Crédit Agricole +1,17 %.', why: 'Quand le risque sur la dette de l’État baisse, les banques, qui en détiennent beaucoup, sont souvent soulagées.', concept: 'taux', src: 'recap' },
    { id: 'boeing', day: 'mar. 27/10', co: 'Boeing', sector: 'Aéronautique', head: 'Boeing publie une perte trimestrielle plus lourde que prévu.', move: -10.7, why: 'Une perte plus forte que ce que le marché attendait : l’action est sanctionnée.', concept: 'attentes', src: 'recap' },
    { id: 'exosens', day: 'mar. 27/10', co: 'Exosens', sector: 'Technologie', head: 'Exosens annonce un chiffre d’affaires en hausse de 23,5 %, à 133,8 millions d’euros.', move: -5, approx: true, why: 'Les ventes montent, mais les investisseurs ont regardé la marge, jugée décevante. Une bonne nouvelle peut faire baisser une action.', concept: 'attentes', src: 'recap' },
    { id: 'stellantis', day: 'mer. 28/10', co: 'Stellantis', sector: 'Automobile', head: 'Stellantis : marge opérationnelle de 0,7 % (contre 0,2 %), mais une perte nette de 453 millions d’euros.', move: 15.4, why: 'Malgré la perte, la marge s’améliore plus que prévu : le marché regarde la direction prise et l’écart avec les attentes.', concept: 'attentes', src: 'recap' },
    { id: 'alphabet', day: 'jeu. 29/10', co: 'Alphabet (Google)', sector: 'Technologie', head: 'Alphabet inquiète sur la rentabilité de ses dépenses dans l’intelligence artificielle.', move: -12.64, extra: 'L’action termine à 283,82 $ : environ 480 milliards de dollars de valeur effacés.', why: 'Même une géante peut chuter fortement quand le marché doute du retour de ses investissements.', concept: 'risque', src: 'recap' },
    { id: 'renault', day: 'jeu. 29/10', co: 'Renault', sector: 'Automobile', head: 'Renault : chiffre d’affaires en hausse de 1,5 %, à 11,6 milliards d’euros, malgré des ventes de voitures en baisse de 6 %.', move: null, leader: true, why: 'Renault a terminé en tête du CAC 40 ce jour-là : le chiffre d’affaires tient mieux que les volumes.', concept: 'lecture', src: 'recap' },
    { id: 'bce', day: 'jeu. 29/10', co: 'BCE', sector: 'Banque centrale', head: 'La BCE laisse son taux de dépôt à 2,50 %. Christine Lagarde quittera la présidence le 7 février 2027.', move: null, why: 'Après deux hausses en 2026 (juin et septembre) face à une inflation poussée par l’énergie, la BCE fait une pause.', concept: 'taux', src: 'bce' },
    { id: 'sanofi', day: 'ven. 30/10', co: 'Sanofi', sector: 'Santé', head: 'Sanofi : chiffre d’affaires de 14,44 milliards d’euros (+16,2 %), au-dessus des 13,66 milliards attendus. Prévisions relevées.', move: 4.7, why: 'Des résultats au-dessus des attentes et des prévisions relevées : le titre progresse.', concept: 'attentes', src: 'tsat' },
    { id: 'intel', day: 'ven. 30/10', co: 'Intel', sector: 'Semi-conducteurs', head: 'Intel publie des perspectives décevantes.', move: -30, approx: true, extra: 'L’indice des semi-conducteurs de Philadelphie recule de 8 %.', why: 'Des perspectives décevantes dans un secteur déjà nerveux : chute brutale.', concept: 'risque', src: 'recap' },
    { id: 'imerys', day: 'ven. 30/10', co: 'Imerys', sector: 'Matériaux', head: 'Imerys publie des résultats bien reçus par les investisseurs.', move: 13.8, why: 'Les résultats ont rassuré : forte hausse.', concept: 'attentes', src: 'tsat' },
    { id: 'schneider', day: 'ven. 30/10', co: 'Schneider Electric', sector: 'Équipements', head: 'Les doutes sur les valeurs liées à l’intelligence artificielle s’étendent.', move: -4.1, extra: 'STMicro −5,3 %, Soitec −9,6 %, Legrand −2,7 %.', why: 'Quand un thème à la mode est remis en question, tout le secteur peut baisser ensemble : c’est le risque de concentration.', concept: 'diversif', src: 'tsat' },
    { id: 'capgemini', day: 'ven. 30/10', co: 'Capgemini', sector: 'Services informatiques', head: 'Capgemini publie des résultats bien reçus.', move: 3.5, why: 'Résultats rassurants : le titre monte.', concept: 'attentes', src: 'tsat' },
    { id: 'amazon', day: 'ven. 30/10', co: 'Amazon', sector: 'Commerce en ligne', head: 'Amazon publie des revenus trimestriels inférieurs aux attentes.', move: -2, why: 'En dessous des attentes : baisse, ici modérée.', concept: 'attentes', src: 'tsat' },
    { id: 'scor', day: 'ven. 30/10', co: 'Scor', sector: 'Assurance', head: 'Scor publie des résultats bien reçus.', move: 4.7, why: 'Résultats rassurants : le titre monte.', concept: 'attentes', src: 'tsat' },
  ];
  /* Contexte (pas de réaction d'action) */
  const CONTEXT = [
    { h: 'Pétrole', t: 'Le Brent termine la semaine à 113,91 $ le baril (+2,8 % vendredi), sur fond de tensions au Moyen-Orient.', src: 'tsat' },
    { h: 'Inflation et taux', t: 'L’inflation de la zone euro a atteint 3,2 % en août 2026, tirée par l’énergie. La BCE a relevé son taux de dépôt en juin puis en septembre, à 2,50 %.', src: 'bceSept' },
    { h: 'Luxe', t: 'LVMH : 18,5 milliards d’euros de ventes au 3e trimestre (+1 % à périmètre comparable), mais la mode et la maroquinerie reculent de 5 %, plus que prévu.', src: 'lvmh' },
    { h: 'Dette française', t: 'Le taux à 10 ans de l’État français est repassé à 4,90 % après le maintien de la note par Moody’s, puis a subi des tensions après une contraction inattendue du PIB.', src: 'recap' },
  ];
  /* La semaine rejouée en 5 journées de trader */
  const DAYS = [
    { n: 1, label: 'Lundi 26 octobre', brief: 'banques', decide: 'banques', flash: 'taux' },
    { n: 2, label: 'Mardi 27 octobre', brief: 'boeing', decide: 'exosens', flash: 'attentes' },
    { n: 3, label: 'Mercredi 28 octobre', brief: 'stellantis', decide: 'stellantis', flash: 'attentes' },
    { n: 4, label: 'Jeudi 29 octobre', brief: 'bce', decide: 'alphabet', flash: 'risque' },
    { n: 5, label: 'Vendredi 30 octobre', brief: 'schneider', decide: 'sanofi', flash: 'diversif' },
  ];
  /* Leçons flash (2-3 écrans), déclenchées au bon moment */
  const FLASH = {
    attentes: { title: 'Le marché réagit aux attentes', cards: [
      { k: 'info', viz: 'scale', h: 'Ce qui compte : l’écart', t: 'Avant chaque publication, les analystes ont une estimation. L’action réagit surtout à l’écart entre le résultat et cette attente.' },
      { k: 'guess', h: 'À ton avis…', t: 'Ventes +23 %, mais marge décevante. L’action…', opts: ['monte forcément', 'peut baisser'], a: 1, r: 'Le marché regarde tout : ventes, marge, prévisions. Une bonne nouvelle « moins bonne que prévu » peut faire baisser.' } ] },
    taux: { title: 'Taux et dette : qui en profite ?', cards: [
      { k: 'info', viz: 'scale', h: 'Le taux de l’État', t: 'Quand le risque sur la dette d’un pays baisse, son taux d’emprunt baisse aussi. Les banques, qui détiennent beaucoup de cette dette, respirent.' },
      { k: 'info', viz: 'clock', h: 'La banque centrale', t: 'La BCE monte ses taux pour freiner l’inflation. Des taux plus hauts rendent le crédit plus cher et pèsent souvent sur la croissance.' } ] },
    risque: { title: 'Même les géants peuvent chuter', cards: [
      { k: 'info', viz: 'down', h: '−12 % en un jour', t: 'Alphabet, une des plus grosses entreprises du monde, a perdu environ 480 milliards de dollars de valeur en une séance.' },
      { k: 'tap', viz: 'shield', h: 'La protection', t: 'Comment limiter ce risque ?', hidden: 'Ne pas tout miser sur une seule action, et décider à l’avance de sa perte maximale (le stop).' } ] },
    diversif: { title: 'Quand tout un thème baisse', cards: [
      { k: 'info', viz: 'one', h: 'Le piège du thème à la mode', t: 'Le 30 octobre, les doutes sur l’IA ont fait baisser ensemble Soitec, STMicro, Schneider, Legrand et Intel.' },
      { k: 'info', viz: 'basket', h: 'La solution', t: 'Répartir entre secteurs et pays : quand un thème chute, les autres amortissent.' } ] },
    lecture: { title: 'Lire un chiffre d’affaires', cards: [
      { k: 'info', viz: 'bars', h: 'Volumes et prix', t: 'Une entreprise peut vendre moins de produits mais plus cher : son chiffre d’affaires tient malgré la baisse des volumes.' } ] },
  };
  return { SRC, MARKET, EVENTS, CONTEXT, DAYS, FLASH, ev: id => EVENTS.find(e => e.id === id) };
})();
