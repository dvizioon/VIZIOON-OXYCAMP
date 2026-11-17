/**
 * Vector V-06b ONLY: popup must reinject modular scripts when content missing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_SCRIPTS, PAGE_SCRIPTS, readContentBundle, readUnlock, root } from "./_read.mjs";

const popup = readFileSync(join(root, "extension/popup/popup.js"), "utf8");
const content = readContentBundle();
const unlock = readUnlock();
const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(manifest.permissions.includes("scripting"), "needs scripting permission");
assert(popup.includes("executeScript"), "popup reinjects via executeScript");
assert(popup.includes("CONTENT_SCRIPTS") || popup.includes("PAGE_SCRIPTS"), "popup uses shared script paths");
assert(popup.includes("ping(tab") || popup.includes('type: "ping"'), "popup pings tab");
assert(content.includes('msg?.type === "ping"'), "content answers ping");
assert(content.includes("__oxycampContentVersion"), "content versioned reinject");
assert(unlock.includes("__oxycampPageUnlockVersion"), "page-unlock versioned reinject");
assert(CONTENT_SCRIPTS.length >= 5, "content is split into modules");
assert(PAGE_SCRIPTS.includes("page/unlock.js"), "page unlock path registered");

console.log("PASS v06b-popup-reinject");
