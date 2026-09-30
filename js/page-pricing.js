PAGES.pricing = () => `
  <div class="page-in">${pricingBlock(false)}
  <section class="section">
    <h2 class="h2">Comparer les offres</h2>
    <div class="card" style="margin-top:16px;overflow-x:auto">
      <table class="t"><thead><tr><th>Fonctionnalité</th><th>Free</th><th>Pro</th><th>Elite</th></tr></thead>
        <tbody>${[
          ['Nova Score et fiches', '✓','✓','✓'],
          ['Entreprises suivies', '10','illimité','illimité'],
          ['Alertes', '3','illimité','illimité'],
          ['Analyses IA par mois', '5','200','800'],
          ["Modèles d'IA", '1','1','3'],
          ['Consensus multi-modèles', '—','—','✓'],
          ['Comparateur', '2 valeurs','3 valeurs','5 valeurs'],
          ['Historique du score', '30 jours','complet','complet'],
        ].map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}
        </tbody></table>
    </div>
  </section></div>`;
