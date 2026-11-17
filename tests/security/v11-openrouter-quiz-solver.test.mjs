/**
 * Vector V-11 ONLY: quiz can be solved via OpenRouter (DOM question → indices → click).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_VERSION, readBackgroundBundle, readContentBundle, root } from "./_read.mjs";

const bg = readBackgroundBundle();
const content = readContentBundle();
const popup = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const manifest = readFileSync(join(root, "extension/manifest.json"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(manifest.includes("openrouter.ai"), "manifest hosts openrouter");
assert(bg.includes("solveWithOpenRouter"), "background calls OpenRouter");
assert(bg.includes("solveQuiz") || bg.includes('"solveQuiz"'), "handles solveQuiz message");
assert(bg.includes("SYSTEM_PROMPT"), "prompt instructs JSON indices");
assert(content.includes("selectWithOpenRouter"), "content uses AI picker");
assert(content.includes("readQuizQuestion"), "reads tipo/enunciado/opcoes from DOM");
assert(content.includes("applyAiIndices"), "clicks AI indices");
assert(content.includes('type: "solveQuiz"'), "asks background to solve");
assert(popup.includes("aiKey") || popup.includes("openrouterKey"), "popup stores API key");
assert(popup.includes("aiQuiz"), "popup toggle for AI quiz");
assert(
  content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) || content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`),
  `content v${CONTENT_VERSION}`
);

console.log("PASS v11-openrouter-quiz-solver");
