import { CONTENT_VERSION, DEFAULT_STATE, HOST_RE, TOGGLE_KEYS } from "../shared/constants.js";
import { CONTENT_SCRIPTS, PAGE_SCRIPTS } from "../shared/paths.js";
import {
  loadModelsFromBackground,
  syncProviderUi,
  wireModelUi,
} from "./models.js";

async function load() {
  wireTabs();
  const state = await chrome.storage.local.get(null);
  for (const k of TOGGLE_KEYS) {
    const el = document.getElementById(k);
    if (!el) continue;
    el.checked = state[k] !== undefined ? !!state[k] : !!DEFAULT_STATE[k];
  }

  syncProviderUi(state);
  wireModelUi();

  const mins = document.getElementById("creditMinutes");
  if (mins) mins.value = state.creditMinutes || 10;

  renderLogs(state.logs || []);
  renderCredit(state.creditProgress || null);
  await loadModelsFromBackground({ force: false }).catch(() => {});
  await ensureActiveTabReady().catch(() => {});
  await refreshVideoInfo().catch(() => {});
}

function wireTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add("active");
      if (tab.dataset.tab === "video") refreshVideoInfo().catch(() => {});
    });
  });
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderCredit(p) {
  const fill = document.getElementById("creditFill");
  const meta = document.getElementById("creditMeta");
  const detail = document.getElementById("creditDetail");
  if (!fill || !meta || !detail) return;

  if (!p || !(p.duration > 0 || p.credited >= 0)) {
    fill.style.width = "0%";
    meta.textContent = "Parado";
    detail.textContent = "";
    return;
  }

  const pct = Math.max(
    0,
    Math.min(100, Number(p.pct) || (p.duration ? (p.credited / p.duration) * 100 : 0))
  );
  fill.style.width = `${pct.toFixed(1)}%`;
  const label = p.label || "Assistir";
  meta.textContent = p.running ? `${label} (${pct.toFixed(0)}%)` : `${label} ok`;
  const bits = [`${fmt(p.credited)} / ${fmt(p.duration)}`];
  if (p.eta != null) bits.push(`falta ~${p.eta}s`);
  detail.textContent = bits.join("  ");
}

function renderLogs(logs) {
  const box = document.getElementById("logs");
  if (!box) return;
  box.innerHTML = logs
    .slice(0, 50)
    .map((l) => {
      const cls = l.level === "error" ? "log-error" : l.level === "warn" ? "log-warn" : "";
      const t = new Date(l.t).toLocaleTimeString();
      return `<div class="${cls}">[${t}] ${escapeHtml(l.text)}</div>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function pushLog(text, level = "error") {
  const logs = (await chrome.storage.local.get(["logs"])).logs || [];
  const next = [{ t: Date.now(), level, text }, ...logs].slice(0, 200);
  await chrome.storage.local.set({ logs: next });
}

async function getTargetTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && HOST_RE.test(active.url || "")) return active;
  const tabs = await chrome.tabs.query({ url: ["https://oxyeducorp.oxygeni.com.br/*"] });
  return tabs.find((t) => /#\/aprender\/aula\//.test(t.url || "")) || tabs[0] || active || null;
}

async function ping(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "ping" });
}

async function injectScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: () => {
      globalThis.__oxycampContentGen = -1;
      if (typeof globalThis.__oxycampContentCleanup === "function") {
        try {
          globalThis.__oxycampContentCleanup();
        } catch (_) {
          /* ignore */
        }
      }
      globalThis.__oxycampContentVersion = 0;
    },
  });
  await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: PAGE_SCRIPTS });
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    files: CONTENT_SCRIPTS,
  });
}

async function ensureActiveTabReady() {
  const tab = await getTargetTab();
  if (!tab?.id) {
    await pushLog("Abra a aula no OxyEduCorp");
    return null;
  }
  if (!HOST_RE.test(tab.url || "")) {
    await pushLog("Essa aba não é a plataforma");
    return null;
  }
  try {
    const res = await ping(tab.id);
    if (!res?.version || res.version < CONTENT_VERSION) {
      await pushLog("Atualizando a página...", "warn");
      await chrome.tabs.reload(tab.id);
      return null;
    }
    return tab;
  } catch (_) {
    try {
      await injectScripts(tab.id);
      await new Promise((r) => setTimeout(r, 200));
      const res = await ping(tab.id);
      if (!res?.version || res.version < CONTENT_VERSION) {
        await chrome.tabs.reload(tab.id);
        return null;
      }
      await pushLog("Pronto nessa aba", "warn");
      return tab;
    } catch (err) {
      await pushLog(`Falhou: ${err.message}`);
      return null;
    }
  }
}

async function sendToActiveTab(msg) {
  const tab = await ensureActiveTabReady();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (err) {
    await pushLog(`Erro: ${err.message}`);
    return null;
  }
}

function setVideoLinks(info) {
  const idEl = document.getElementById("youtubeId");
  const titleEl = document.getElementById("videoTitle");
  const openYt = document.getElementById("openYoutube");
  const openEmbed = document.getElementById("openEmbed");
  const cobalt = document.getElementById("dlCobalt");
  const y2mate = document.getElementById("dlY2mate");
  const saveto = document.getElementById("dlSaveto");

  const id = info?.youtubeId || "";
  const watch = info?.watchUrl || (id ? `https://www.youtube.com/watch?v=${id}` : "");
  const embed = info?.embedUrl || (id ? `https://www.youtube-nocookie.com/embed/${id}` : "");

  if (idEl) idEl.value = id || "";
  if (titleEl) titleEl.textContent = info?.title || "";

  const bind = (el, href) => {
    if (!el) return;
    if (href) {
      el.href = href;
      el.classList.remove("disabled");
    } else {
      el.href = "#";
      el.removeAttribute("href");
    }
  };

  bind(openYt, watch || null);
  bind(openEmbed, embed || null);
  bind(cobalt, watch ? `https://cobalt.tools/#${encodeURIComponent(watch)}` : null);
  bind(y2mate, watch ? `https://www.y2mate.com/youtube/${encodeURIComponent(id)}` : null);
  bind(saveto, watch ? `https://en.savefrom.net/#url=${encodeURIComponent(watch)}` : null);
}

async function refreshVideoInfo() {
  const res = await sendToActiveTab({ type: "getVideoInfo" });
  if (!res?.ok) {
    setVideoLinks(null);
    return;
  }
  setVideoLinks(res);
  if (res.youtubeId) await pushLog(`Vídeo: ${res.youtubeId}`, "info");
}

function watchSeconds(seconds, label) {
  return sendToActiveTab({ type: "creditBy", seconds, label });
}

for (const k of TOGGLE_KEYS) {
  document.getElementById(k)?.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ [k]: e.target.checked });
  });
}

document.getElementById("watch10s")?.addEventListener("click", () => watchSeconds(10, "Assistir 10s"));
document.getElementById("watch1m")?.addEventListener("click", () => watchSeconds(60, "Assistir 1m"));
document.getElementById("watch10m")?.addEventListener("click", () => watchSeconds(600, "Assistir 10m"));

document.getElementById("watchCustom")?.addEventListener("click", async () => {
  const el = document.getElementById("creditMinutes");
  const mins = Math.max(0.1, Number(el?.value) || 10);
  await chrome.storage.local.set({ creditMinutes: mins });
  await watchSeconds(Math.round(mins * 60), `Assistir ${mins}m`);
});

document.getElementById("creditMinutes")?.addEventListener("change", async (e) => {
  await chrome.storage.local.set({ creditMinutes: Math.max(0.1, Number(e.target.value) || 10) });
});

document.getElementById("creditStop")?.addEventListener("click", () => sendToActiveTab({ type: "creditStop" }));

function keyStorageKey(provider) {
  if (provider === "gemini") return "geminiKey";
  if (provider === "groq") return "groqKey";
  return "openrouterKey";
}

function updateKeyStatus(provider, hasKey) {
  const el = document.getElementById("keyStatus");
  if (!el) return;
  if (provider === "chatgpt") {
    el.textContent = "";
    return;
  }
  el.textContent = hasKey ? "Key salva no storage" : "Sem key salva";
}

document.getElementById("saveKey")?.addEventListener("click", async () => {
  const prov = document.getElementById("aiProvider")?.value || "openrouter";
  if (prov === "chatgpt") return;
  const key = document.getElementById("aiKey")?.value?.trim() || "";
  await chrome.storage.local.set({ [keyStorageKey(prov)]: key });
  updateKeyStatus(prov, !!key);
  await pushLog(key ? `Key ${prov} salva` : `Key ${prov} limpa`, "info");
});

document.getElementById("clearKey")?.addEventListener("click", async () => {
  const prov = document.getElementById("aiProvider")?.value || "openrouter";
  if (prov === "chatgpt") return;
  const el = document.getElementById("aiKey");
  if (el) el.value = "";
  await chrome.storage.local.set({ [keyStorageKey(prov)]: "" });
  updateKeyStatus(prov, false);
  await pushLog(`Key ${prov} removida`, "warn");
});

document.getElementById("testAsk")?.addEventListener("click", async () => {
  const out = document.getElementById("testReply");
  const prompt = document.getElementById("testPrompt")?.value || "";
  const maxTokens = Number(document.getElementById("testMaxTokens")?.value) || 512;
  const prov = document.getElementById("aiProvider")?.value || "openrouter";
  if (out) out.textContent = "…";
  await chrome.storage.local.set({ aiMaxTokens: maxTokens });
  try {
    const res = await chrome.runtime.sendMessage({ type: "askProvider", prompt, maxTokens });
    if (out) {
      out.textContent = res?.ok
        ? res.text || "(vazio)"
        : `Erro (${prov}${res?.model ? ` / ${res.model}` : ""}): ${res?.error || "falhou"}`;
    }
    if (!res?.ok) await pushLog(`Teste ${prov}: ${res?.error || "falhou"}`, "error");
  } catch (err) {
    if (out) out.textContent = `Erro (${prov}): ${err.message || err}`;
    await pushLog(`Teste ${prov}: ${err.message || err}`, "error");
  }
});

document.getElementById("testMaxTokens")?.addEventListener("change", async (e) => {
  await chrome.storage.local.set({ aiMaxTokens: Math.max(32, Number(e.target.value) || 512) });
});

document.getElementById("refreshVideo")?.addEventListener("click", () => refreshVideoInfo());
document.getElementById("copyYtId")?.addEventListener("click", async () => {
  const id = document.getElementById("youtubeId")?.value || "";
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    await pushLog(`Copiado: ${id}`, "info");
  } catch (_) {
    await pushLog("Não deu pra copiar", "error");
  }
});

document.getElementById("clear")?.addEventListener("click", async () => {
  await chrome.storage.local.set({ logs: [] });
  renderLogs([]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.logs) renderLogs(changes.logs.newValue || []);
  if (changes.creditProgress) renderCredit(changes.creditProgress.newValue || null);
});

load();
