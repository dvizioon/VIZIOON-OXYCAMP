/** Bridge: encontra/abre aba chatgpt.com logada e pede texto via DOM. */

const CHATGPT_URLS = ["https://chatgpt.com/*", "https://chat.openai.com/*"];
const BRIDGE_FILE = "content/chatgpt-bridge.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitTabComplete(tabId, maxMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.status === "complete") return tab;
    await sleep(400);
  }
  return chrome.tabs.get(tabId).catch(() => null);
}

const BRIDGE_MIN_VERSION = 8;

async function pingBridge(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "CHATGPT_PING" });
    if (!res?.ok) return { ok: false, version: 0 };
    return { ok: true, version: Number(res.version) || 1 };
  } catch (_) {
    return { ok: false, version: 0 };
  }
}

async function injectBridge(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [BRIDGE_FILE],
  });
  await sleep(250);
}

export async function ensureChatGptTab({ openIfMissing = true } = {}) {
  let tabs = await chrome.tabs.query({ url: CHATGPT_URLS });
  let tab = tabs.find((t) => /chatgpt\.com|chat\.openai\.com/i.test(t.url || "")) || tabs[0];

  if (!tab && openIfMissing) {
    tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: false });
    await waitTabComplete(tab.id);
    await sleep(2500);
  }
  if (!tab?.id) throw new Error("ChatGPT: nenhuma aba aberta — abra chatgpt.com e faça login");

  let ping = await pingBridge(tab.id);
  if (!ping.ok || ping.version < BRIDGE_MIN_VERSION) {
    await injectBridge(tab.id);
    ping = await pingBridge(tab.id);
    if (!ping.ok) {
      throw new Error("ChatGPT: bridge não carregou — recarregue a aba do ChatGPT");
    }
  }
  return tab;
}

export async function askChatGpt(prompt, { timeoutMs = 60000 } = {}) {
  const tab = await ensureChatGptTab({ openIfMissing: true });
  const askPromise = chrome.tabs.sendMessage(tab.id, {
    type: "CHATGPT_ASK",
    prompt: String(prompt || ""),
  });
  const timeout = sleep(timeoutMs).then(() => {
    throw new Error("ChatGPT: timeout esperando a aba");
  });
  const res = await Promise.race([askPromise, timeout]);
  if (!res?.ok) throw new Error(res?.error || "ChatGPT: falha na aba");
  return String(res.text || "");
}

export async function diagnoseChatGpt() {
  const tab = await ensureChatGptTab({ openIfMissing: true });
  const res = await chrome.tabs.sendMessage(tab.id, { type: "CHATGPT_DIAG" });
  if (!res?.ok && res?.error) throw new Error(res.error);
  return res;
}
