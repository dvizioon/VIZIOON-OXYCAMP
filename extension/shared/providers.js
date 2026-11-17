/** AI providers supported by the quiz solver */
export const AI_PROVIDERS = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    site: "https://openrouter.ai/keys",
    docs: "https://openrouter.ai/",
    keyLabel: "OpenRouter API key",
    keyPlaceholder: "sk-or-…",
    needsKey: true,
    defaultModel: "openai/gpt-4o-mini",
    models: null, // fetched live
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    site: "https://aistudio.google.com/apikey",
    docs: "https://ai.google.dev/",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza…",
    needsKey: true,
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", name: "gemini-2.0-flash" },
      { id: "gemini-2.0-flash-lite", name: "gemini-2.0-flash-lite" },
      { id: "gemini-2.5-flash", name: "gemini-2.5-flash" },
      { id: "gemini-2.5-pro", name: "gemini-2.5-pro" },
      { id: "gemini-1.5-flash", name: "gemini-1.5-flash" },
      { id: "gemini-1.5-pro", name: "gemini-1.5-pro" },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    site: "https://console.groq.com/keys",
    docs: "https://console.groq.com/",
    keyLabel: "Groq API key",
    keyPlaceholder: "gsk_…",
    needsKey: true,
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", name: "llama-3.3-70b-versatile" },
      { id: "llama-3.1-8b-instant", name: "llama-3.1-8b-instant" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "llama-4-scout-17b" },
      { id: "qwen/qwen3-32b", name: "qwen3-32b" },
      { id: "openai/gpt-oss-120b", name: "gpt-oss-120b" },
      { id: "moonshotai/kimi-k2-instruct", name: "kimi-k2-instruct" },
    ],
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT (aba)",
    site: "https://chatgpt.com/",
    docs: "https://chatgpt.com/",
    keyLabel: "Sessão no navegador",
    keyPlaceholder: "não precisa de key",
    needsKey: false,
    siteButton: "Abrir",
    defaultModel: "chatgpt-web",
    models: [{ id: "chatgpt-web", name: "ChatGPT (sessão logada)" }],
  },
};

export const PROVIDER_IDS = Object.keys(AI_PROVIDERS);
