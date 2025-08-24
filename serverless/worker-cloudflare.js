
// Cloudflare Worker: Token exchange for Notion OAuth
// Usage:
//  - Deploy and set secrets: NOTION_CLIENT_ID / NOTION_CLIENT_SECRET
//  - POST /exchange { code, redirect_uri, client_id }
//    -> { access_token, refresh_token, bot_id, workspace_name, workspace_icon, ... }
//  - POST /refresh { refresh_token, client_id }
//    -> new tokens

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST") return new Response("Not Found", { status: 404 });
    const data = await request.json().catch(() => ({}));
    if (url.pathname === "/exchange") {
      return await exchange(env, data);
    }
    if (url.pathname === "/refresh") {
      return await refresh(env, data);
    }
    return new Response("Not Found", { status: 404 });
  }
};

async function exchange(env, { code, redirect_uri, client_id }) {
  if (!code || !redirect_uri || !client_id) return json({ error: "Missing fields" }, 400);
  if (client_id !== env.NOTION_CLIENT_ID) return json({ error: "Client ID mismatch" }, 400);
  const body = {
    grant_type: "authorization_code",
    code,
    redirect_uri
  };
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + b64(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const out = await res.json();
  return json(out, res.status);
}

async function refresh(env, { refresh_token, client_id }) {
  if (!refresh_token || !client_id) return json({ error: "Missing fields" }, 400);
  if (client_id !== env.NOTION_CLIENT_ID) return json({ error: "Client ID mismatch" }, 400);
  const body = {
    grant_type: "refresh_token",
    refresh_token
  };
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + b64(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const out = await res.json();
  return json(out, res.status);
}

function b64(s) {
  // atob/btoa aren't available in workers v3; use Buffer emulation
  return btoa(unescape(encodeURIComponent(s)));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
