# Estado Atual — CRM Simples Assim

> Atualizado em 15/06/2026. Não editar manualmente.

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
- `src/App.jsx` — componente principal (~3300 linhas após blocos estruturados), monolítico
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

### `dashboard_metrics()` → jsonb
Retorna: carteira_qtd, carteira_valor, premio_mes, comissao_mes,
emitidas_mes, total_mes, taxa_renovacao, projecao_comissao_60d,
perdidos_mes, urgentes_5d, sinistros_abertos, mix_carteira (array por ramo)
- **Correção 15/06/2026:** `sinistros_abertos` agora filtra `r2.arquivado = false`
  (antes contava sinistros de cards arquivados). Validada teste → produção.

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

### Import de PDF
- Botão "Importar PDF" → `ImportModal`; extração no endpoint backend `/api/extract-pdf` (extract-pdf.js)
- Modelo da extração: `claude-haiku-4-5-20251001` (no endpoint). App.jsx menciona sonnet em comentário antigo.
- Retorna JSON com `segurado`, `endereco` (novo 15/06), `apolice`, `veiculo`, `financeiro`
- `findOrCreateCliente`: busca por `cpf_cnpj_norm` com norm robusta (últimos 14/11 dígitos)
- Cria card com `status_pipeline` e `etiqueta_situacao` adequados
- Backup do endpoint antigo guardado como `api/extract-pdf.js.bak` (não vira rota Vercel)

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

### Pendentes não criados no Asana
- ~~Entrega 4 do módulo sinistros: validar `sinistros_abertos` na `dashboard_metrics()`~~ ✅ FEITO 15/06

### Tarefa no Asana (criada 15/06)
5. **30/jun** — Visual do CRM (Home, cards, layout de Renovações e Prospecções) — gid 1215699702329897
   Projeto Via Seguros (gid 1215505399755326). Próximo grande item, ainda não iniciado.

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
- **Edição de App.jsx por str_replace tem risco de remover elemento adjacente usado como âncora.**
  Verificação de integridade obrigatória antes de cada entrega: comparar campos de `mapRow`/`upsertCard`
  do arquivo recebido vs entregue. (Lição: checkbox Segfy e campos de comissão sumiram em sessões anteriores.)

---

## SEÇÃO 11 — Estilo de trabalho do corretor

- Uma tarefa por vez, confirmar antes de avançar
- Sem explicações teóricas — resultado executável direto
- SQL: validar na teste primeiro, depois produção
- Componentes React: Claude gera arquivo em outputs/, usuário baixa e sobrescreve em src/ (não usar Cowork para evitar sobrescrita)
- Commit por terminal PowerShell: `git add .` → `git commit -m "..."` → `git push` (separados, não com &&)
- Deploy manual quando auto-deploy falhar: `npx vercel --prod`
- Build local para verificar erros: `npm run build 2>&1 | Select-Object -First 20`
