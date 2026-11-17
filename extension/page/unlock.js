(() => {
  const VERSION = 7;
  if (globalThis.__oxycampPageUnlockVersion === VERSION) return;
  if (typeof globalThis.__oxycampPageUnlockCleanup === "function") {
    try {
      globalThis.__oxycampPageUnlockCleanup();
    } catch (_) {
      /* ignore */
    }
  }
  globalThis.__oxycampPageUnlockVersion = VERSION;

  const SRC = "oxycamp-page";
  let freeSeek = true;
  let logged = false;
  let time = 0;
  let duration = 0;
  let desired = 0;
  let seekGuardUntil = 0;
  let creditRunning = false;
  let lastCreditSnapshot = null;
  const timers = [];
  const cleanups = [];

  function fmt(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      timers.push(id);
    });
  }

  function aulaIdFromUrl() {
    return (location.hash.match(/\/aula\/([a-z0-9]+)/i) || [])[1] || null;
  }

  function post(type, extra = {}) {
    window.postMessage({ source: SRC, type, ...extra }, "*");
  }

  function on(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    cleanups.push(() => target.removeEventListener(event, handler, opts));
  }

  function every(ms, fn) {
    const id = setInterval(fn, ms);
    timers.push(id);
    return id;
  }

  function text(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  /** True YouTube embed only (cross-origin). Same-origin iframe = not ready / wrong node. */
  function isLiveYtIframe(iframe) {
    if (!iframe?.src || !/youtube(-nocookie)?\.com\/embed\//i.test(iframe.src)) return false;
    try {
      void iframe.contentDocument;
      return false; // accessible ⇒ same-origin ⇒ not the YT document yet
    } catch (_) {
      return true;
    }
  }

  function getIframe() {
    const nodes = [
      ...document.querySelectorAll("app-player-travado iframe"),
      ...document.querySelectorAll('iframe[src*="youtube-nocookie.com/embed"]'),
      ...document.querySelectorAll('iframe[src*="youtube.com/embed"]'),
    ];
    return nodes.find(isLiveYtIframe) || null;
  }

  function getYTPlayer() {
    if (!window.YT?.get) return null;
    const iframe = getIframe();
    const ids = [];
    if (iframe?.id) ids.push(iframe.id);
    ids.push("widget2", "widget3", "widget4", "widget5", "widget6", "player");
    for (const id of ids) {
      try {
        const p = window.YT.get(id);
        if (p && typeof p.seekTo === "function") return p;
      } catch (_) {
        /* ignore */
      }
    }
    // Last resort: any iframe id under the player
    for (const el of document.querySelectorAll("app-player-travado iframe[id]")) {
      try {
        const p = window.YT.get(el.id);
        if (p && typeof p.seekTo === "function") return p;
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }

  function command(func, args = []) {
    const iframe = getIframe();
    if (!iframe?.contentWindow) return false;
    try {
      const origin = new URL(iframe.src).origin;
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), origin);
      return true;
    } catch (_) {
      return false;
    }
  }

  function readTempoFromDom() {
    const el = document.querySelector("app-player-travado .tempo");
    if (!el) return null;
    const m = text(el).match(/(\d+):(\d+)\s*\/\s*(\d+):(\d+)/);
    if (!m) return null;
    return {
      cur: Number(m[1]) * 60 + Number(m[2]),
      dur: Number(m[3]) * 60 + Number(m[4]),
    };
  }

  function currentTime() {
    const yt = getYTPlayer();
    try {
      const t = yt?.getCurrentTime?.();
      if (typeof t === "number" && !Number.isNaN(t)) return t;
    } catch (_) {
      /* ignore */
    }
    if (time > 0) return time;
    return readTempoFromDom()?.cur || 0;
  }

  function currentDuration() {
    const yt = getYTPlayer();
    try {
      const d = yt?.getDuration?.();
      if (typeof d === "number" && d > 0) return d;
    } catch (_) {
      /* ignore */
    }
    if (duration > 0) return duration;
    return readTempoFromDom()?.dur || 0;
  }

  function patchYTPlayer(player) {
    if (!player?.seekTo || player.__oxycampSeekPatched) return;
    const orig = player.seekTo.bind(player);
    player.seekTo = function patchedSeekTo(seconds, allowSeekAhead) {
      if (freeSeek && Date.now() < seekGuardUntil) {
        let cur = desired || 0;
        try {
          cur = player.getCurrentTime?.() || cur;
        } catch (_) {
          /* ignore */
        }
        if (typeof seconds === "number" && seconds < cur - 1.25 && seconds < desired - 0.5) {
          return;
        }
      }
      return orig(seconds, allowSeekAhead);
    };
    player.__oxycampSeekPatched = true;
  }

  function findPlayerCmp() {
    const host = document.querySelector("app-player-travado");
    if (!host) return null;
    try {
      const viaNg = window.ng?.getComponent?.(host);
      if (viaNg && typeof viaNg.maximo === "function") return viaNg;
    } catch (_) {
      /* ignore */
    }
    const seen = new Set();
    const stack = [host.__ngContext__, host];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
      seen.add(cur);
      try {
        if (typeof cur.maximo === "function" && typeof cur.maximo.set === "function") return cur;
      } catch (_) {
        /* ignore */
      }
      try {
        if (Array.isArray(cur) || (cur.length >= 0 && cur.length < 500)) {
          for (const v of cur) stack.push(v);
        } else {
          for (const v of Object.values(cur)) {
            if (v && typeof v === "object") stack.push(v);
          }
        }
      } catch (_) {
        /* ignore */
      }
      if (seen.size > 4000) break;
    }
    return null;
  }

  function unlockCmp() {
    const cmp = findPlayerCmp();
    const yt = getYTPlayer();
    if (yt) patchYTPlayer(yt);
    const dur = currentDuration() || 1e6;
    if (cmp) {
      try {
        cmp.maximo?.set?.(Math.max(cmp.maximo() || 0, dur, desired || 0));
      } catch (_) {
        /* ignore */
      }
    }
    if (!logged) {
      logged = true;
      post("log", {
        text: `Seek unlock v${VERSION} (yt=${!!yt} cmp=${!!cmp} iframe=${!!getIframe()})`,
        level: "warn",
      });
    }
    return !!(cmp || yt || getIframe());
  }

  function clickBarRatio(ratio) {
    const bar = document.querySelector("app-player-travado .barra");
    if (!bar) return false;
    const r = bar.getBoundingClientRect();
    if (r.width < 4) return false;
    const x = r.left + Math.min(r.width - 1, Math.max(1, r.width * ratio));
    const y = r.top + r.height / 2;
    for (const type of ["pointerdown", "mousedown", "click", "mouseup", "pointerup"]) {
      bar.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          view: window,
        })
      );
    }
    return true;
  }

  async function forcePing(posicao, duracao, { quiet = false } = {}) {
    const id = aulaIdFromUrl();
    if (!id) {
      post("log", { text: "Ping: sem id de aula na URL", level: "error" });
      return null;
    }
    try {
      const res = await fetch(`/api/aprender/aulas/${id}/ping`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ posicao, duracao }),
      });
      const body = await res.json().catch(() => null);
      if (!quiet || body?.videoOk) {
        post("log", {
          text: `Ping HTTP ${res.status} pos=${fmt(posicao)} assistido=${fmt(body?.assistido)} videoOk=${body?.videoOk ?? "?"}`,
          level: body?.videoOk ? "info" : "warn",
        });
      }
      return body;
    } catch (err) {
      post("log", { text: `Ping falhou: ${err.message}`, level: "error" });
      return null;
    }
  }

  async function fetchAula() {
    const id = aulaIdFromUrl();
    if (!id) return null;
    try {
      const res = await fetch(`/api/aprender/aulas/${id}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => null);
      return body?.aula || null;
    } catch (err) {
      post("log", { text: `GET aula falhou: ${err.message}`, level: "error" });
      return null;
    }
  }

  /** Stop Angular player from pinging a forged maximo while we credit gradually. */
  function silencePlayerAvisar() {
    const cmp = findPlayerCmp();
    if (!cmp || cmp.__oxycampAvisarWrapped) return cmp;
    const orig = typeof cmp.avisar === "function" ? cmp.avisar.bind(cmp) : null;
    if (!orig) return cmp;
    cmp.avisar = function wrappedAvisar() {
      if (creditRunning) {
        try {
          this.ultimoPing = Date.now();
        } catch (_) {
          /* ignore */
        }
        return Promise.resolve(null);
      }
      return orig.apply(this, arguments);
    };
    cmp.__oxycampAvisarWrapped = true;
    return cmp;
  }

  function syncCreditUi(credited, dur) {
    desired = Math.max(desired, credited);
    seekGuardUntil = Date.now() + 8000;
    time = credited;
    const cmp = findPlayerCmp();
    try {
      // Keep maximo within ~15s of server credit so player won't warn (threshold is 20s).
      cmp?.maximo?.set?.(credited);
      cmp?.terminou?.set?.(false);
      cmp?.atual?.set?.(credited);
    } catch (_) {
      /* ignore */
    }
    const yt = getYTPlayer();
    if (yt?.seekTo) {
      patchYTPlayer(yt);
      try {
        yt.seekTo(credited, true);
      } catch (_) {
        /* ignore */
      }
    } else {
      command("seekTo", [credited, true]);
    }
    if (dur > 0) clickBarRatio(Math.min(0.999, credited / dur));
  }

  function markVideoDone(dur) {
    const cmp = findPlayerCmp();
    doSeek(dur, "Seek fim");
    try {
      cmp?.maximo?.set?.(dur);
      cmp?.terminou?.set?.(true);
      if (!cmp?.avisouConclusao) {
        cmp.avisouConclusao = true;
        cmp?.concluido?.emit?.();
      } else {
        cmp?.avisar?.(dur);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function doSeek(next, label) {
    unlockCmp();
    const dur = currentDuration();
    const target = dur > 0 ? Math.max(0, Math.min(dur, next)) : Math.max(0, next);
    desired = Math.max(desired, target);
    seekGuardUntil = Date.now() + 20000;
    time = target;

    const cmp = findPlayerCmp();
    try {
      cmp?.maximo?.set?.(Math.max(cmp.maximo?.() || 0, target, dur || 0, 1e6));
    } catch (_) {
      /* ignore */
    }

    let via = [];
    const yt = getYTPlayer();
    if (yt?.seekTo) {
      patchYTPlayer(yt);
      try {
        yt.seekTo(target, true);
        via.push("YT.API");
      } catch (_) {
        /* ignore */
      }
    }

    if (command("seekTo", [target, true])) via.push("postMessage");

    // DOM barra (works after maximo unlock)
    if (dur > 0 && clickBarRatio(Math.min(0.999, target / dur))) via.push("barra");
    else if (!(dur > 0) && clickBarRatio(0.999)) via.push("barra");

    try {
      if (typeof cmp?.irParaLivre === "function") {
        cmp.irParaLivre(target);
        via.push("irParaLivre");
      }
    } catch (_) {
      /* ignore */
    }

    try {
      if (dur > 0 && target >= dur - 1.5) {
        cmp?.terminou?.set?.(true);
        cmp?.avisar?.(dur);
        via.push("avisar(fim)");
      } else {
        cmp?.avisar?.(target);
        via.push("avisar");
      }
    } catch (_) {
      /* ignore */
    }

    post("log", {
      text: `${label} → ${Math.floor(target)}s via [${via.join("+") || "nenhum"}]`,
      level: via.length ? "info" : "error",
    });

    return { target, dur, via };
  }

  function seekBy(deltaSec) {
    doSeek(currentTime() + deltaSec, deltaSec >= 0 ? `Seek +${deltaSec}s` : `Seek ${deltaSec}s`);
  }

  function reportCredit(partial) {
    lastCreditSnapshot = {
      ...(lastCreditSnapshot || {}),
      t: Date.now(),
      running: !!creditRunning,
      ...partial,
    };
    post("creditProgress", lastCreditSnapshot);
  }

  /**
   * Credit watch time via stepped pings (V-01). goalSec = absolute assistido target.
   */
  async function creditTo(goalSec, label = "Assistir") {
    if (creditRunning) {
      post("log", { text: "Crédito já em andamento — aguarde", level: "warn" });
      return;
    }
    creditRunning = true;
    unlockCmp();
    silencePlayerAvisar();

    try {
      const aula = await fetchAula();
      let dur = currentDuration() || Number(aula?.duracao) || 0;
      if (!(dur > 0)) dur = readTempoFromDom()?.dur || 0;

      let credited = Number(aula?.assistido) || 0;
      if (aula?.videoOk) {
        markVideoDone(dur || credited);
        reportCredit({
          credited: dur || credited,
          duration: dur || credited,
          goal: dur || credited,
          pct: 100,
          videoOk: true,
          label,
          status: "já ok",
        });
        post("log", { text: "Servidor já tem videoOk", level: "info" });
        return;
      }
      if (!(dur > 0)) {
        post("log", { text: `${label}: sem duração (YT/DOM/API)`, level: "error" });
        reportCredit({ credited, duration: 0, goal: 0, pct: 0, status: "sem duração" });
        return;
      }

      const goal = Math.min(dur, Math.max(credited, Number(goalSec) || dur));
      if (goal <= credited + 0.5) {
        post("log", { text: `${label}: já em ${fmt(credited)} (meta ${fmt(goal)})`, level: "info" });
        reportCredit({
          credited,
          duration: dur,
          goal,
          pct: dur ? (credited / dur) * 100 : 0,
          status: "meta já atingida",
        });
        syncCreditUi(credited, dur);
        return;
      }

      try {
        getYTPlayer()?.pauseVideo?.();
      } catch (_) {
        /* ignore */
      }
      command("pauseVideo");

      let slack = 45;
      let waitMs = 280;
      let stalls = 0;
      let lastLogAt = 0;
      let lastUiAt = 0;
      let lastPingAt = Date.now();
      const t0 = Date.now();
      const startCred = credited;

      post("log", {
        text: `${label}: ${fmt(credited)} → ${fmt(goal)} / ${fmt(dur)}`,
        level: "warn",
      });
      reportCredit({
        credited,
        duration: dur,
        goal,
        pct: (credited / dur) * 100,
        status: "rodando",
        label,
      });
      syncCreditUi(credited, dur);

      while (credited < goal - 0.5) {
        await sleep(waitMs);
        if (!creditRunning) break;

        const wall = Math.max(0, (Date.now() - lastPingAt) / 1000);
        const target = Math.min(goal, credited + wall + slack);
        if (target <= credited + 0.2) continue;

        const body = await forcePing(target, dur, {
          quiet: Date.now() - lastLogAt < 2500,
        });
        lastPingAt = Date.now();

        if (!body) {
          stalls += 1;
          waitMs = Math.min(2000, waitMs + 120);
          if (stalls >= 10) {
            post("log", { text: "Crédito abortado: ping sem resposta", level: "error" });
            reportCredit({
              credited,
              duration: dur,
              goal,
              pct: (credited / dur) * 100,
              status: "falha ping",
              label,
            });
            break;
          }
          continue;
        }

        const got = Number(body.assistido);
        if (body.videoOk) {
          credited = Math.max(got || 0, dur);
          const wallSec = Math.round((Date.now() - t0) / 1000);
          const speed = (credited - startCred) / Math.max(1, wallSec);
          post("log", {
            text: `videoOk=true em ${fmt(credited)} — ${wallSec}s wall (~${speed.toFixed(1)}×)`,
            level: "info",
          });
          reportCredit({
            credited,
            duration: dur,
            goal: dur,
            pct: 100,
            videoOk: true,
            speed,
            status: "videoOk",
            label,
          });
          markVideoDone(dur);
          return;
        }

        if (!(got > credited + 0.05)) {
          stalls += 1;
          slack = Math.max(1.5, slack * 0.45);
          waitMs = Math.min(1500, Math.round(waitMs + 80));
          if (stalls === 1 || stalls % 4 === 0) {
            post("log", {
              text: `Teto do servidor em ${fmt(got || credited)} — slack→${slack.toFixed(1)}s`,
              level: "warn",
            });
          }
          if (stalls >= 30) {
            post("log", {
              text: `Crédito travado em ${fmt(credited)}. Slack esgotado (V-01).`,
              level: "error",
            });
            reportCredit({
              credited,
              duration: dur,
              goal,
              pct: (credited / dur) * 100,
              status: "travado",
              label,
            });
            syncCreditUi(credited, dur);
            break;
          }
          continue;
        }

        const gained = got - credited;
        const overWall = gained - wall;
        credited = got;
        stalls = 0;

        if (got < target - 0.75) {
          slack = Math.max(1.5, Math.min(slack, overWall + 0.5));
        } else {
          slack = Math.min(90, slack + 3);
          waitMs = Math.max(180, waitMs - 15);
        }

        const wallSec = Math.max(1, (Date.now() - t0) / 1000);
        const speed = (credited - startCred) / wallSec;
        const leftGoal = Math.max(0, goal - credited);
        const eta = speed > 0.3 ? Math.ceil(leftGoal / speed) : null;

        if (Date.now() - lastUiAt > 800) {
          lastUiAt = Date.now();
          syncCreditUi(credited, dur);
          reportCredit({
            credited,
            duration: dur,
            goal,
            pct: (credited / dur) * 100,
            speed,
            eta,
            status: "rodando",
            label,
          });
        }

        if (Date.now() - lastLogAt > 2000) {
          lastLogAt = Date.now();
          post("log", {
            text: `${label} ${fmt(credited)}/${fmt(goal)} (+${gained.toFixed(0)}s) · ${speed.toFixed(1)}× · ETA~${eta ?? "?"}s`,
            level: "info",
          });
        }
      }

      syncCreditUi(credited, dur);
      if (credited >= dur - 0.5) {
        const body = await forcePing(dur, dur);
        if (body?.videoOk) {
          markVideoDone(dur);
          reportCredit({
            credited: dur,
            duration: dur,
            goal: dur,
            pct: 100,
            videoOk: true,
            status: "videoOk",
            label,
          });
          return;
        }
      }

      reportCredit({
        credited,
        duration: dur,
        goal,
        pct: dur ? (credited / dur) * 100 : 0,
        status: credited >= goal - 0.5 ? "meta ok" : "parado",
        label,
      });
      post("log", {
        text: `${label} final: ${fmt(credited)} (meta ${fmt(goal)} / aula ${fmt(dur)})`,
        level: "info",
      });
    } finally {
      creditRunning = false;
      if (lastCreditSnapshot) {
        post("creditProgress", { ...lastCreditSnapshot, t: Date.now(), running: false });
      }
    }
  }

  async function creditBy(deltaSec, label) {
    const aula = await fetchAula();
    const credited = Number(aula?.assistido) || currentTime() || 0;
    const dur = currentDuration() || Number(aula?.duracao) || readTempoFromDom()?.dur || 0;
    const add = Math.max(1, Number(deltaSec) || 0);
    const goal = dur > 0 ? Math.min(dur, credited + add) : credited + add;
    const nice =
      label ||
      (add >= 60 ? `Assistir ${Math.round(add / 60)}m` : `Assistir ${Math.round(add)}s`);
    await creditTo(goal, nice);
  }

  async function seekToEnd() {
    const aula = await fetchAula();
    const dur = currentDuration() || Number(aula?.duracao) || readTempoFromDom()?.dur || 0;
    await creditTo(dur > 0 ? dur : 1e9, "Assistir resto");
  }

  function onYtMessage(ev) {
    const raw = ev.data;
    if (typeof raw !== "string" || raw.length < 2) return;
    if (raw[0] !== "{" && raw[0] !== "[") return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return;
    }
    const info = data?.info || data?.data;
    if (info && typeof info === "object") {
      if (typeof info.currentTime === "number") time = info.currentTime;
      if (typeof info.duration === "number" && info.duration > 0) duration = info.duration;
    }
  }

  function onBridge(ev) {
    const d = ev.data;
    if (!d || d.source !== "oxycamp-bridge") return;
    if (d.type === "settings") {
      freeSeek = d.freeSeek !== false;
      if (freeSeek) unlockCmp();
    }
    if (d.type === "seekBy") seekBy(Number(d.seconds) || 0);
    if (d.type === "seekEnd") seekToEnd();
    if (d.type === "creditBy") creditBy(Number(d.seconds) || 0, d.label);
    if (d.type === "creditStop") {
      creditRunning = false;
      post("log", { text: "Crédito interrompido pelo popup", level: "warn" });
    }
  }

  on(window, "message", onYtMessage);
  on(window, "message", onBridge);

  every(500, () => {
    if (!freeSeek) return;
    unlockCmp();
    const yt = getYTPlayer();
    if (yt) {
      try {
        const t = yt.getCurrentTime?.();
        const d = yt.getDuration?.();
        if (typeof t === "number") time = t;
        if (typeof d === "number" && d > 0) duration = d;
      } catch (_) {
        /* ignore */
      }
    } else {
      const dom = readTempoFromDom();
      if (dom) {
        time = dom.cur;
        duration = dom.dur;
      }
    }
  });

  globalThis.__oxycampPageUnlockCleanup = () => {
    creditRunning = false;
    for (const id of timers) {
      clearInterval(id);
      clearTimeout(id);
    }
    timers.length = 0;
    for (const fn of cleanups) {
      try {
        fn();
      } catch (_) {
        /* ignore */
      }
    }
    cleanups.length = 0;
  };

  unlockCmp();
  post("ready");
  post("log", { text: `page-unlock v${VERSION} ativo`, level: "warn" });
})();
