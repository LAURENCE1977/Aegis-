export async function onRequestPost(context) {
  const { request, env } = context;
  const { question } = await request.json();

  if (!question) {
    return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400 });
  }

  // Example: Cloudflare Workers AI
  if (env.AI) {
    const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
      messages: [{ role: 'user', content: question }]
    });
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  return new Response(JSON.stringify({ error: 'No AI provider configured' }), { status: 503 });
}
