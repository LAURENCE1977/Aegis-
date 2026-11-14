const MAX_HISTORY = 10;
const MAX_TEXT = 4000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

async function loadNotes(env) {
  if (!env.MEMORY) return [];
  try {
    const list = JSON.parse((await env.MEMORY.get('notes')) || '[]');
    return Array.isArray(list) ? list.filter(n => typeof n === 'string') : [];
  } catch (e) {
    return [];
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid request' }, 400); }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return json({ error: 'Prompt required' }, 400);
  if (!env.AI) return json({ error: 'No AI provider configured' }, 503);

  const history = Array.isArray(body.history)
    ? body.history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }))
    : [];

  const notes = await loadNotes(env);
  let system = 'You are AEGIS, a private personal AI assistant. Be clear, helpful and friendly.';
  if (notes.length) {
    system += '\n\nThings you know about the user (saved notes):\n' + notes.map(n => '- ' + n).join('\n');
  }

  try {
    const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: question.slice(0, MAX_TEXT) }
      ],
      max_tokens: 1024
    });
    return json(result);
  } catch (e) {
    return json({ error: 'The AI could not answer right now. Please try again.' }, 502);
  }
}
