import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODELS_CACHE_MS } from "../shared/constants.js";
import { AI_PROVIDERS } from "../shared/providers.js";
import { askChatGpt } from "./chatgpt.js";
import { pushLog } from "./logs.js";

export const SYSTEM_PROMPT = `Você resolve questões de quiz de um curso online (português).
Responda APENAS JSON válido, sem markdown:
{"indices":[...],"reason":"frase curta"}

Regras por tipo:
- multipla | verdadeiro_falso | completar: indices com 1 índice (0-based) da opção correta
- marcar: indices com todas as corretas (use quantasCorretas se vier)
- ordenar: indices com TODOS os itens na ordem correta (primeiro → último)

Em completar, a frase traz a lacuna (___ / espaço em branco); escolha a palavra do banco (opcoes) que completa corretamente.
Não invente índices fora do intervalo. Se incerto, escolha a mais plausível.`;

export function extractJson(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch (_) {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  return null;
}

function questionUserContent(question) {
  const userPayload = {
    tipo: question.tipo,
    enunciado: question.enunciado,
    frase: question.frase || "",
    quantasCorretas: question.quantasCorretas ?? null,
    opcoes: question.opcoes,
  };
  return `Resolva esta questão e devolva só JSON:\n${JSON.stringify(userPayload, null, 2)}`;
}

function parseIndices(content, providerLabel, model) {
  const parsed = extractJson(content);
  const indices = Array.isArray(parsed?.indices)
    ? parsed.indices.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)
    : [];
  if (!indices.length) {
    return { ok: false, error: "resposta sem indices", raw: content };
  }
  return {
    ok: true,
    indices,
    reason: parsed?.reason || "",
    model,
    provider: providerLabel,
  };
}

function isTextModel(m) {
  const arch = m?.architecture || {};
  const modality = String(arch.modality || "").toLowerCase();
  const inputs = arch.input_modalities || [];
  const outputs = arch.output_modalities || [];
  if (modality.includes("text")) return true;
  if (inputs.includes?.("text") && outputs.includes?.("text")) return true;
  if (!modality && !inputs.length) return true;
  return false;
}

function normalizeModel(m) {
  return {
    id: m.id,
    name: m.name || m.id,
    context: m.context_length || 0,
    modality: m.architecture?.modality || "",
  };
}

export async function listModels({ force = false, provider } = {}) {
  const state = await chrome.storage.local.get(null);
  const prov = provider || state.aiProvider || DEFAULT_PROVIDER;
  const meta = AI_PROVIDERS[prov] || AI_PROVIDERS.openrouter;

  if (meta.models) {
    return { ok: true, models: meta.models, cached: true, count: meta.models.length, provider: prov };
  }

  // OpenRouter live catalog
  const cached = Array.isArray(state.openrouterModels) ? state.openrouterModels : [];
  const age = Date.now() - Number(state.openrouterModelsAt || 0);
  if (!force && cached.length && age < MODELS_CACHE_MS) {
    return { ok: true, models: cached, cached: true, count: cached.length, provider: "openrouter" };
  }

  const headers = {
    Accept: "application/json",
    "HTTP-Referer": "https://oxyeducorp.oxygeni.com.br/",
    "X-Title": "OxyCamp Auto QA",
  };
  const key = String(state.openrouterKey || "").trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const err = raw?.error?.message || raw?.error || `HTTP ${res.status}`;
    await pushLog(`OpenRouter models: ${err}`, "error");
    if (cached.length) {
      return { ok: true, models: cached, cached: true, stale: true, count: cached.length, provider: "openrouter" };
    }
    return { ok: false, error: String(err), models: [], provider: "openrouter" };
  }

  const list = (raw?.data || [])
    .filter(isTextModel)
    .map(normalizeModel)
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  await chrome.storage.local.set({ openrouterModels: list, openrouterModelsAt: Date.now() });
  await pushLog(`OpenRouter: ${list.length} modelos carregados`, "info");
  return { ok: true, models: list, cached: false, count: list.length, provider: "openrouter" };
}

async function solveOpenRouter(question, state) {
  const key = String(state.openrouterKey || "").trim();
  if (!key) return { ok: false, error: "Sem API key OpenRouter — pegue em openrouter.ai/keys" };
  const model = String(state.openrouterModel || DEFAULT_MODEL).trim();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://oxyeducorp.oxygeni.com.br/",
      "X-Title": "OxyCamp Auto QA",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: questionUserContent(question) },
      ],
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const err = raw?.error?.message || raw?.error || `HTTP ${res.status}`;
    await pushLog(`OpenRouter erro: ${err}`, "error");
    return { ok: false, error: String(err) };
  }
  const content = raw?.choices?.[0]?.message?.content || "";
  const parsed = parseIndices(content, "openrouter", model);
  if (!parsed.ok) {
    await pushLog(`OpenRouter sem indices: ${String(content).slice(0, 160)}`, "error");
    return parsed;
  }
  await pushLog(`OpenRouter ${model}: [${parsed.indices.join(",")}] ${parsed.reason}`.trim(), "info");
  return parsed;
}

async function solveGemini(question, state) {
  const key = String(state.geminiKey || "").trim();
  if (!key) return { ok: false, error: "Sem API key Gemini — pegue em aistudio.google.com/apikey" };
  const model = String(state.geminiModel || AI_PROVIDERS.gemini.defaultModel).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${questionUserContent(question)}` }],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const err = raw?.error?.message || raw?.error || `HTTP ${res.status}`;
    await pushLog(`Gemini erro: ${err}`, "error");
    return { ok: false, error: String(err) };
  }
  const content = raw?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  const parsed = parseIndices(content, "gemini", model);
  if (!parsed.ok) {
    await pushLog(`Gemini sem indices: ${String(content).slice(0, 160)}`, "error");
    return parsed;
  }
  await pushLog(`Gemini ${model}: [${parsed.indices.join(",")}] ${parsed.reason}`.trim(), "info");
  return parsed;
}

async function solveGroq(question, state) {
  const key = String(state.groqKey || "").trim();
  if (!key) return { ok: false, error: "Sem API key Groq — pegue em console.groq.com/keys" };
  const model = String(state.groqModel || AI_PROVIDERS.groq.defaultModel).trim();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: questionUserContent(question) },
      ],
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const err = raw?.error?.message || raw?.error || `HTTP ${res.status}`;
    await pushLog(`Groq erro: ${err}`, "error");
    return { ok: false, error: String(err) };
  }
  const content = raw?.choices?.[0]?.message?.content || "";
  const parsed = parseIndices(content, "groq", model);
  if (!parsed.ok) {
    await pushLog(`Groq sem indices: ${String(content).slice(0, 160)}`, "error");
    return parsed;
  }
  await pushLog(`Groq ${model}: [${parsed.indices.join(",")}] ${parsed.reason}`.trim(), "info");
  return parsed;
}

async function solveChatGpt(question) {
  const prompt = `${SYSTEM_PROMPT}\n\n${questionUserContent(question)}`;
  await pushLog("ChatGPT: pedindo na aba…", "warn");
  let content;
  try {
    content = await askChatGpt(prompt);
  } catch (err) {
    const msg = err?.message || String(err);
    await pushLog(`ChatGPT erro: ${msg}`, "error");
    return { ok: false, error: msg };
  }
  const parsed = parseIndices(content, "chatgpt", "chatgpt-web");
  if (!parsed.ok) {
    await pushLog(`ChatGPT sem indices: ${String(content).slice(0, 160)}`, "error");
    return parsed;
  }
  await pushLog(`ChatGPT: [${parsed.indices.join(",")}] ${parsed.reason}`.trim(), "info");
  return parsed;
}

/** Unified quiz solver — routes by aiProvider */
export async function solveQuiz(question) {
  const state = await chrome.storage.local.get(null);
  if (state.aiQuiz === false) return { ok: false, error: "aiQuiz desligado" };
  const provider = state.aiProvider || DEFAULT_PROVIDER;

  if (provider === "gemini") return solveGemini(question, state);
  if (provider === "groq") return solveGroq(question, state);
  if (provider === "chatgpt") return solveChatGpt(question);
  return solveOpenRouter(question, state);
}

function clampTokens(n, fallback = 512) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(4096, Math.max(32, Math.floor(v)));
}

async function askOpenRouterRaw(prompt, state, maxTokens) {
  const key = String(state.openrouterKey || "").trim();
  if (!key) return { ok: false, error: "Sem key OpenRouter no storage" };
  const model = String(state.openrouterModel || DEFAULT_MODEL).trim();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://oxyeducorp.oxygeni.com.br/",
      "X-Title": "OxyCamp Auto QA",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: String(raw?.error?.message || raw?.error || `HTTP ${res.status}`) };
  }
  return { ok: true, text: raw?.choices?.[0]?.message?.content || "", provider: "openrouter", model };
}

async function askGeminiRaw(prompt, state, maxTokens) {
  const key = String(state.geminiKey || "").trim();
  if (!key) return { ok: false, error: "Sem key Gemini no storage" };
  const model = String(state.geminiModel || AI_PROVIDERS.gemini.defaultModel).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: String(raw?.error?.message || raw?.error || `HTTP ${res.status}`) };
  }
  const text = raw?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return { ok: true, text, provider: "gemini", model };
}

async function askGroqRaw(prompt, state, maxTokens) {
  const key = String(state.groqKey || "").trim();
  if (!key) return { ok: false, error: "Sem key Groq no storage" };
  const model = String(state.groqModel || AI_PROVIDERS.groq.defaultModel).trim();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: String(raw?.error?.message || raw?.error || `HTTP ${res.status}`) };
  }
  return { ok: true, text: raw?.choices?.[0]?.message?.content || "", provider: "groq", model };
}

/** Free-form ask for provider smoke-test (popup). Keys come from chrome.storage.local. */
export async function askProvider(prompt, { maxTokens } = {}) {
  const state = await chrome.storage.local.get(null);
  const provider = state.aiProvider || DEFAULT_PROVIDER;
  const text = String(prompt || "").trim();
  if (!text) return { ok: false, error: "Escreve uma pergunta" };
  const limit = clampTokens(maxTokens ?? state.aiMaxTokens, 512);

  let res;
  if (provider === "chatgpt") {
    try {
      const out = await askChatGpt(text);
      res = { ok: true, text: out, provider: "chatgpt", model: "chatgpt-web" };
    } catch (err) {
      res = { ok: false, error: err?.message || String(err) };
    }
  } else if (provider === "gemini") {
    res = await askGeminiRaw(text, state, limit);
  } else if (provider === "groq") {
    res = await askGroqRaw(text, state, limit);
  } else {
    res = await askOpenRouterRaw(text, state, limit);
  }

  if (res.ok) {
    await pushLog(`Teste ${res.provider}: ${String(res.text).slice(0, 80)}…`, "info");
  } else {
    await pushLog(`Teste falhou: ${res.error}`, "error");
  }
  return { ...res, maxTokens: limit };
}

/** @deprecated use solveQuiz */
export async function solveWithOpenRouter(question) {
  return solveQuiz(question);
}
