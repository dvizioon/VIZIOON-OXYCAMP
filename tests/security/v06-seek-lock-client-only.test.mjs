/**
 * Vector V-06 ONLY: seek lock is client-side; unlock runs in MAIN world.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readUnlock, root } from "./_read.mjs";

const player = readFileSync(join(root, "docs/chunk-4PKINWVF.js"), "utf8");
const unlock = readUnlock();
const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(player.includes("N\xE3o \xE9 poss\xEDvel adiantar o v\xEDdeo") || player.includes("adiantar o v"), "seek snap warning exists");
assert(player.includes("s\xF3 pode voltar ou rever") || player.includes("voltar ou rever"), "barra seek warning exists");
assert(player.includes("maximo()+1.5") || player.includes("maximo() + 1.5"), "vigil snaps when ahead of maximo");
assert(player.includes("avancoLivre"), "admin free-seek flag exists");
assert(unlock.includes("maximo.set") || unlock.includes("maximo?.set"), "unlock script raises maximo when cmp found");
assert(unlock.includes("youtube-nocookie") || unlock.includes("getIframe"), "unlock uses youtube iframe fallback");
assert(unlock.includes("command") && unlock.includes("seekTo"), "unlock can postMessage seekTo");
assert(unlock.includes("seekBy") || unlock.includes("function seekBy"), "unlock exposes seek helpers");
assert(
  manifest.content_scripts.some((c) => c.js?.includes("page/unlock.js") && c.world === "MAIN"),
  "page/unlock must run in MAIN world"
);

console.log("PASS v06-seek-lock-client-only");
