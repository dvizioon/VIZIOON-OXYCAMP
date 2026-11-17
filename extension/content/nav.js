(() => {
  const O = globalThis.OxyCamp;

  function lessonItems() {
    return [...document.querySelectorAll("ol.lista li, .lista li")];
  }

  function isLessonDone(li) {
    return Boolean(li.querySelector(".an-check-circle, .an-check, [class*='check-circle']"));
  }

  function canLeaveCurrent(atual) {
    if (isLessonDone(atual)) return true;
    if (document.querySelector(".resultado, app-aula .resultado")) return true;
    return false;
  }

  O.goNextModule = function goNextModule() {
    if (!O.settings.enabled || !O.settings.autoModules) return false;
    // sem Abrir quiz → fica na aula atual (não passa de vídeo sozinho)
    if (!O.settings.autoQuiz) return false;
    if (document.querySelector(O.SELECTORS.quiz)) return false;
    // vídeo ok mas quiz ainda disponível → não pular (fluxo automático do quiz)
    if (O.hasFazerQuizButton?.()) return false;
    if (O.quizSession.active && Date.now() < O.quizSession.lockRestartUntil) return false;
    if (!O.throttle("nav", 4000)) return false;

    const skip = O.clickByLabel(["pular para a próxima aula"]);
    if (skip) {
      O.quizSession.startedOnce = false;
      O.quizSession.active = false;
      O.log("Módulo: pulou para próxima aula (admin)");
      return true;
    }

    const items = lessonItems();
    const atualIdx = items.findIndex((li) => li.classList.contains("atual"));
    if (atualIdx < 0) return false;

    const atual = items[atualIdx];
    if (!canLeaveCurrent(atual)) return false;

    for (let i = atualIdx + 1; i < items.length; i++) {
      const li = items[i];
      if (li.classList.contains("travada")) continue;
      const a = li.querySelector("a");
      if (!a) continue;
      if (O.click(a)) {
        O.quizSession.startedOnce = false;
        O.quizSession.active = false;
        O.quizSession.lockRestartUntil = 0;
        O.log(`Módulo: próxima aula → ${O.textOf(a)}`);
        return true;
      }
    }

    return false;
  };

  O.advanceModules = function advanceModules() {
    if (!O.settings.enabled) return;
    // para qualquer “pular leitura” antigo que ainda esteja ativo
    if (O.skipRead?.active) O.stopPularLeitura?.();

    // Quiz já aberto: responde (IA/gabarito) mesmo com Abrir quiz off
    if (O.advanceQuiz()) return;

    if (!O.settings.autoModules) return;

    // Abrir quiz off → não abre quiz e não avança aula
    if (!O.settings.autoQuiz) return;

    if (O.startQuizIfReady()) return;
    O.goNextModule();
  };
})();
