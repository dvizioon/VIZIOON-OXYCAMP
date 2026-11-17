/**
 * Bridge ChatGPT — Web API (ChatGPTBox) + DOM fallback (shell novo via main.innerText).
 * Roda em chatgpt.com com a sessão já logada.
 */
(() => {
  const BRIDGE_VERSION = 8;
  if (globalThis.__oxycampChatgptBridgeVersion === BRIDGE_VERSION) return;
  globalThis.__oxycampChatgptBridgeVersion = BRIDGE_VERSION;
  globalThis.__oxycampChatgptBridge = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uuid = () => crypto.randomUUID();

  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $$(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  }
  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const st = getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) !== 0;
  }

  function cookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function mainRoot() {
    return $("main") || document.body;
  }

  function mainPlainText() {
    return (mainRoot().innerText || "").replace(/\u200b/g, "").replace(/\s+\n/g, "\n").trim();
  }

  /* ─── Web API ─── */

  async function getAccessToken() {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (res.status === 403) throw new Error("API: Cloudflare — abra chatgpt.com e resolva");
    const data = await res.json().catch(() => ({}));
    if (!data?.accessToken) throw new Error("API: sem sessão — faça login no chatgpt.com");
    return data.accessToken;
  }

  async function getChatRequirements(token) {
    const res = await fetch("/backend-api/sentinel/chat-requirements", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  async function readSseText(res) {
    const ctype = res.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const j = await res.json().catch(() => null);
      const part = j?.message?.content?.parts?.[0];
      if (typeof part === "string" && part) return part;
      if (j?.detail) throw new Error(`API JSON: ${JSON.stringify(j.detail).slice(0, 160)}`);
      throw new Error("API: JSON sem texto");
    }

    if (!res.body) throw new Error("API: sem body");

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let answer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return answer;
        if (!data) continue;
        try {
          const j = JSON.parse(data);
          if (j.error) throw new Error(JSON.stringify(j.error));
          const parts = j.message?.content?.parts;
          if (Array.isArray(parts)) {
            const textParts = parts.filter((p) => typeof p === "string");
            if (textParts.length) answer = textParts.join("\n");
          }
        } catch (err) {
          if (String(err.message || "").startsWith("{")) throw err;
        }
      }
    }
    return answer;
  }

  async function askViaWebApi(prompt) {
    const token = await getAccessToken();
    const requirements = await getChatRequirements(token);

    // Sem arkose/PoW no bridge (ChatGPTBox tem lib própria). Se exigir, sobe pro DOM.
    if (requirements?.arkose?.required) throw new Error("API: Arkose exigido");
    if (requirements?.proofofwork?.required) throw new Error("API: Proof-of-work exigido");

    const deviceId = cookie("oai-did") || cookie("oai-hlib") || uuid();
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      "Oai-Device-Id": deviceId,
      "Oai-Language": "pt-BR",
    };
    if (requirements?.token) {
      headers["Openai-Sentinel-Chat-Requirements-Token"] = requirements.token;
    }

    const messageId = uuid();
    const parentId = uuid();

    const res = await fetch("/backend-api/conversation", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        action: "next",
        messages: [
          {
            id: messageId,
            author: { role: "user" },
            content: { content_type: "text", parts: [String(prompt)] },
            metadata: {},
          },
        ],
        model: "auto",
        parent_message_id: parentId,
        conversation_mode: { kind: "primary_assistant" },
        force_paragen: false,
        force_rate_limit: false,
        suggestions: [],
        history_and_training_disabled: true,
        timezone_offset_min: new Date().getTimezoneOffset(),
        websocket_request_id: uuid(),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`API HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const text = await readSseText(res);
    if (!text) throw new Error("API: resposta vazia");
    return text;
  }

  /* ─── DOM ─── */

  function findPromptBox() {
    const candidates = [
      $("#prompt-textarea"),
      $('form[data-type="unified-composer"] #prompt-textarea'),
      $('div#prompt-textarea[contenteditable="true"]'),
      $('div.ProseMirror[contenteditable="true"]'),
      ...$$('div[contenteditable="true"][role="textbox"]'),
      ...$$('div[contenteditable="true"]'),
      ...$$("textarea"),
    ].filter(visible);
    return (
      candidates.find((el) => el.getBoundingClientRect().top > window.innerHeight * 0.4) ||
      candidates[0] ||
      null
    );
  }

  function composerRoot(box) {
    return (
      box?.closest('form[data-type="unified-composer"]') ||
      box?.closest("form") ||
      box?.closest('[class*="composer"]') ||
      box?.closest("main") ||
      document.body
    );
  }

  function isDisabled(btn) {
    return (
      !btn ||
      btn.disabled ||
      btn.getAttribute("aria-disabled") === "true" ||
      btn.getAttribute("data-disabled") === "true"
    );
  }

  function labelOf(btn) {
    return (
      btn.getAttribute("aria-label") ||
      btn.getAttribute("data-testid") ||
      btn.getAttribute("title") ||
      btn.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function toolish(btn) {
    const bag = `${labelOf(btn)} ${btn.id || ""} ${btn.getAttribute("data-testid") || ""}`;
    return /stop|parar|voice|mic|attach|upload|dictat|foto|photo|speech|plus|search|web|tools|dictation|microphone/i.test(
      bag
    );
  }

  function findSendButton(box) {
    const root = composerRoot(box);
    const picks = [
      $("#composer-submit-button", root),
      $('[data-testid="send-button"]', root),
      $('[data-testid="composer-send-button"]', root),
      $('button[data-testid="send-button"]', root),
      $('button[aria-label="Send prompt"]', root),
      $('button[aria-label="Send message"]', root),
      $('button[aria-label="Enviar prompt"]', root),
      $('button[aria-label="Enviar mensagem"]', root),
      $("button.composer-submit-btn", root),
      $('button[type="submit"]', root),
    ];
    for (const b of picks) {
      if (b && visible(b) && !isDisabled(b) && !toolish(b)) return b;
    }

    const buttons = $$("button", root).filter((b) => visible(b) && !isDisabled(b) && !toolish(b));
    const byLabel = buttons.find((b) => /send|enviar|submit/i.test(labelOf(b)));
    if (byLabel) return byLabel;

    const byTid = buttons.find((b) =>
      /send|submit/i.test(`${b.id || ""} ${b.getAttribute("data-testid") || ""}`)
    );
    if (byTid) return byTid;

    // Shell novo: botão só com seta SVG, sem label — último botão habilitado do composer.
    if (buttons.length && readBoxText(box)) return buttons[buttons.length - 1];
    return null;
  }

  function findStopButton() {
    return (
      $$("button")
        .filter(visible)
        .find(
          (b) =>
            /stop-button|stop-generating|composer-stop/i.test(
              `${b.getAttribute("data-testid") || ""} ${b.id || ""}`
            ) || /^(stop|parar|stop generating|parar de gerar)/i.test(labelOf(b))
        ) || null
    );
  }

  function readBoxText(box) {
    return (box.innerText || box.textContent || box.value || "").replace(/\u200b/g, "").trim();
  }

  function setPromptText(box, text) {
    box.focus();
    box.click();

    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (proto?.set) proto.set.call(box, text);
      else box.value = text;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand("insertText", false, text);
    } catch (_) {
      ok = false;
    }

    if (!ok || !readBoxText(box)) {
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        box.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
      } catch (_) {
        /* ignore */
      }
    }

    if (!readBoxText(box)) {
      box.textContent = "";
      box.appendChild(document.createTextNode(text));
      box.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
  }

  function pressEnter(box) {
    box.focus();
    const opts = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };
    box.dispatchEvent(new KeyboardEvent("keydown", opts));
    box.dispatchEvent(new KeyboardEvent("keypress", opts));
    box.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  function uniqueLeaves(nodes) {
    return nodes.filter((el, i, arr) => el && !arr.some((o, j) => j !== i && o.contains(el)));
  }

  function cleanTurnText(raw) {
    let t = String(raw || "");
    t = t.replace(/^You said:\s*/i, "");
    t = t.replace(/^ChatGPT said:\s*/i, "");
    t = t.replace(/^ChatGPT\s*/i, "");
    t = t.replace(/^You\s*/i, "");
    t = t.split(/You said:\s*/i)[0];
    t = t.split(/ChatGPT can make mistakes/i)[0];
    t = t.split(/Latest response/i)[0];
    return scrubUiChrome(t);
  }

  function userMessages() {
    const preferred = $$(
      [
        "[data-user-message-bubble]",
        '[data-conversation-role="user"]',
        '[data-conversation-role="User"]',
        '[data-message-author-role="user"]',
        '[data-testid="user-message"]',
        '[data-turn="user"]',
        ".user-message-bubble-color",
      ].join(", ")
    );
    if (preferred.length) return uniqueLeaves(preferred);
    return uniqueLeaves($$("[data-thread-user-message-navigation-content]"));
  }

  function assistantRoots() {
    const preferred = $$(
      [
        "[data-response-body]",
        "[data-chatgpt-agent-turn-start]",
        '[data-conversation-role="assistant"]',
        '[data-conversation-role="Assistant"]',
        '[data-conversation-role="ChatGPT"]',
        '[data-message-author-role="assistant"]',
        '[data-turn="assistant"]',
        'article[data-testid^="conversation-turn-"]',
        '[data-testid="assistant-message"]',
      ].join(", ")
    );
    return uniqueLeaves(preferred);
  }

  function textFromAssistantRoot(el) {
    if (!el) return "";
    const preferred =
      el.querySelector("[data-markdown-text-style]") ||
      el.querySelector("[data-markdown-copy]") ||
      el.querySelector(".markdown") ||
      el.querySelector(".prose") ||
      el.querySelector('[class*="markdown"]') ||
      el.querySelector("[data-response-body]") ||
      el;
    const clone = preferred.cloneNode(true);
    clone
      .querySelectorAll("button, nav, [role='toolbar'], [class*='action']")
      .forEach((n) => n.remove());
    return cleanTurnText((clone.innerText || clone.textContent || "").replace(/\s+\n/g, "\n"));
  }

  function textFromUserRoot(el) {
    if (!el) return "";
    return cleanTurnText((el.innerText || el.textContent || "").replace(/\s+\n/g, "\n"));
  }

  function allAssistantTexts() {
    const texts = assistantRoots()
      .map(textFromAssistantRoot)
      .filter((t) => t && t.length > 0);
    const seen = new Set();
    const out = [];
    for (const t of texts) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  function scrubUiChrome(text) {
    return String(text || "")
      .replace(
        /\b(Copiar|Copy code|Copy|Bom|Ruim|Good response|Bad response|Compartilhar|Share|Regenerate|Tentar novamente|Continue generating|Continuar gerando|Editar|Edit)\b/gi,
        ""
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** Último bloco "ChatGPT said:" do main (shell acessível). */
  function lastChatGptSaidBlock(fullText) {
    const parts = String(fullText || "").split(/ChatGPT said:\s*/i);
    if (parts.length < 2) return "";
    return cleanTurnText(parts[parts.length - 1]);
  }

  /**
   * Resposta logo após o último eco do prompt no fio "You said: / ChatGPT said:".
   */
  function extractAfterPrompt(fullText, prompt) {
    const needle = String(prompt || "").trim();
    const text = String(fullText || "");
    if (!needle) return lastChatGptSaidBlock(text);

    const lower = text.toLowerCase();
    const promptLower = needle.toLowerCase();
    let searchFrom = 0;
    let bestYou = -1;

    while (true) {
      const youIdx = lower.indexOf("you said:", searchFrom);
      if (youIdx < 0) break;
      const afterYou = text.slice(youIdx + "you said:".length).replace(/^\s+/, "");
      const head = afterYou.slice(0, Math.max(promptLower.length + 8, 64)).toLowerCase();
      if (head.startsWith(promptLower) || head.includes(promptLower.slice(0, Math.min(12, promptLower.length)))) {
        bestYou = youIdx;
      }
      searchFrom = youIdx + 9;
    }

    if (bestYou < 0) return lastChatGptSaidBlock(text);

    const from = text.slice(bestYou);
    const cgMatch = from.match(/ChatGPT said:\s*/i);
    if (!cgMatch) return "";
    const replyStart = cgMatch.index + cgMatch[0].length;
    let reply = from.slice(replyStart);
    reply = reply.split(/You said:\s*/i)[0];
    reply = reply.split(/ChatGPT can make mistakes/i)[0];
    reply = reply.split(/Latest response/i)[0];
    reply = reply.split(
      /\n(?:Pergunte qualquer coisa|Ask anything|Message ChatGPT|Enviar uma mensagem)\b/i
    )[0];
    return cleanTurnText(reply);
  }

  async function waitForReplyMainText(prompt, prevAssistantCount, timeoutMs = 45000) {
    const t0 = Date.now();
    let stable = "";
    let hits = 0;
    const prevLast = allAssistantTexts().slice(-1)[0] || "";

    while (Date.now() - t0 < timeoutMs) {
      // Preferir nodes novos do shell
      const assists = allAssistantTexts();
      if (assists.length > prevAssistantCount) {
        const cur = assists[assists.length - 1] || "";
        if (cur && cur !== prevLast) {
          if (cur === stable) hits += 1;
          else {
            stable = cur;
            hits = 0;
          }
          if (!findStopButton() && hits >= 2) return stable;
        }
      }

      const after = extractAfterPrompt(mainPlainText(), prompt);
      const stopping = !!findStopButton();

      if (after.length > 0 && after !== prevLast) {
        if (after === stable) hits += 1;
        else {
          stable = after;
          hits = 0;
        }
        if (!stopping && hits >= 3) return stable;
      }

      await sleep(300);
    }

    if (stable) return stable;
    throw new Error(`DOM: main-text sem resposta (mainLen=${mainPlainText().length})`);
  }

  async function waitComposerSent(box, timeoutMs = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (!readBoxText(box)) return true;
      if (findStopButton()) return true;
      // eco do usuário no main
      await sleep(200);
    }
    return !readBoxText(box) || !!findStopButton();
  }

  async function waitForUserEcho(prompt, prevCount, timeoutMs = 12000) {
    const needle = String(prompt).trim().slice(0, 48).toLowerCase();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const users = userMessages();
      if (users.length > prevCount) {
        const last = (users[users.length - 1].innerText || "").trim().toLowerCase();
        if (!needle || last.includes(needle.slice(0, 12)) || needle.includes(last.slice(0, 12))) {
          return true;
        }
      }
      if (findStopButton()) return true;
      // Shell novo: eco aparece no main.innerText sem nodes de role
      const main = mainPlainText().toLowerCase();
      if (needle && main.includes(needle.slice(0, Math.min(24, needle.length)))) return true;
      await sleep(250);
    }
    return false;
  }

  async function waitForNewAssistant(prevTexts, timeoutMs = 12000) {
    const prev = new Set(prevTexts);
    const t0 = Date.now();
    let stable = "";
    let stableHits = 0;

    while (Date.now() - t0 < timeoutMs) {
      const now = allAssistantTexts();
      const newer = now.filter((t) => !prev.has(t));
      const cur = newer[newer.length - 1] || "";
      const stopping = !!findStopButton();

      if (cur) {
        if (cur === stable) stableHits += 1;
        else {
          stable = cur;
          stableHits = 0;
        }
        if (!stopping && stableHits >= 2) return stable;
      }

      await sleep(280);
    }

    return stable || "";
  }

  async function submitDom(box) {
    let send = null;
    for (let i = 0; i < 30; i++) {
      send = findSendButton(box);
      if (send && !isDisabled(send)) break;
      await sleep(100);
    }
    if (send && !isDisabled(send)) {
      send.click();
      return "click";
    }
    pressEnter(box);
    await sleep(200);
    const form = box.closest("form");
    if (form?.requestSubmit) {
      try {
        form.requestSubmit();
        return "form";
      } catch (_) {
        /* ignore */
      }
    }
    return "enter";
  }

  async function askViaDom(prompt) {
    const box = findPromptBox();
    if (!box) throw new Error("DOM: caixa não encontrada — deixe o chat aberto");

    const prevTexts = allAssistantTexts();
    const prevUsers = userMessages().length;

    setPromptText(box, prompt);
    await sleep(350);
    if (!readBoxText(box)) {
      setPromptText(box, prompt);
      await sleep(350);
    }
    if (!readBoxText(box)) throw new Error("DOM: não conseguiu digitar no composer");

    await submitDom(box);

    const echoed = await waitForUserEcho(prompt, prevUsers, 10000);
    const cleared = await waitComposerSent(box, 8000);

    if (!echoed && !cleared && !findStopButton()) {
      pressEnter(box);
      await waitForUserEcho(prompt, prevUsers, 6000);
      await waitComposerSent(box, 5000);
      if (readBoxText(box) && !findStopButton()) {
        throw new Error("DOM: mensagem não foi enviada (composer)");
      }
    }

    // 1) seletores clássicos (se existirem)
    const viaSel = await waitForNewAssistant(prevTexts, 8000);
    if (viaSel) return viaSel;

    // 2) shell novo: data-response-body / bloco "ChatGPT said:"
    return waitForReplyMainText(prompt, prevTexts.length, 45000);
  }

  /* ─── diagnóstico + public ─── */

  function topDataAttrs(limit = 35) {
    const counts = Object.create(null);
    try {
      for (const el of mainRoot().querySelectorAll("*")) {
        for (const a of el.attributes) {
          if (!a.name.startsWith("data-")) continue;
          counts[a.name] = (counts[a.name] || 0) + 1;
        }
      }
    } catch (_) {
      /* ignore */
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, v]) => `${k}:${v}`);
  }

  function classHits() {
    const sels = {
      responseBody: "[data-response-body]",
      userBubbleAttr: "[data-user-message-bubble]",
      conversationRole: "[data-conversation-role]",
      agentTurn: "[data-chatgpt-agent-turn-start]",
      markdownStyle: "[data-markdown-text-style]",
      proseMirror: "div.ProseMirror",
      threadUser: "[data-thread-user-message-navigation-content]",
      threadFind: "[data-thread-find-target]",
      testIdSend: '[data-testid*="send"]',
    };
    const out = {};
    for (const [k, sel] of Object.entries(sels)) {
      out[k] = $$(sel).length;
    }
    return out;
  }

  function diagnose() {
    const box = findPromptBox();
    const send = box ? findSendButton(box) : null;
    const assists = allAssistantTexts();
    const users = userMessages();
    const mainText = mainPlainText();
    const lastFromMain = lastChatGptSaidBlock(mainText);
    return {
      ok: true,
      version: BRIDGE_VERSION,
      href: location.href,
      title: document.title.slice(0, 80),
      hasPrompt: !!box,
      promptTag: box ? `${box.tagName}.${box.className}`.slice(0, 80) : "",
      promptText: box ? readBoxText(box).slice(0, 60) : "",
      hasSend: !!send,
      sendLabel: send ? labelOf(send).slice(0, 60) : "",
      sendDisabled: send ? isDisabled(send) : null,
      hasStop: !!findStopButton(),
      userCount: users.length,
      assistantCount: assists.length,
      lastAssistant: (assists[assists.length - 1] || lastFromMain || "").slice(0, 160),
      lastUser: users.length ? textFromUserRoot(users[users.length - 1]).slice(0, 80) : "",
      roleAssistantNodes: $$('[data-message-author-role="assistant"]').length,
      turnAssistantNodes: $$('[data-turn="assistant"]').length,
      articleTurns: $$('article[data-testid^="conversation-turn-"]').length,
      markdownNodes: $$(".markdown, .prose, [data-markdown-text-style]").length,
      responseBodies: $$("[data-response-body]").length,
      mainLen: mainText.length,
      mainTail: mainText.slice(-220),
      classHits: classHits(),
      dataAttrs: topDataAttrs(30),
    };
  }

  let busy = false;

  async function ask(prompt) {
    if (busy) throw new Error("ChatGPT: pedido em andamento — espera ou F5 na aba");
    busy = true;
    const errors = [];
    try {
      try {
        return await askViaWebApi(prompt);
      } catch (e) {
        errors.push(e?.message || String(e));
      }
      try {
        return await askViaDom(prompt);
      } catch (e) {
        errors.push(e?.message || String(e));
      }
      const snap = diagnose();
      throw new Error(
        `${errors.join(" → ")} | diag: v=${snap.version} assist=${snap.assistantCount} user=${snap.userCount} send=${snap.hasSend} mainLen=${snap.mainLen}`
      );
    } finally {
      busy = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "CHATGPT_PING") {
      sendResponse({ ok: true, bridge: true, version: BRIDGE_VERSION, modes: ["webapi", "dom"] });
      return true;
    }
    if (msg?.type === "CHATGPT_DIAG") {
      try {
        sendResponse(diagnose());
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
      return true;
    }
    if (msg?.type !== "CHATGPT_ASK") return false;
    const hardTimeout = sleep(55000).then(() => {
      throw new Error("ChatGPT: timeout 55s — F5 no chatgpt.com e tenta de novo");
    });
    Promise.race([ask(String(msg.prompt || "")), hardTimeout])
      .then((text) => sendResponse({ ok: true, text }))
      .catch((e) => {
        busy = false;
        sendResponse({ ok: false, error: e?.message || String(e) });
      });
    return true;
  });
})();
