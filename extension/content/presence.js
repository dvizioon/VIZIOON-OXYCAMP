(() => {
  const O = globalThis.OxyCamp;

  O.confirmPresence = function confirmPresence() {
    if (!O.settings.enabled || !O.settings.autoPresence) return;
    const btn = document.querySelector(O.SELECTORS.presenceBtn);
    if (!btn || !O.visible(btn)) return;
    if (!O.throttle("presence", 800)) return;
    if (O.click(btn)) O.log("Presença confirmada automaticamente");
  };

  O.resumeIfPaused = function resumeIfPaused() {
    if (!O.settings.enabled || !O.settings.autoPlay) return;
    if (document.querySelector(O.SELECTORS.quiz)) return;
    const player = document.querySelector(O.SELECTORS.player);
    if (!player) return;
    const presence = document.querySelector(O.SELECTORS.presenceBox);
    if (presence && O.visible(presence)) return;
    const paused = player.querySelector(".capa.pausado");
    if (!paused || !O.visible(paused)) return;
    if (!O.throttle("play", 2500)) return;
    const play =
      player.querySelector('button[aria-label="Reproduzir"]') ||
      player.querySelector(".play-grande") ||
      player.querySelector(".capa");
    if (O.click(play)) O.log("Play retomado (anti-pause / anti-blur)");
  };

  O.installAntiBlur = function installAntiBlur() {
    if (!O.settings.antiBlur) return;
    try {
      Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
      Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
      O.log("Anti-blur: document.hidden forçado para visible", "warn");
    } catch (err) {
      O.log(`Anti-blur falhou: ${err.message}`, "error");
    }
  };
})();
