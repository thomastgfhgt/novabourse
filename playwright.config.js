/* Test de fumée (Playwright) : npm run test:fumee
   Utilise le Chrome (ou Edge) déjà installé : aucun navigateur à télécharger.
   Choisir le navigateur : variable NT_NAVIGATEUR = chrome (défaut) ou msedge. */
const { defineConfig } = require('@playwright/test');

const canal = process.env.NT_NAVIGATEUR || 'chrome';

module.exports = defineConfig({
  testDir: 'tests/fumee',
  testMatch: '*.spec.js',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { channel: canal, headless: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' },
  projects: [
    { name: 'telephone', use: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'ordinateur', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
