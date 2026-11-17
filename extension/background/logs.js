export function pushLog(text, level = "info") {
  return chrome.storage.local.get(["logs"]).then(({ logs = [] }) => {
    const next = [{ t: Date.now(), level, text }, ...logs].slice(0, 200);
    return chrome.storage.local.set({ logs: next });
  });
}
