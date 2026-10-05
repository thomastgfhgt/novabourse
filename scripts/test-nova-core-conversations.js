// Reproduit fidelement la logique de validation d'api/nova/conversations.js
// (Nova Core, §4/§8 du prompt maitre NovaTitre) pour la verifier sans appel
// Supabase reel. Meme convention que test-portfolio-cashflows.js (check()
// + PASS/FAIL), adaptee ici a de la validation d'entree plutot qu'a du calcul.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ROLES = ['user', 'assistant', 'system'];

// ---- validation d'un message (reproduit le bloc POST ?action=message) ----
function validerMessage(body) {
  const role = ROLES.includes(body.role) ? body.role : null;
  const content = str(body.content, 20000);
  if (!role || !content) return { ok: false };
  const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata : null;
  return { ok: true, role, content, metadata };
}

// ---- validation d'une création de conversation ----
function validerConversation(body) {
  const moduleId = str(body.module, 40);
  if (!moduleId) return { ok: false };
  const title = str(body.title, 200) || null;
  const context = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
    ? body.context : null;
  return { ok: true, module: moduleId, title, context };
}

// ---- messages ----
check('message valide (role user) accepté', validerMessage({ role: 'user', content: 'Pourquoi ça baisse ?' }).ok === true);
check('message valide (role assistant) accepté', validerMessage({ role: 'assistant', content: 'Réponse de Nova.' }).ok === true);
check('role invalide ("bot") rejeté — jamais un rôle inventé', validerMessage({ role: 'bot', content: 'x' }).ok === false);
check('contenu vide rejeté', validerMessage({ role: 'user', content: '' }).ok === false);
check('contenu absent rejeté', validerMessage({ role: 'user' }).ok === false);
check('contenu tronqué à 20000 caractères (jamais une erreur serveur sur un pavé trop long)',
  validerMessage({ role: 'user', content: 'a'.repeat(30000) }).content.length === 20000);
{
  const r = validerMessage({ role: 'assistant', content: 'x', metadata: { provider: 'xai', model: 'grok-4.6', tokens: 120 } });
  check('metadata objet accepté telle quelle (§76, coûts IA)', r.metadata && r.metadata.provider === 'xai');
}
check('metadata tableau rejeté (doit être un objet, jamais un array)',
  validerMessage({ role: 'user', content: 'x', metadata: [1, 2, 3] }).metadata === null);
check('metadata absente -> null, jamais undefined (sérialisation JSON propre)',
  validerMessage({ role: 'user', content: 'x' }).metadata === null);

// ---- conversations ----
check('création valide (module seul) acceptée', validerConversation({ module: 'novabot' }).ok === true);
check('module absent rejeté', validerConversation({}).ok === false);
check('module chaîne vide rejeté', validerConversation({ module: '   ' }).ok === false);
{
  const r = validerConversation({ module: 'stock', title: 'LVMH', context: { type: 'stock', stockId: 'MC-PAR' } });
  check('titre + contexte structuré (§7) acceptés ensemble', r.title === 'LVMH' && r.context.stockId === 'MC-PAR');
}
check('titre absent -> null, jamais une chaîne inventée ("Nouvelle conversation")',
  validerConversation({ module: 'general' }).title === null);
check('context tableau rejeté (doit être un objet)',
  validerConversation({ module: 'general', context: [1, 2] }).context === null);
check('un module inconnu/nouveau (pas dans une liste fermée) reste accepté — §4 : "permettre d\'ajouter [...] sans réécrire toute l\'application"',
  validerConversation({ module: 'un-futur-module-pas-encore-inventé' }).ok === true);

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
