/* Test de fumée de NovaTitre, sur téléphone (393×852) et ordinateur (1440×900).

   Parcours vérifié :
   1. l'ouverture (animation du temple) passe ;
   2. visite Accueil, Parcours, Marchés, Portefeuille, Profil, Coach ;
   3. sans compte, « Commencer » ouvre la page Connexion ;
   4. connexion en mode démonstration local (aucun e-mail envoyé, code 123456,
      prévu par le site hors de novatitre.com) : la mission demandée reprend ;
   5. une vidéo est lancée puis passée ;
   6. une mission est répondue (au moins une réponse donnée, puis « Suivant »).

   Échec si : une erreur JavaScript apparaît, ou un bloc de contenu est
   visible à l'écran mais entièrement transparent (texte « invisible »). */
const { test, expect } = require('@playwright/test');
const { demarrer } = require('./serveur.js');

let serveur, base;
test.beforeAll(async () => { serveur = await demarrer(); base = `http://127.0.0.1:${serveur.address().port}`; });
test.afterAll(async () => { if (serveur) serveur.close(); });

/* Blocs de texte affichés dans l'écran mais à opacité (cumulée) nulle. */
async function blocsTransparents(page) {
  return page.evaluate(() => {
    const opacite = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return null; o *= parseFloat(s.opacity); } return o; };
    const visibleEcran = r => r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    const fautifs = [];
    for (const el of document.querySelectorAll('#app *, #player *')) {
      if (el.closest('[aria-hidden="true"], .nt-intro, canvas, svg, .sr')) continue;
      const texte = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
      if (texte.length < 3) continue;
      const r = el.getBoundingClientRect(); if (!visibleEcran(r)) continue;
      const o = opacite(el);
      if (o !== null && o < 0.05) fautifs.push(`${el.tagName.toLowerCase()}.${el.className} « ${texte.slice(0, 40)} » (opacité ${o.toFixed(2)})`);
    }
    return fautifs.slice(0, 10);
  });
}

async function aller(page, cle) {
  const bouton = page.locator(`[data-go="${cle}"]:visible`).first();
  if (await bouton.count()) await bouton.click();
  else await page.evaluate(k => { const b = document.createElement('button'); b.hidden = true; b.dataset.go = k; document.body.appendChild(b); b.click(); b.remove(); }, cle);
  await page.waitForTimeout(900);
}

test('ouverture, pages principales, connexion, vidéo et mission', async ({ page }) => {
  const erreursJS = [];
  page.on('pageerror', e => erreursJS.push(e.message));

  /* 1. ouverture */
  await page.goto(base + '/');
  await page.waitForSelector('.nt-intro', { state: 'detached', timeout: 15_000 }).catch(() => {});
  await expect(page.locator('.nt-intro')).toHaveCount(0);
  await expect(page).toHaveTitle(/Accueil/);

  /* témoin : le détecteur doit repérer un texte visible mais transparent */
  await page.evaluate(() => { const p = document.createElement('p'); p.id = 'temoin-transparent'; p.textContent = 'Texte témoin invisible'; p.style.cssText = 'position:fixed;top:40px;left:40px;opacity:0;z-index:9'; document.getElementById('app').appendChild(p); });
  expect((await blocsTransparents(page)).join(' '), 'le détecteur fonctionne').toContain('Texte témoin');
  await page.evaluate(() => document.getElementById('temoin-transparent').remove());

  expect(await blocsTransparents(page), 'Accueil : blocs transparents').toEqual([]);

  /* 2. pages principales */
  const pages = [['carte', /Ma carte|Parcours/], ['markets', /Marchés/], ['portfolio', /Portefeuille/], ['profile', /Profil/], ['coach', /Nova Coach/], ['home', /Accueil/]];
  for (const [cle, titre] of pages) {
    await aller(page, cle);
    await expect(page, `page ${cle}`).toHaveTitle(titre);
    expect(await blocsTransparents(page), `${cle} : blocs transparents`).toEqual([]);
  }

  /* 3. sans compte, « Commencer » ouvre la Connexion */
  const commencer = page.locator('button:visible', { hasText: /^Commencer$/ }).first();
  await expect(commencer).toBeVisible();
  await commencer.click();
  await expect(page).toHaveTitle(/Connexion/);

  /* 4. connexion démo (aucun e-mail : code 123456 hors de novatitre.com) */
  await page.locator('.au-main input').first().fill('eleve.test@exemple.fr');
  await page.getByRole('button', { name: /Recevoir un code/ }).click();
  await page.locator('#authOtp').fill('123456');
  await expect(page.locator('#player')).toBeVisible({ timeout: 10_000 });

  /* 5. vidéo lancée puis passée */
  const passer = page.locator('#player [data-vidskip]:visible').first();
  if (await passer.count() === 0) {
    const autre = page.locator('#player [data-vidskip]').first();
    await expect(autre, 'une vidéo doit se lancer au début de la mission').toHaveCount(1);
  }
  await page.waitForTimeout(1500);
  expect(await blocsTransparents(page), 'vidéo : blocs transparents').toEqual([]);
  await page.locator('#player [data-vidskip]:visible').first().click();
  await expect(page.locator('#player [data-vidskip]:visible')).toHaveCount(0, { timeout: 5_000 });

  /* 6. une mission répondue : avancer jusqu'à une question, y répondre, continuer */
  const NON_REPONSE = '[data-quit],[data-askq],[data-lnext],[data-next],[data-vidskip],[data-vidsound],[data-vidtap],[disabled]';
  let reponses = 0;
  for (let etape = 0; etape < 25 && reponses < 1; etape++) {
    const suivant = page.locator('#player [data-lnext]:visible:enabled, #player [data-next]:visible:enabled').first();
    const choix = page.locator(`#player button:visible:enabled:not(${NON_REPONSE})`).filter({ hasNotText: /^Une question/ });
    const suivantBloque = await page.locator('#player [data-lnext]:visible:disabled, #player [data-next]:visible:disabled').count();
    if (suivantBloque && await choix.count()) {
      await choix.first().click(); reponses++;
      await page.waitForTimeout(700);
      await expect(page.locator('#player [data-lnext]:visible:enabled, #player [data-next]:visible:enabled').first(), 'Suivant se débloque après la réponse').toBeVisible();
      expect(await blocsTransparents(page), 'mission : blocs transparents').toEqual([]);
      await page.locator('#player [data-lnext]:visible:enabled, #player [data-next]:visible:enabled').first().click();
    } else if (await suivant.count()) {
      await suivant.click();
    } else break;
    await page.waitForTimeout(700);
  }
  expect(reponses, 'au moins une question de mission répondue').toBeGreaterThan(0);

  expect(erreursJS, 'aucune erreur JavaScript').toEqual([]);
});
