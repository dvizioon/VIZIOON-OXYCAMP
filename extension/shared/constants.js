/** Shared constants (ESM — background + popup). Keep CONTENT_VERSION in sync with content/version.js */
export const CONTENT_VERSION = 18;
export const EXTENSION_VERSION = "0.6.11";
export const DEFAULT_AI_MAX_TOKENS = 512;
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_PROVIDER = "openrouter";
export const MODELS_CACHE_MS = 12 * 60 * 60 * 1000;
export const HOST_RE = /^https:\/\/oxyeducorp\.oxygeni\.com\.br\//i;
export const BRAND = "Dvizioon";

export const DEFAULT_STATE = {
  enabled: true,
  autoPresence: true,
  antiBlur: true,
  autoPlay: true,
  autoModules: true,
  autoQuiz: false,
  freeSeek: true,
  aiQuiz: true,
  aiProvider: DEFAULT_PROVIDER,
  openrouterKey: "",
  openrouterModel: DEFAULT_MODEL,
  openrouterModels: [],
  openrouterModelsAt: 0,
  geminiKey: "",
  geminiModel: "gemini-2.0-flash",
  groqKey: "",
  groqModel: "llama-3.3-70b-versatile",
  creditMinutes: 10,
  aiMaxTokens: DEFAULT_AI_MAX_TOKENS,
  creditProgress: null,
  logs: [],
};

export const TOGGLE_KEYS = [
  "enabled",
  "autoPresence",
  "antiBlur",
  "autoPlay",
  "autoModules",
  "autoQuiz",
  "freeSeek",
  "aiQuiz",
];
