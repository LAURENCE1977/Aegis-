export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: "aegis-infinity" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
