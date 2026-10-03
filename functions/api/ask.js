export async function onRequestPost({ request, env }) {
  try {
    const { question } = await request.json();
    
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Message needed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
      messages: [
        { role: 'system', content: 'You are AEGIS — a helpful, clear personal assistant.' },
        { role: 'user', content: question }
      ]
    });

    return new Response(JSON.stringify({ reply: response.response }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
