/**
 * Vector V-15: multi-provider AI (OpenRouter/Gemini/Groq), video extract tab, Dvizioon hacker UI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_SCRIPTS, readBackgroundBundle, readContentBundle, root } from "./_read.mjs";

const html = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const css = readFileSync(join(root, "extension/popup/popup.css"), "utf8");
const providers = readFileSync(join(root, "extension/shared/providers.js"), "utf8");
const ai = readFileSync(join(root, "extension/background/ai.js"), "utf8");
const manifest = readFileSync(join(root, "extension/manifest.json"), "utf8");
const content = readContentBundle();
const bg = readBackgroundBundle();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes("Dvizioon"), "brand by Dvizioon in popup");
assert(html.includes('data-tab="ai"') && html.includes('data-tab="video"'), "AI + VIDEO tabs");
assert(html.includes("aiProvider") && html.includes("gemini") && html.includes("groq"), "provider select");
assert(html.includes("providerSite"), "link to provider site");
assert(html.includes("youtubeId") && html.includes("dlCobalt"), "video id + download helpers");
assert(!html.includes("bloqueado pelo Google"), "no verbose download disclaimer");
assert(!html.includes("download_helpers"), "no fake terminal section labels");
assert(css.includes("scanlines") || css.includes("--accent"), "hacker styling");
assert(providers.includes("openrouter") && providers.includes("gemini") && providers.includes("groq"), "providers catalog");
assert(ai.includes("solveGemini") && ai.includes("solveGroq") && ai.includes("solveQuiz"), "multi-provider solver");
assert(manifest.includes("generativelanguage.googleapis.com") && manifest.includes("api.groq.com"), "host perms");
assert(content.includes("getVideoInfo") && content.includes("youtubeId"), "content extracts YT id");
assert(CONTENT_SCRIPTS.includes("content/video.js"), "video module registered");
assert(bg.includes("solveQuiz"), "background uses solveQuiz");
assert(/"version":\s*"0\.[5-9]\./.test(manifest), "version 0.5+");

console.log("PASS v15-multi-ai-video-hacker-ui");
