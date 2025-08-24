
export function buildAuthUrl({ client_id, redirect_uri, auth_url, state }) {
  const u = new URL(auth_url || "https://api.notion.com/v1/oauth/authorize");
  u.searchParams.set("client_id", client_id);
  u.searchParams.set("redirect_uri", redirect_uri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("owner", "user");
  u.searchParams.set("state", state);
  return u.toString();
}

// Notion redirects with code in query (?code=...) not fragment.
export function parseRedirectFragmentOrQuery(redirectUrl) {
  const u = new URL(redirectUrl);
  const code = u.searchParams.get("code") || null;
  const received_state = u.searchParams.get("state") || null;
  const error = u.searchParams.get("error") || null;
  return { code, received_state, error };
}
