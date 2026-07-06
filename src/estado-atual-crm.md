# Estado Atual — CRM Simples Assim

> Atualizado em 06/07/2026. Não editar manualmente. Documento aditivo — não substituir seções antigas, apenas acrescentar.

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
  - Testado: `git push` direto para `main` é rejeitado (`GH013`)
- **Fluxo correto daqui pra frente:** branch separada → PR → merge. Nunca push direto na `main`.
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

---

## SEÇÃO 0.2 — FIX MODALCARD (01/07/2026) — EM PRODUÇÃO

### Problema corrigido
`handleExtrairDados` no `ModalCard.jsx` usava lógica "preenche só se vazio" para todos os campos. Em cards de renovação, `dataRenovacao` já tem valor do ciclo anterior, então a vigência nova extraída do PDF era descartada silenciosamente. Campos como telefone, e-mail, condutor e estado civil nunca foram mapeados nessa função.

### Correção aplicada
Campos que mudam a cada ciclo agora **sempre sobrescrevem** ao extrair PDF:
`dataRenovacao`, `vigenciaInicio` (novo), `valor`, `premioLiquido`, `seguradora`, `proposta`, `apolice`, `etiquetaPagamento`, endereço completo (7 campos), `telefone`, `email`, `autoEstadoCivil`, `autoCondutor`, `autoCpfCondutor`, `autoNascimentoCondutor`, `autoEstadoCivilCondutor`, `autoCondutor1825`.

Campo "Vigência início" adicionado ao formulário do card (visível e editável), ao lado de "Vigência fim (data renovação)".

**Débito pendente (Asana):**
- gid 1216209458912908 — SQL: `reativar_renovacoes()` deve copiar `vigencia_inicio` do ciclo anterior

---

## SEÇÃO 0.3 — CORREÇÃO DE DEFASAGEM DESTE DOCUMENTO (06/07/2026)

Auditoria direta do código real (App.jsx, Dashboard.jsx, Segurados.jsx, PipelineUI.jsx, navConfig.js, Layout.jsx, constants.js, tailwind.config.js, data.js, utils.js) encontrou divergências entre este documento e o estado real do repositório. Registrando aqui para não se repetir:

- **Seção 0.1 dizia que a migração de dark mode/tokens de Dashboard.jsx e Segurados.jsx estava concluída.** Na prática, só o `<h1>` de cada um tinha `dark:text-slate-100` — todo o resto do corpo (cards, modal, inputs, avatares) continuava com cores hardcoded (`bg-white`, `text-slate-*`). Corrigido de verdade em 06/07 (ver Seção 0.4).
- **Seção 1 (lista de arquivos) estava incompleta.** Arquivos reais do projeto que não apareciam ali: `Layout.jsx`, `navConfig.js`, `PipelineUI.jsx`, `ModalCard.jsx`, `constants.js`, `utils.js`, `data.js`, `ImportPDF.jsx`, `Prospeccoes.jsx`, `DocumentosEndossos.jsx`, `ModaisCadastro.jsx`, e a API route `api/extract-pdf.js`.
- **Seção 7 listava 7 etapas no Kanban, incluindo "crosselling".** Essa etapa foi removida de verdade em 06/07 (ver Seção 0.5) — o Kanban tem 6 etapas hoje.

**Lição registrada:** a fonte de verdade é sempre o código real e o schema real do Supabase — nunca este documento por si só. Antes de qualquer frente estrutural nova, recomenda-se auditar divergências direto no repositório. Tarefa criada no Asana para rodar isso via Cowork quando fizer sentido (gid 1216295911789891).

---

## SEÇÃO 0.4 — REDESIGN FASE 1: DASHBOARD E CLIENTES CONCLUÍDOS DE VERDADE (06/07/2026) — EM PRODUÇÃO

- Migração completa de paleta para os tokens (`canvas`, `painel`, `borda`, `marca`) em `Dashboard.jsx` e `Segurados.jsx` — não só o título como registrado antes, mas todo o corpo: cards de indicador, modal "Sem comissão", seletores de período/horizonte, inputs de edição (incluindo texto digitado, que não tinha `dark:` no original), avatares circulares, histórico de apólices expansível.
- **Propositalmente não tocado:** cores de identidade/status — badges (Vigente/Não renovada/Encerrada), `SN_STATUS_COR`, `CORES_GATILHO`, cores dos ícones dos cards de indicador (`color` prop). São identidade de dado, não estrutura de painel.
- Item "Renovações" da Fase 1 = remoção da etapa Crosselling do Kanban (ver Seção 0.5).
- **Fase 1 do redesign (Dashboard + Clientes + Renovações) está 100% concluída e em produção.**

---

## SEÇÃO 0.5 — REMOÇÃO DA ETAPA "CROSSELLING" DO KANBAN (06/07/2026) — EM PRODUÇÃO

- `constants.js`: objeto `crosselling` removido do array `STAGES`. Kanban passa de 7 para 6 colunas.
- Confirmado via SQL antes da remoção: zero cards com `status_pipeline = 'crosselling'` em produção — remoção sem impacto em dados existentes.
- `CANAL_COR["Crosselling"]` (tag de origem/canal, camada "Canal/Origem" das Regras de Negócio v2) foi **mantida** — é um conceito diferente (de onde o negócio veio), não afetado pela remoção da etapa do pipeline.
- A funcionalidade comercial de cross-sell deixou de ser uma etapa sequencial do Kanban e passou a ser uma tela própria no menu (ver Seção 0.6).

---

## SEÇÃO 0.6 — FASE 2 DO REDESIGN: CROSS-SELL (06/07/2026) — EM PRODUÇÃO

- Novo arquivo `CrossSell.jsx`: inverte a lógica que já existia por cliente na ficha (`Segurados.jsx`, item "Cross-sell" da ficha) — em vez de "olhando 1 cliente, o que falta", mostra "olhando toda a carteira, quem são os candidatos", ranqueados por engajamento (mais apólices vigentes primeiro; empate resolvido por maior prêmio ativo).
- `navConfig.js`: item "Cross-sell" adicionado ao grupo Vendas.
- `App.jsx`: nova função central `navigateTo(view, { clienteId })` — toda navegação normal pelo menu limpa o cliente pré-selecionado; só quem chama explicitamente com `clienteId` o preenche. Evita reabrir por acidente um cliente antigo se a pessoa navegar para Clientes por outro caminho depois. Usada por Cross-sell, Sinistros e Aniversariantes para abrir a ficha do cliente certo direto.
- `Segurados.jsx`: passou a aceitar prop `initialSelId` — se vier preenchida, abre direto na ficha desse cliente em vez da lista.

---

## SEÇÃO 0.7 — FASE 2 DO REDESIGN: SINISTROS (06/07/2026) — EM PRODUÇÃO

Substitui e amplia o que a Seção 6 (antiga, 14/06) descrevia. O objeto sinistro (jsonb dentro de `renovacoes.sinistros`) continua exatamente o mesmo formato documentado na Seção 6 — isso não mudou.

**Novo arquivo `Sinistros.jsx`** — tela consolidada (grupo Operações no menu), com:
- Cards de contagem por status (clicáveis, funcionam como filtro)
- Toggle "ver encerrados"
- Botão "+ Novo sinistro": cria sinistro sem precisar abrir o card. Campo de busca por nome ou CPF/CNPJ (typeahead com até 8 resultados — escala para carteiras grandes, não usa `<select>` com todas as apólices); tipo usa a mesma lista fixa do `ModalCard.jsx` (Colisão, Roubo/Furto, Incêndio, Vida, Danos Elétricos, RC, Outros)
- Cada sinistro é expansível: mudar status, marcar/desmarcar checklist de documentos, registrar contato com a seguradora — as mesmas ações que já existiam no `ModalCard.jsx`
- Botão "Abrir card": localiza e abre o modal do card certo no Kanban (função `handleAbrirCard` em `App.jsx`; se o card não estiver na lista ativa — ex: apólice arquivada — avisa em vez de falhar silenciosamente)

**`Segurados.jsx`** — a seção "Sinistros" na ficha do cliente (`SinistrosCliente`) deixou de ser só leitura: ganhou as mesmas ações (status/checklist/contato) e o botão "Abrir card".

**REGRA DE ESCRITA — vale para os três lugares que hoje editam sinistro** (modal do card, tela Sinistros, ficha do cliente):
```js
supabase.from("renovacoes").update({ sinistros: novoArray }).eq("id", renovacao_id)
```
Update **direto e isolado** só na coluna `sinistros` da apólice específica. **Nunca** usar `upsertCard` para isso — ele reconstrói a linha inteira da apólice a partir de um objeto `card` completo, e um upsert parcial (sem todos os campos carregados) arriscaria zerar colunas que não estavam presentes no objeto em memória naquele momento.

**Removido:** o painel fixo `PainelSinistros` à direita do Kanban, e todo o mecanismo `onlyComSinistro` em `App.jsx` (estado, filtro no `visible`, resets nos outros filtros, pill do topbar) — existiam só para alimentar aquele painel, ficariam como código morto. O componente `PainelSinistros` continua definido em `PipelineUI.jsx` (não foi apagado), só não é mais importado em lugar nenhum.

**`Dashboard.jsx`:** card "Sinistros abertos" agora navega direto para a tela Sinistros (`onNavigate("sinistros")`) em vez de filtrar o Pipeline.

**Menu lateral atual (navConfig.js), para referência:**
| Grupo | Itens |
|---|---|
| Visão Geral | Dashboard |
| Vendas | Captação, Cross-sell |
| Operações | Pipeline, Sinistros, Documentos |
| Carteira | Clientes |

---

## SEÇÃO 0.8 — INCIDENTE: DEPLOY DE SINISTROS FORA DO FLUXO DE PR (05–06/07/2026) E CORREÇÃO

**O que aconteceu:** depois do merge do PR de Cross-sell, o checkout local não foi atualizado (`git checkout main` + `git pull`) antes de abrir a frente de Sinistros. Os commits de Sinistros foram empilhados na branch antiga já mergeada/fechada (`feat/cross-sell-visao-carteira`), sem nunca terem sido de fato mergeados de volta no `main` via Pull Request.

**Sintoma:** produção rodando com a correção de cabeçalho do Kanban (que veio de um `main` puxado corretamente) **mas sem a tela Sinistros** (que nunca chegou ao `main` real) — uma mistura de duas branches diferentes, sem nenhum deploy "quebrado" visível.

**Causa provável do deploy que pareceu funcionar antes:** `npx vercel --prod` publica o **checkout local** no momento em que é executado — não necessariamente o conteúdo do `main` no GitHub. Se o terminal estiver numa branch antiga, é isso que vai para produção.

**Correção:** aberto PR #8 (`feat/cross-sell-visao-carteira` → `main`) com o commit de Sinistros pendente, testado em Preview, mergeado corretamente pelo GitHub.

**LIÇÃO DE PROCESSO (permanente, reforça o que a Seção 0 já dizia):**
- Sempre `git checkout main` + `git pull` antes de `git checkout -b` de qualquer branch nova.
- `npx vercel --prod` é último recurso, só depois de confirmar merge real no GitHub — nunca substitui o fluxo de PR.

---

## SEÇÃO 0.9 — CORREÇÃO DE ALINHAMENTO DO CABEÇALHO DO KANBAN (06/07/2026) — EM PRODUÇÃO

`PipelineUI.jsx` (componente `Column`): cabeçalho passou a usar `stage.short` (rótulo curto, ex: "Vistoria" em vez de "Vistoria / Pend. Emissão", "Pagamento" em vez de "Boleto / Débito") em vez de `stage.label` (nome completo). Nomes longos quebravam em duas linhas dentro da largura fixa da coluna (256px), desalinhando a fileira inteira de cabeçalhos. Nome completo mantido como tooltip (`title`) ao passar o mouse.

---

## SEÇÃO 0.10 — PENDÊNCIAS EM ABERTO (06/07/2026)

- **Cor do menu lateral (sidebar) no claro/escuro** — decisão pendente com Salim: (a) virar claro/branco no modo claro, abandonando o navy fixo da identidade SeguraPro; ou (b) manter navy, com contraste bem mais forte entre os dois tons. Sem decisão ainda — não mexer até fechar.
- **Comissões (versão estimada)** — último item da Fase 2, pausado. Registrado no Asana (gid 1216295454296978). Escopo: agregação de `premio_liquido × percentual_comissao` por mês/produto/seguradora. A versão financeira detalhada (`comissao_parcelas`/`comissao_movimentos`) continua separada e pausada à parte, aguardando regras reais de pagamento por seguradora.
- **RLS das tabelas de comissão** (`comissao_parcelas`/`comissao_movimentos`) precisa espelhar as políticas de `renovacoes` antes de qualquer exposição na UI, mesmo da versão estimada, se ela tocar essas tabelas.
- **Auditoria completa de divergência doc-vs-código via Cowork** — registrada no Asana (gid 1216295911789891), ainda não executada.

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

### Componentes React ativos
- `src/App.jsx` — componente principal (~2900 linhas), monolítico
- `src/Dashboard.jsx` — dashboard com 8 cards + gráfico rosca (mix de carteira)
- `src/Segurados.jsx` — área do segurado com ficha completa
- `src/supabase.js` — cliente Supabase

### Deploy
- Vercel conectado ao GitHub (auto-deploy no push para main)
- Quando o auto-deploy falhar: `npx vercel --prod` no PowerShell
- Build local: `npm run build 2>&1 | Select-Object -Last 20`

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
Normalização robusta de CPF/CNPJ: remove não-dígitos, mantém últimos 14 (CNPJ) ou 11 (CPF).
Evita duplicação de cadastro por zero extra na frente do CNPJ.

### `enriquecer_cliente()` + trigger `trg_enriquecer_cliente`
Trigger AFTER INSERT OR UPDATE em `renovacoes`.
Preenche campos VAZIOS do cadastro de clientes (fill-blank-only, nunca sobrescreve):
- nome, cpf_cnpj, cpf_cnpj_norm, tipo_pessoa (inferido dos dígitos), telefone, email
- data_nascimento (copia de auto_nascimento_segurado quando CPF/nome do segurado bate com o titular)

### `reativar_renovacoes()`
Cria novo card (INSERT) para renovações 30 dias antes do vencimento.
- Copia dados do card arquivado+emitido
- Status = 'cotacoes', etiqueta_situacao = 'Renovação'
- Trava anti-duplicidade (NOT EXISTS)
- Exclui: Não Renovada, Cancelada, Recusada, Sem Negócio, Viagem, RC Obras
- Agendada via pg_cron: job `reativar-renovacoes-diario`, `0 11 * * *` (08:00 Brasília)

### `dashboard_metrics()` → jsonb
Retorna: carteira_qtd, carteira_valor, premio_mes, comissao_mes,
emitidas_mes, total_mes, taxa_renovacao, projecao_comissao_60d,
perdidos_mes, urgentes_5d, sinistros_abertos, mix_carteira (array por ramo)

---

## SEÇÃO 4 — Componente Dashboard.jsx

8 cards de indicadores + gráfico rosca "Mix de Carteira por ramo".
Chama `supabase.rpc('dashboard_metrics')`.
Cards: Carteira ativa, Prêmio do mês, Comissão do mês, Taxa de renovação,
Receita projetada 60d, Perdidos no mês, Sinistros abertos, Urgentes (≤5 dias).

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
- `norm_doc` robusta no `findOrCreateCliente`: mantém últimos 14/11 dígitos

---

## SEÇÃO 6 — Módulo Sinistros (App.jsx, estado 14/06/2026)

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

### Funções no Modal (App.jsx)
- `SN_STATUS` — array dos 5 status
- `SN_DOCS` — array dos 6 documentos do checklist
- `addSinistro()` — cria novo objeto e adiciona ao array
- `removeSinistro(id)` — remove do array
- `updateSinistroStatus(id, status)` — atualiza status (preenche dataEncerramento automaticamente)
- `addContatoSinistro(sinId, contato)` — adiciona contato ao histórico
- `toggleDocSinistro(sinId, doc)` — marca/desmarca documento no checklist
- `snContatoForm` — estado dos formulários de contato por sinistro

### PainelSinistros (componente autônomo antes de `function Column`)
Lê `cards.flatMap(c => c.sinistros.filter(s => s.status !== "Encerrado"))`.
Coluna fixa 256px à direita do Kanban, scroll próprio.

---

## SEÇÃO 7 — Pipeline Kanban (App.jsx)

### STAGES (etapas)
1. cotacoes — "Cotações e Leads" (azul)
2. enviada — "Enviada ao Cliente" (laranja)
3. transmitida — "Proposta Transmitida" (roxo)
4. vistoria — "Vistoria / Pend. Emissão" (vermelho) — condicional
5. boleto — "Boleto / Débito / Link" (amarelo) — condicional
6. emitida — "Apólice Emitida" (verde)
7. crosselling — "Crosselling" (roxo claro)

### Fluxo de arquivamento
- `handleSave`: se `updated.arquivado && !anterior.arquivado` → remove da lista (some sem F5)
- `handleArquivar`: `upsertCard` + `setCards(filter)`
- `handleNaoRenovada`: arquiva + cria prospecção automática

### Import de PDF
- Botão "Importar PDF" → `ImportModal`
- Extrai dados via API Anthropic (claude-sonnet-4-6)
- `findOrCreateCliente`: busca por `cpf_cnpj_norm` com norm robusta (últimos 14/11 dígitos)
- Cria card com `status_pipeline` e `etiqueta_situacao` adequados

---

## SEÇÃO 8 — Correções e blindagens implementadas

### Anti-duplicidade de cadastro (duas camadas)
- **Camada 1 (banco):** `norm_doc()` + trigger `enriquecer_cliente` — colapsam CNPJ com zero extra
- **Camada 2 (App.jsx):** `findOrCreateCliente` normaliza com `slice(-14)` antes de buscar

### Merge FOCALIZE executado
CNPJ `021.672.740/0001-44` (15 dígitos, tipo ?) fundido com `21.672.740/0001-44` (PJ).
Apólice movida, duplicado apagado. Caça-duplicados rodou: 0 outros duplicados.

### Limpeza de cadastros existentes
```sql
UPDATE clientes SET cpf_cnpj_norm = norm_doc(cpf_cnpj) WHERE ...;
UPDATE clientes SET tipo_pessoa = CASE ... WHERE coalesce(tipo_pessoa,'') IN ('','?') ...;
```

---

## SEÇÃO 9 — Backlog mapeado (Asana)

Tarefas criadas no Asana com contexto técnico:
1. **05/jul** — Migração da carteira real do Segfy para a produção
2. **10/jul** — E-mail de aviso na reativação automática (Resend + Edge Function)
3. **15/jul** — Frente 4: paridade de campos com Segfy (vigência início, parcelamento, observações)
4. **30/jul** — Opção B: campo `linha_apolice` para encadeamento robusto de ciclos

### Pendentes não criados no Asana
- Entrega 4 do módulo sinistros: validar `sinistros_abertos` na `dashboard_metrics()`
- Ponto 1 do dia 14/06: visual do CRM (Home, cards, layout de Renovações e Prospecções)

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

---

## SEÇÃO 11 — Estilo de trabalho do corretor

- Uma tarefa por vez, confirmar antes de avançar
- Sem explicações teóricas — resultado executável direto
- SQL: validar na teste primeiro, depois produção
- Componentes React: Claude gera arquivo em outputs/, usuário baixa e sobrescreve em src/ (não usar Cowork para evitar sobrescrita)
- Commit por terminal PowerShell: `git add .` → `git commit -m "..."` → `git push` (separados, não com &&)
- Deploy manual quando auto-deploy falhar: `npx vercel --prod`
- Build local para verificar erros: `npm run build 2>&1 | Select-Object -First 20`
