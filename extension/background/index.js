import { DEFAULT_STATE } from "../shared/constants.js";
import { pushLog } from "./logs.js";
import { askProvider, listModels, solveQuiz } from "./ai.js";
import { diagnoseChatGpt, ensureChatGptTab } from "./chatgpt.js";

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULT_STATE, ...cur, logs: cur.logs || [] });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "log") {
    pushLog(msg.text, msg.level || "info").then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "getState") {
    chrome.storage.local.get(null).then((s) => sendResponse(s));
    return true;
  }
  if (msg?.type === "setState") {
    chrome.storage.local.set(msg.patch || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "solveQuiz") {
    solveQuiz(msg.question || {})
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  if (msg?.type === "listModels") {
    listModels({ force: !!msg.force, provider: msg.provider })
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err), models: [] }));
    return true;
  }
  if (msg?.type === "openChatGpt") {
    ensureChatGptTab({ openIfMissing: true })
      .then((tab) => sendResponse({ ok: true, tabId: tab?.id }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  if (msg?.type === "diagnoseChatGpt") {
    diagnoseChatGpt()
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  if (msg?.type === "askProvider") {
    askProvider(msg.prompt || "", { maxTokens: msg.maxTokens })
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  if (msg?.type === "creditProgress") {
    chrome.storage.local
      .set({ creditProgress: msg.progress || null })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
