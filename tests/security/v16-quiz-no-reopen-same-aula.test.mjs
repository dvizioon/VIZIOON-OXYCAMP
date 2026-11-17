/**
 * Vector V-16: after starting quiz on an aula, going back to the video
 * must NOT auto-click quiz again — esp. "refazer o quiz" must not match "fazer o quiz".
 */
import { CONTENT_VERSION, readContentBundle } from "./_read.mjs";

const content = readContentBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(content.includes("aulaIdFromUrl"), "reads aula id from hash");
assert(content.includes("quizAlreadyStartedHere"), "blocks re-entry after quiz started");
assert(content.includes("quizSession.aulaId"), "quiz session tracks aulaId");
assert(content.includes("aulaId && aulaId === lastAulaId"), "same-aula hash change keeps session");
assert(/if \(O\.quizAlreadyStartedHere\(\)\) return false/.test(content), "startQuizIfReady respects already-started");
assert(content.includes("clickFazerQuiz"), "exact-match starter for fazer o quiz");
assert(content.includes('label !== "fazer o quiz"'), "must exact-match, not includes()");
assert(
  !/clickByLabel\(\["fazer o quiz"\]\)/.test(content),
  "must not use includes()-based clickByLabel for fazer o quiz (hits refazer)"
);
assert(
  !/startedOnce && Date\.now\(\) < O\.quizSession\.lockRestartUntil/.test(content),
  "must not allow re-start after lock expires on same aula"
);
assert(
  content.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`) ||
    content.includes(`O.CONTENT_VERSION = ${CONTENT_VERSION}`),
  "content version bumped"
);

console.log("PASS v16-quiz-no-reopen-same-aula");
