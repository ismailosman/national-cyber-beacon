// Deprecated – use api-proxy instead
Deno.serve(() => new Response(
  JSON.stringify({ error: "Deprecated – use api-proxy" }),
  { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
));
