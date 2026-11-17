/**
 * Vector V-13 ONLY: popup watch credits (+10s/+1m/+10m/custom) + progress bar.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readContentBundle, readUnlock, root } from "./_read.mjs";

const popupHtml = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const popupJs = readFileSync(join(root, "extension/popup/popup.js"), "utf8");
const unlock = readUnlock();
const content = readContentBundle();
const bg = readFileSync(join(root, "extension/background/index.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!popupHtml.includes("seekEnd") && !popupHtml.includes(">Fim<"), "Fim button removed");
assert(popupHtml.includes("watch10s") && popupHtml.includes("watch1m") && popupHtml.includes("watch10m"), "preset watch buttons");
assert(popupHtml.includes("creditMinutes") && popupHtml.includes("watchCustom"), "custom minutes input");
assert(popupHtml.includes("creditFill") && popupHtml.includes("progress-bar"), "progress bar in popup");
assert(popupJs.includes('type: "creditBy"'), "popup sends creditBy");
assert(popupJs.includes("renderCredit"), "popup renders credit progress");
assert(unlock.includes("creditBy") && unlock.includes("reportCredit"), "page credits + reports");
assert(content.includes("creditProgress"), "content forwards progress");
assert(bg.includes("creditProgress"), "background stores progress");

console.log("PASS v13-watch-credit-progress-ui");
