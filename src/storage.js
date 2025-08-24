
export async function getState(keys = null) {
  return await chrome.storage.sync.get(keys || null);
}

export async function setState(obj) {
  return await chrome.storage.sync.set(obj);
}

export function onChanged(callback) {
  chrome.storage.onChanged.addListener(callback);
}
