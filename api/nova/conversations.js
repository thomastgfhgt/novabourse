/**
 * Nova Core — conversations et messages (§4, §8 du prompt maître NovaTitre).
 * Voir sql/2026-10-05_nova_core_conversations.sql pour le schéma et le
 * raisonnement complet (une seule table de conversations pour tous les
 * modules Nova, pas une par module — "une mémoire commune").
 *
 * GET  /api/nova/conversations            — liste les conversations de
 *   l'utilisateur (triées par updated_at desc), sans leurs messages.
 * GET  /api/nova/conversations?id=X        — une conversation + tous ses
 *   messages, dans l'ordre chronologique.
 * POST /api/nova/conversations             — crée une conversation
 *   { module, title?, context? } -> { id }.
 * POST /api/nova/conversations?id=X&action=message — ajoute un message à
 *   une conversation existante { role, content, metadata? }, met à jour
 *   updated_at de la conversation.
 *
 * Portée volontairement minimale (§87 : ne pas tout construire d'un coup) :
 * CRUD seulement, aucune recherche/récupération de mémoire inter-
 * conversations pour l'instant (§9-10) — viendra une fois ce socle utilisé
 * par au moins un module réel.
 */
const { userFromToken, sb } = require('../me.js');

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ROLES = ['user', 'assistant', 'system'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  const id = typeof req.query?.id === 'string' ? req.query.id : null;

  if (req.method === 'GET') {
    try {
      if (id) {
        const convRows = await sb(
          `nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`
        );
        if (!convRows.length) return res.status(404).json({ error: 'conversation_introuvable' });
        const msgRows = await sb(
          `nova_messages?conversation_id=eq.${encodeURIComponent(id)}&select=id,role,content,metadata,created_at&order=created_at.asc`
        );
        const c = convRows[0];
        return res.status(200).json({
          id: c.id, module: c.module, title: c.title, context: c.context,
          createdAt: c.created_at, updatedAt: c.updated_at,
          messages: msgRows.map(m => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata, date: m.created_at })),
        });
      }
      const rows = await sb(
        `nova_conversations?user_id=eq.${encodeURIComponent(user.id)}&select=id,module,title,context,created_at,updated_at&order=updated_at.desc&limit=200`
      );
      return res.status(200).json({
        conversations: rows.map(c => ({
          id: c.id, module: c.module, title: c.title, context: c.context,
          createdAt: c.created_at, updatedAt: c.updated_at,
        })),
      });
    } catch (e) {
      console.error('[nova/conversations] lecture :', e.message);
      return res.status(503).json({ error: 'lecture_impossible' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const body = req.body || {};

  /* ---------- ajout d'un message à une conversation existante ---------- */
  if (id && body.action === 'message') {
    const role = ROLES.includes(body.role) ? body.role : null;
    const content = str(body.content, 20000);
    if (!role || !content) return res.status(400).json({ error: 'message_invalide' });
    try {
      const convRows = await sb(
        `nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id`
      );
      if (!convRows.length) return res.status(404).json({ error: 'conversation_introuvable' });

      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata : null;
      const [msg] = await sb('nova_messages', {
        method: 'POST',
        body: JSON.stringify([{ conversation_id: id, user_id: user.id, role, content, metadata }]),
      });
      await sb(`nova_conversations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ id: msg.id, date: msg.created_at });
    } catch (e) {
      console.error('[nova/conversations] ajout message :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible' });
    }
  }

  /* ---------- création d'une conversation ---------- */
  const moduleId = str(body.module, 40);
  if (!moduleId) return res.status(400).json({ error: 'module_requis' });
  const title = str(body.title, 200) || null;
  const context = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
    ? body.context : null;

  try {
    const [conv] = await sb('nova_conversations', {
      method: 'POST',
      body: JSON.stringify([{ user_id: user.id, module: moduleId, title, context }]),
    });
    return res.status(200).json({ id: conv.id, createdAt: conv.created_at, updatedAt: conv.updated_at });
  } catch (e) {
    console.error('[nova/conversations] création :', e.message);
    return res.status(503).json({ error: 'ecriture_impossible' });
  }
};
