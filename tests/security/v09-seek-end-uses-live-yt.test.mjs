/**
 * Vector V-09 ONLY: seek-end must not postMessage into same-origin iframes.
 */
import { readContentBundle, readUnlock } from "./_read.mjs";

const unlock = readUnlock();
const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(unlock.includes("isLiveYtIframe"), "detects live cross-origin YT iframe");
assert(unlock.includes("clickBarRatio"), "DOM barra fallback");
assert(unlock.includes("forcePing"), "pings /api/.../ping on seek end");
assert(/VERSION = [4567]/.test(unlock), "page-unlock v4+");
assert(content.includes(".contador"), "quiz progress reads .contador only");
assert(!content.includes("textOf(root).match(/(\\d+)\\s*\\/\\s*(\\d+)/)"), "no full-root progress regex");

console.log("PASS v09-seek-end-uses-live-yt");
