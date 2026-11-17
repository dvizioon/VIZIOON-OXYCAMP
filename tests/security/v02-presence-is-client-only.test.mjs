/**
 * Vector V-02 ONLY: presence confirmation has no dedicated API in the client bundle.
 * Evidence from docs/chunk-BVQJ3B6M.js + docs/chunk-4PKINWVF.js.
 * Run: node tests/security/v02-presence-is-client-only.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const api = readFileSync(join(root, "docs/chunk-BVQJ3B6M.js"), "utf8");
const player = readFileSync(join(root, "docs/chunk-4PKINWVF.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.includes("ping(r,t,n)"), "API must expose ping");
assert(!/presenca|presence/i.test(api), "API client must not expose presence endpoint");
assert(player.includes("confirmarPresenca()"), "player has client-side presence confirm");
assert(player.includes("perguntarPresenca()"), "player asks presence locally");
assert(
  !player.includes("api.") || !/api\.\w*presenca/i.test(player),
  "confirmPresence must not call api.*presenca"
);

console.log("PASS v02-presence-is-client-only");
