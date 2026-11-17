/**
 * Vector V-08 ONLY: next-lesson navigation must only walk forward after .atual.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_VERSION, readContentBundle, root } from "./_read.mjs";

const content = readContentBundle();
const api = readFileSync(join(root, "docs/api.txt"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.includes('"ordem": 0') && api.includes('"ordem": 1'), "api snapshot has ordered aulas");
assert(api.includes('"concluida": true'), "aula 1 can be concluida while aula 2 is current");
assert(content.includes("atualIdx + 1"), "walks forward from current index");
assert(!content.includes('querySelector("ol.lista li:not(.travada):not(.atual) a")'), "old buggy selector removed");
assert(content.includes("isLessonDone"), "requires current lesson done before leaving");
assert(
  content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) || content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`),
  `content version ${CONTENT_VERSION}`
);
assert(content.includes("isDisabled"), "skips disabled Verificar spam");
assert(content.includes("__oxycampContentGen"), "generation kill-switch for old injects");

console.log("PASS v08-next-lesson-forward-only");
