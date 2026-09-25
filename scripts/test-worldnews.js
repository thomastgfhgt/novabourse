// Reproduit fidelement le parseur RSS et la fusion multi-sources de
// api/market/extra.js (kind=worldnews, LOT C, 2026-09-25) pour la verifier
// sans appel reseau reel.
function decoderEntitesRss(valeur) {
  return String(valeur)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}
function champRss(bloc, tag) {
  const m = bloc.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decoderEntitesRss(m[1]) : null;
}
function parserRss(xml) {
  const items = [];
  const blocs = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const bloc of blocs) {
    const title = champRss(bloc, 'title');
    const link = champRss(bloc, 'link');
    if (!title || !link) continue;
    const pubDateRaw = champRss(bloc, 'pubDate');
    const d = pubDateRaw ? new Date(pubDateRaw) : null;
    const publishedAt = d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
    items.push({ title: title.slice(0, 220), url: link, publishedAt });
  }
  return items;
}
function fusionner(resultats) {
  const parUrl = new Map();
  for (const r of resultats) {
    if (!r.ok) continue;
    for (const it of r.items) { if (!parUrl.has(it.url)) parUrl.set(it.url, it); }
  }
  return [...parUrl.values()].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// --- Parsing ---
{
  const xml = `<rss><channel>
    <item><title>Marchés en hausse</title><link>https://example.com/a</link><pubDate>Fri, 25 Sep 2026 08:00:00 GMT</pubDate></item>
    <item><title><![CDATA[Le CAC 40 & la BCE]]></title><link>https://example.com/b</link><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate></item>
    <item><title>Sans lien</title><pubDate>Fri, 25 Sep 2026 10:00:00 GMT</pubDate></item>
    <item><link>https://example.com/c</link><pubDate>Fri, 25 Sep 2026 11:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const items = parserRss(xml);
  check('parse les items valides (titre + lien)', items.length === 2);
  check('decode le CDATA et les entites (&amp;)', items[1].title === 'Le CAC 40 & la BCE');
  check('un item sans lien est ignore', !items.some(it => it.title === 'Sans lien'));
  check('un item sans titre est ignore', !items.some(it => it.url === 'https://example.com/c'));
  check('pubDate convertie en ISO', items[0].publishedAt === new Date('Fri, 25 Sep 2026 08:00:00 GMT').toISOString());
}
{
  // Apostrophe HTML (&#39;/&apos;) et balise residuelle dans un titre.
  const xml = `<item><title>Bitcoin Could &#39;Go to Infinity&#39; <b>says CEO</b></title><link>https://example.com/d</link></item>`;
  const items = parserRss(xml);
  check('decode &#39; en apostrophe', items[0].title.includes("'Go to Infinity'"));
  check('retire une balise HTML residuelle dans le titre', !items[0].title.includes('<b>'));
}
{
  // pubDate absente ou invalide -> publishedAt null, jamais une date inventee.
  const xml = `<item><title>Sans date</title><link>https://example.com/e</link></item>`;
  const items = parserRss(xml);
  check('pubDate absente -> publishedAt null (jamais devine)', items[0].publishedAt === null);
}

// --- Fusion multi-sources ---
{
  const resultats = [
    { ok: true, items: [
      { title: 'A', url: 'https://x/1', publishedAt: '2026-09-25T08:00:00.000Z' },
      { title: 'B', url: 'https://x/2', publishedAt: '2026-09-25T10:00:00.000Z' },
    ] },
    { ok: true, items: [
      { title: 'A doublon', url: 'https://x/1', publishedAt: '2026-09-25T08:00:00.000Z' }, // meme URL -> deduplique
      { title: 'C', url: 'https://x/3', publishedAt: '2026-09-25T09:00:00.000Z' },
    ] },
  ];
  const fusion = fusionner(resultats);
  check('dedoublonne par URL (3 items uniques, pas 4)', fusion.length === 3);
  check('trie par date decroissante (plus recent en premier)', fusion[0].url === 'https://x/2' && fusion[2].url === 'https://x/1');
}
{
  // Une source en echec (ok:false) ne casse jamais la fusion des autres.
  const resultats = [
    { ok: false, reason: 'HTTP 500' },
    { ok: true, items: [{ title: 'Seule source OK', url: 'https://x/9', publishedAt: '2026-09-25T08:00:00.000Z' }] },
  ];
  const fusion = fusionner(resultats);
  check('une source en echec n\'empeche jamais l\'autre de repondre', fusion.length === 1 && fusion[0].url === 'https://x/9');
}
{
  check('toutes les sources en echec -> fusion vide (jamais un article invente)', fusionner([{ ok: false }, { ok: false }]).length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
