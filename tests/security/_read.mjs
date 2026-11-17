import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_SCRIPTS, PAGE_SCRIPTS } from "../../plugin/extension/shared/paths.js";
import { CONTENT_VERSION } from "../../plugin/extension/shared/constants.js";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function readExt(...parts) {
  return readFileSync(join(root, "extension", ...parts), "utf8");
}

export function readContentBundle() {
  return CONTENT_SCRIPTS.map((p) => readFileSync(join(root, "extension", p), "utf8")).join("\n");
}

export function readUnlock() {
  return PAGE_SCRIPTS.map((p) => readFileSync(join(root, "extension", p), "utf8")).join("\n");
}

export function readBackgroundBundle() {
  const dir = join(root, "extension/background");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

export { CONTENT_SCRIPTS, PAGE_SCRIPTS, CONTENT_VERSION };
