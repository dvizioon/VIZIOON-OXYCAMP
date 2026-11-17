(() => {
  const O = globalThis.OxyCamp;

  O.settings = {
    enabled: true,
    autoPresence: true,
    antiBlur: true,
    autoPlay: true,
    autoModules: true,
    autoQuiz: false,
    freeSeek: true,
    aiQuiz: true,
  };

  O.last = { any: 0, presence: 0, play: 0, quiz: 0, nav: 0, quizStart: 0, skipRead: 0, skipNav: 0 };
  O.observer = null;
  O.tickTimer = null;

  O.alive = function alive() {
    return globalThis.__oxycampContentGen === O.CONTENT_VERSION;
  };

  O.log = function log(text, level = "info") {
    if (!O.alive()) return;
    console.info(`[OxyCamp] ${text}`);
    try {
      chrome.runtime.sendMessage({ type: "log", text, level });
    } catch (_) {
      /* extension context may be gone */
    }
  };

  O.throttle = function throttle(key, ms) {
    const now = Date.now();
    if (now - (O.last[key] || 0) < ms) return false;
    O.last[key] = now;
    O.last.any = now;
    return true;
  };

  O.applyStorage = function applyStorage(s) {
    O.settings = { ...O.settings, ...s };
  };
})();
