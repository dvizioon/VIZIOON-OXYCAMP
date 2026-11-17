/**
 * Vector V-19: provider keys saved in chrome.storage.local + popup smoke-test ask.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readBackgroundBundle, root } from "./_read.mjs";

const html = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const popup = readFileSync(join(root, "extension/popup/popup.js"), "utf8");
const ai = readFileSync(join(root, "extension/background/ai.js"), "utf8");
const bg = readBackgroundBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes("saveKey") && html.includes("clearKey"), "save/clear key buttons");
assert(html.includes("testAsk") && html.includes("testPrompt"), "provider test ask UI");
assert(popup.includes("chrome.storage.local.set") && popup.includes("keyStorageKey"), "persists key");
assert(popup.includes("askProvider"), "popup calls askProvider");
assert(ai.includes("export async function askProvider"), "askProvider exported");
assert(bg.includes("askProvider"), "background handles askProvider");
assert(html.includes("testMaxTokens") || popup.includes("aiMaxTokens"), "token limit");

console.log("PASS v19-provider-key-storage-test-ask");
