(() => {
  const O = globalThis.OxyCamp;

  O.quizSession = {
    active: false,
    lockRestartUntil: 0,
    lastProgress: "",
    lastAction: "",
    startedOnce: false,
    /** aula em que já abrimos/vimos o quiz — não reclica "fazer o quiz" nela */
    aulaId: "",
  };

  O.aiCache = new Map();
  O.aiInflightKey = "";

  O.quizHasCorrection = function quizHasCorrection(root) {
    return Boolean(
      root.querySelector(
        ".caixa.certa, .caixa.errada, button.certa, button.errada, .lacuna.certa, .lacuna.errada, button.bloco.certa, button.bloco.errada"
      )
    );
  };

  O.quizHasSelection = function quizHasSelection(root) {
    // multipla / VF / marcar
    if (root.querySelector(".caixa.selecionada, button.selecionada")) return true;
    // completar: bloco escolhido fica .usado-palavra e a lacuna ganha texto
    if (root.querySelector("button.bloco.usado-palavra")) return true;
    const lacuna = root.querySelector(".lacuna");
    if (lacuna && O.textOf(lacuna)) return true;
    // ordenar: já colocou algum bloco na faixa de ordem
    if (root.querySelector(".ordem button.bloco, button.bloco.usado")) return true;
    return false;
  };

  O.quizProgress = function quizProgress(root) {
    const el = root.querySelector(".contador");
    if (!el) return "";
    const m = O.textOf(el).match(/^(\d+)\s*\/\s*(\d+)$/);
    return m ? `${m[1]}/${m[2]}` : "";
  };

  O.selectGabaritoOptions = function selectGabaritoOptions(root) {
    if (O.quizHasCorrection(root)) return 0;
    const marked = [
      ...root.querySelectorAll(
        "button.caixa.gabarito, .caixa.gabarito, button.bloco.gabarito, .banco button.bloco.gabarito"
      ),
    ].filter(O.visible);
    if (!marked.length) return 0;
    let n = 0;
    for (const opt of marked) {
      if (
        opt.classList.contains("selecionada") ||
        opt.classList.contains("usado-palavra") ||
        opt.classList.contains("certa") ||
        opt.classList.contains("errada")
      ) {
        continue;
      }
      if (O.click(opt)) n += 1;
    }
    return n;
  };

  O.selectFromAdminHint = function selectFromAdminHint(root) {
    if (O.quizHasCorrection(root)) return 0;
    const hint = root.querySelector(".gabarito-admin");
    if (!hint || !O.visible(hint)) return 0;
    const raw = O.textOf(hint);
    const parts = raw
      .split(":")
      .slice(1)
      .join(":")
      .split(/·|→/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return 0;
    let n = 0;
    const boxes = [...root.querySelectorAll("button.caixa, .caixa, .banco button.bloco, button.bloco")].filter(
      O.visible
    );
    for (const part of parts) {
      const hit = boxes.find((b) => O.textOf(b).toLowerCase().includes(part.toLowerCase()));
      if (
        hit &&
        !hit.classList.contains("selecionada") &&
        !hit.classList.contains("usado-palavra") &&
        O.click(hit)
      ) {
        n += 1;
      }
    }
    return n;
  };

  function optionText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll(".letra, i, .an").forEach((n) => n.remove());
    return O.textOf(clone) || O.textOf(el).replace(/^[A-F]\s+/, "").trim();
  }

  /** completar/ordenar usam button.bloco no .banco — não .caixa */
  function quizOptionButtons(root, tipo) {
    if (tipo === "completar" || tipo === "ordenar") {
      let pool = [...root.querySelectorAll(".banco button.bloco")];
      if (!pool.length) pool = [...root.querySelectorAll("button.bloco")];
      pool = pool.filter(O.visible);
      if (pool.length) return pool;
    }
    return [...root.querySelectorAll("button.caixa, .caixa")].filter(O.visible);
  }

  function isOptionTaken(el) {
    return (
      el.classList.contains("selecionada") ||
      el.classList.contains("usado-palavra") ||
      el.classList.contains("usado")
    );
  }

  O.readQuizQuestion = function readQuizQuestion(root) {
    const tipo = root.querySelector(".rotulo")?.getAttribute("data-tipo") || "multipla";
    const enunciado = O.textOf(root.querySelector(".enunciado, h2.enunciado, h2"));
    const frase = O.textOf(root.querySelector(".frase, p.frase"));
    const rotulo = O.textOf(root.querySelector(".rotulo"));
    const qm = rotulo.match(/\((\d+)\)/);
    const buttons = quizOptionButtons(root, tipo);
    const opcoes = buttons.map((el, index) => ({
      index,
      letra: O.textOf(el.querySelector(".letra")) || "",
      texto: optionText(el),
    }));
    return { tipo, enunciado, frase, quantasCorretas: qm ? Number(qm[1]) : null, opcoes, buttons };
  };

  O.applyAiIndices = function applyAiIndices(root, indices) {
    if (O.quizHasCorrection(root) || !indices?.length) return 0;
    const q = O.readQuizQuestion(root);
    const buttons = q.buttons;
    let n = 0;

    if (q.tipo === "ordenar") {
      // clica só blocos ainda no banco (não usados)
      for (const idx of indices) {
        const el = buttons[idx];
        if (el && !isOptionTaken(el) && O.click(el)) n += 1;
      }
      return n;
    }

    if (q.tipo === "marcar") {
      for (const idx of indices) {
        const el = buttons[idx];
        if (!el || isOptionTaken(el)) continue;
        if (O.click(el)) n += 1;
      }
      return n;
    }

    // multipla / verdadeiro_falso / completar — um clique
    const el = buttons[indices[0]];
    if (el && !isOptionTaken(el) && O.click(el)) n += 1;
    return n;
  };

  O.askOpenRouter = function askOpenRouter(question) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "solveQuiz",
            question: {
              tipo: question.tipo,
              enunciado: question.enunciado,
              frase: question.frase,
              quantasCorretas: question.quantasCorretas,
              opcoes: question.opcoes,
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(res || { ok: false, error: "sem resposta" });
          }
        );
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  };

  O.selectWithOpenRouter = function selectWithOpenRouter(root) {
    if (!O.settings.aiQuiz) return 0;
    if (O.quizHasCorrection(root) || O.quizHasSelection(root)) return 0;

    const progress = O.quizProgress(root) || `t${Date.now()}`;
    const cached = O.aiCache.get(progress);
    if (cached?.indices?.length) {
      const n = O.applyAiIndices(root, cached.indices);
      if (n) O.log(`Quiz IA (cache): clicou ${n} em ${progress}`);
      return n;
    }

    if (O.aiInflightKey === progress) return 0;

    const q = O.readQuizQuestion(root);
    // completar: enunciado genérico "Complete a frase" — a frase com lacuna basta
    if (!q.opcoes.length) return 0;
    if (!q.enunciado && !q.frase) return 0;

    O.aiInflightKey = progress;
    O.quizSession.lastAction = "ai-pending";
    O.log(`Quiz IA: pedindo OpenRouter p/ ${progress} (${q.tipo})…`, "warn");

    O.askOpenRouter(q).then((res) => {
      if (O.aiInflightKey === progress) O.aiInflightKey = "";
      if (!res?.ok || !res.indices?.length) {
        O.log(`Quiz IA falhou: ${res?.error || "sem índices"}`, "error");
        O.quizSession.lastAction = "ai-fail";
        return;
      }
      O.aiCache.set(progress, { indices: res.indices });
      const live = document.querySelector(O.SELECTORS.quiz);
      if (!live || O.quizProgress(live) !== progress) return;
      const n = O.applyAiIndices(live, res.indices);
      if (n) {
        O.quizSession.lastAction = "pick";
        O.log(`Quiz IA: selecionou ${n} opção(ões) → [${res.indices.join(",")}]`);
      }
    });

    return 0;
  };

  O.markQuizActive = function markQuizActive() {
    O.quizSession.active = true;
    O.quizSession.startedOnce = true;
    O.quizSession.aulaId = O.aulaIdFromUrl() || O.quizSession.aulaId;
    O.quizSession.lockRestartUntil = Date.now() + 120000;
  };

  O.resetQuizSession = function resetQuizSession() {
    O.quizSession.active = false;
    O.quizSession.startedOnce = false;
    O.quizSession.aulaId = "";
    O.quizSession.lockRestartUntil = 0;
    O.quizSession.lastProgress = "";
    O.quizSession.lastAction = "";
    O.aiCache.clear();
    O.aiInflightKey = "";
  };

  /** Já entramos no quiz desta aula — não forçar de novo ao voltar pro vídeo */
  O.quizAlreadyStartedHere = function quizAlreadyStartedHere() {
    const id = O.aulaIdFromUrl();
    if (!O.quizSession.startedOnce) return false;
    if (!id) return true;
    return !O.quizSession.aulaId || O.quizSession.aulaId === id;
  };

  O.advanceQuiz = function advanceQuiz() {
    // Roda no quiz já aberto mesmo com Abrir quiz off (Quiz com IA / gabarito).
    if (!O.settings.enabled) return false;
    if (O.skipRead?.active) return false;
    const quiz = document.querySelector(O.SELECTORS.quiz);
    if (!quiz || !O.visible(quiz)) {
      if (O.quizSession.active && Date.now() > O.quizSession.lockRestartUntil) {
        O.quizSession.active = false;
      }
      return false;
    }

    O.markQuizActive();
    if (!O.throttle("quiz", 1100)) return true;

    const progress = O.quizProgress(quiz);
    if (progress && progress !== O.quizSession.lastProgress) {
      O.log(`Quiz: questão ${progress}`);
      O.quizSession.lastProgress = progress;
      O.quizSession.lastAction = "progress";
      if (O.aiInflightKey && O.aiInflightKey !== progress) O.aiInflightKey = "";
    }

    if (O.quizHasCorrection(quiz)) {
      const cont = O.clickQuizAction(quiz, ["ver resultado", "continuar"]);
      if (cont) {
        O.quizSession.lastAction = "continuar";
        O.quizSession.lockRestartUntil = Date.now() + 120000;
        O.log(`Quiz: ${cont} (próxima questão)`);
      }
      return true;
    }

    if (O.quizHasSelection(quiz)) {
      if (O.quizSession.lastAction === "verificar") return true;
      const verify = O.clickQuizAction(quiz, ["verificar"]);
      if (verify) {
        O.quizSession.lastAction = "verificar";
        O.log("Quiz: Verificar");
      }
      return true;
    }

    if (O.quizSession.lastAction === "ai-pending") return true;
    const picked = O.selectGabaritoOptions(quiz) || O.selectFromAdminHint(quiz);
    if (picked) {
      O.quizSession.lastAction = "pick";
      O.log(`Quiz: selecionou ${picked} opção(ões) do gabarito`);
      return true;
    }
    O.selectWithOpenRouter(quiz);
    return true;
  };

  /** Só o botão exato "fazer o quiz" — "refazer o quiz" contém essa frase e NÃO deve bater */
  O.clickFazerQuiz = function clickFazerQuiz() {
    const nodes = [...document.querySelectorAll("po-button, button, a.po-button, [p-label]")];
    for (const el of nodes) {
      const label = O.buttonLabel(el);
      if (label !== "fazer o quiz") continue;
      if (O.click(el)) return label;
    }
    return null;
  };

  O.startQuizIfReady = function startQuizIfReady() {
    if (!O.settings.enabled || !O.settings.autoModules || !O.settings.autoQuiz) return false;
    if (O.skipRead?.active) return false;
    if (document.querySelector(O.SELECTORS.quiz)) {
      O.markQuizActive();
      return false;
    }
    // volta pro vídeo da mesma aula → não empurra de novo pro quiz
    if (O.quizAlreadyStartedHere()) return false;
    if (O.quizSession.active || Date.now() < O.quizSession.lockRestartUntil) return false;
    // check na aula = vídeo ok; quiz ainda pode estar pendente ("fazer o quiz")
    if (!O.throttle("quizStart", 2500)) return false;

    const started = O.clickFazerQuiz();
    if (started) {
      O.markQuizActive();
      O.log(`Módulo: ${started}`);
      return true;
    }
    return false;
  };
})();
