# Estado Atual — CRM Simples Assim

> Atualizado em 12/07/2026. Não editar manualmente. Documento aditivo — não substituir seções antigas, apenas acrescentar.

---

## ACHADO E FUSÃO: DUAS LINHAGENS DIVERGENTES DESTE DOCUMENTO (12/07/2026)

Auditoria de hoje encontrou que este documento vinha sendo mantido em **duas linhagens paralelas, sem saber uma da outra**:

- **Linhagem A ("detalhe técnico")** — a que está preservada abaixo, a partir de "CONTEXTO GERAL". Foi commitada por último em 26/06/2026 e tem o conteúdo mais rico: refatoração do `App.jsx`, schema completo, funções SQL, correções N1–N6/M1–M3/B1–B5, e a Seção 12 inteira sobre o modelo de dados de Comissões (Fase 0). Nunca recebeu as Seções 0/0.1/0.2 abaixo.
- **Linhagem B ("incidente/redesign")** — vinha registrando o incidente de produção de 29-30/06 e o redesign visual (Fase 1, Cross-sell, Sinistros, sidebar), mas partiu de uma versão **mais antiga e mais simples** das Seções 1–11 (sem o detalhe técnico da Linhagem A, sem a Seção 12).

**A partir de hoje, as duas viram uma só.** Este arquivo tem a Linhagem A intacta a partir de "CONTEXTO GERAL", com a Linhagem B (Seções 0 a 0.10) inserida antes dela, e uma auditoria completa + correções de hoje logo a seguir. Nenhuma frase de nenhuma das duas foi apagada.

**Causa provável da divergência:** pelo menos uma atualização anterior deste arquivo (a de 06/07/2026, sessão de redesign) nunca chegou a ser commitada de verdade — o texto foi gerado, mas o arquivo em disco não foi sobrescrito (confirmado via `git log` do arquivo: o commit real mais recente antes de hoje era de 26/06). Também existia uma **cópia solta na raiz do repositório** (`/estado-atual-crm.md`, sem ser em `/src/`, datada de 19/06) — removida hoje. **Lição:** depois de qualquer atualização de doc, confirmar com um comando simples (`Select-String -Path src\estado-atual-crm.md -Pattern "algo que só existe na versão nova"`) que o arquivo em disco realmente mudou, antes de assumir que o commit vai pegar o conteúdo certo.

---

## SEÇÃO 0 — INCIDENTE DE PRODUÇÃO (29-30/06/2026) E CORREÇÕES — LER ANTES DE QUALQUER MERGE/DEPLOY

### O que aconteceu
Durante a Fase 1 do redesign visual (branch `redesign-fase1-layout`), Claude incluiu o passo de merge na `main` dentro de uma lista de comandos sem pedir aprovação explícita. Salim executou o merge, disparando deploy automático de produção e **derrubando crm.simplesassim.com.br** (tela branca, `Uncaught Error: supabaseUrl is required`).

### Causa raiz
As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel estavam configuradas **apenas para Preview** (banco de teste `ijlwdshwmsgkvsdjxfad`). O ambiente Production nunca teve essas variáveis. No Vite, variáveis são gravadas nos arquivos JS no momento do build — reaproveitar um deploy antigo não resolve; é necessário forçar build novo.

### Correções aplicadas
- **Variáveis separadas por escopo no Vercel:**
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → **Production** = `mrxfgvotcmtdmuzcajin`
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → **Preview** = `ijlwdshwmsgkvsdjxfad`
  - Campo "Note" usado para anotar qual banco (valores ficam mascarados como Sensitive)
- **Proteção de branch no GitHub** (Settings → Rules → Rulesets → "protege-main", Active):
  - "Require a pull request before merging" (Required approvals: 0)
  - "Restrict deletions" e "Block force pushes"
  - Testado: `git push` direto para `main` é rejeitado (`GH013`) — **confirmado de novo hoje (12/07), inclusive para arquivo de documentação (ver Seção 0.13)**
- **Fluxo correto daqui pra frente:** branch separada → PR → merge. Nunca push direto na `main` — **sem exceção para nenhum tipo de arquivo.**
- **Claude nunca inclui merge/push para `main` em lista de passos** — sempre pergunta isolada com aprovação explícita.

---

## SEÇÃO 0.1 — REDESIGN FASE 1 (SeguraPro) — CONCLUÍDA E EM PRODUÇÃO (30/06/2026)

Sistema de cor único com par claro/escuro no `tailwind.config.js`:
- Tokens: `canvas`, `painel`, `sidebar` (navy, muda com o tema), `borda`, `marca` (gold/navy)
- Sidebar: navy `#0F2044` no claro, navy profundo `#0B1730` no escuro
- Cabeçalhos de coluna do Kanban: fundo neutro + borda fina colorida no topo (campo `accent`)
- Arquivos novos: `Layout.jsx`, `navConfig.js`
- Arquivos modificados: `tailwind.config.js`, `App.jsx`, `Dashboard.jsx`, `Segurados.jsx`, `PipelineUI.jsx`, `constants.js`
- Títulos com `dark:text-slate-100` em Dashboard e Segurados (corrigidos durante Fase 1)

**Débitos técnicos (Asana):**
- gid 1216140717738568 — Polimento dark mode: cards internos de Dashboard.jsx e Segurados.jsx
- gid 1216135141084286 — Limpeza de lint do App.jsx

**Nota de 06/07 (auditoria de código):** essa seção registrava a migração de tokens como concluída, mas na prática só o `<h1>` de Dashboard.jsx e Segurados.jsx tinha `dark:` — o resto do corpo (cards, modal, inputs) continuava com cores hardcoded. Migração completa de verdade só em 06/07 — ver Seção 0.4. Sidebar também deixou de ser navy fixo — ver Seção 0.10.1.

---

## SEÇÃO 0.2 — FIX MODALCARD (01/07/2026) — EM PRODUÇÃO

### Problema corrigido
`handleExtrairDados` no `ModalCard.jsx` usava lógica "preenche só se vazio" para todos os campos. Em cards de renovação, `dataRenovacao` já tem valor do ciclo anterior, então a vigência nova extraída do PDF era descartada silenciosamente. Campos como telefone, e-mail, condutor e estado civil nunca foram mapeados nessa função.

### Correção aplicada
Campos que mudam a cada ciclo agora **sempre sobrescrevem** ao extrair PDF:
`dataRenovacao`, `vigenciaInicio` (novo), `valor`, `premioLiquido`, `seguradora`, `proposta`, `apolice`, `etiquetaPagamento`, endereço completo (7 campos), `telefone`, `email`, `autoEstadoCivil`, `autoCondutor`, `autoCpfCondutor`, `autoNascimentoCondutor`, `autoEstadoCivilCondutor`, `autoCondutor1825`.

Campo "Vigência início" adicionado ao formulário do card (visível e editável), ao lado de "Vigência fim (data renovação)".

**Nota importante (12/07):** isso **substitui, para os campos de ciclo listados acima**, o que a Seção 7 (mais abaixo, 19/06, correção N2) registra sobre `dataRenovacao` ser fill-blank. A evolução real foi: 19/06 tornou `dataRenovacao` fill-blank (certo para reimportação simples) → 01/07 percebeu que isso quebrava o fluxo de renovação (a vigência nova *precisa* sobrescrever a antiga) e tornou os campos de ciclo sempre-sobrescreve. As duas correções fizeram sentido no momento em que foram feitas; a de 01/07 é a que vale hoje.

**Débito pendente (Asana):**
- gid 1216209458912908 — SQL: `reativar_renovacoes()` deve copiar `vigencia_inicio` do ciclo anterior

---

## SEÇÃO 0.3 — REDESIGN FASE 1: DASHBOARD E CLIENTES CONCLUÍDOS DE VERDADE (06/07/2026) — EM PRODUÇÃO

- Migração completa de paleta para os tokens (`canvas`, `painel`, `borda`, `marca`) em `Dashboard.jsx` e `Segurados.jsx` — não só o título (ver nota na Seção 0.1), mas todo o corpo: cards de indicador, modal "Sem comissão", seletores de período/horizonte, inputs de edição (incluindo texto digitado), avatares circulares, histórico de apólices expansível.
- **Propositalmente não tocado:** cores de identidade/status — badges (Vigente/Não renovada/Encerrada), `SN_STATUS_COR`, `CORES_GATILHO`, cores dos ícones dos cards de indicador (`color` prop). São identidade de dado, não estrutura de painel.
- Item "Renovações" da Fase 1 = remoção da etapa Crosselling do Kanban (ver Seção 0.5).
- **Fase 1 do redesign (Dashboard + Clientes + Renovações) está 100% concluída e em produção.**

---

## SEÇÃO 0.4 — REMOÇÃO DA ETAPA "CROSSELLING" DO KANBAN (06/07/2026) — EM PRODUÇÃO

- `constants.js`: objeto `crosselling` removido do array `STAGES`. Kanban passa de 7 para 6 etapas — **isso substitui a contagem de 7 etapas registrada na Seção 7 mais abaixo.**
- Confirmado via SQL antes da remoção: zero cards com `status_pipeline = 'crosselling'` em produção — remoção sem impacto em dados existentes.
- `CANAL_COR["Crosselling"]` (tag de origem/canal, camada "Canal/Origem" das Regras de Negócio v2) foi **mantida** — é um conceito diferente (de onde o negócio veio), não afetado pela remoção da etapa do pipeline.
- A funcionalidade comercial de cross-sell deixou de ser uma etapa sequencial do Kanban e passou a ser uma tela própria no menu (ver Seção 0.5).

---

## SEÇÃO 0.5 — FASE 2 DO REDESIGN: CROSS-SELL (06/07/2026) — EM PRODUÇÃO

- Novo arquivo `CrossSell.jsx`: inverte a lógica que já existia por cliente na ficha (`Segurados.jsx`, item "Cross-sell" da ficha) — em vez de "olhando 1 cliente, o que falta", mostra "olhando toda a carteira, quem são os candidatos", ranqueados por engajamento (mais apólices vigentes primeiro; empate resolvido por maior prêmio ativo).
- `navConfig.js`: item "Cross-sell" adicionado ao grupo Vendas.
- `App.jsx`: nova função central `navigateTo(view, { clienteId })` — toda navegação normal pelo menu limpa o cliente pré-selecionado; só quem chama explicitamente com `clienteId` o preenche. Usada por Cross-sell, Sinistros e Aniversariantes para abrir a ficha do cliente certo direto.
- `Segurados.jsx`: passou a aceitar prop `initialSelId` — se vier preenchida, abre direto na ficha desse cliente em vez da lista.

---

## SEÇÃO 0.6 — FASE 2 DO REDESIGN: SINISTROS (06/07/2026) — EM PRODUÇÃO

Substitui e amplia o que a Seção 6 (mais abaixo) descreve. O objeto sinistro (jsonb dentro de `renovacoes.sinistros`) continua exatamente o mesmo formato — isso não mudou.

**Novo arquivo `Sinistros.jsx`** — tela consolidada (grupo Operações no menu), com:
- Cards de contagem por status (clicáveis, funcionam como filtro)
- Toggle "ver encerrados"
- Botão "+ Novo sinistro": cria sinistro sem precisar abrir o card. Campo de busca por nome ou CPF/CNPJ (typeahead com até 8 resultados); tipo usa a mesma lista fixa do `ModalCard.jsx` (Colisão, Roubo/Furto, Incêndio, Vida, Danos Elétricos, RC, Outros)
- Cada sinistro é expansível: mudar status, marcar/desmarcar checklist de documentos, registrar contato com a seguradora
- Botão "Abrir card": localiza e abre o modal do card certo no Kanban (função `handleAbrirCard` em `App.jsx`; se o card não estiver na lista ativa — ex: apólice arquivada — avisa em vez de falhar silenciosamente)

**`Segurados.jsx`** — a seção "Sinistros" na ficha do cliente (`SinistrosCliente`) deixou de ser só leitura: ganhou as mesmas ações (status/checklist/contato) e o botão "Abrir card".

**REGRA DE ESCRITA — vale para os três lugares que hoje editam sinistro** (modal do card, tela Sinistros, ficha do cliente):
```js
supabase.from("renovacoes").update({ sinistros: novoArray }).eq("id", renovacao_id)
```
Update **direto e isolado** só na coluna `sinistros` da apólice específica. **Nunca** usar `upsertCard` para isso.

**Removido:** o painel fixo `PainelSinistros` à direita do Kanban, e todo o mecanismo `onlyComSinistro` em `App.jsx`. **Atualização de 12/07:** o componente `PainelSinistros` em si (que tinha ficado como código morto em `PipelineUI.jsx`) foi apagado por completo — ver Seção 0.12.

**`Dashboard.jsx`:** card "Sinistros abertos" agora navega direto para a tela Sinistros (`onNavigate("sinistros")`) em vez de filtrar o Pipeline.

**Menu lateral atual (navConfig.js), para referência:**
| Grupo | Itens |
|---|---|
| Visão Geral | Dashboard |
| Vendas | Captação, Cross-sell |
| Operações | Pipeline, Sinistros, Documentos |
| Carteira | Clientes |

---

## SEÇÃO 0.7 — INCIDENTE: DEPLOY DE SINISTROS FORA DO FLUXO DE PR (05–06/07/2026) E CORREÇÃO

**O que aconteceu:** depois do merge do PR de Cross-sell, o checkout local não foi atualizado (`git checkout main` + `git pull`) antes de abrir a frente de Sinistros. Os commits de Sinistros foram empilhados na branch antiga já mergeada/fechada, sem nunca terem sido de fato mergeados de volta no `main` via Pull Request.

**Sintoma:** produção rodando com a correção de cabeçalho do Kanban mas sem a tela Sinistros — mistura de duas branches diferentes, sem nenhum deploy "quebrado" visível.

**Causa provável do deploy que pareceu funcionar antes:** `npx vercel --prod` publica o **checkout local** no momento em que é executado — não necessariamente o conteúdo do `main` no GitHub.

**Correção:** aberto PR (`feat/cross-sell-visao-carteira` → `main`) com o commit de Sinistros pendente, testado em Preview, mergeado corretamente pelo GitHub.

**LIÇÃO DE PROCESSO (permanente):**
- Sempre `git checkout main` + `git pull` antes de `git checkout -b` de qualquer branch nova.
- `npx vercel --prod` é último recurso, só depois de confirmar merge real no GitHub — nunca substitui o fluxo de PR.
- **Esse mesmo padrão se repetiu de novo em 12/07** (branch do sidebar ainda ativa quando começamos a auditoria) — sem causar perda dessa vez, mas confirma que é um erro recorrente. Ver Seção 0.13 para o reforço da lição.

---

## SEÇÃO 0.8 — CORREÇÃO DE ALINHAMENTO DO CABEÇALHO DO KANBAN (06/07/2026) — EM PRODUÇÃO

`PipelineUI.jsx` (componente `Column`): cabeçalho passou a usar `stage.short` (rótulo curto, ex: "Vistoria" em vez de "Vistoria / Pend. Emissão") em vez de `stage.label` (nome completo) — evita quebra em duas linhas dentro da largura fixa da coluna (256px). Nome completo mantido como tooltip (`title`).

---

## SEÇÃO 0.9 — SIDEBAR ACOMPANHA TEMA CLARO/ESCURO (12/07/2026) — EM PRODUÇÃO

- `tailwind.config.js`: token `sidebar` deixou de ser navy fixo (`#0F2044`/`#0B1730`, registrado na Seção 0.1). Passou por três iterações até o resultado final:
  1. Sempre escuro, só trocando a família de cor (navy → slate) — rejeitado, sem separação visual real entre os dois tons.
  2. Cinza médio (`#94A3B8`) nos dois temas — rejeitado, o dourado da marca ficava ilegível sobre tom médio.
  3. **Versão final:** branco (`#FFFFFF`) no claro / `#0B1220` no escuro. A separação vem do canvas cinza contrastando contra o menu branco no claro (mesma lógica dos cards do app), e do menu mais escuro que o canvas no escuro.
- Novo token `marca.golddark` (`#8A6D2A`) — dourado escurecido para uso sobre fundo claro, onde o dourado original (`#C9A84C`) perde contraste. Item ativo do menu e logo usam `golddark` no claro, `gold` original no escuro.
- `Layout.jsx`: todo texto do menu (nome, grupos, itens, rodapé) ganhou par claro/escuro — antes assumia fundo sempre escuro.

---

## SEÇÃO 0.10 — PENDÊNCIAS EM ABERTO (12/07/2026)

- **Comissões (versão estimada)** — último item da Fase 2 do redesign visual, pausado. Registrado no Asana (gid 1216295454296978). Escopo: agregação de `premio_liquido × percentual_comissao` por mês/produto/seguradora — **tela/UI**, distinta do modelo de dados de Comissões Fase 0 já implementado (ver Seção 12, mais abaixo — schema já existe nas duas bases desde 19/06). **CONCLUÍDO em 12/07 — ver Seção 0.14. Fase 2 do redesign está inteira em produção.**
- **RLS das tabelas de comissão** (`comissao_parcelas`/`comissao_movimentos`) precisa espelhar as políticas de `renovacoes` antes de qualquer exposição na UI — já registrado como pendência na própria Seção 12.
- **Auditoria completa de divergência doc-vs-código via Cowork** — executada em 12/07 (ver Seção 0.11). Registrada no Asana (gid 1216295911789891), pode ser fechada/marcada como concluída.

---

## SEÇÃO 0.11 — AUDITORIA COMPLETA VIA COWORK (12/07/2026)

Rodada a auditoria que ficava pendente desde 05/07 (gid 1216295911789891). Metodologia: repositório clonado (só leitura), lido integralmente contra este documento. Schema Supabase verificado por evidência indireta (código que lê/grava colunas + SQL versionado), já que não há credenciais nem pasta `supabase/migrations` no repo.

**Achados principais** (relatório completo arquivado fora deste documento, disponível se precisar consultar de novo):
1. As duas linhagens divergentes deste arquivo (ver topo do documento).
2. Núcleo técnico de 26/06 (abaixo, "CONTEXTO GERAL" em diante) **confirmado como implementado e funcionando** — refatoração em módulos, Dashboard 4 regiões, save seguro, trava de comissão, unificação de moeda, importação completa, módulo de sinistros no modal/ficha.
3. Três divergências reais de código (não só de doc), corrigidas no mesmo dia — ver Seção 0.12.
4. Redesign visual inteiro (Fase 1, Cross-sell, Sinistros, sidebar, correção de cabeçalho) nunca tinha chegado à linhagem de 26/06 — resolvido pela fusão das duas linhagens neste documento.
5. Detalhes menores de defasagem nas Seções 1–12 (contagem de linhas de arquivo, colunas de banco não listadas, arquivo SQL de Comissões não encontrado no repo) — apontados na Seção 13, ao final do documento, sem alterar o texto original dessas seções.

---

## SEÇÃO 0.12 — CORREÇÕES DE CÓDIGO ENCONTRADAS PELA AUDITORIA (12/07/2026)

Três divergências que eram bug real, não só documentação desatualizada — corrigidas e enviadas a PR no mesmo dia:

1. **Modelo de extração de PDF.** `api/extract-pdf.js` estava rodando `claude-haiku-4-5-20251001`. A Seção 7 (mais abaixo) sempre registrou a intenção como `claude-sonnet-4-6`. Corrigido para `sonnet-4-6`, alinhando código à intenção documentada.
2. **`PainelSinistros` — remoção definitiva.** Desde a criação da tela Sinistros consolidada (Seção 0.6), o painel fixo do Kanban tinha só deixado de ser *importado*, mas o componente continuava existindo em `PipelineUI.jsx` como código morto. Removido de vez, junto com um `SN_STATUS_COR_PILL` que só ele usava.
3. **Sincronização de cliente (nascimento/endereço) na importação de PDF — regressão da correção N3.** A Seção 7 (19/06, correção N3) registra que essa sincronização passou a ser fill-blank-only com `maskCEP`. A auditoria encontrou que, em algum momento não documentado, isso regrediu: o código voltava a sobrescrever campos já preenchidos e gravava o CEP sem máscara. Restaurado hoje: busca o cadastro atual do cliente antes de decidir o que gravar, só preenche campos vazios, aplica `maskCEP`.

Bônus: um segundo `SN_STATUS_COR_PILL` morto, dentro do `handleExtrairDados` em `ModalCard.jsx` (já registrado como achado, não corrigido, na Seção 1 — linha "Achado durante a refatoração") — removido junto nesta mesma correção.

---

## SEÇÃO 0.13 — DUAS LIÇÕES DE PROCESSO REFORÇADAS HOJE (12/07/2026)

1. **Documentação também precisa de Pull Request.** Uma crença que vinha sendo repassada (implícita na Seção 11, "commit por terminal PowerShell... separados") foi tratada, em algum momento, como "documentação pode ir direto pro `main`, é só texto". **Isso está errado** — a proteção de branch (`protege-main`, Seção 0) bloqueia push direto de qualquer arquivo, documentação incluída (confirmado hoje: `git push` direto recusado com `GH013`). A partir de agora, atualização de doc segue o mesmo fluxo de qualquer código: branch → commit → push → PR → merge.
2. **Confirmar que o arquivo em disco realmente mudou antes de assumir que o commit vai pegar o conteúdo certo.** A atualização deste documento gerada em 06/07 nunca chegou a substituir o arquivo real no disco (provável download que foi para a pasta errada) — e isso só foi descoberto hoje, através de duas checagens simples: `git log --oneline -- src/estado-atual-crm.md` (mostrou o último commit real como sendo de 26/06) e `Select-String -Path src\estado-atual-crm.md -Pattern "<texto que só existiria na versão nova>"` (não encontrou nada). Vale rodar essas duas checagens **depois** de qualquer atualização de documentação, antes do commit — não só quando algo parece errado.

---

## SEÇÃO 0.14 — FASE 2 DO REDESIGN: COMISSÕES (VERSÃO ESTIMADA) (12/07/2026) — EM PRODUÇÃO — FASE 2 CONCLUÍDA

Último item da Fase 2. Com essa entrega, **Cross-sell, Sinistros e Comissões estão os três em produção** — a Fase 2 do redesign visual está inteira concluída.

**Novo arquivo `Comissoes.jsx`** — tela no grupo Operações do menu (entre Sinistros e Documentos), versão estimada (agregação de `premio_liquido × percentual_comissao`, dado que já alimenta o `dashboard_metrics()` — não é a versão financeira detalhada da Seção 12, que continua pausada):
- Seletor de período (Mês atual/15/30/90/livre), mesmo padrão visual do seletor já usado no `Dashboard.jsx`
- 4 cards de resumo: comissão do período, prêmio líquido, ticket médio, contagem "sem comissão"
- Duas quebras com barra de proporção: por seguradora e por produto
- Filtro: `status_pipeline = 'emitida'` e `data_emissao` dentro do período — mesma lógica que a "Produção" do Dashboard já usa (não filtra por `data_renovacao`)

**Achado durante o teste — grafia inconsistente de seguradora.** Com dado real, "PORTO SEGURO" e "Porto Seguro" apareciam como duas linhas separadas na quebra por seguradora. Causa raiz: um card na base de **teste** (Fernando Carneiro Ferreira, Residencial, emitida 24/06) tinha `seguradora = 'Porto Seguro'` em vez do padrão `'PORTO SEGURO'` usado no resto da carteira. Produção já estava limpa (confirmado por SQL, zero linhas). Duas correções aplicadas:
1. **Na tela:** agrupamento por seguradora/produto passou a ser case-insensitive (`chave = valor.trim().toUpperCase()`), exibindo sempre em maiúsculas — protege contra a mesma inconsistência aparecer de novo no futuro (ex: vinda da importação de PDF, onde o texto vem direto do documento).
2. **Na origem:** `UPDATE renovacoes SET seguradora = 'PORTO SEGURO' WHERE seguradora = 'Porto Seguro'` rodado na base de teste, confirmado com SELECT antes e depois.

---

## CONTEXTO GERAL

CRM proprietário do corretor Fabio Salim Guimarães Marques (Via Seguros / Simples Assim).
Stack: React + Vite (frontend), Supabase PostgreSQL (backend), Vercel (deploy).
URL produção: https://crm.simplesassim.com.br
GitHub: repositório `crm-simplesassim` (Windows, PowerShell).

**DOIS projetos Supabase:**
- `crm-simplesassim` = PRODUÇÃO (ref: mrxfgvotcmtdmuzcajin) — base que o site lê
- `crm-simplesassim-teste` (ref: ijlwdshwmsgkvsdjxfad) — base de testes com dados reais

**REGRA OBRIGATÓRIA:** sempre especificar explicitamente em qual base rodar cada SQL.

---

## SEÇÃO 1 — Arquivos do projeto

### Refatoração do `App.jsx` (26/06/2026)
`App.jsx` era monolítico (~3.735 linhas). Dividido em 8 passos, cada um numa branch própria, validado com `npm run build` + checagem de sintaxe (esbuild) + checagem de variável não declarada (ESLint `no-undef`), testado numa URL de Preview isolada da Vercel, e só então mesclado na `main`. Zero mudança de comportamento — só reorganização. Resultado: **`App.jsx` caiu para 461 linhas (-88%)**, distribuído em 9 arquivos novos por responsabilidade:

| Arquivo | Conteúdo | Linhas |
|---|---|---|
| `src/App.jsx` | Componente principal: estado global, handlers, composição das telas, pipeline Kanban | 461 |
| `src/ModalCard.jsx` | Modal de edição de card — dados, automóvel/imóvel/vida/equip/viagem, sinistros, beneficiários, `handleExtrairDados` | 1.019 |
| `src/ImportPDF.jsx` | `ImportModal` — importação de PDF via IA, detecção de duplicata, roteamento por status | 635 |
| `src/ModaisCadastro.jsx` | `AddModal`, `ClienteModal`, `LoginScreen` | 372 |
| `src/data.js` | Funções de acesso ao Supabase: `mapRow`, `loadCards`, `upsertCard`, `findOrCreateCliente`, etc. | 395 |
| `src/Prospeccoes.jsx` | `AniversariantesView`, `ProspeccoesView` | 280 |
| `src/PipelineUI.jsx` | `CardTile`, `Column`, `PainelSinistros`, `ApoliceRow` | 209 |
| `src/DocumentosEndossos.jsx` | `DocsSection`, `EndossoSection` (abas do Modal) | 234 |
| `src/utils.js` | Funções puras: formatação, máscaras, `mapPagamento` | 116 |
| `src/constants.js` | `STAGES`, `PROSP_STAGES`, `DOC_TIPOS`, listas de ramos, cores de etiqueta | 68 |

**Achado durante a refatoração (não corrigido, registrado pra decisão futura):** existe uma `SN_STATUS_COR_PILL` duplicada dentro do `handleExtrairDados` em `ModalCard.jsx` — declarada mas nunca usada nesse escopo (código morto, sobra de copy-paste antigo). Inofensivo, mas candidato a limpeza numa próxima sessão.

**Prática a partir de agora:** com `App.jsx` em 461 linhas, patches via Ctrl+H voltam a ser viáveis pra ele. Pros arquivos extraídos maiores (`ModalCard.jsx`, `ImportPDF.jsx`), o método continua sendo arquivo completo via download/sobrescrita, igual já era praticado.

### Componentes React ativos
- `src/App.jsx` — ver tabela acima
- `src/Dashboard.jsx` — dashboard rico em 4 regiões (Produção com seletor de período, Carteira atual + Mix por ramo, A renovar, Aniversariantes), com cards clicáveis que navegam pro Kanban filtrado + card "Sem comissão" que abre modal com lista detalhada
- `src/Segurados.jsx` — área do segurado com ficha completa
- `src/supabase.js` — cliente Supabase

### Deploy
- Vercel conectado ao GitHub (auto-deploy no push para main)
- Quando o auto-deploy falhar: `npx vercel --prod` no PowerShell
- Build local: `npm run build 2>&1 | Select-Object -Last 20`

### Ambiente de desenvolvimento local
- `npm run dev` → Vite puro (porta 5173) — **NÃO roda as serverless functions** (`/api/*`)
- `npx vercel dev` → Vite + funções serverless (porta 3000) — necessário para testar Importação de PDF localmente
- `.env` local (raiz do projeto) deve conter `ANTHROPIC_API_KEY` (sem prefixo `VITE_`, fica só no servidor) além das `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — confirmar sempre para qual base (teste/produção) essas variáveis apontam antes de testar

---

## SEÇÃO 2 — Schema Supabase (estado real)

### Tabela principal: `renovacoes`
Sistema **card-cêntrico**. Cada card = uma renovação/apólice no pipeline.

Colunas principais confirmadas via CSV:
- `id` (uuid PK), `cliente_id` (FK → clientes), `cliente_nome`, `cpf_cnpj`, `telefone`, `email`
- `tipo_seguro`, `seguradora`, `status_pipeline`, `data_renovacao` (date — vigência fim)
- `valor` (prêmio bruto), `premio_liquido`, `percentual_comissao`
- `proposta`, `apolice_nova` (número da apólice)
- `etiqueta_situacao`, `etiqueta_pagamento`, `etiqueta_canal`
- `mes_referencia` (text, NOT NULL), `arquivado` (boolean), `arquivado_em`
- `sinistros` (jsonb array), `endossos` (jsonb array), `historico_ciclos` (jsonb array)
- `apolice_anexada` (boolean), `transmitida_em`, `auto_enviada_cliente`
- `endereco` (text solto), `criado_em`, `atualizado_em`
- Campos auto: `auto_placa`, `auto_modelo`, `auto_ano_fab`, `auto_ano_mod`, `auto_chassi`
- `auto_nome_segurado`, `auto_cpf_segurado`, `auto_nascimento_segurado` (text)
- `auto_data_nascimento` (date), `auto_condutor`, `auto_cpf_condutor`
- `auto_nascimento_condutor`, `auto_cep_pernoite`, `auto_tipo_utilizacao`, `auto_condutor_1825`
- `auto_estado_civil`, `auto_nome_segurado`, `responsavel`
- `endereco_cep`, `endereco_logradouro`, `endereco_numero`, `endereco_complemento`, `endereco_bairro`, `endereco_cidade`, `endereco_uf` — já existiam no schema, mas não eram preenchidos pela importação de PDF até 18/06/2026
- `vigencia_inicio` (date), `numero_parcelas` (integer), `valor_parcela` (numeric), `vencimento_primeira_parcela` (date), `auto_zero_km` (boolean), `auto_combustivel` (text) — **colunas novas, criadas em 18/06/2026** (teste e produção) para capturar dados secundários extraídos do PDF e evitar pagar duas vezes pela mesma extração de IA (ver Seção 7)
- `data_emissao` (date) — usada pela CTE `prod` do `dashboard_metrics` (produção do mês). Card emitida sem `data_emissao` **não conta** no prêmio/comissão do mês (ver Seção 3 e N4 na Seção 9)

### Tabela: `clientes`
Colunas: id, nome, cpf_cnpj, tipo_pessoa, data_nascimento (date), profissao,
telefone, whatsapp, email, cep, logradouro, numero, complemento, bairro,
cidade, estado, status, origem, responsavel_id, observacoes,
criado_em, atualizado_em, cpf_cnpj_norm, updated_at

### Tabela: `documentos`
id, renovacao_id, tipo, nome_arquivo, storage_path, criado_em
Bucket Supabase Storage: `documentos`
Tipos: proposta, apolice, nf, laudo, cnh, crlv

### Outras tabelas
seguradoras (42 pré-cadastradas), produtos (35 pré-cadastrados),
prospeccoes, follow_ups, usuarios

---

## SEÇÃO 3 — Funções SQL instaladas (PRODUÇÃO e TESTE)

### `norm_doc(p text) → text`
Normalização robusta de CPF/CNPJ. Definição real (confirmada em 19/06/2026):
remove não-dígitos e, **se tiver mais de 14 dígitos, mantém os últimos 14**; caso contrário mantém como está. **Não corta para 11** — um CPF de 12–13 dígitos permanece com 12–13. Evita duplicação de cadastro por zero extra na frente do CNPJ. O front (`findOrCreateCliente`) faz exatamente o mesmo (`>14 → slice(-14)`), então não há divergência.

### `enriquecer_cliente()` + trigger `trg_enriquecer_cliente`
Trigger AFTER INSERT OR UPDATE em `renovacoes`.
Preenche campos VAZIOS do cadastro de clientes (fill-blank-only, nunca sobrescreve):
- nome, cpf_cnpj, cpf_cnpj_norm, tipo_pessoa (inferido dos dígitos), telefone, email
- data_nascimento (copia de auto_nascimento_segurado quando CPF/nome do segurado bate com o titular)
- **Não** sincroniza endereço — por isso o `handleExtrairDados` faz esse sync à parte (ver Seção 7, agora fill-blank)

### `reativar_renovacoes()`
Cria novo card (INSERT) para renovações 30 dias antes do vencimento.
- Copia dados do card arquivado+emitido
- Status = 'cotacoes', etiqueta_situacao = 'Renovação'
- Trava anti-duplicidade (NOT EXISTS)
- Exclui: Não Renovada, Cancelada, Recusada, Sem Negócio, Viagem, RC Obras
- Agendada via pg_cron: job `reativar-renovacoes-diario`, `0 11 * * *` (08:00 Brasília)

### `dashboard_metrics(p_inicio date, p_fim date, p_renovar_dias integer)` → jsonb
Parametrizada (período de produção, janela de "a renovar"). Retorna, agrupado em jsonb: dados de Produção (período), Carteira (foto de agora), A renovar (horizonte), Aniversariantes, foto geral (sinistros, urgentes, **sem_comissao_qtd/valor**) e bloco de compatibilidade com nomes antigos do Dashboard (premio_mes, comissao_mes, etc.)

**`sem_comissao_qtd` / `sem_comissao_valor`** — adicionados em 18/06/2026. Contam apólices da carteira ativa (`status_pipeline = 'emitida' AND data_renovacao >= hoje`) com `percentual_comissao` OU `premio_liquido` em branco. Alimenta o card clicável "Sem comissão" no Dashboard. (Não filtra `arquivado` de propósito — ver decisão N1 na Seção 10.)

**Fórmula de comissão (confirmada no código-fonte da função, 18/06 e 19/06/2026):**
```sql
premio_liquido * percentual_comissao / 100.0
```
`percentual_comissao` é guardado como número inteiro (`15` = 15%). Usada em três lugares dentro da função: `comissao_periodo`, `carteira_comissao` e `projecao_comissao_60d`. Como qualquer multiplicação com `NULL` em SQL resulta em `NULL`, e `SUM()` ignora `NULL` silenciosamente, um card sem `percentual_comissao` ou sem `premio_liquido` simplesmente **não entra na soma** — sem erro visível, só um número de comissão mais baixo do que deveria no Dashboard. É a razão pela qual esses dois campos passaram a ser obrigatórios em certas transições (ver Seção 7).

**Perdidos no mês e Taxa de renovação — corrigidos em 19/06/2026 (N5/N6):**
Antes, ambos eram calculados dentro da CTE `prod` (que filtra `status_pipeline = 'emitida' AND data_emissao BETWEEN ini/fim`):
- `perdidas_periodo` contava "Não Renovada" ali dentro — mas card "Não Renovada" nunca é emitida → resultado **sempre ~0**.
- `total_periodo` era `count FILTER (mes_referencia IS NOT NULL)` no mesmo conjunto emitida → praticamente igual a `emitidas_periodo` → `taxa_renovacao` **sempre ~100%**.

Correção: criada CTE `perdidas` separada que conta "Não Renovada" por `arquivado_em` no período (independente do filtro de emitida). Passou a valer `total = emitidas + perdidas` e `taxa = round(100 × emitidas / (emitidas + perdidas), 1)`. Comissão, prêmio, carteira e projeção **inalterados**. Aplicado em teste e produção. Definição da taxa endossada pelo corretor (ver Seção 10).

---

## SEÇÃO 4 — Componente Dashboard.jsx

**Restaurado em 18/06/2026** após ter sido temporariamente sobrescrito por uma versão simplificada de 8 cards (commit `f670817` recuperado via `git show`). A versão correta tem 4 regiões:

1. **Produção** — seletor de período (Mês atual / 15 / 30 / 90 dias / livre). Cards clicáveis: Apólices emitidas, Prêmio produzido, Comissões, Taxa de renovação, Perdidos (navegam pro Kanban filtrado por status/data via `onNavigate`/`onFiltro`). Card informativo (não clicável): Proj. comissão 60d. (Taxa de renovação e Perdidos passaram a mostrar valor real a partir de 19/06 — ver Seção 3.)
2. **Carteira atual** — Apólices vigentes, Comissão da carteira (informativos), Sinistros abertos e Urgentes (≤5 dias) clicáveis, e o card **"Sem comissão"** (clicável) ao lado do gráfico Mix de carteira por ramo.
3. **A renovar** — seletor de horizonte (15/60/90d), card clicável grande mostrando quantidade e prêmio.
4. **Aniversariantes** — seletor (Hoje/15/30 dias), card clicável que leva pra `AniversariantesView`.

### Card "Sem comissão" — implementado em 18/06/2026
- Mostra `m.sem_comissao_qtd` e `m.sem_comissao_valor` (vem do `dashboard_metrics()`, ver Seção 3)
- Ao clicar, abre `ModalSemComissao`: busca direto no Supabase (`renovacoes`, filtro `status_pipeline = 'emitida' AND data_renovacao >= hoje AND (percentual_comissao IS NULL OR premio_liquido IS NULL)`) e lista cliente, produto, seguradora, valor, vencimento e badges ("sem prêmio líq.", "sem % comissão")
- Botão "Ver no Kanban" no modal chama `onFiltro({ semComissao: true })` → ativa `onlySemComissao` no App, que filtra o Kanban pra mostrar só essas apólices (filtro não persiste ao navegar pra outra view — comportamento aceito, não é bug)

---

## SEÇÃO 5 — Componente Segurados.jsx (estado 14/06/2026)

### Lista de clientes
- Busca por nome ou CPF/CNPJ
- Contador de apólices por cliente com badge "X vigente(s)"
- Carrega tabelas `clientes` e `renovacoes` (select *)

### Ficha do cliente (ao clicar)
Seções em ordem:
1. **Cabeçalho** — nome, CPF/CNPJ, tipo (PF/PJ), status
2. **Dados cadastrais** — nascimento+idade, profissão, origem, telefone (formatado), whatsapp, email, endereço, status
3. **Modo edição** — botão Editar/Salvar grava em `clientes` via supabase.update
4. **Ações sugeridas** (gatilhos) — aparece só quando relevante:
   - Aniversário no mês atual
   - Apólice vigente OU renovação em andamento vencendo em ≤30 dias (vermelho ≤7d, amarelo ≤30d)
   - Contato incompleto (falta telefone e/ou email)
   - Sem apólice vigente E sem renovação em aberto → reativação/captação
5. **Valor do cliente** — Prêmio ativo, Comissão acumulada, contador de apólices
6. **Cross-sell** — ramos que o cliente não tem vs universo da carteira
7. **Sinistros do cliente** — painel com todos os sinistros abertos (não encerrados)
   - Badge contador, toggle para ver encerrados
   - Mostra: tipo, status (com cor), apólice vinculada, protocolo, datas, último contato
8. **Histórico de apólices** — agrupado por ramo+seguradora (Opção A)
   - Cabeçalho do grupo: badge Vigente/Encerrada, contador de ciclos
   - Cada ciclo expansível → detalhe completo (nº apólice, proposta, seguradora, ramo,
     situação, vigência fim, prêmio total, prêmio líquido, comissão % e R$, pagamento,
     canal, mês referência)
   - Seção Veículo/Condutor SOMENTE para Automóvel
   - Seção Anexos: lista PDFs do bucket `documentos` com link para abrir

### Formatadores
- `fmtFone(v)`: aceita 10 dígitos (fixo) e 11 (celular), formata (DD) XXXXX-XXXX
- `fmtData(d)`: date → DD/MM/AAAA
- `fmtBRL(v)`: número → R$ X.XXX,XX
- `norm_doc` robusta no `findOrCreateCliente`: mantém últimos 14 dígitos quando passa de 14 (idêntico ao `norm_doc` do banco)

---

## SEÇÃO 6 — Módulo Sinistros (estado 14/06/2026; localização de arquivo atualizada em 26/06/2026)

### Objeto sinistro (jsonb dentro de `renovacoes.sinistros`)
```js
{
  id: uuid,
  tipo: "Colisão" | "Roubo/Furto" | "Incêndio" | "Vida" | "Danos Elétricos" | "RC" | "Outros",
  protocolo: string,
  descricao: string,
  dataOcorrencia: "YYYY-MM-DD",
  dataPrevistaResolucao: "YYYY-MM-DD",
  dataEncerramento: "YYYY-MM-DD",
  status: "Aberto" | "Documentação" | "Aguardando Seguradora" | "Em Regulação" | "Encerrado",
  docs: ["BO", "Fotos", "NF", "CNH", "CRLV", "Laudo"],  // checklist
  contatos: [{ id, data, descricao }],  // histórico de contatos com seguradora
  observacoes: string,
}
```

### Onde aparece
1. **Badge no card do pipeline** — "X sinistro(s) aberto(s)" em vermelho
2. **Aba Sinistros no Modal** — registro completo, checklist clicável, histórico de contatos
3. **Painel na ficha do Segurado** — sinistros abertos do cliente, toggle encerrados
4. **Painel fixo à direita do Kanban** — `PainelSinistros`, sempre visível, clicável

### Funções no Modal (agora em `src/ModalCard.jsx`)
- `SN_STATUS` — array dos 5 status
- `SN_DOCS` — array dos 6 documentos do checklist
- `addSinistro()` — cria novo objeto e adiciona ao array
- `removeSinistro(id)` — remove do array
- `updateSinistroStatus(id, status)` — atualiza status (preenche dataEncerramento automaticamente)
- `addContatoSinistro(sinId, contato)` — adiciona contato ao histórico
- `toggleDocSinistro(sinId, doc)` — marca/desmarca documento no checklist
- `snContatoForm` — estado dos formulários de contato por sinistro

### PainelSinistros (agora em `src/PipelineUI.jsx`, junto com `Column`)
Lê `cards.flatMap(c => c.sinistros.filter(s => s.status !== "Encerrado"))`.
Coluna fixa 256px à direita do Kanban, scroll próprio.

---

## SEÇÃO 7 — Pipeline Kanban (App.jsx + ModalCard.jsx + ImportPDF.jsx desde 26/06/2026)

### STAGES (etapas)
1. cotacoes — "Cotações e Leads" (azul)
2. enviada — "Enviada ao Cliente" (laranja)
3. transmitida — "Proposta Transmitida" (roxo)
4. vistoria — "Vistoria / Pend. Emissão" (vermelho) — condicional
5. boleto — "Boleto / Débito / Link" (amarelo) — condicional
6. emitida — "Apólice Emitida" (verde)
7. crosselling — "Crosselling" (roxo claro)

### Fluxo de arquivamento e save seguro
- `handleSave`: se `updated.arquivado && !anterior.arquivado` → remove da lista (some sem F5)
- `handleArquivar`: `upsertCard` + `setCards(filter)`
- `handleNaoRenovada`: arquiva + cria prospecção automática
- **Save seguro (19/06/2026, C1):** `upsertCard` agora **retorna o erro** do banco, e todos os handlers acima (+ `handleAdd`, `handleDrop`, `handleDesarquivar`) checam esse erro **antes** de mexer na UI. Se o banco recusar, mostra o erro real e não remove/move o card. O `handleDrop` reverte a posição do card se o save falhar.

### Validação de comissão obrigatória — implementada em 18/06/2026, unificada em 19/06/2026 (M1)
Em 18/06 a trava existia só no `handleSave`. Em 19/06 a regra foi extraída para uma função única **`faltaComissaoParaAvancar(card, novoStatus, statusAnterior)`** e aplicada em **todos** os caminhos que promovem um card:
- `handleSave` (Modal + Salvar)
- `handleDrop` (arrastar no Kanban) — **bloqueia e reverte** o card pra coluna de origem se faltar comissão
- `handleApoliceAnexada` (anexar apólice que promove pra "emitida")

Regra: se o card está **entrando agora** no estágio `transmitida` ou `emitida` (status mudou para um desses E o anterior era diferente) → exige `premioLiquido` e `percentualComissao` preenchidos. Se faltar, alerta e não salva.
- **Não dispara** se o card já estava nesse estágio (edição de card antigo/histórico não é bloqueada).
- **Não afeta** a criação via "Importar PDF" (`handleAdd`) — usado pra registrar apólices da concorrência/imports em lote, sem comissão própria.
- Motivo: `percentual_comissao` é essencial pro cálculo no `dashboard_metrics()` (ver Seção 3) e ficava em branco silenciosamente.
- **Commits:** `42cf643` (18/06) + correções de 19/06.

### Import de PDF (`ImportModal`, em `src/ImportPDF.jsx` desde 26/06/2026)
- Botão "Importar PDF" → `ImportModal`
- Extrai dados via API Anthropic (claude-sonnet-4-6), endpoint `/api/extract-pdf` (`extract-pdf.js`)
- `findOrCreateCliente`: busca por `cpf_cnpj_norm` (norm robusta idêntica ao `norm_doc`). **Em 19/06 (B2):** trocado `.maybeSingle()` por `.limit(1)` pegando o primeiro — antes lançava erro se já houvesse >1 cliente com o mesmo norm, fazendo o card perder o `cliente_id`.
- Cria card com `status_pipeline` e `etiqueta_situacao` adequados
- Campo **Data de Nascimento** obrigatório na revisão quando há CPF (validado em `criarCard`, ~linha 2695): `<input type="date">` ligado a `form.autoNascimentoSegurado`, asterisco condicional via `isCNPJ()` — **corrigido em 18/06/2026**
- **Inputs de valor na revisão (Prêmio total, Prêmio líquido, Valor da parcela): `maskMoeda` aplicada no `onChange` — corrigido em 19/06/2026 (M3).** Antes eram crus; um valor sem centavos (ex.: "2.500") era lido como 2,5 pelo parser de último separador. A máscara força o formato "X.XXX,XX" com centavos.
- `parseBRL` (que existia dentro do `ImportModal`): **eliminado em 19/06/2026 (B3)** — era idêntico ao `moedaParaNumero`; as 3 chamadas no `criarCard` (`valor`, `premioLiquido`, `valorParcela`) passaram a usar `moedaParaNumero`, o conversor único.
- **Produto** (`tipoSeguro`) inicia em branco ("Selecione") em vez de fixo em "AUTOMÓVEL" — **corrigido em 18/06/2026**, tanto no `AddModal` quanto no `ImportModal`
- **Canal de origem** na revisão usa a lista compartilhada `CANAIS` (5 opções) em vez de uma lista hardcoded de 3 — **corrigido em 18/06/2026**

#### Captura completa em uma única extração — implementado em 18/06/2026
Motivação: evitar pagar duas vezes pela IA por causa de campos que ela já extrai mas o fluxo descartava. Mapeados em `processarPDF`, exibidos na revisão e persistidos em `criarCard`:

**Críticos (campos que já existiam no schema, só não eram capturados):**
- Endereço completo do segurado (`d.endereco.*` → `enderecoCep/Logradouro/Numero/Complemento/Bairro/Cidade/Uf`)
- Prêmio líquido (`d.financeiro.premioLiquido` → `premioLiquido`) — exigido pela validação de comissão obrigatória
- Data de emissão (`d.apolice.dataEmissao` → `dataEmissao`) — sem isso, `upsertCard` defaultava pra "hoje" quando status='emitida', inflando as métricas de produção do mês
- Classe de bônus (`d.apolice.classeBonus` → `autoClasseBonus`)

**Secundários (exigiram colunas novas no banco, ver Seção 2):**
- Vigência início (`d.apolice.vigenciaInicio` → `vigenciaInicio`)
- Zero KM e combustível do veículo (`d.veiculo.zeroKm/combustivel` → `autoZeroKm`/`autoCombustivel`)
- Número de parcelas, valor da parcela, vencimento da 1ª parcela

IOF foi avaliado e **descartado** de propósito (decisão do corretor).

#### Forma de pagamento → move automaticamente pra "Boleto/Débito" — implementado em 18/06/2026
Quando a forma de pagamento mapeada (`mapPagamento()`) for "Boleto", "Débito em Conta" ou "Link de Pagamento", o card que iria pra `transmitida` é desviado direto pra `boleto`. Implementado em dois pontos:
- **`ImportModal` (`processarPDF`)**: `importStatus` calculado normalmente, depois sobrescrito pra `"boleto"` se bater a condição.
- **`handleExtrairDados` (Modal de card existente)**: a forma de pagamento também é capturada aqui (`updates.etiquetaPagamento`), e a transição automática pra `transmitida` decide entre `"boleto"` ou `"transmitida"` com a mesma lista.

### Extração de dados em card existente (`handleExtrairDados`, dentro do `Modal` — agora em `src/ModalCard.jsx`)
- Disparada pelo botão "Extrair" sobre um documento anexado (proposta, apólice ou endosso)
- Preenche **campos vazios** do card a partir do PDF extraído (fill-blank). **Corrigido em 19/06/2026 (N2):** a `dataRenovacao` era a única linha que sobrescrevia incondicionalmente — agora também é fill-blank (`if (!d.dataRenovacao && ...)`), pra não carimbar por cima de uma vigência corrigida à mão (reimport/endosso).
- **Sync da tabela `clientes` — corrigido em 19/06/2026 (N3):** antes gravava `data_nascimento`/endereço sempre que o PDF trazia valor (sobrescrevendo dado bom) e gravava o `cep` cru. Agora **busca o cliente atual e só preenche os campos vazios**, com `maskCEP` no cep — alinhado ao fill-blank do trigger `enriquecer_cliente`.
- Se `tipo === "proposta"` e o card está em `cotacoes` → muda `d.status` para `transmitida` (ou `boleto`) automaticamente (só no estado local do Modal; só persiste no "Salvar", onde a validação de comissão acima entra em ação)
- Se `tipo === "apolice_endosso"` → calcula delta de prêmio líquido (via `moedaParaNumero`) e registra em `endossos`

---

## SEÇÃO 8 — Correções e blindagens implementadas

### Anti-duplicidade de cadastro (duas camadas)
- **Camada 1 (banco):** `norm_doc()` + trigger `enriquecer_cliente` — colapsam CNPJ com zero extra
- **Camada 2 (`src/data.js` desde 26/06/2026, era App.jsx):** `findOrCreateCliente` normaliza com `slice(-14)` antes de buscar (idêntico ao `norm_doc`). Em 19/06 trocou `.maybeSingle()` por `.limit(1)` — ver Sessão 19/06 abaixo.

### Merge FOCALIZE executado
CNPJ `021.672.740/0001-44` (15 dígitos, tipo ?) fundido com `21.672.740/0001-44` (PJ).
Apólice movida, duplicado apagado. Caça-duplicados rodou: 0 outros duplicados.

### Limpeza de cadastros existentes
```sql
UPDATE clientes SET cpf_cnpj_norm = norm_doc(cpf_cnpj) WHERE ...;
UPDATE clientes SET tipo_pessoa = CASE ... WHERE coalesce(tipo_pessoa,'') IN ('','?') ...;
```

### Bug do parser de valores monetários — corrigido em 18/06/2026
Existiam **três funções divergentes** de conversão de moeda no arquivo, todas com a mesma falha: tratavam o caractere "." sempre como separador de milhar, mesmo quando era o separador decimal.

- `parseBRL` (dentro do `ImportModal`) — usada na criação de card via importação de PDF
- `moedaParaNumero` (função **global**) — usada em **todos** os campos de dinheiro do sistema
- `parseBRLlocal` (dentro do `Modal` de edição) — usada na extração de PDF dentro de um card existente

**Sintoma:** ao importar um PDF, o valor aparecia correto na criação (ex: R$ 755,82), mas mudava sozinho depois do arquivamento (ex: R$ 755,82 → R$ 75.582,00), porque o fluxo reprocessava o número JS (`755.82`) pela `moedaParaNumero` antiga, que removia o ponto como milhar.

**Correção:** as funções foram unificadas pela lógica robusta de último separador (detecta vírgula ou ponto como decimal). `parseBRLlocal` foi eliminada e `handleExtrairDados` passou a chamar `moedaParaNumero`. **Commit:** `e6aeb71`.
*(Complemento 19/06 — B3: o último gêmeo, `parseBRL` do ImportModal, também foi eliminado; ver Sessão 19/06.)*

**Registros corrompidos na base de teste** (Andreia Tavares de Lima, duplicatas de Layla Canholato Paschoetto) — identificados e removidos. Base de teste confirmada limpa em 18/06/2026.

### Regressão corrigida: chamada órfã para `parseBRLlocal` (18/06/2026)
Ao eliminar `parseBRLlocal`, uma chamada passou batido dentro do bloco `tipo === "apolice_endosso"` do `handleExtrairDados`. Corrigida para chamar `moedaParaNumero`.

### Dashboard.jsx sobrescrito por engano e restaurado (18/06/2026)
Versão rica (4 regiões, commit `f670817`) sobrescrita por engano por uma simplificada. Recuperada via `git show f670817:src/Dashboard.jsx`. **Cuidado no Windows:** `>` no PowerShell corrompe acentos; usar Node.js pra reescrever em UTF-8 sem BOM:
```powershell
node -e "const fs=require('fs');const {execSync}=require('child_process');const content=execSync('git show <hash>:<path>').toString('utf8');fs.writeFileSync('<path>',content,'utf8');"
```

### Regressões de sintaxe durante edições manuais (18/06/2026)
Copiar/colar manual introduziu erros (declaração de `useState` apagada, `const card` duplicada, vírgula dupla, capitalização errada como `autotipoUtilizacao`). **Lição:** conferir o print do trecho editado antes de salvar; atenção a capitalização e linhas duplicadas (não geram erro de build, falham em runtime ou silenciosamente).

### Sessão 19/06/2026 — Auditoria técnica (prompt 1) + integridade de dados (prompt 2)
Origem: `auditoria-crm.md` (prompt 1) + relatório de integridade (prompt 2, rodado no Cowork). 11 correções aplicadas, todas commitadas (App.jsx) ou aplicadas nas duas bases (SQL).

- **C1 — Fim do save silencioso.** `upsertCard` retorna o erro do banco; `handleAdd`, `handleDrop` (reverte), `handleSave`, `handleArquivar`, `handleDesarquivar`, `handleNaoRenovada` checam antes de tocar na UI. Antes, erro de banco era só `console.error` e a tela dizia "salvo"/removia o card — risco de perder dado sem aviso. (Detalhe na Seção 7.)
- **M1 — Trava de comissão unificada.** `faltaComissaoParaAvancar` aplicada em handleSave + handleDrop (reverte) + handleApoliceAnexada. (Detalhe na Seção 7.)
- **M2 — `data_emissao` no anexo.** `handleApoliceAnexada` (UPDATE direto) não gravava `data_emissao` ao promover pra "emitida"; a edição seguinte carimbava a data errada, distorcendo métricas por mês de emissão. Agora grava ao virar emitida.
- **M3 — Máscara de moeda no ImportModal.** (Detalhe na Seção 7 — Import de PDF.)
- **B2 — `findOrCreateCliente` tolera duplicado.** `.maybeSingle()` → `.limit(1)`. NOTA: a normalização do front **já era idêntica** ao `norm_doc` (que só faz `>14 → últimos 14`, nunca corta pra 11) — não havia a divergência que o relatório do prompt 2 supôs.
- **N2 — `dataRenovacao` fill-blank** no `handleExtrairDados`. (Detalhe na Seção 7.)
- **N3 — Sync de `clientes` fill-blank + `maskCEP`** no `handleExtrairDados`. (Detalhe na Seção 7.)
- **B5 — Guarda de nome nulo:** `(c.nome || "").split(" ")[0]` nas mensagens de aniversário (WhatsApp/e-mail).
- **B3 — `parseBRL` eliminado.** Estende a unificação de moeda de 18/06: o último gêmeo (`parseBRL` do ImportModal) saiu; `moedaParaNumero` é o conversor único de verdade.
- **N5 / N6 — Perdidos no mês e Taxa de renovação (SQL `dashboard_metrics`).** (Detalhe na Seção 3.) Aplicado em teste e produção.

**Confirmado correto (não mexer):** fórmula de comissão (`premio_liquido * percentual_comissao / 100.0`) nos 3 pontos; simetria `mapRow` ↔ `upsertCard` íntegra (diferem só em `criado_em`/`atualizado_em`, geridos pelo banco, e na coluna morta `apolice_id`).

---

## SEÇÃO 9 — Backlog mapeado (Asana)

Tarefas criadas no Asana com contexto técnico:
1. **05/jul** — Migração da carteira real do Segfy para a produção
2. **10/jul** — E-mail de aviso na reativação automática (Resend + Edge Function)
3. **15/jul** — Frente 4: paridade de campos com Segfy (vigência início, parcelamento, observações)
4. **30/jul** — Opção B: campo `linha_apolice` para encadeamento robusto de ciclos

### Pós-julho / polimento (registrado no Asana 19/06 — não bloqueia migração)
- **B1** — coluna morta `apolice_id` (`upsertCard` grava sempre `null`, nada popula `card.apoliceId`): remover a escrita ou documentar como reservada.
- **B4** — `handleRecuperar`: setar `criadoEm` e formatar o `valor` do novo card (cosmético/transitório).
- **N4 (operacional, atenção na migração)** — garantir `data_emissao` nas apólices que entrarem como "emitida" na migração das 30; a CTE `prod` do dashboard filtra `data_emissao BETWEEN ini/fim`, então emitida sem data **some** do prêmio/comissão do mês.
- **Hardening** — expor `norm_doc` como RPC e chamar no front pra nunca divergir (hoje front e banco já são idênticos).

### Pendentes não criados no Asana
- Entrega 4 do módulo sinistros: validar `sinistros_abertos` na `dashboard_metrics()`
- Ponto 1 do dia 14/06: visual do CRM (Home, cards, layout de Renovações e Prospecções)
- Ambiente de demonstração para corretor terceiro testar o CRM — bloqueado pelo limite de 2 projetos gratuitos no Supabase. Decisão adiada.
- **Etiqueta de alerta no card do cliente** (sinalizando "sem comissão") — sugerido em 18/06, ainda não implementado
- Mensagem de alerta pós-extração em `handleExtrairDados` ainda diz "Card movido para Proposta Transmitida" mesmo quando o destino é "Boleto/Débito" (cosmético)
- Filtro `onlySemComissao` do Kanban não persiste ao navegar pra outra view — comportamento aceito por ora
- IOF avaliado e descartado de propósito da captura de importação de PDF (decisão do corretor, 18/06)

---

## SEÇÃO 10 — Decisões de arquitetura

- **Apólices vigentes** = `status_pipeline = 'emitida' AND data_renovacao >= current_date`
- **Agrupamento de histórico** = Opção A (ramo+seguradora no frontend). Opção B (linha_apolice) em jul/2026.
- **Migração Segfy** = mai/jun 2026 emitidas + jul/ago 2026 a vencer, cliente a cliente
- **Segfy sem API pública** — só import manual via PDF
- **Tailwind v3** — não usar v4 (conflito confirmado)
- **crypto.randomUUID()** para IDs (não usar custom generators)
- **.env no Windows** — usar `Set-Content` no PowerShell (Notepad salva como .env.txt)
- **Asana free/Basic** — não expõe custom fields via API (priority não pode ser setada programaticamente)
- **Parsing de moeda** — usar sempre uma única função compartilhada (`moedaParaNumero`) com detecção automática do separador decimal; nunca assumir que "." é sempre milhar. `parseBRL` e `parseBRLlocal` foram eliminados (18/06 e 19/06); `moedaParaNumero` é a única função.
- **Taxa de renovação** (19/06) = `round(100 × emitidas / (emitidas + perdidas), 1)` no período; "perdidas" = cards "Não Renovada" arquivados no período. Decisão de negócio endossada pelo corretor.
- **"Sem comissão" sem filtro de `arquivado`** (revisado 19/06, N1) = **by-design**, consistente com a `carteira`: a apólice emitida é arquivada mas segue na carteira ativa enquanto vigente. NÃO adicionar filtro de arquivado sem decisão — quebraria a consistência com a carteira.

---

## SEÇÃO 11 — Estilo de trabalho do corretor

- Uma tarefa por vez, confirmar antes de avançar
- Sem explicações teóricas — resultado executável direto
- SQL: validar na teste primeiro, depois produção
- Componentes React: Claude gera arquivo em outputs/, usuário baixa e sobrescreve em src/ (não usar Cowork para evitar sobrescrita)
- Edições em App.jsx: patches entregues como pares Localizar/Substituir pro Ctrl+H (Regex off, Match Case on, conferir "1 de 1"); usuário cola/aplica no VS Code e valida o build antes do commit
- Commit por terminal PowerShell: `git add .` → `git commit -m "..."` → `git push` (separados, não com &&)
- Deploy manual quando auto-deploy falhar: `npx vercel --prod`
- Build local para verificar erros: `npm run build 2>&1 | Select-Object -Last 20` (o vermelho `RemoteException`/`NativeCommandError` após "built in ...ms" é cosmético do PowerShell; o aviso de chunk >500 kB também não bloqueia)
- Teste local da Importação de PDF: usar `npx vercel dev` (porta 3000), não `npm run dev` (porta 5173, sem funções serverless)

---

## SEÇÃO 12 — Módulo de Comissões (Fase 0 — 19/06/2026)

Origem: prompt 3 (gestão). Maior gargalo do corretor: comissão recebida vs. esperada,
inadimplência e conciliação — hoje tudo manual/projetado, nunca confirmado.

### Modelo de dados — "cronograma + razão" (regras de seguradora FORA do schema)
- **`comissao_parcelas`** — cronograma ESPERADO. Uma linha por parcela de comissão:
  `renovacao_id` (FK), `numero_parcela`, `valor_esperado`, `data_prevista`,
  `status` (prevista/recebida/parcial/atrasada/estornada/cancelada).
- **`comissao_movimentos`** — RAZÃO real (com sinal). `tipo` (credito/extra/estorno/
  desconto_assessoria/debito_diverso/ajuste), `valor` (+/-), `data_movimento`,
  `seguradora`, `extrato_ref`, `extrato_data`; liga a apólice (nulável) e à parcela.
- Criadas nas DUAS bases (`comissoes_fase0_schema.sql`). **Não tocam em `renovacoes`.**
- A regra da seguradora só GERA o cronograma — não entra no schema. Por isso o modelo
  sobrevive aos ~6 meses de ajuste sem mudar de estrutura.

### Regimes (distribuição da carteira) → como viram parcelas
- Antecipado (60%): 1 parcela = comissão total.
- Parcelado (25%): N parcelas = comissão ÷ N, datas seguindo os boletos.
- Esgotamento (15%): parcelas conforme o prêmio é esgotado / cliente paga.

### Validado com dado real (na teste)
Maria Amélia (MAPFRE): comissão total R$ 545,07 (10% × 5.450,74), paga em 3× R$ 181,69
nas 3 primeiras das 11 parcelas do cliente. Extrato 68594402 → parcela 1 recebida.
SELECT de validação: esperado 545,07 = cronograma 545,07; recebido 181,69; saldo 363,38.
- O "%comissão" do extrato (36,67%) é DERIVADO, não a taxa real (10%).
- ISS/IRRF/INSS retidos vêm no NÍVEL DO EXTRATO (não por apólice) → movimento à parte.
- Assessoria (BR INFINITE / LojaCorr) → `desconto_assessoria` / repasse no cronograma.

### Decisões
- `regime_comissao` fica FORA do schema por ora (cronograma manual na migração; campo
  entra com o gerador automático na Fase 1+).
- **RLS:** as 2 tabelas nascem sem policies — funcionam no SQL Editor/service role; antes
  de a UI (chave anon) usar, aplicar as MESMAS policies de RLS da `renovacoes`.

### Fases
- Fase 0 (feita): modelo de dados nas 2 bases.
- Migração julho: entrar o cronograma das 30 (inclui comissões em andamento de apólices antigas).
- Fase 1: UI de lançamento manual + conciliação simples.
- Fase 2: relatório esperado × recebido × saldo por mês/seguradora.
- Fase 3: extração de extrato (PDF/CSV) por seguradora — SPIKE em 1 formato real antes.
- Fase 4: relatórios e automações.

---

## SEÇÃO 13 — CORREÇÕES PONTUAIS AO CONTEÚDO DAS SEÇÕES 1–12 (12/07/2026)

Achados da auditoria de código que se referem a detalhes específicos das seções acima. Registrados aqui, sem alterar o texto original de nenhuma delas — cada item aponta pra seção que ele corrige.

**Sobre a Seção 1 (Arquivos do projeto):**
- O "Achado durante a refatoração" (`SN_STATUS_COR_PILL` morto dentro do `handleExtrairDados`) foi corrigido em 12/07 — ver Seção 0.12.
- A tabela de arquivos lista os 9 que vieram da divisão do `App.jsx` original. Desde então, quatro arquivos novos passaram a existir e nunca entraram nessa tabela: `Layout.jsx` (134 linhas), `navConfig.js` (38 linhas), `CrossSell.jsx` (142 linhas), `Sinistros.jsx` (492 linhas) — ver Seções 0.5 e 0.6.
- Contagem de linhas de `App.jsx` (461), `ModalCard.jsx` (1.019) e `utils.js` (116) na tabela está um pouco defasada (hoje 540, 1.034 e 127 respectivamente) — sem impacto prático, só uma nota pra quem for procurar por número de linha específico.

**Sobre a Seção 2 (Schema Supabase):**
- O código usa colunas em `renovacoes` que não aparecem na lista desta seção: `etiqueta_segfy`, `data_alerta`, `auto_sexo`, `auto_menor_residente`, `auto_estado_civil_condutor`, `veiculo`, `cotacoes` (follow-ups). Significado e tipo de cada uma a confirmar numa próxima sessão — não é urgente, só uma lacuna de documentação encontrada pela auditoria.

**Sobre a Seção 7 (Pipeline Kanban / Import de PDF):**
- `STAGES` tem **6 etapas** hoje, não 7 — a Crosselling foi removida em 05/07 (ver Seção 0.4).
- O modelo de extração (`claude-sonnet-4-6`, linha "Extrai dados via API Anthropic") **estava rodando `claude-haiku-4-5-20251001` no código até 12/07** — divergência real entre intenção documentada e código, corrigida hoje (ver Seção 0.12). A partir de agora os dois batem.
- A correção N3 (sync de `clientes` fill-blank + `maskCEP`) tinha regredido silenciosamente em algum momento não documentado — o código voltou a sobrescrever campos preenchidos e gravar CEP sem máscara. Restaurado em 12/07 (ver Seção 0.12).

**Sobre a Seção 12 (Módulo de Comissões — Fase 0):**
- O arquivo `comissoes_fase0_schema.sql` e qualquer referência a `comissao_parcelas`/`comissao_movimentos` **não foram encontrados no repositório** pela auditoria de 12/07 — nenhuma linha de código no app referencia essas tabelas ainda (esperado, já que a Fase 1+ de UI está pausada). Não dá pra confirmar por código se as tabelas realmente existem nas duas bases como esta seção descreve — só é possível verificar direto no SQL Editor de produção e teste. Vale fazer essa checagem antes de retomar qualquer trabalho de Comissões.
- **Verificado em 12/07 (`information_schema.columns` nas duas bases):** as duas tabelas existem, com colunas idênticas em produção e teste, batendo exatamente com o que esta seção descreve — `comissao_parcelas` (id, renovacao_id, numero_parcela, valor_esperado, data_prevista, status, observacao, criado_em) e `comissao_movimentos` (id, renovacao_id, parcela_id, tipo, valor, data_movimento, seguradora, extrato_ref, extrato_data, observacao, criado_em). Zero divergência entre as duas bases. Esse era o único item da auditoria de 12/07 que ficava sem confirmação — agora fechado.