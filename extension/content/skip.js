(() => {
  const O = globalThis.OxyCamp;

  O.skipRead = {
    active: false,
    creditAskedFor: "",
    finalStarted: false,
  };

  O.fetchAulaApi = async function fetchAulaApi() {
    const id = O.aulaIdFromUrl();
    if (!id) return null;
    try {
      const res = await fetch(`/api/aprender/aulas/${id}`, { credentials: "include" });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  };

  O.hasFazerQuizButton = function hasFazerQuizButton() {
    const nodes = [...document.querySelectorAll("po-button, button, a.po-button, [p-label]")];
    return nodes.some((el) => {
      if (O.buttonLabel(el) !== "fazer o quiz") return false;
      return O.visible(el) && !O.isDisabled(el);
    });
  };

  O.clickNextLesson = function clickNextLesson() {
    const skip = O.clickByLabel(["pular para a próxima aula"]);
    if (skip) return skip;

    const items = [...document.querySelectorAll("ol.lista li, .lista li")];
    const atualIdx = items.findIndex((li) => li.classList.contains("atual"));
    if (atualIdx < 0) return null;

    for (let i = atualIdx + 1; i < items.length; i++) {
      const li = items[i];
      if (li.classList.contains("travada")) continue;
      const a = li.querySelector("a");
      if (a && O.click(a)) return O.textOf(a) || "próxima";
    }
    return null;
  };

  O.startPularLeitura = function startPularLeitura() {
    O.skipRead.active = true;
    O.skipRead.creditAskedFor = "";
    O.skipRead.finalStarted = false;
    O.log("Pular leitura: ligado — vai até o último vídeo", "warn");
  };

  O.stopPularLeitura = function stopPularLeitura() {
    if (!O.skipRead.active) return;
    O.skipRead.active = false;
    O.skipRead.creditAskedFor = "";
    O.skipRead.finalStarted = false;
    O.bridge("creditStop");
    O.log("Pular leitura: parado", "warn");
  };

  /** Intermediários: crédito rápido e avança. Último: crédito e fica. Sem quiz. */
  O.tickPularLeitura = async function tickPularLeitura() {
    if (!O.settings.enabled || !O.skipRead.active) return;
    if (!O.throttle("skipRead", 1800)) return;
    if (document.querySelector(O.SELECTORS.quiz)) return;

    const data = await O.fetchAulaApi();
    if (!data?.aula) {
      O.log("Pular leitura: sem dados da aula", "error");
      return;
    }

    const aulas = Array.isArray(data.aulas) ? data.aulas : [];
    const cur = data.aula;
    const last = aulas.length ? aulas[aulas.length - 1] : null;
    const isLast = Boolean(last && cur.id === last.id);
    const title = cur.titulo || cur.id;

    if (isLast) {
      if (cur.videoOk) {
        O.skipRead.active = false;
        O.log(`Pular leitura: último ok — ${title}`, "info");
        return;
      }
      if (!O.skipRead.finalStarted || O.skipRead.creditAskedFor !== cur.id) {
        O.skipRead.finalStarted = true;
        O.skipRead.creditAskedFor = cur.id;
        O.log(`Pular leitura: último vídeo — assistindo ${title}`, "warn");
        O.bridge("seekEnd");
      }
      return;
    }

    if (!cur.videoOk) {
      if (O.skipRead.creditAskedFor !== cur.id) {
        O.skipRead.creditAskedFor = cur.id;
        O.log(`Pular leitura: passando ${title}`, "warn");
        O.bridge("seekEnd");
      }
      return;
    }

    if (!O.throttle("skipNav", 3200)) return;
    const went = O.clickNextLesson();
    if (went) {
      O.skipRead.creditAskedFor = "";
      O.skipRead.finalStarted = false;
      O.log(`Pular leitura: próxima → ${went}`);
      return;
    }
    O.log("Pular leitura: próxima travada (falta liberar no servidor)", "error");
  };
})();
