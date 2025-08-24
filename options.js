
import { getState, setState } from "./src/storage.js";

const els = {
  oauthClientId: document.getElementById("oauthClientId"),
  oauthAuthUrl: document.getElementById("oauthAuthUrl"),
  tokenExchangeUrl: document.getElementById("tokenExchangeUrl"),
  beginAuth: document.getElementById("beginAuth"),
  saveOAuth: document.getElementById("saveOAuth"),
  oauthStatus: document.getElementById("oauthStatus"),
  internalToken: document.getElementById("internalToken"),
  saveInternal: document.getElementById("saveInternal"),
  intStatus: document.getElementById("intStatus"),
  refreshDbs: document.getElementById("refreshDbs"),
  dbList: document.getElementById("dbList"),
  dbStatus: document.getElementById("dbStatus")
};

async function init() {
  const st = await getState();
  els.oauthClientId.value = st.oauthClientId || "";
  els.oauthAuthUrl.value = st.oauthAuthUrl || "https://api.notion.com/v1/oauth/authorize?owner=user";
  els.tokenExchangeUrl.value = st.tokenExchangeUrl || "";
  els.internalToken.value = st.internalToken || "";
}
init();

els.saveOAuth.addEventListener("click", async () => {
  await setState({
    oauthClientId: els.oauthClientId.value.trim(),
    oauthAuthUrl: els.oauthAuthUrl.value.trim(),
    tokenExchangeUrl: els.tokenExchangeUrl.value.trim()
  });
  els.oauthStatus.textContent = "Saved OAuth settings";
});

els.beginAuth.addEventListener("click", async () => {
  const cid = els.oauthClientId.value.trim();
  const aurl = els.oauthAuthUrl.value.trim();
  const tex = els.tokenExchangeUrl.value.trim();
  await setState({ oauthClientId: cid, oauthAuthUrl: aurl, tokenExchangeUrl: tex });
  const start = await chrome.runtime.sendMessage({ type: "auth.begin" });
  if (!start?.ok) { els.oauthStatus.textContent = start?.error || "Failed to start auth"; els.oauthStatus.className = "error"; return; }
  const exchanged = await chrome.runtime.sendMessage({ type: "auth.exchange", code: start.code, redirect_uri: start.redirect_uri });
  if (!exchanged?.ok) { els.oauthStatus.textContent = exchanged?.error || "Token exchange failed"; els.oauthStatus.className = "error"; return; }
  els.oauthStatus.textContent = "Connected to Notion ✅";
  await refreshDbs();
});

els.saveInternal.addEventListener("click", async () => {
  const token = els.internalToken.value.trim();
  await setState({ internalToken: token, notionAuth: null });
  els.intStatus.textContent = token ? "Internal token saved" : "Cleared";
});

els.refreshDbs.addEventListener("click", async () => {
  await refreshDbs();
});

async function refreshDbs() {
  els.dbList.innerHTML = "Loading...";
  const resp = await chrome.runtime.sendMessage({ type: "notion.searchDatabases" });
  if (!resp?.ok) { els.dbStatus.textContent = resp?.error || "Failed to list databases"; els.dbList.innerHTML = ""; return; }
  const dbs = resp.data;
  els.dbList.innerHTML = "";
  if (!dbs.length) {
    els.dbList.textContent = "No databases found. Ensure you've shared a database with this integration.";
    return;
  }
  for (const db of dbs) {
    const div = document.createElement("div");
    div.className = "db";
    div.textContent = `${db.title} (${db.id.slice(0,8)}…)`;
    div.addEventListener("click", async () => {
      await setState({ database_id: db.id, database_title: db.title });
      await chrome.runtime.sendMessage({ type: "notion.setDatabase", database_id: db.id });
      els.dbStatus.textContent = `Selected: ${db.title}`;
      // Visual selection
      document.querySelectorAll(".db").forEach(el => el.classList.remove("selected"));
      div.classList.add("selected");
    });
    els.dbList.appendChild(div);
  }
}
