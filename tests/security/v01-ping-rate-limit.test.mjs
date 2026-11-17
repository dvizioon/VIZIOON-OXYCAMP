/**
 * Vector V-01 ONLY: server must reject progress that advances faster than wall-clock.
 * Run: node tests/security/v01-ping-rate-limit.test.mjs
 */

function simulateServerPing({ lastPos, lastAt, posicao, now, slackSec = 8 }) {
  if (typeof posicao !== "number" || posicao < 0) return { ok: false, reason: "invalid" };
  if (posicao < lastPos) return { ok: true, assistido: lastPos, videoOk: false, note: "rewind allowed" };
  const elapsed = (now - lastAt) / 1000;
  const maxAllowed = lastPos + elapsed + slackSec;
  if (posicao > maxAllowed) {
    return { ok: false, assistido: lastPos, videoOk: false, reason: "rate_exceeded" };
  }
  const assistido = posicao;
  return { ok: true, assistido, videoOk: false };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const t0 = 1_000_000;
let lastPos = 0;
let lastAt = t0;

// Honest watch: +10s position after 10s wall → accept
{
  const r = simulateServerPing({ lastPos, lastAt, posicao: 10, now: t0 + 10_000 });
  assert(r.ok, "honest ping should pass");
  lastPos = r.assistido;
  lastAt = t0 + 10_000;
}

// Attack: jump +600s after only 2s wall → reject
{
  const r = simulateServerPing({ lastPos, lastAt, posicao: 610, now: lastAt + 2_000 });
  assert(!r.ok && r.reason === "rate_exceeded", "forged jump must fail");
}

console.log("PASS v01-ping-rate-limit");
