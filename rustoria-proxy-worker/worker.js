// Read-only CORS proxy for a small, fixed set of Rustoria.co statistics endpoints.
// api.rustoria.co has no Access-Control-Allow-Origin header, so ranking.html/index.html
// (served from GitHub Pages) can't call it directly from the browser. This worker
// fetches on the server side (no CORS involved there) and re-serves the response
// with CORS headers added, restricted to our own site's origin.
//
// ROUTE_BUILDERS is a fixed lookup table (our path -> upstream URL template), and the
// only request-supplied piece of the URL is `server`, which must be one of
// ALLOWED_SERVERS -- so this still can't be abused as an open relay to arbitrary URLs.

const ALLOWED_ORIGIN = "https://aulait1117-ux.github.io";
const DEFAULT_SERVER = "vanilla_main_us";

// Mirrors the `id` field of every entry currently returned by api.rustoria.co/servers.
// Re-sync this list (via the /servers route below) if Rustoria adds/removes servers.
const ALLOWED_SERVERS = new Set([
  "vanilla_low_pop_us", "10x_eu", "vanilla_main_br", "vanilla_low_pop_eu", "vanilla_long_br",
  "2x_mondays_eu", "vanilla_long_eu", "vanilla_long_us", "vanilla_main_eu", "vanilla_main_sea",
  "vanilla_main_us", "vanilla_medium_eu", "vanilla_medium_us", "vanilla_mondays_eu", "vanilla_mondays_us",
  "vanilla_small_eu", "vanilla_small_us", "10x_us", "nobps_5x_eu", "nobps_5x_us", "vanilla_long_eueast",
  "trio_5x_us", "vanilla_premium_au", "vanilla_medium_eueast", "vanilla_long_sea", "vanilla_medium_sea"
]);

const ROUTE_BUILDERS = {
  "/resources": function (server) { return "https://api.rustoria.co/statistics/leaderboards/" + server + "/resources"; },
  "/pvp": function (server) { return "https://api.rustoria.co/statistics/leaderboards/" + server + "/pvp"; },
  "/wipes": function (server) { return "https://api.rustoria.co/statistics/wipes/" + server; },
  "/servers": function () { return "https://api.rustoria.co/servers"; }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
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
    const buildUpstream = ROUTE_BUILDERS[incoming.pathname];
    if (!buildUpstream) {
      return jsonError(404, "unknown route");
    }

    const params = new URLSearchParams(incoming.search);
    let target;
    if (incoming.pathname === "/servers") {
      target = new URL(buildUpstream());
    } else {
      const server = params.get("server") || DEFAULT_SERVER;
      if (!ALLOWED_SERVERS.has(server)) {
        return jsonError(400, "unknown server");
      }
      params.delete("server");
      target = new URL(buildUpstream(server));
      target.search = params.toString();
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), { headers: { Accept: "application/json" } });
    } catch (err) {
      return jsonError(502, "upstream fetch failed");
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
};
