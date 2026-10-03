export async function onRequestPost({ env }) {
  try {
    const { question } = await request.json();
    const out = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
      messages: [
        { role: 'system', content: 'You are AEGIS.' },
        { role: 'user', content: question }
      ]
    });
    return Response.json({ reply: out.response });
  } catch (e) {
    return Response.json({ error: e.message });
  }
}
