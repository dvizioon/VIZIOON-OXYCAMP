/**
 * Vector V-04 ONLY: quiz gabarito can be present on the client (CSS class / admin hint).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readContentBundle, root } from "./_read.mjs";

const player = readFileSync(join(root, "docs/chunk-4PKINWVF.js"), "utf8");
const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(player.includes("gabarito?.includes(t)") || player.includes("gabarito?.includes(t)"), "estadoOpcao leaks gabarito into CSS class");
assert(player.includes('" gabarito"') || player.includes(".caixa.gabarito"), "gabarito class string present");
assert(player.includes("gabaritoAdmin"), "admin gabarito renderer exists");
assert(player.includes("app-quiz-jogo"), "quiz component exists");
assert(content.includes("selectGabaritoOptions"), "extension consumes gabarito class");
assert(content.includes("autoModules"), "extension has module advance flag");
assert(content.includes("fazer o quiz"), "extension starts quiz after video");

console.log("PASS v04-gabarito-leaked-in-client");
