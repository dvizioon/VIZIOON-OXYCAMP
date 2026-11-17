/**
 * Vector V-12 ONLY: extension is modular; OpenRouter models are fetched and filterable.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_SCRIPTS,
  CONTENT_VERSION,
  PAGE_SCRIPTS,
  readBackgroundBundle,
  root,
} from "./_read.mjs";

const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));
const bg = readBackgroundBundle();
const modelsUi = readFileSync(join(root, "extension/popup/models.js"), "utf8");
const popupHtml = readFileSync(join(root, "extension/popup/popup.html"), "utf8");
const constants = readFileSync(join(root, "extension/shared/constants.js"), "utf8");
const version = readFileSync(join(root, "extension/content/version.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(manifest.version.startsWith("0."), "semver release");
assert(manifest.background.service_worker === "background/index.js", "modular background entry");
assert(manifest.action.default_popup === "popup/popup.html", "popup under popup/");
assert(CONTENT_SCRIPTS.every((p) => manifest.content_scripts.some((c) => c.js?.includes(p))), "manifest lists all content modules");
assert(PAGE_SCRIPTS.every((p) => manifest.content_scripts.some((c) => c.js?.includes(p))), "manifest lists page unlock");
assert(bg.includes("listModels"), "background can list OpenRouter models");
assert(bg.includes("/api/v1/models"), "fetches OpenRouter models API");
assert(modelsUi.includes("renderFiltered"), "popup filters models");
assert(modelsUi.includes("loadModelsFromBackground"), "popup loads catalog from SW");
assert(popupHtml.includes("modelFilter"), "search input for models");
assert(popupHtml.includes("refreshModels"), "refresh models button");
assert(constants.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`), "shared constants version");
assert(version.includes(`CONTENT_VERSION = ${CONTENT_VERSION}`), "content version.js in sync");

console.log("PASS v12-modular-openrouter-models");
