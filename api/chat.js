// Vercel Edge Function — runs on the server, never in the browser.
// The API key lives here as an environment variable and is never exposed to the client.

export const config = { runtime: "edge" };

const MODEL = "claude-fable-5";
const MAX_TOKENS = 1024;
const DEFAULT_SYSTEM = "You are a helpful, concise assistant.";

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: "ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings." },
      500
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "Field 'messages' must be a non-empty array." }, 400);
  }

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: typeof body.system === "string" ? body.system : DEFAULT_SYSTEM,
        messages,
      }),
    });
  } catch {
    return json({ error: "Could not reach the Anthropic API." }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return json({ error: "Anthropic API error.", detail }, upstream.status);
  }

  // Stream the server-sent events straight through to the browser.
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
