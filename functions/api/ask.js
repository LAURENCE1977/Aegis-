export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { question } = await request.json();
    
    if (!question || !question.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use Cloudflare Workers AI — Llama 3.3 70B
    if (env.AI) {
      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
        messages: [
          { role: 'system', content: 'You are AEGIS — a helpful, friendly personal AI assistant. Keep answers clear, concise, and conversational.' },
          { role: 'user', content: question }
        ]
      });
      
      return new Response(JSON.stringify({ reply: response.result?.content || response }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fallback if no AI connected
    return new Response(JSON.stringify({ 
      reply: `Received: "${question}" — AI connecting soon.` 
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
