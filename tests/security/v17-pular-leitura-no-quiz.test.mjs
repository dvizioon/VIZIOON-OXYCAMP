/**
 * Vector V-17: without Abrir quiz, automation must stay on the current aula
 * (no auto-nav / no Pular leitura UI forcing page changes).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_VERSION, readContentBundle, root } from "./_read.mjs";

const content = readContentBundle();
const html = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const popup = readFileSync(join(root, "extension/popup/popup.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(content.includes("autoQuiz"), "autoQuiz gate exists");
assert(/if\s*\(\s*!O\.settings\.autoQuiz\s*\)\s*return/.test(content), "nav/advance bail when autoQuiz off");
assert(content.includes("hasFazerQuizButton"), "blocks next lesson while quiz button exists");
assert(
  content.includes("Roda no quiz já aberto mesmo com Abrir quiz off"),
  "advanceQuiz runs without Abrir quiz (Quiz com IA no quiz aberto)"
);
assert(
  /O\.advanceQuiz = function advanceQuiz\(\) \{[\s\S]*?if \(!O\.settings\.enabled\) return false/.test(content),
  "advanceQuiz gated only by enabled"
);
assert(html.includes('id="aiQuiz"') && html.includes('id="panel-ops"'), "Quiz com IA toggle in popup");
assert(
  /panel-ops[\s\S]*id="aiQuiz"[\s\S]*panel-ai/.test(html.replace(/\s+/g, " ")),
  "Quiz com IA fica na página Ops (inicial)"
);
assert(!html.includes("pularLeitura") && !html.includes("Pular leitura"), "no Pular leitura UI");
assert(!popup.includes("pularLeitura"), "popup does not start pular leitura");
assert(!content.includes('type === "pularLeitura"'), "content does not expose pularLeitura message");
assert(
  content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) ||
    content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`),
  "content version bumped"
);

console.log("PASS v17-pular-leitura-no-quiz");
