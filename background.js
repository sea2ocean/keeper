
import { NotionClient } from "./src/notionClient.js";
import { getState, setState, onChanged } from "./src/storage.js";
import { buildAuthUrl, parseRedirectFragmentOrQuery } from "./src/oauth.js";

// Initialize context menu on install
chrome.runtime.onInstalled.addListener(async (details) => {
  // Context menu only shows when there is a selection
  chrome.contextMenus.create({
    id: "save-selection-to-notion",
    title: "Save selection to Notion",
    contexts: ["selection"]
  });
  // Open onboarding
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-selection-to-notion") return;
  const selectionText = info.selectionText?.trim();
  if (!selectionText) return;
  await saveSelection(selectionText, info.pageUrl, tab?.title || "");
});

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-selection-to-notion") {
    // Execute a content script in the active tab to get the selection text
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) return;
    try {
      const [{result}] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => window.getSelection()?.toString() || ""
      });
      const selectionText = (result || "").trim();
      if (!selectionText) return;
      await saveSelection(selectionText, tab.url || "", tab.title || "");
    } catch (e) {
      console.error(e);
    }
  }
});

// Listen for messages from popup/options
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "auth.begin") {
      const state = crypto.randomUUID();
      const redirectUri = chrome.identity.getRedirectURL("notion");
      const { oauthClientId, oauthAuthUrl } = await getState(["oauthClientId", "oauthAuthUrl"]);
      if (!oauthClientId || !oauthAuthUrl) {
        sendResponse({ ok: false, error: "Missing oauthClientId or oauthAuthUrl in settings." });
        return;
      }
      const url = buildAuthUrl({ client_id: oauthClientId, redirect_uri: redirectUri, auth_url: oauthAuthUrl, state });
      const interactive = true;
      try {
        const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive });
        const { code, received_state, error } = parseRedirectFragmentOrQuery(redirect);
        if (error) {
          sendResponse({ ok: false, error });
          return;
        }
        if (received_state !== state) {
          sendResponse({ ok: false, error: "State mismatch." });
          return;
        }
        sendResponse({ ok: true, code, redirect_uri: redirectUri });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true; // keep channel open
    }
    if (msg.type === "auth.exchange") {
      const { code, redirect_uri } = msg;
      const { tokenExchangeUrl, oauthClientId } = await getState(["tokenExchangeUrl", "oauthClientId"]);
      if (!tokenExchangeUrl) {
        sendResponse({ ok: false, error: "Missing tokenExchangeUrl. Configure in Options." });
        return;
      }
      try {
        const res = await fetch(`${tokenExchangeUrl}/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirect_uri, client_id: oauthClientId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        await setState({ notionAuth: data });
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
    if (msg.type === "notion.searchDatabases") {
      try {
        const client = await makeClient();
        const dbs = await client.listDatabases();
        sendResponse({ ok: true, data: dbs });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
    if (msg.type === "notion.setDatabase") {
      const { database_id } = msg;
      (await setState({ database_id }));
      // cache title prop
      try {
        const client = await makeClient();
        const schema = await client.getDatabaseSchema(database_id);
        await setState({ title_prop: schema.titlePropertyName });
      } catch {}
      sendResponse({ ok: true });
      return true;
    }
  })();
  return true;
});

async function makeClient() {
  const { notionAuth, internalToken } = await getState(["notionAuth", "internalToken"]);
  const token = internalToken || notionAuth?.access_token;
  if (!token) throw new Error("Not connected to Notion. Open Options to sign in or set an internal token.");
  return new NotionClient({ token });
}

// Core save routine
async function saveSelection(selectionText, pageUrl, pageTitle) {
  const st = await getState(["database_id", "projectName"]);
  if (!st.database_id) {
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Notion Highlighter",
      message: "No Notion database selected. Open the extension Options."
    });
    return;
  }
  try {
    const client = await makeClient();
    const nowIso = new Date().toISOString();
    const project = st.projectName || "General";
    const resp = await client.createHighlight({
      database_id: st.database_id,
      content: selectionText,
      url: pageUrl,
      date: nowIso,
      project,
      titleHint: pageTitle
    });
    console.log("Saved to Notion:", resp.id);
    try{
      await chrome.runtime.sendMessage({ type: "lastSave", ok: true, id: resp.id });
    }catch(e){
      // No active receiver (popup/options closed). Safe to ignore.
    }
  } catch (e) {
    console.error(e);
    try {
      await chrome.runtime.sendMessage({ type: "lastSave", ok: false, error: String(e) });
    } catch (error) {
      // No active receiver (popup/options closed). Safe to ignore.
    }
  }
}
