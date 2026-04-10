// GET /api/state — load shared dashboard state from KV
export async function onRequestGet(context) {
  const data = await context.env.CHEBAR_DATA.get("dashboard-state", "text");
  return new Response(data || "{}", {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// PUT /api/state — save shared dashboard state to KV
export async function onRequestPut(context) {
  const body = await context.request.text();
  // Basic validation: must be valid JSON
  try { JSON.parse(body); } catch (e) {
    return new Response('{"error":"Invalid JSON"}', { status: 400, headers: { "Content-Type": "application/json" } });
  }
  await context.env.CHEBAR_DATA.put("dashboard-state", body);
  return new Response('{"ok":true}', {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
