/**
 * Vector V-03 ONLY: blur/visibility pause is client-only and resumeable via DOM.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readContentBundle, root } from "./_read.mjs";

const player = readFileSync(join(root, "docs/chunk-4PKINWVF.js"), "utf8");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(player.includes('addEventListener("visibilitychange"'), "registers visibilitychange");
assert(player.includes('addEventListener("blur"'), "registers window blur");
assert(player.includes("pausarPor("), "pauses via pausarPor");
assert(html.includes('aria-label="Reproduzir"'), "play control exists in saved UI");
assert(html.includes("motivo-pausa"), "pause reason UI exists");
assert(content.includes("resumeIfPaused"), "extension resumes after pause");
assert(content.includes('document, "hidden"'), "extension overrides document.hidden");

console.log("PASS v03-blur-pause-bypassable");
