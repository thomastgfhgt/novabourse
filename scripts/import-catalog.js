#!/usr/bin/env node
/**
 * scripts/import-catalog.js — IMPORT MANUEL DU CATALOGUE MONDIAL
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-catalog.js
 *
 * (PowerShell)
 *   $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-catalog.js
 *
 * Lancé MANUELLEMENT pour l'instant (pas de Vercel Cron dans cette passe,
 * pour limiter les coûts et éviter tout traitement automatique non désiré).
 * La logique réutilisable vit dans scripts/lib/catalogImport.js : un futur
 * Cron n'aura qu'à l'appeler depuis une route api/cron/*.js, sans dupliquer
 * ce script.
 *
 * Ne jamais committer les valeurs de SUPABASE_SERVICE_ROLE_KEY : à définir
 * uniquement dans l'environnement local au moment de l'exécution.
 */

const { runImport } = require('./lib/catalogImport.js');

async function main() {
  const debut = Date.now();

  console.log('=== NovaBourse — import du catalogue mondial (free-ticker-database) ===');

  const resultat = await runImport({ log: (msg) => console.log(msg) });

  const secondes = ((Date.now() - debut) / 1000).toFixed(1);

  console.log('');
  console.log('=== Terminé ===');
  console.log(`Lot d'import      : ${resultat.importBatchId}`);
  console.log(`Lignes lues       : ${resultat.rowsRead}`);
  console.log(`Lignes importées  : ${resultat.rowsUpserted}`);
  console.log(`Lignes ignorées   : ${resultat.rowsSkipped}`);
  console.log(`Durée             : ${secondes}s`);

  const nonMappees = Object.entries(resultat.unmappedExchanges)
    .sort((a, b) => b[1] - a[1]);

  if (nonMappees.length) {
    console.log('');
    console.log(`Places sans code NovaBourse vérifié (${nonMappees.length} places, `
      + `${nonMappees.reduce((s, [, n]) => s + n, 0)} instruments concernés) :`);
    console.log('Ces instruments restent identifiables (catalogue) mais sans cotation');
    console.log('en direct tant qu\'aucun fournisseur confirmé ne les couvre.');
    for (const [exchange, count] of nonMappees.slice(0, 20)) {
      console.log(`  ${exchange.padEnd(20)} ${count}`);
    }
    if (nonMappees.length > 20) console.log(`  ... et ${nonMappees.length - 20} autres`);
  }
}

main().catch((error) => {
  console.error('');
  console.error('=== ÉCHEC DE L\'IMPORT ===');
  console.error(error.message || error);
  process.exitCode = 1;
});
