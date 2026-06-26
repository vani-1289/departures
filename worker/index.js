/**
 * Cloudflare Worker — Claude API proxy for "Departures".
 *
 * This is the ONLY piece of this project that ever touches your real
 * Anthropic API key. It runs on Cloudflare's servers, not in the browser,
 * so the key is never visible to anyone visiting your GitHub Pages site.
 *
 * Deploy this separately from the frontend (see DEPLOY.md). Once deployed,
 * Cloudflare gives you a URL like:
 *   https://departures-proxy.yourname.workers.dev
 * Put that URL into src/config.js as PROXY_URL.
 */

// Only allow requests from your own GitHub Pages origin once you know it.
// During local dev this also allows localhost. Update YOUR_GITHUB_PAGES_URL
// after your first deploy.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://YOUR_GITHUB_USERNAME.github.io",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { messages, systemPrompt } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Basic guardrails: cap conversation length and message size to limit
    // cost/abuse since this endpoint is public-facing.
    if (messages.length > 30) {
      return new Response(JSON.stringify({ error: "Conversation too long" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (totalChars > 12000) {
      return new Response(JSON.stringify({ error: "Message content too long" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY, // set via `wrangler secret put`, never in code
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt || "",
          messages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "Upstream error" }), {
          status: response.status,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy request failed", detail: String(err) }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  },
};
