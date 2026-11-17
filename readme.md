# PLUGIN-OXYCAMP

Plugin de automação/QA para a plataforma **OxyEduCorp** (cursinho online com player travado).

## O que é
Extensão Chromium que:
- Detecta `app-player-travado`
- Mantém o vídeo tocando (retoma após blur / troca de aba)
- Confirma automaticamente o check de presença
- **Avança módulos**: vai de aula em aula; quiz só se “Abrir quiz” estiver ligado
- **ChatGPT (aba)**: quiz via sessão logada no `chatgpt.com` (sem key; seletores podem mudar)
- **Abrir quiz off**: fica na aula atual (não troca de página sozinho)
- **Libera seek do vídeo**: remove a trava “só pode rever o que já assistiu” (+10s / +1 min / Fim no popup)
- Registra eventos no painel da extensão (logs)

Documentação de referência (HTML/JS salvos da plataforma): `./docs/`

## Estrutura
| Path | Função |
|------|--------|
| `extension/manifest.json` | MV3 |
| `extension/shared/` | Constantes + lista de scripts |
| `extension/background/` | Service worker (ESM) + OpenRouter |
| `extension/content/` | Scripts isolados (DOM, quiz, nav…) |
| `extension/page/` | Unlock seek (MAIN world) |
| `extension/popup/` | UI + filtro de modelos |
| `docs/` | Snapshot da UI OxyEduCorp |
| `tests/security/` | Vetores (um por vez) |
| `notes.md` / `features.md` | Aprendizados e features |

## Instalar a extensão (Chrome/Edge/Brave)
1. Abra `chrome://extensions`
2. Ative **Developer mode**
3. **Load unpacked** → selecione a pasta `extension/`
4. Abra uma aula em `oxyeducorp.oxygeni.com.br` e deixe a extensão ligada
5. Depois de cada update: **Reload** na extensão **e F5** na aula
6. Console: `Content script v13` / `page-unlock v7`
7. Popup (by **Dvizioon**): aba **AI** → escolha provedor (OpenRouter / Gemini / Groq) → cole a key (botão **SITE** abre a página de keys)
8. Aba **VIDEO**: SCAN pega o YouTube ID → abrir YT / helpers de download
9. Popup detecta versão antiga e recarrega a aba sozinho

## Segurança
O progresso real ainda depende de `POST /api/aprender/aulas/{id}/ping`.
Controles só no cliente (seek, velocidade, presença) podem ser contornados — ver `notes.md`.

## Desenvolvimento
```bash
git checkout -b feature/<nome>
# altere → teste um vetor → commit
```

## Testes de segurança (um vetor por vez)
```bash
node tests/security/v01-ping-rate-limit.test.mjs
node tests/security/v02-presence-is-client-only.test.mjs
node tests/security/v03-blur-pause-bypassable.test.mjs
node tests/security/v04-gabarito-leaked-in-client.test.mjs
node tests/security/v06-seek-lock-client-only.test.mjs
node tests/security/v10-incremental-ping-credit.test.mjs
node tests/security/v11-openrouter-quiz-solver.test.mjs
node tests/security/v12-modular-openrouter-models.test.mjs
# or: npm test
```

## Branches
- `main` — workspec / docs base
- `docs/oxyeducorp-snapshot` — snapshot da UI
- `feature/auto-watch-plugin` — vídeo + presença
- `feature/auto-advance-modules` — quiz + próxima aula
- `feature/unlock-seek` — liberar avanço de minutos
- `feature/fix-quiz-next-question` — quiz avança sem voltar pra 1ª (**branch atual**)

## Seek livre
1. Ative **Liberar avanço do vídeo** no popup
2. Use a barra do player ou os botões **+10s / +1 min / Fim**
3. **Fim** credita rápido via pings curtos (`assistido + wall + slack`) até `videoOk`. Log: `Crédito … · 12.0× · ETA~…s`. O teto ainda é o rate-limit do servidor (V-01).

## Fluxo automático de módulo
1. Assiste o vídeo (playback real + presença)
2. Clica **Fazer o quiz**
3. Responde: gabarito DOM se existir; senão **OpenRouter** lê a questão e clica as opções → **Verificar** → **Continuar**
4. Abre a próxima `li` não `.travada` na lista de aulas

## OpenRouter (quiz)
- Toggle **Quiz via OpenRouter** + API key no popup
- Lista **todos** os modelos text via `GET /api/v1/models` (cache local 12h; botão ↻ força refresh)
- Campo **Filtrar modelos** (ex.: `claude`, `gpt-4o`, `deepseek`)
- Background: `chat/completions` + prompt JSON `{"indices":[...],"reason":"..."}`
- Default: `openai/gpt-4o-mini`

## API relevante (do bundle)
- `GET /api/aprender/aulas/{id}`
- `POST /api/aprender/aulas/{id}/ping` body `{ posicao, duracao }`
- Quiz: `POST /api/aprender/aulas/{id}/quiz`
- Questão: `POST /api/aprender/tentativas/{id}/questao`
- Resposta: `POST /api/aprender/tentativas/{id}/responder`
- Finalizar: `POST /api/aprender/tentativas/{id}/finalizar`
