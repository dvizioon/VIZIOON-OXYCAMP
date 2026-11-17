import { AI_PROVIDERS } from "../shared/providers.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../shared/constants.js";

let allModels = [];
let selectedId = DEFAULT_MODEL;
let currentProvider = DEFAULT_PROVIDER;

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function getSelectedModel() {
  return selectedId;
}

export function getCurrentProvider() {
  return currentProvider;
}

export function setProvider(id) {
  currentProvider = id in AI_PROVIDERS ? id : DEFAULT_PROVIDER;
  return AI_PROVIDERS[currentProvider];
}

export function setModels(models, currentId) {
  allModels = Array.isArray(models) ? models : [];
  if (currentId) selectedId = currentId;
  if (selectedId && !allModels.some((m) => m.id === selectedId)) {
    allModels = [{ id: selectedId, name: selectedId }, ...allModels];
  }
  renderFiltered(document.getElementById("modelFilter")?.value || "");
}

export function renderFiltered(query) {
  const select = document.getElementById("aiModel");
  const meta = document.getElementById("modelMeta");
  if (!select) return;

  const q = String(query || "")
    .trim()
    .toLowerCase();
  const filtered = !q
    ? allModels
    : allModels.filter((m) => {
        const hay = `${m.id} ${m.name || ""}`.toLowerCase();
        return q.split(/\s+/).every((part) => hay.includes(part));
      });

  const prev = selectedId;
  select.innerHTML = filtered
    .slice(0, 400)
    .map((m) => {
      const label = m.name && m.name !== m.id ? `${m.id}` : m.id;
      return `<option value="${escapeHtml(m.id)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  if (filtered.some((m) => m.id === prev)) {
    select.value = prev;
    selectedId = prev;
  } else if (filtered[0]) {
    select.value = filtered[0].id;
    selectedId = filtered[0].id;
  }

  if (meta) {
    meta.textContent = q
      ? `${filtered.length} de ${allModels.length}`
      : selectedId
        ? `${allModels.length} modelos`
        : "";
  }
}

function modelStorageKey(provider) {
  if (provider === "gemini") return "geminiModel";
  if (provider === "groq") return "groqModel";
  if (provider === "chatgpt") return "chatgptModel";
  return "openrouterModel";
}

function keyStorageKey(provider) {
  if (provider === "gemini") return "geminiKey";
  if (provider === "groq") return "groqKey";
  return "openrouterKey";
}

export function syncProviderUi(state = {}) {
  const meta = setProvider(state.aiProvider || DEFAULT_PROVIDER);
  const site = document.getElementById("providerSite");
  const keyLabel = document.getElementById("aiKeyLabel");
  const keyEl = document.getElementById("aiKey");
  const keyWrap = document.getElementById("aiKeyWrap");
  const provEl = document.getElementById("aiProvider");
  const needsKey = meta.needsKey !== false;

  if (provEl) provEl.value = currentProvider;
  if (site) {
    site.href = meta.site;
    site.title = meta.docs;
    site.textContent = meta.siteButton || (needsKey ? "Key" : "Abrir");
  }
  if (keyWrap) keyWrap.style.display = needsKey ? "" : "none";
  if (keyLabel) keyLabel.textContent = meta.keyLabel || "API key";
  if (keyEl) {
    keyEl.placeholder = meta.keyPlaceholder || "cole a key";
    keyEl.value = needsKey ? state[keyStorageKey(currentProvider)] || "" : "";
    keyEl.disabled = !needsKey;
  }
  const keyStatus = document.getElementById("keyStatus");
  if (keyStatus) {
    keyStatus.textContent = !needsKey
      ? ""
      : state[keyStorageKey(currentProvider)]
        ? "Key salva no storage"
        : "Sem key salva";
  }
  const maxEl = document.getElementById("testMaxTokens");
  if (maxEl && state.aiMaxTokens) maxEl.value = state.aiMaxTokens;

  selectedId =
    state[modelStorageKey(currentProvider)] || meta.defaultModel || DEFAULT_MODEL;

  if (meta.models) {
    setModels(meta.models, selectedId);
  } else {
    setModels(state.openrouterModels || [], selectedId);
  }
}

export async function loadModelsFromBackground({ force = false } = {}) {
  const metaEl = document.getElementById("modelMeta");
  if (metaEl) metaEl.textContent = force ? "Atualizando..." : "Carregando...";

  const res = await chrome.runtime.sendMessage({
    type: "listModels",
    force,
    provider: currentProvider,
  });
  if (!res?.ok) {
    if (metaEl) metaEl.textContent = res?.error || "Falhou";
    const fallback = AI_PROVIDERS[currentProvider]?.models;
    if (fallback) setModels(fallback, selectedId);
    return [];
  }
  setModels(res.models || [], selectedId);
  return res.models || [];
}

export function wireModelUi() {
  const filter = document.getElementById("modelFilter");
  const select = document.getElementById("aiModel");
  const refresh = document.getElementById("refreshModels");
  const provider = document.getElementById("aiProvider");
  const keyEl = document.getElementById("aiKey");

  filter?.addEventListener("input", (e) => renderFiltered(e.target.value));

  select?.addEventListener("change", async (e) => {
    selectedId = e.target.value;
    await chrome.storage.local.set({ [modelStorageKey(currentProvider)]: selectedId });
    renderFiltered(filter?.value || "");
  });

  refresh?.addEventListener("click", async () => {
    await loadModelsFromBackground({ force: true });
    await chrome.storage.local.set({ [modelStorageKey(currentProvider)]: selectedId });
  });

  provider?.addEventListener("change", async (e) => {
    const id = e.target.value;
    await chrome.storage.local.set({ aiProvider: id });
    const state = await chrome.storage.local.get(null);
    syncProviderUi({ ...state, aiProvider: id });
    await loadModelsFromBackground({ force: false });
  });

  const persistKey = async () => {
    if (!keyEl) return;
    await chrome.storage.local.set({ [keyStorageKey(currentProvider)]: keyEl.value.trim() });
  };
  keyEl?.addEventListener("change", persistKey);
  keyEl?.addEventListener("blur", async () => {
    await persistKey();
    if (currentProvider === "openrouter") await loadModelsFromBackground({ force: true }).catch(() => {});
  });
}
