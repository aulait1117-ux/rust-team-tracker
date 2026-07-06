// Read-only CORS proxy for a small, fixed set of Rustoria.co statistics endpoints.
// api.rustoria.co has no Access-Control-Allow-Origin header, so ranking.html
// (served from GitHub Pages) can't call it directly from the browser. This
// worker fetches on the server side (no CORS involved there) and re-serves
// the response with CORS headers added, restricted to our own site's origin.
//
// UPSTREAM_ROUTES is a fixed lookup table (our path -> exact upstream URL), not
// built from request input, so this can't be abused as an open relay to
// arbitrary URLs -- only these two exact upstream endpoints are ever reachable.

const ALLOWED_ORIGIN = "https://aulait1117-ux.github.io";
const UPSTREAM_ROUTES = {
  "/resources": "https://api.rustoria.co/statistics/leaderboards/vanilla_main_us/resources",
  "/wipes": "https://api.rustoria.co/statistics/wipes/vanilla_main_us"
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    const incoming = new URL(request.url);
    const upstreamBase = UPSTREAM_ROUTES[incoming.pathname];
    if (!upstreamBase) {
      return new Response(JSON.stringify({ error: "unknown route" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    const target = new URL(upstreamBase);
    target.search = incoming.search;

    let upstream;
    try {
      upstream = await fetch(target.toString(), { headers: { Accept: "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: "upstream fetch failed" }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
};
