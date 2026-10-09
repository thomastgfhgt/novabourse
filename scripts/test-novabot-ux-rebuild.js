// Vérifie la refonte UX complète de NovaBot (2026-10-08, 2e passe —
// conversations multiples, fonds simulés) sans réseau ni navigateur :
// reproduit fidèlement
// 1) novabotAjouterFonds()/novabotRetirerFonds() (js/core.js) ;
// 2) le titrage automatique d'une conversation (js/novabot-chat.js) ;
// 3) le filtre de recherche sur la liste des conversations.
// Même convention que les fichiers test-novabot-*.js précédents.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- 1) ajouter/retirer des fonds (copie de novabotAjouterFonds/novabotRetirerFonds) ---------- */
function creerWallet(cash, invested){ return { cash, invested, positions:[], realizedPnL:0 }; }
function ajouterFonds(wallet, transactions, amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  wallet.cash += amountEUR;
  wallet.invested += amountEUR;
  transactions.push({ type:'deposit', amountEUR });
  return { ok:true, msg:`${amountEUR} € ajoutés` };
}
function retirerFonds(wallet, transactions, amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  if (amountEUR > wallet.cash) return { ok:false, msg:'Liquidités simulées insuffisantes' };
  wallet.cash -= amountEUR;
  wallet.invested -= amountEUR;
  transactions.push({ type:'withdraw', amountEUR });
  return { ok:true, msg:`${amountEUR} € retirés` };
}

{
  const w = creerWallet(10000, 10000); const tx = [];
  const r = ajouterFonds(w, tx, 500);
  check('dépôt de 500 € : ok=true, cash et invested augmentent à parts égales (§6 : jamais compté comme un gain)',
    r.ok === true && w.cash === 10500 && w.invested === 10500);
  check('le dépôt est bien journalisé comme une transaction', tx.length === 1 && tx[0].type === 'deposit' && tx[0].amountEUR === 500);
}
{
  const w = creerWallet(10000, 10000); const tx = [];
  const r = ajouterFonds(w, tx, -100);
  check('dépôt d\'un montant négatif ou nul REJETÉ, wallet inchangé', r.ok === false && w.cash === 10000);
}
{
  const w = creerWallet(1000, 10000); const tx = [];
  const r = retirerFonds(w, tx, 1500);
  check('retrait au-delà du cash disponible REFUSÉ (jamais un cash négatif)', r.ok === false && w.cash === 1000);
}
{
  const w = creerWallet(10000, 10000); const tx = [];
  const r = retirerFonds(w, tx, 3000);
  check('retrait valide : ok=true, cash et invested diminuent à parts égales',
    r.ok === true && w.cash === 7000 && w.invested === 7000);
}
{
  const w = creerWallet(5000, 5000); const tx = [];
  const r = retirerFonds(w, tx, 5000);
  check('retrait du montant EXACT disponible autorisé (limite incluse, jamais un rejet à l\'égalité)',
    r.ok === true && w.cash === 0);
}

/* ---------- 2) titrage automatique (copie de novabotAutoTitrer()) ---------- */
function titreAuto(message){
  return message.trim().slice(0, 50) + (message.length > 50 ? '…' : '');
}
check('message court -> titre = message tel quel, pas de troncature inutile',
  titreAuto('Bonjour Nova') === 'Bonjour Nova');
check('message long -> tronqué à 50 caractères avec une ellipse',
  titreAuto('a'.repeat(80)).length === 51 && titreAuto('a'.repeat(80)).endsWith('…'));
check('espaces de début/fin retirés avant troncature', titreAuto('   Bonjour   ') === 'Bonjour');

/* ---------- 3) filtre de recherche sur la liste des conversations ---------- */
function filtrerConversations(list, search){
  const q = (search || '').toLowerCase();
  return q ? list.filter(c => (c.title || '').toLowerCase().includes(q)) : list;
}
{
  const list = [{ id:'1', title:'Pourquoi LVMH ?' }, { id:'2', title:'Mandat initial' }, { id:'3', title:null }];
  check('recherche "lvmh" (insensible à la casse) ne retrouve que la conversation correspondante',
    filtrerConversations(list, 'LVMH').length === 1 && filtrerConversations(list, 'LVMH')[0].id === '1');
  check('recherche vide renvoie la liste complète, y compris les conversations sans titre',
    filtrerConversations(list, '').length === 3);
  check('une conversation sans titre n\'est jamais trouvée par une recherche non vide (jamais null.includes())',
    filtrerConversations(list, 'x').every(c => c.id !== '3'));
}

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length) {
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
