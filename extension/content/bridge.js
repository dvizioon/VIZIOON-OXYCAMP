(() => {
  const O = globalThis.OxyCamp;

  O.bridge = function bridge(type, extra = {}) {
    window.postMessage({ source: "oxycamp-bridge", type, ...extra }, "*");
  };

  O.syncUnlock = function syncUnlock() {
    O.bridge("settings", { freeSeek: !!(O.settings.enabled && O.settings.freeSeek) });
  };
})();
