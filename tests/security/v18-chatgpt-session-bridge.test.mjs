/**
 * Vector V-18: ChatGPT provider uses logged-in chatgpt.com tab via DOM bridge
 * (no API key / no cookie scraping).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readBackgroundBundle, root } from "./_read.mjs";

const providers = readFileSync(join(root, "extension/shared/providers.js"), "utf8");
const bridge = readFileSync(join(root, "extension/content/chatgpt-bridge.js"), "utf8");
const chatgptBg = readFileSync(join(root, "extension/background/chatgpt.js"), "utf8");
const ai = readFileSync(join(root, "extension/background/ai.js"), "utf8");
const manifest = readFileSync(join(root, "extension/manifest.json"), "utf8");
const html = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const bg = readBackgroundBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(providers.includes("chatgpt") && providers.includes("needsKey: false"), "chatgpt provider no key");
assert(bridge.includes("CHATGPT_ASK"), "ask message");
assert(bridge.includes("/api/auth/session") && bridge.includes("/backend-api/conversation"), "ChatGPTBox-style web API");
assert(bridge.includes("askViaWebApi") && bridge.includes("askViaDom"), "webapi + DOM fallback");
assert(bridge.includes("Oai-Device-Id") || bridge.includes("oai-did"), "device id like ChatGPTBox");
assert(bridge.includes("waitForUserEcho"), "DOM confirms send before waiting reply");
assert(bridge.includes("waitForNewAssistant") && bridge.includes("allAssistantTexts"), "reads new assistant turn");
assert(bridge.includes("waitForReplyMainText") && bridge.includes("mainPlainText"), "shell-novo via main.innerText");
assert(bridge.includes("data-response-body") && bridge.includes("lastChatGptSaidBlock"), "parses response-body / ChatGPT said");
assert(bridge.includes("BRIDGE_VERSION = 8"), "bridge v8 clean turn extract");
assert(bridge.includes("prompt-textarea"), "DOM selectors kept");
assert(chatgptBg.includes("ensureChatGptTab") && chatgptBg.includes("askChatGpt"), "background tab relay");
assert(chatgptBg.includes("BRIDGE_MIN_VERSION = 8"), "reinjects bridge >= 8");
assert(ai.includes('provider === "chatgpt"') && ai.includes("solveChatGpt"), "solver routes to chatgpt");
assert(manifest.includes("chatgpt.com") && manifest.includes("chatgpt-bridge.js"), "manifest hosts + script");
assert(html.includes('value="chatgpt"'), "popup provider option");
assert(bg.includes("askChatGpt") || bg.includes("ensureChatGptTab"), "bg bundle includes bridge");

console.log("PASS v18-chatgpt-session-bridge");
