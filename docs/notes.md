# Notes — PLUGIN-OXYCAMP

## 2026-11-16 — Análise do snapshot `docs/`

### Arquitetura observada
- Angular 21 + PO-UI (TOTVS) + YouTube IFrame API (`youtube-nocookie.com`).
- Componente crítico: `app-player-travado` em `docs/chunk-4PKINWVF.js`.
- API client em `docs/chunk-BVQJ3B6M.js`.

### Fluxo de progresso
- Cliente chama `POST /api/aprender/aulas/{id}/ping` com `{ posicao, duracao }` a cada ~10s enquanto toca, e no pause/destroy/end.
- Resposta traz `assistido` e `videoOk`. Se o servidor devolver `assistido` bem abaixo do `maximo` local, o player puxa o seek de volta.
- Conclusão do vídeo emite `concluido` → UI libera quiz (`videoOk`).

### Defesas client-side
| Defesa | Comportamento | Força |
|--------|---------------|-------|
| Seek lock | `vigiar()` a cada 250ms; se `currentTime > maximo+1.5` → `seekTo(maximo)` | Fraca se `maximo` for mutável no JS |
| Speed lock | `onPlaybackRateChange` força rate=1 | Fraca (só YouTube API) |
| Blur/aba | `window.blur` e `visibilitychange` pausam | Fraca — content script pode retomar |
| Presença | Sorteia 180–360s de play; modal 30s | Fraca — botão confirmável por script |
| Admin `avancoLivre` | Flag `podeAvancar` do backend | Depende do servidor |

### Vulnerabilidades / riscos (prioridade)
1. **V-01 Progresso depende de ping com posição reportada pelo cliente.** Se o backend não limitar avanço por tempo real (ex.: posicao não pode crescer mais rápido que elapsed wall-clock + margem), um atacante forja conclusão sem assistir.
2. **V-02 Presença é 100% client-side.** Confirmar presença não parece enviar evento dedicado ao servidor; só o ping contínuo importa.
3. **V-03 Pause por blur não impede automação.** Qualquer extensão/userscript retoma `play` / clica o botão.
4. **V-04 Gabarito no client.** `estadoOpcao` adiciona classe CSS `gabarito` quando `questao.gabarito` vem no payload; `gabaritoAdmin` renderiza texto. Automação de quiz só precisa clicar `.caixa.gabarito`.
5. **V-05 YouTube ID exposto no DOM/iframe.** Conteúdo pode ser assistido fora da plataforma; só o *crédito* depende do ping autenticado.
6. **V-06 Seek lock só no client.** Aviso “Você só pode voltar ou rever o que já assistiu” vem de `irPara`/`vigiar` comparando com `maximo`. Subir `maximo` (ou `avancoLivre`) libera a barra. O servidor ainda pode puxar de volta no `ping` se rate-limitar (V-01).

### Mitigações recomendadas (servidor)
- Rate-limit de `posicao` por sessão: Δposicao ≤ Δt_wall + slack.
- Exigir N pings espaçados cobrindo a duração antes de `videoOk`.
- Assinar sessão de watch (token de início + heartbeat).
- Não confiar em flags só de UI para liberar quiz.
- **Nunca** incluir `gabarito` no payload da questão antes de `responder`; remover classe/estilo que dependa disso.

### Ideia de produto
Plugin de **auto-assistência QA** (playback real + auto-presença + anti-blur + avanço de módulos) para o dono testar a experiência e endurecer o backend — não forjar `posicao`.

### Ops / extensão
- Erro `Receiving end does not exist` = aba aberta **antes** do reload da extensão (content script não injeta sozinho). Fix 0.3.1: popup faz `chrome.scripting.executeScript` (MAIN + ISOLATED) e `ping` antes dos botões de seek. Ainda assim: Reload na extensão + F5 na aula é o caminho limpo.
- Erro `Player ainda não pronto para seek` = dependia do componente Angular/`cmp.player`. Fix 0.3.2: seek via `YT.get` + `postMessage` no iframe + bloqueio de snap-back do `vigiar`; reinjeção versionada (não fica preso na v antiga).
- Quiz voltava sempre à questão 1: MutationObserver + clique fuzzy em “Continuar/Refazer” reiniciava a tentativa. Fix 0.3.3: state machine (`quizSession`), só “Fazer o quiz” uma vez, “Continuar” só após `.certa/.errada`, observer não chama mais `startQuizIfReady`.
- Após Aula 2, voltava pra Aula 1: `li:not(.travada):not(.atual) a` pegava a primeira liberada (Aula 1 concluída). Fix 0.3.4: só anda `atualIdx+1…`, só sai se aula atual estiver done; popup recarrega aba se detectar script < v5. Ver `docs/api.txt`.
- Botão **Fim** não andava: `postMessage` ia pra iframe same-origin (ainda não YT) → erro de origin. Fix 0.3.5: só fala com iframe YT cross-origin; seek via YT.API + barra DOM + `POST /ping` com cookie da sessão. Quiz `.contador` (marca d’água poluía progresso).
- **V-01 confirmado em produção:** um ping no fim é rejeitado → toast “Uma parte do vídeo não foi registrada. Continue a partir de 0:48…”. O player (`avisar`) puxa `maximo`/`seekTo` de volta para `assistido`. Fix 0.3.6: **Fim** faz crédito em degrau (`GET aula` → pings com `posicao` crescente até `videoOk`), silencia `avisar` do Angular durante o crawl, sincroniza UI com `assistido`. Se o rate-limit for ~1× wall-clock, o ETA ≈ tempo restante do vídeo.
- Fix 0.3.7: crédito **rápido** — pings ~280ms usando `posicao = assistido + Δwall + slack` (slack inicial 45s, adapta). Taxa ≈ `1 + slack/intervalo` (ex.: slack 8 / 0.3s ≈ 27×). Antes o step = gained travava em ~1×.
- **V-11 Quiz via LLM:** sem gabarito no DOM (usuário comum), a extensão manda enunciado+opções ao OpenRouter e clica pelos `indices`. Key fica só em `chrome.storage` (popup). Risco: modelo erra / custo por questão; ordenar depende de cliques em `button.bloco`.
- **0.4.0 modularização:** monolitos `content.js` / `background.js` / `popup.*` viraram pastas. Content usa namespace clássico `OxyCamp` (reinject multi-file); background/popup são ESM. Catálogo de modelos via `GET /api/v1/models` (cache 12h) + filtro no popup (`modelFilter`).
- **0.4.1 assistir em blocos:** remove botão Fim; popup tem +10s / +1m / +10m + input de minutos; crédito via pings; barra de progresso (`creditProgress` no storage) pra acompanhar sem dar F5 na aula.
- **0.4.2 completar:** questões `completar` renderizam opções em `.banco button.bloco` + lacuna (não `.caixa`). Fix: ler/clicar `bloco`, detectar seleção por `.usado-palavra` / texto na lacuna. Ver `docs/api.txt`.
- **0.5.0 multi-AI + video tab:** provedores OpenRouter / Gemini / Groq com link pro site de keys; popup tabs OPS/AI/VIDEO/LOGS; visual hacker + “by Dvizioon”; extrai `youtubeId` do iframe e oferece helpers externos (cobalt/y2mate) — download nativo YT continua bloqueado pelo Google.
- **0.5.2 quiz reabre:** voltar do quiz pro vídeo da mesma aula resetava a sessão (hash change / lock 2min) e o auto clicava de novo em “fazer o quiz”. Fix: `startedOnce` + `aulaId` — só reseta ao trocar de aula; `quizAlreadyStartedHere` bloqueia reentrada.
- **0.5.3 refazer:** `clickByLabel` usa `includes("fazer o quiz")`, então **“Refazer o quiz”** também batia e reabria o quiz ao voltar pro vídeo. Fix: match exato `label === "fazer o quiz"` + skip se aula atual já tem check.
- **0.6.0 Pular leitura:** do vídeo atual até o **último** da lista: crédito rápido nos intermediários, avança sem abrir quiz; no último fica e faz o crédito/play. Toggle `autoQuiz` (off por padrão). Se a próxima ficar `.travada` sem `quizOk` no servidor, o avanço para (limitação do backend).
- **0.6.1 ChatGPT (aba):** provedor `chatgpt` automatiza o DOM de `chatgpt.com` com a sessão já logada (sem cookie/token / sem `backend-api`). Quebra se a OpenAI mudar seletores; pode conflitar com ToS. Para produção séria, API oficial.
- **0.6.3:** remove UI “Pular leitura”. Com **Abrir quiz** off, o plugin **não navega** sozinho — fica na aula atual. Keys salvas no `chrome.storage.local` + teste pergunta/resposta no popup.
- **0.6.5 ChatGPT Web API:** bridge no estilo ChatGPTBox — `GET /api/auth/session` + `POST /backend-api/conversation` (SSE) na aba logada; se Arkose/PoW/erro, cai no DOM. Ref: `docs/chatGPTBox`.

### Testes executados
- `tests/security/v01-ping-rate-limit.test.mjs` → PASS (mitigação simulada)
- `tests/security/v02-presence-is-client-only.test.mjs` → PASS (confirmado: sem endpoint de presença no client API)
- `tests/security/v03-blur-pause-bypassable.test.mjs` → PASS (blur/aba só pausam no client; extensão retoma)
- `tests/security/v04-gabarito-leaked-in-client.test.mjs` → PASS (gabarito vaza para CSS/DOM)
- `tests/security/v06-seek-lock-client-only.test.mjs` → PASS (trava de seek é client-side)

### Implicação para o plugin
Auto-clicar presença prova V-02 na prática: o backend só “vê” pings contínuos. Endurecer com heartbeats autenticados + tempo mínimo de sessão.
Auto-avançar módulos prova V-04: **nunca envie `gabarito` no JSON da questão antes da resposta**; corrija só no `POST .../responder`.
