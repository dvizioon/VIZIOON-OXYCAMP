/**
 * Vector V-10 ONLY: Seek Fim must credit via stepped pings using server assistido
 * (single jump to duration is rejected — "Continue a partir de X").
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const unlock = readFileSync(join(root, "extension/page/unlock.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(/VERSION = [67]/.test(unlock), "page-unlock v6+");
assert(unlock.includes("creditRunning"), "tracks credit crawl state");
assert(unlock.includes("creditTo"), "creditTo handles stepped pings");
assert(unlock.includes("creditBy"), "creditBy adds watch minutes");
assert(unlock.includes("creditProgress"), "reports progress for popup bar");
assert(unlock.includes("fetchAula"), "reads assistido from GET aula");
assert(unlock.includes("silencePlayerAvisar"), "blocks Angular avisar during credit");
assert(/while\s*\(\s*credited\s*<\s*goal/.test(unlock), "loops until goal credited");
assert(unlock.includes("body.videoOk"), "stops when server sets videoOk");
assert(unlock.includes("wall + slack"), "uses wall-clock + slack budget");

const creditTo = unlock.slice(unlock.indexOf("async function creditTo"), unlock.indexOf("async function creditBy"));
assert(creditTo.includes("forcePing(target, dur"), "pings intermediate targets");
assert(creditTo.includes("assistido"), "uses response.assistido");
assert(creditTo.includes("slack"), "adapts slack from server caps");

console.log("PASS v10-incremental-ping-credit");
