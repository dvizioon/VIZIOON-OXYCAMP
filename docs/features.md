# Features

## Planned / in progress
- *(none)*

## Done
- **feature/chatgpt-session-bridge** — Provedor ChatGPT via aba logada: Web API estilo ChatGPTBox (`/api/auth/session` + `/backend-api/conversation`) com fallback DOM (V-18); 0.6.5.
- **feature/pular-leitura** — Botão “Pular leitura”: encadeia vídeos sem quiz até o último; intermediários só creditam e avançam; último assiste de verdade. `autoQuiz` off por padrão (V-17); 0.6.0 / content v16.
- **feature/hacker-multi-ai-video** — UI hacker + by Dvizioon; provedores OpenRouter/Gemini/Groq (link SITE); aba VIDEO (YT id / open / download helpers) (V-15); 0.5.0 / content v13.
- **feature/fix-completar-bloco** — Quiz `completar` clica `.banco button.bloco` + detecta `.usado-palavra` (V-14); 0.4.2 / content v12.
- **feature/watch-credit-blocks** — Assistir +10s/+1m/+10m + minutos custom; barra de progresso no popup; remove Fim (V-13); 0.4.1 / content v11 / page-unlock v7.
- **feature/modularize-openrouter-models** — Extensão modular (`background/`, `content/`, `popup/`, `page/`, `shared/`); catálogo completo OpenRouter + filtro no popup (V-12); 0.4.0 / content v10.
- **feature/openrouter-quiz-ai** — Quiz automático via OpenRouter: lê enunciado/tipo/opções, pede JSON `{indices}`, clica/preenche; fallback gabarito DOM; key no popup (V-11); 0.3.8 / content v9.
- **feature/fix-seek-end-ping-credit** — Seek Fim credita via pings incrementais (V-01/V-10); crédito rápido com slack; 0.3.7 / page-unlock v6.
- **feature/fix-quiz-next-question** — Quiz não reinicia na Q1 (V-07); próxima aula só para frente, nunca volta pra Aula 1 (V-08); content v5.
- **feature/unlock-seek** — Desbloqueia “Você só pode voltar ou rever…”. Script MAIN (`page-unlock.js`) sobe `maximo` à duração; popup com +10s / +1 min / Fim. Toggle `freeSeek`. V-06.
- **feature/auto-advance-modules** — Após o vídeo: inicia quiz, usa gabarito vazado no DOM (`.caixa.gabarito` / `.gabarito-admin`), verifica, continua e abre a próxima aula não travada. Toggle `autoModules` no popup. V-04.
- **feature/auto-watch-plugin** — Extensão MV3: auto-retoma play, confirma presença, anti-blur, logs no popup (sem forjar ping). V-01..V-03.
- **main scaffolding** — workspec, notes, features, readme, snapshot `docs/`.

## Deferred
- Forge-ping red-team harness against **local mock only** (security branch).
- Tipos de quiz `ordenar` sem classe gabarito (arrastar blocos).
- Dashboard de telemetria de sessões de watch.
