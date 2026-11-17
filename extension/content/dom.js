(() => {
  const O = globalThis.OxyCamp;

  O.SELECTORS = {
    player: "app-player-travado",
    playBtn:
      'app-player-travado button[aria-label="Reproduzir"], app-player-travado .capa, app-player-travado .play-grande',
    presenceBtn: "app-player-travado .caixa-presenca button",
    presenceBox: "app-player-travado .presenca, app-player-travado .caixa-presenca",
    quiz: "app-quiz-jogo",
    aula: "app-aula",
  };

  /** Id da aula atual no hash (#/aprender/aula/{id}) */
  O.aulaIdFromUrl = function aulaIdFromUrl() {
    return (location.hash.match(/\/aula\/([a-z0-9]+)/i) || [])[1] || "";
  };

  O.visible = function visible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  O.isDisabled = function isDisabled(el) {
    if (!el) return true;
    if (el.disabled) return true;
    if (el.getAttribute("disabled") !== null) return true;
    if (el.getAttribute("aria-disabled") === "true") return true;
    const inner = el.tagName === "PO-BUTTON" ? el.querySelector("button") : null;
    if (inner && (inner.disabled || inner.getAttribute("disabled") !== null)) return true;
    return false;
  };

  O.click = function click(el) {
    if (!el || !O.visible(el) || O.isDisabled(el)) return false;
    const target = el.tagName === "PO-BUTTON" ? el.querySelector("button") || el : el;
    if (O.isDisabled(target)) return false;
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  };

  O.textOf = function textOf(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  };

  O.buttonLabel = function buttonLabel(el) {
    return (el.getAttribute("p-label") || el.getAttribute("aria-label") || O.textOf(el))
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  O.clickByLabel = function clickByLabel(labels, root = document) {
    const wanted = labels.map((l) => l.toLowerCase());
    const nodes = [...root.querySelectorAll("po-button, button, a.po-button, [p-label]")];
    for (const el of nodes) {
      const label = O.buttonLabel(el);
      if (!wanted.some((w) => label.includes(w))) continue;
      if (O.click(el)) return label;
    }
    return null;
  };

  O.clickQuizAction = function clickQuizAction(root, labels) {
    const wanted = labels.map((l) => l.toLowerCase());
    const nodes = [...root.querySelectorAll("po-button, button, [p-label]")];
    for (const el of nodes) {
      const label = O.buttonLabel(el);
      if (!wanted.some((w) => label === w || label.startsWith(w))) continue;
      if (label.includes("assistindo")) continue;
      if (O.click(el)) return label;
    }
    return null;
  };
})();
