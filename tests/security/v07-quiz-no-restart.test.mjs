/**
 * Vector V-07 ONLY: quiz automation must not restart attempt (back to question 1).
 */
import { CONTENT_VERSION, readContentBundle } from "./_read.mjs";

const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(content.includes("quizSession"), "quiz session state exists");
assert(content.includes("lockRestartUntil"), "restart lock exists");
assert(content.includes("quizHasCorrection"), "waits for correction before continue");
assert(content.includes("clickQuizAction"), "exact quiz button matching");
assert(!content.includes('clickByLabel(["fazer o quiz", "refazer o quiz"])'), "must not auto-click Refazer");
assert(content.includes("clickFazerQuiz") || content.includes('label !== "fazer o quiz"'), "only exact Fazer o quiz");
assert(!/clickByLabel\(\["fazer o quiz"\]\)/.test(content), "includes()-match would also hit Refazer");
assert(content.includes("advanceQuiz()"), "observer advances in-quiz");
assert(!/observer[\s\S]{0,400}startQuizIfReady\(/.test(content), "observer must not call startQuizIfReady");
assert(content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) || content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`), "content version bumped");

console.log("PASS v07-quiz-no-restart");
