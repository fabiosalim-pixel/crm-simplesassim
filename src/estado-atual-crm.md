# Estado Atual — CRM Simples Assim

> Atualizado em 15/06/2026 (sessão 3). Não editar manualmente.

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
- `src/App.jsx` — componente principal (~3600 linhas), monolítico. Inclui `AniversariantesView`.
  **⚠️ Lição (sessão 3):** `PainelSinistros` estava duplicado dentro do `handleExtrairDados` por bug de str_replace.
  Verificação obrigatória: `grep -c "function PainelSinistros" App.jsx` deve retornar 1.
- `src/Dashboard.jsx` — dashboard com 4 regiões, seletor de período, cards clicáveis (reescrito 15/06 sessão 2)
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
- **`data_emissao`** (date, add 15/06 sessão 2) — data real de emissão/produção da apólice.
  Gravada automaticamente no `upsertCard` quando `status = 'emitida'`. Marco de produção para o dashboard.

### Ciclo de renovação (entendimento confirmado sessão 3)
`data_renovacao` = vigência fim do **ciclo atual que está sendo trabalhado** (não do anterior).
Ex: card em "Cotações e Leads" para Maria Julia RC Prof → `data_renovacao = 08/07/2027` (correto).
A apólice anterior (2025→2026) é o card arquivado. O card novo trabalha o próximo ciclo.
Ao extrair **proposta** de renovação, `vigenciaFim` da proposta = `data_renovacao` do card novo. ✅

### Blocos estruturados por ramo (adicionados 15/06/2026)
Substituem o antigo campo único "Veículo/Bem Segurado" (que sumiu para ramos com bloco
próprio; vira "Bem segurado / descrição" texto livre só para ramos sem bloco).
Cada bloco aparece condicionalmente conforme `tipo_seguro`. Arrays de ramos no topo do App.jsx:
`RAMOS_IMOVEL`, `RAMOS_VIDA`, `RAMOS_EQUIP`, `RAMOS_VIAGEM`.

- **Endereço do cliente** (estruturado, substitui `endereco` texto solto — este foi mantido por compat):
  `endereco_cep`, `endereco_logradouro`, `endereco_numero`, `endereco_complemento`,
  `endereco_bairro`, `endereco_cidade`, `endereco_uf` (todos text). ViaCEP no campo CEP.
- **Imóvel** (EMPRESARIAL, RESIDENCIAL, CONDOMÍNIO, FIANÇA LOCATÍCIA, RC OBRAS, RISCO DE ENGENHARIA, RURAL):
  `imovel_cep`, `imovel_logradouro`, `imovel_numero`, `imovel_complemento`, `imovel_bairro`,
  `imovel_cidade`, `imovel_uf`, `imovel_atividade`, `imovel_tipo` (text), `imovel_valor_risco` (numeric). ViaCEP no CEP.
- **Vida/Pessoas** (VIDA INDIVIDUAL, VIDA EM GRUPO, ACIDENTES PESSOAIS):
  `vida_capital_morte`, `vida_capital_invalidez`, `vida_capital_funeral` (numeric),
  `vida_beneficiarios` (jsonb: `[{id, nome, parentesco, cpf, percentual}]`). Validador soma % = 100.
- **Equipamento** (BIKE, EQUIPAMENTOS PORTÁTEIS):
  `equip_tipo`, `equip_marca`, `equip_modelo`, `equip_serie` (text),
  `equip_data_aquisicao` (date), `equip_valor_aquisicao` (numeric).
- **Viagem** (SEGURO VIAGEM):
  `viagem_destino`, `viagem_origem`, `viagem_motivo`, `viagem_faixa_etaria` (text),
  `viagem_data_ida`, `viagem_data_volta` (date). Contador de dias automático na UI.

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

### `dashboard_metrics(p_inicio, p_fim, p_renovar_dias)` → jsonb
**Versão 2 (15/06 sessão 2)** — parametrizada por período. Substitui versão sem parâmetros (dropada).
Defaults: `p_inicio = início do mês corrente`, `p_fim = hoje`, `p_renovar_dias = 30`.

Retorna 4 regiões separadas:
- **Produção (período para trás):** `emitidas_periodo`, `premio_periodo`, `comissao_periodo`,
  `perdidas_periodo`, `total_periodo`, `periodo_inicio`, `periodo_fim`. Usa `data_emissao`.
- **Carteira (foto de agora):** `carteira_qtd`, `carteira_valor`, `carteira_comissao`, `mix_carteira`.
- **A renovar (para frente):** `a_renovar_qtd`, `a_renovar_premio`, `renovar_dias`.
- **Aniversariantes:** `aniv_hoje`, `aniv_15d`, `aniv_30d`. Lógica MM-DD (ignora ano).
- **Foto geral:** `sinistros_abertos`, `urgentes_5d`.
- **Compat. legada:** `premio_mes`, `comissao_mes`, `emitidas_mes`, `total_mes`, `taxa_renovacao`,
  `perdidos_mes`, `projecao_comissao_60d` (mantidos para não quebrar código antigo).
- **Correção 15/06 sessão 1:** `sinistros_abertos` filtra `arquivado = false`.

---

## SEÇÃO 4 — Componente Dashboard.jsx (reescrito 15/06 sessão 2)

**4 regiões com seletor de período e cards clicáveis.**
Chama `supabase.rpc('dashboard_metrics', { p_inicio, p_fim, p_renovar_dias })`.
Recebe props `onNavigate(view)` e `onFiltro(filtro)` do App.jsx para drill-downs.

### Região 1 — Produção (para trás)
Seletor: Mês atual / 15 / 30 / 90 dias / intervalo livre (data início → fim).
Cards clicáveis: Apólices emitidas, Prêmio produzido, Comissões, Taxa de renovação, Perdidos.
Card informativo: Proj. comissão 60d.
Drill-down → pipeline filtrado por status.

### Região 2 — Carteira (foto de agora)
Cards: Apólices vigentes, Comissão da carteira (informativos).
Cards clicáveis: Sinistros abertos, Urgentes (≤5 dias).
Gráfico rosca: Mix de carteira por ramo.

### Região 3 — A renovar (para frente)
Seletor de horizonte: 15 / 60 / 90 dias.
Bloco clicável violeta: qtd de apólices + prêmio em jogo. Drill-down → pipeline.

### Região 4 — Aniversariantes (para frente)
Seletor: Hoje / 15 dias / 30 dias.
Bloco clicável âmbar → tela `AniversariantesView` (view = "aniversariantes").

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
- `handleSave`: card **NÃO fecha mais ao salvar** (mudança 15/06). Só fecha quando arquivado
  ou no X. Mostra toast "X campo(s) atualizado(s) com sucesso" (some em 3,5s).
- `handleArquivar`: `upsertCard` + `setCards(filter)`
- `handleNaoRenovada`: arquiva + cria prospecção automática

### Campos financeiros (App.jsx, estado 15/06/2026)
- Prêmio (`valor`) e Prêmio líquido (`premioLiquido`) usam **máscara de moeda BR** (texto "1.583,00").
  Funções: `maskMoeda` (formata), `moedaParaNumero` (salvar), `numeroParaMoeda` (carregar do banco).
- Comissão (%) → campo `percentualComissao`. Comissão (R$) calculada e exibida (read-only) = líquido × %.
- `fmtBRL` corrigido com `maximumFractionDigits: 2` (arredonda em 2 casas).

### Endereço (App.jsx + extract-pdf.js, 15/06/2026)
- Função `buscaCEP(cep)` → ViaCEP (`https://viacep.com.br/ws/CEP/json/`), gratuito, sem chave, CORS ok.
  Dispara no `onBlur`. Máscara `maskCEP`. Usado no endereço do cliente e no bloco Imóvel.
- `extract-pdf.js`: agora extrai endereço do segurado (PASSO 6 + objeto `endereco` no JSON).
  `handleExtrairDados` preenche `endereco_*` (fill-blank-only).

### Import de PDF / handleExtrairDados (App.jsx, estado sessão 3)
- Endpoint backend `/api/extract-pdf` (extract-pdf.js) — modelo `claude-haiku-4-5-20251001`
- Retorna JSON com `segurado` (incl. `dataNascimento`), `endereco`, `apolice`, `veiculo`, `financeiro`
- **Mudança automática de status (add sessão 3):** ao extrair uma **proposta** com card em `cotacoes`,
  o status avança automaticamente para `transmitida` com `transmitida_em = now()`.
- **Sincronização com `clientes` (add sessão 3):** após extrair PDF, atualiza diretamente a tabela
  `clientes` com `data_nascimento` e campos de endereço (`cep`, `logradouro`, `numero`, `complemento`,
  `bairro`, `cidade`, `estado`). Fill-blank-only — não sobrescreve campos já preenchidos.
- Backfill executado em teste e produção (sessão 3): clientes existentes atualizados com dados dos cards.
- `findOrCreateCliente`: busca por `cpf_cnpj_norm` com norm robusta (últimos 14/11 dígitos)
- Backup do endpoint antigo: `api/extract-pdf.js.bak`

### AniversariantesView (add 15/06 sessão 2, dentro do App.jsx)
Tela dedicada acessada via `view = "aniversariantes"` (clique no bloco âmbar do dashboard).
- Seletor: Hoje / Próximos 15 dias / Próximos 30 dias
- Busca por nome
- Lista: avatar inicial, nome clicável (→ Segurados), data de aniversário + idade, e-mail
- **Botão WhatsApp** — `wa.me/55NUM?text=mensagem pronta de parabéns` (sem API, link direto)
- **Botão E-mail** — `mailto:` com assunto e mensagem pronta (sem backend)
- Lógica de filtro: compara MM-DD do `data_nascimento` (ignora ano), correto para qualquer faixa etária
- Ponte para etapa 2 de comunicação (automação via Resend virá depois)

### Bug corrigido (sessão 3) — PainelSinistros duplicado
`PainelSinistros` estava inserido dentro do `handleExtrairDados` por bug de str_replace anterior.
Causava: `SN_STATUS_COR_PILL` fora de escopo, `onExtrairDados` retornando `() => {}` no Modal.
Fix: removido o duplicado, função restaurada. Verificação: `grep -c "function PainelSinistros" App.jsx` = 1.

### Badge "urgente" (topo) e critério de urgência
- Badge "X urgente(s)" é **clicável** (15/06): leva ao pipeline + ativa filtro `onlyUrgentes`.
  Chip vermelho "Só urgentes (≤5 dias)" com X para limpar.
- Critério unificado em **≤5 dias** (badge, filtro e card do dashboard). Bordas dos cards individuais
  mantêm gradiente próprio (vermelho ≤2, amarelo ≤7).

### Canais de origem (etiqueta_canal)
Array `CANAIS`: Google, Indicação, Site, **Cliente da Corretora**, **Outros/Não informado** (2 últimos add 15/06).

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
5. **30/jun** — Visual do CRM (Home, cards, layout de Renovações e Prospecções) — gid 1215699702329897

### Pendentes não criados no Asana
- ~~Entrega 4 do módulo sinistros: validar `sinistros_abertos`~~ ✅ FEITO 15/06 sessão 1
- ~~Visual do CRM~~ → criado no Asana (item 5 acima)
- **E-mail automático de aniversário** via Resend — próximo passo da etapa 2 de comunicação
- **WhatsApp em massa / campanha** — avaliar integração futura (Twilio/Z-API)
- **Drill-down de sinistros** no dashboard (botão "Sinistros abertos" ainda não tem tela dedicada)

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
- **Blocos por ramo = colunas estruturadas com prefixo** (15/06) — escolhido sobre campo genérico de texto.
  Incremental: novo ramo de natureza diferente → adiciona bloco sem refazer. Evolução futura possível:
  mover blocos para jsonb quando a tabela ficar muito larga (não agora).
- **ViaCEP** (não API Correios, que é paga) — gratuito, sem chave, CORS liberado, chamado do frontend.
- **Múltiplos carros do mesmo cliente** = múltiplos cards (não um card com vários veículos). Confirmado.
- **Verificação obrigatória pré-entrega App.jsx (add sessão 3):**
  1. `grep -c "function PainelSinistros" App.jsx` = 1
  2. Integridade mapRow: `comm -23` entre campos do original e do novo
  3. Compilação limpa: esbuild sem ERROR/WARNING
- **Dashboard híbrido** (15/06 sessão 2): drill-downs reaproveitam telas existentes (Renovações/Segurados);
  tela dedicada criada só para Aniversariantes (gatilho de ação de comunicação).
- **`data_emissao`** = marco de produção (não `arquivado_em`, que pode ter outros motivos).
  Backfill: `arquivado_em` → `atualizado_em` como fallback. Gravada automaticamente ao emitir.
- **Aniversariantes** = tela de relacionamento, não de renovação. Gatilho de WhatsApp/e-mail.
  WhatsApp via link `wa.me` (sem API). E-mail via `mailto:` (sem backend). Automação via Resend no futuro.
- **Período do dashboard**: produção = para trás (o que foi vendido); a renovar = para frente (esforço futuro).
  Dois seletores independentes, cada um na sua região. Aniversariantes = para frente (quem vai fazer aniversário).

---

## SEÇÃO 11 — Estilo de trabalho do corretor

- Uma tarefa por vez, confirmar antes de avançar
- Sem explicações teóricas — resultado executável direto
- SQL: validar na teste primeiro, depois produção
- Componentes React: Claude gera arquivo em outputs/, usuário baixa e sobrescreve em src/ (não usar Cowork para evitar sobrescrita)
- Commit por terminal PowerShell: `git add .` → `git commit -m "..."` → `git push` (separados, não com &&)
- Deploy manual quando auto-deploy falhar: `npx vercel --prod`
- Build local para verificar erros: `npm run build 2>&1 | Select-Object -First 20`

---

## SEÇÃO 12 — Atualização 17/06/2026: Integração Site→CRM e correções críticas

### Nova função/trigger: processar_lead_site()
AFTER INSERT ON public.leads (TESTE e PRODUÇÃO). Mapeia automaticamente todo lead novo
do site para um card em renovacoes (Cotações e Leads). Traduz tipo_seguro do site
("Seguro Auto" etc.) para a convenção do CRM (AUTOMÓVEL/RESIDENCIAL/VIAGEM/VIDA/
EMPRESARIAL/OUTROS). Para Auto + fluxo "novo": mapeia placa/modelo/ano/chassi/
cpf_condutor/estado_civil_condutor/cep_pernoite/tipo_utilizacao/condutor_1825.
Blindado com BEGIN/EXCEPTION — erro de mapeamento nunca bloqueia o INSERT do lead.

### ACHADO CRÍTICO #1 (corrigido): CRM lia base de teste, não produção
Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY na Vercel (projeto crm-simplesassim)
apontavam para ijlwdshwmsgkvsdjxfad (teste) em vez de mrxfgvotcmtdmuzcajin (produção).
Corrigido + redeploy sem cache. Usuário de login recriado em produção (Authentication
estava vazio). LIÇÃO: checar periodicamente se o ambiente publicado aponta pro projeto
certo — não havia alerta visual disso.

### ACHADO CRÍTICO #2 (corrigido): schema da produção incompleto
Produção estava sem 4 colunas que a teste já tinha: vida_capital_morte,
vida_capital_invalidez, vida_capital_funeral, vida_beneficiarios (bloco Vida).
Causava falha silenciosa ao salvar QUALQUER card (erro PGRST204, mascarado por
atualização otimista da UI). Corrigido com ALTER TABLE + NOTIFY pgrst reload schema.
LIÇÃO: ao adicionar coluna nova em um ambiente, replicar no outro imediatamente —
não foi feito systematicamente até agora.

### Paridade teste/produção restabelecida
Teste não tinha as tabelas `seguradoras` e `usuarios` (só produção tinha). Criadas na
teste com a mesma estrutura + RLS + as 42 seguradoras copiadas. Funções confirmadas
idênticas nos dois ambientes (dashboard_metrics, enriquecer_cliente, norm_doc,
reativar_renovacoes, processar_lead_site).

### Card "Jose Ribamar" (produção)
Mantido permanentemente por decisão do Salim — atualizado com dados do seu falecido
pai, como homenagem. Não excluir.