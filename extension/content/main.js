(() => {
  const O = globalThis.OxyCamp;
  const CONTENT_VERSION = O.CONTENT_VERSION;

  globalThis.__oxycampContentGen = CONTENT_VERSION;
  if (globalThis.__oxycampContentVersion === CONTENT_VERSION) {
    console.info("[OxyCamp] content já ativo — skip reinjeção");
    return;
  }
  if (typeof globalThis.__oxycampContentCleanup === "function") {
    try {
      globalThis.__oxycampContentCleanup();
    } catch (_) {
      /* ignore */
    }
  }
  globalThis.__oxycampContentVersion = CONTENT_VERSION;

  function tick() {
    if (!O.alive()) return;
    O.confirmPresence();
    O.resumeIfPaused();
    O.advanceModules();
  }

  function start() {
    O.installAntiBlur();
    if (O.tickTimer) clearInterval(O.tickTimer);
    O.tickTimer = setInterval(tick, 900);
    if (O.observer) O.observer.disconnect();
    let obsPending = false;
    O.observer = new MutationObserver(() => {
      if (obsPending) return;
      obsPending = true;
      setTimeout(() => {
        obsPending = false;
        O.confirmPresence();
        // Quiz aberto: avança questões mesmo com Abrir quiz off
        if (O.settings.enabled) O.advanceQuiz();
      }, 400);
    });
    O.observer.observe(document.documentElement, { childList: true, subtree: true });
    O.syncUnlock();
    globalThis.__oxycampContentCleanup = () => {
      clearInterval(O.tickTimer);
      O.tickTimer = null;
      if (O.observer) O.observer.disconnect();
      O.observer = null;
    };
    O.log(`Content script v${CONTENT_VERSION} ativo (modular)`);
  }

  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.source !== "oxycamp-page") return;
    if (d.type === "log") O.log(d.text, d.level || "info");
    if (d.type === "ready") O.syncUnlock();
    if (d.type === "creditProgress") {
      try {
        chrome.runtime.sendMessage({
          type: "creditProgress",
          progress: {
            t: d.t || Date.now(),
            running: !!d.running,
            credited: d.credited,
            duration: d.duration,
            goal: d.goal,
            pct: d.pct,
            speed: d.speed,
            eta: d.eta,
            status: d.status,
            label: d.label,
            videoOk: d.videoOk,
          },
        });
      } catch (_) {
        /* ignore */
      }
    }
  });

  let lastHash = location.hash;
  let lastAulaId = O.aulaIdFromUrl();
  setInterval(() => {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    const aulaId = O.aulaIdFromUrl();
    // mesma aula (vídeo ↔ quiz ↔ resultado) — mantém startedOnce pra não reabrir o quiz
    if (aulaId && aulaId === lastAulaId) return;
    lastAulaId = aulaId;
    O.resetQuizSession();
    O.log(`Aula mudou → sessão de quiz resetada (${lastHash})`);
  }, 1000);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "ping") {
      O.syncUnlock();
      sendResponse({ ok: true, pong: true, version: CONTENT_VERSION });
      return true;
    }
    if (msg?.type === "seekBy") {
      O.syncUnlock();
      O.bridge("seekBy", { seconds: msg.seconds });
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "creditBy") {
      O.syncUnlock();
      const sec = Number(msg.seconds) || 0;
      O.log(`Popup → Assistir +${Math.round(sec)}s (crédito ping)`);
      O.bridge("creditBy", { seconds: sec, label: msg.label });
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "creditStop") {
      O.bridge("creditStop");
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "seekEnd") {
      O.syncUnlock();
      O.log("Popup → Assistir resto");
      O.bridge("seekEnd");
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "getVideoInfo") {
      sendResponse({ ok: true, ...O.getVideoInfo() });
      return true;
    }
    return false;
  });

  chrome.storage.local.get(null).then((s) => {
    O.applyStorage(s);
    O.stopPularLeitura?.();
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) {
      if (k in O.settings) O.settings[k] = v.newValue;
    }
    if (changes.antiBlur) O.installAntiBlur();
    if (changes.freeSeek || changes.enabled) O.syncUnlock();
    // desligou Abrir quiz → para qualquer avanço automático
    if (changes.autoQuiz && changes.autoQuiz.newValue === false) {
      O.stopPularLeitura?.();
    }
  });
})();
