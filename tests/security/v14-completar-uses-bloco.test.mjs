/**
 * Vector V-14 ONLY: tipo completar usa button.bloco no .banco (não .caixa).
 * Evidence: docs/api.txt HTML snapshot with data-tipo="completar".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_VERSION, readContentBundle, root } from "./_read.mjs";

const api = readFileSync(join(root, "docs/api.txt"), "utf8");
const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.includes('data-tipo="completar"'), "api snapshot has completar");
assert(api.includes('class="banco"') && api.includes('class="bloco"'), "completar options are .banco .bloco");
assert(api.includes('class="lacuna"'), "completar has lacuna blank");
assert(content.includes('tipo === "completar"'), "quiz code handles completar");
assert(content.includes(".banco button.bloco"), "reads blocos from banco");
assert(content.includes("usado-palavra"), "detects completar selection via usado-palavra");
assert(
  content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) ||
    content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`),
  `content v${CONTENT_VERSION}`
);

console.log("PASS v14-completar-uses-bloco");
