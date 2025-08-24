
import { getState, setState } from "./src/storage.js";

const projectInput = document.getElementById("project");
const saveBtn = document.getElementById("saveProject");
const openOptions = document.getElementById("openOptions");
const statusEl = document.getElementById("status");
const dbEl = document.getElementById("db");

async function init() {
  const st = await getState(["projectName", "database_id", "database_title"]);
  projectInput.value = st.projectName || "General";
  dbEl.textContent = st.database_title ? `Database: ${st.database_title}` : "No database selected";
}
init();

saveBtn.addEventListener("click", async () => {
  const projectName = projectInput.value.trim() || "General";
  await setState({ projectName });
  showStatus(`Project set to "${projectName}"`, true);
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function showStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.className = `status ${ok ? "ok" : "err"}`;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "lastSave") {
    showStatus(msg.ok ? "Saved to Notion" : ("Failed: " + msg.error), msg.ok);
  }
});
