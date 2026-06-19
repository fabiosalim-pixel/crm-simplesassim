# Estado Atual — CRM Simples Assim

> Atualizado em 18/06/2026. Não editar manualmente.

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

### `dashboard_metrics(p_inicio date, p_fim date, p_renovar_dias integer)` → jsonb
Parametrizada (período de produção, janela de "a renovar"). Retorna, agrupado em jsonb: dados de Produção (período), Carteira (foto de agora), A renovar (horizonte), Aniversariantes, foto geral (sinistros, urgentes, **sem_comissao_qtd/valor**) e bloco de compatibilidade com nomes antigos do Dashboard (premio_mes, comissao_mes, etc.)

**`sem_comissao_qtd` / `sem_comissao_valor`** — adicionados em 18/06/2026. Contam apólices da carteira ativa (`status_pipeline = 'emitida' AND data_renovacao >= hoje`) com `percentual_comissao` OU `premio_liquido` em branco. Alimenta o card clicável "Sem comissão" no Dashboard.

**Fórmula de comissão (confirmada no código-fonte da função, 18/06/2026):**
```sql
premio_liquido * percentual_comissao / 100.0
```
`percentual_comissao` é guardado como número inteiro (`15` = 15%). Usada em três lugares dentro da função: `comissao_periodo`, `carteira_comissao` e `projecao_comissao_60d`. Como qualquer multiplicação com `NULL` em SQL resulta em `NULL`, e `SUM()` ignora `NULL` silenciosamente, um card sem `percentual_comissao` ou sem `premio_liquido` simplesmente **não entra na soma** — sem erro visível, só um número de comissão mais baixo do que deveria no Dashboard. É a razão pela qual esses dois campos passaram a ser obrigatórios em certas transições (ver Seção 7).

---

## SEÇÃO 4 — Componente Dashboard.jsx

**Restaurado em 18/06/2026** após ter sido temporariamente sobrescrito por uma versão simplificada de 8 cards (commit `f670817` recuperado via `git show`). A versão correta tem 4 regiões:

1. **Produção** — seletor de período (Mês atual / 15 / 30 / 90 dias / livre). Cards clicáveis: Apólices emitidas, Prêmio produzido, Comissões, Taxa de renovação, Perdidos (navegam pro Kanban filtrado por status/data via `onNavigate`/`onFiltro`). Card informativo (não clicável): Proj. comissão 60d.
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

### Validação de comissão obrigatória — implementada em 18/06/2026
No `handleSave` do App (~linha 3256), antes de chamar `upsertCard`:
- Se o card está **entrando agora** no estágio `transmitida` ou `emitida` (ou seja, `updated.status` mudou para um desses E `anterior?.status` era diferente) → exige `premioLiquido` e `percentualComissao` preenchidos (não vazios).
- Se algum estiver em branco, mostra `window.alert(...)` e `return` antes do `upsertCard` — nada é salvo.
- **Não dispara** se o card já estava nesse estágio antes (edição de um card antigo/histórico não é bloqueada por falta de comissão).
- **Não afeta** o fluxo de criação via "Importar PDF" (`handleAdd`, função separada) — usado para registrar apólices da concorrência ou imports em lote, que não precisam de comissão.
- Motivo: o `percentual_comissao` é essencial para o cálculo de comissão no `dashboard_metrics()` (ver Seção 3) e ficava em branco silenciosamente quando a proposta era transmitida via "Extrair Dados".

### Import de PDF
- Botão "Importar PDF" → `ImportModal`
- Extrai dados via API Anthropic (claude-sonnet-4-6), endpoint `/api/extract-pdf` (`extract-pdf.js`)
- `findOrCreateCliente`: busca por `cpf_cnpj_norm` com norm robusta (últimos 14/11 dígitos)
- Cria card com `status_pipeline` e `etiqueta_situacao` adequados
- Campo **Data de Nascimento** obrigatório na revisão quando há CPF (validado em `criarCard`, ~linha 2695): `<input type="date">` ligado a `form.autoNascimentoSegurado`, asterisco condicional via `isCNPJ()` — **corrigido em 18/06/2026** (o campo havia sido removido da tela de revisão e bloqueava o salvamento de qualquer produto não-Auto, ex: RC Profissional)
- `parseBRL` (dentro do `ImportModal`, ~linha 2572): converte os valores financeiros extraídos do PDF para número, aceitando formato BR (vírgula decimal) OU US (ponto decimal) — a IA de extração varia o formato entre execuções — **corrigido em 18/06/2026** (ver Seção 8)
- **Produto** (`tipoSeguro`) inicia em branco ("Selecione") em vez de fixo em "AUTOMÓVEL" — **corrigido em 18/06/2026**, tanto no `AddModal` (Novo card) quanto no `ImportModal` (estado inicial + condição que sempre retornava "AUTOMÓVEL" independente do PDF ter dados de veículo ou não)
- **Canal de origem** na tela de revisão agora usa a lista compartilhada `CANAIS` (5 opções: Google, Indicação, Site, Cliente da Corretora, Outros/Não informado) em vez de uma lista hardcoded incompleta com só 3 — **corrigido em 18/06/2026**

#### Captura completa em uma única extração — implementado em 18/06/2026
Motivação: evitar pagar duas vezes pela IA (uma na importação, outra ao usar "Extrair" dentro do card já criado) por causa de campos que a IA já extrai mas o fluxo descartava. Mapeados em `processarPDF` (estado do `form`), exibidos na tela de revisão e persistidos em `criarCard`:

**Críticos (campos que já existiam no schema, só não eram capturados):**
- Endereço completo do segurado (`d.endereco.*` → `enderecoCep/Logradouro/Numero/Complemento/Bairro/Cidade/Uf`)
- Prêmio líquido (`d.financeiro.premioLiquido` → `premioLiquido`) — essencial pois é um dos campos exigidos pela validação de comissão obrigatória (Seção 7, abaixo)
- Data de emissão (`d.apolice.dataEmissao` → `dataEmissao`) — sem isso, `upsertCard` defaultava pra "hoje" quando status='emitida', inflando artificialmente as métricas de produção do mês no Dashboard pra qualquer apólice histórica importada
- Classe de bônus (`d.apolice.classeBonus` → `autoClasseBonus`)

**Secundários (exigiram colunas novas no banco, ver Seção 2):**
- Vigência início (`d.apolice.vigenciaInicio` → `vigenciaInicio`)
- Zero KM e combustível do veículo (`d.veiculo.zeroKm/combustivel` → `autoZeroKm`/`autoCombustivel`)
- Número de parcelas, valor da parcela, vencimento da 1ª parcela (`d.financeiro.numeroParcelas/valorParcela/vencimentoPrimeiraParcela`)

IOF foi avaliado e **descartado** de propósito (decisão do corretor).

#### Forma de pagamento → move automaticamente pra "Boleto/Débito" — implementado em 18/06/2026
Quando a forma de pagamento mapeada (`mapPagamento()`) for "Boleto", "Débito em Conta" ou "Link de Pagamento", o card que iria pra `transmitida` é desviado direto pra `boleto` em vez disso. Implementado em dois pontos:
- **`ImportModal` (`processarPDF`)**: `importStatus` calculado normalmente, depois sobrescrito pra `"boleto"` se bater a condição.
- **`handleExtrairDados` (Modal de card existente)**: a forma de pagamento agora também é capturada aqui (`updates.etiquetaPagamento`, gap que não existia antes), e a transição automática pra `transmitida` (quando `tipo === "proposta" && d.status === "cotacoes"`) decide entre `"boleto"` ou `"transmitida"` com a mesma lista de formas de pagamento.

### Extração de dados em card existente (`handleExtrairDados`, dentro do `Modal`)
- Disparada pelo botão "Extrair" sobre um documento anexado (proposta, apólice ou endosso)
- Preenche campos vazios do card a partir do PDF extraído (não sobrescreve o que já estava preenchido)
- Se `tipo === "proposta"` e o card está em `cotacoes` → muda `d.status` para `transmitida` automaticamente (só no estado local do Modal; só persiste no clique em "Salvar", onde a validação de comissão da seção acima entra em ação)
- Se `tipo === "apolice_endosso"` → calcula delta de prêmio líquido e registra em `endossos`

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

### Bug do parser de valores monetários — corrigido em 18/06/2026
Existiam **três funções divergentes** de conversão de moeda no arquivo, todas com a mesma falha: tratavam o caractere "." sempre como separador de milhar, mesmo quando era o separador decimal.

- `parseBRL` (dentro do `ImportModal`, ~linha 2572) — usada na criação de card via importação de PDF
- `moedaParaNumero` (função **global**, ~linha 104) — usada em **todos** os campos de dinheiro do sistema (inputs mascarados via `maskMoeda` / `numeroParaMoeda`)
- `parseBRLlocal` (dentro do `Modal` de edição de card, ~linha 1244) — usada na extração de PDF dentro de um card já existente ("Extrair Dados")

**Sintoma observado:** ao importar um PDF, o valor aparecia correto na criação do card (ex: R$ 755,82), mas mudava sozinho depois do arquivamento automático (ex: R$ 755,82 → R$ 75.582,00). Causa: o fluxo de arquivamento reprocessava o valor — que já era um número JS (`755.82`) — através da `moedaParaNumero` antiga. Como `String(755.82)` em JS sempre usa ponto (`"755.82"`), a função antiga removia esse ponto como se fosse separador de milhar, resultando em `75582`.

**Correção:** as três funções foram unificadas pela mesma lógica robusta — detecta automaticamente qual separador (vírgula ou ponto) é o decimal, olhando qual aparece **por último** na string, funcionando tanto para o formato BR quanto US. `parseBRLlocal` foi eliminada e `handleExtrairDados` passou a chamar `moedaParaNumero` diretamente, evitando duplicidade de lógica.

**Commit:** `e6aeb71` — "fix: corrige parser de valores monetarios BR/US (data e financeiro) na importacao de PDF"

**Registros corrompidos na base de teste** (Andreia Tavares de Lima, duplicatas de Layla Canholato Paschoetto) — identificados e removidos manualmente. Base de teste confirmada limpa em 18/06/2026.

### Regressão corrigida: chamada órfã para `parseBRLlocal` (18/06/2026)
Ao eliminar a função `parseBRLlocal` (fix acima), uma terceira chamada a ela passou batido — dentro do bloco `tipo === "apolice_endosso"` do `handleExtrairDados` (~linha 1268), usada para calcular o delta de prêmio líquido em endossos. Teria quebrado com `ReferenceError` na primeira extração de um endosso. Corrigida para chamar `moedaParaNumero` também.

### Comissão obrigatória em Proposta Transmitida / Apólice Emitida (18/06/2026)
Ver detalhes da implementação na Seção 7 ("Validação de comissão obrigatória"). Resumo da decisão de negócio:
- `premio_liquido` e `percentual_comissao` passam a ser obrigatórios **apenas no momento em que o card entra** nos estágios `transmitida` ou `emitida` pelo fluxo normal do app (Modal + Salvar).
- Cards que já estavam nesses estágios antes (histórico, apólices da concorrência importadas para referência) **não são bloqueados** ao serem editados depois — a trava só olha a transição, não o estado já salvo.
- Imports diretos via SQL (migração Segfy) e via "Importar PDF" (`handleAdd`) não passam por essa validação — preservado de propósito, pois usados para registrar apólices que não geram comissão própria (ex: apólice atual do cliente com outro corretor).
- **Commit:** `42cf643` — "feat: torna premio liquido e percentual de comissao obrigatorios ao avancar para Proposta Transmitida e Apolice Emitida"

### Dashboard.jsx sobrescrito por engano e restaurado (18/06/2026)
Ao gerar um novo `Dashboard.jsx` simplificado (8 cards) pra adicionar o card "Sem comissão", a versão rica de produção (4 regiões, commit `f670817`) foi sobrescrita sem querer. Recuperada via `git show f670817:src/Dashboard.jsx`. **Cuidado no Windows:** redirecionar a saída do `git show` direto pro arquivo via `>` no PowerShell corrompe acentos (BOM/encoding errado) — usar Node.js pra reescrever em UTF-8 sem BOM:
```powershell
node -e "const fs=require('fs');const {execSync}=require('child_process');const content=execSync('git show <hash>:<path>').toString('utf8');fs.writeFileSync('<path>',content,'utf8');"
```
Card "Sem comissão" foi então readicionado por cima da versão rica recuperada (ver Seção 4).

### Regressões de sintaxe durante edições manuais (18/06/2026)
Várias vezes durante as edições de hoje no `App.jsx`, copiar/colar manual no VS Code introduziu erros que só apareceram em runtime ou no overlay do Vite — todas identificadas e corrigidas antes do commit:
- Declaração `const [form, setForm] = useState({...})` inteira apagada por acidente dentro do `ImportModal` → erro `setForm is not defined`
- `const card = {` duplicada dentro do `criarCard`
- Vírgula dupla e campos duplicados (`autoZeroKm`/`autoCombustivel` repetidos) em objetos literais
- Campos perdendo capitalização correta (`autotipoUtilizacao` em vez de `autoTipoUtilizacao`) — quebra silenciosamente porque JS é case-sensitive, sem erro de sintaxe, só o campo fica `undefined`

**Lição:** sempre conferir o print do trecho editado antes de salvar, e prestar atenção especial a capitalização e linhas duplicadas — esses dois tipos de erro não geram erro de build, só falham em runtime ou silenciosamente.

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
- Ambiente de demonstração para corretor terceiro testar o CRM — bloqueado pelo limite de 2 projetos gratuitos no Supabase (por conta, não por organização). Decisão adiada: focar em testar na base de teste antes de subir ~30 propostas reais de julho em produção.
- **Etiqueta de alerta no card do cliente** (sinalizando "sem comissão") — sugerido em 18/06, ainda não implementado
- Mensagem de alerta pós-extração em `handleExtrairDados` ainda diz "Card movido para Proposta Transmitida" mesmo quando o destino é "Boleto/Débito" (cosmético, não bloqueia)
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
- **Parsing de moeda** — usar sempre uma única função compartilhada (`moedaParaNumero`) capaz de detectar automaticamente o separador decimal (vírgula ou ponto); nunca assumir que "." é sempre separador de milhar, pois valores já numéricos (JS) se representam com ponto decimal nativo

---

## SEÇÃO 11 — Estilo de trabalho do corretor

- Uma tarefa por vez, confirmar antes de avançar
- Sem explicações teóricas — resultado executável direto
- SQL: validar na teste primeiro, depois produção
- Componentes React: Claude gera arquivo em outputs/, usuário baixa e sobrescreve em src/ (não usar Cowork para evitar sobrescrita)
- Edições em App.jsx: confirmar linhas antes/depois da edição; usuário cola manualmente no VS Code e envia print para validação antes de salvar
- Commit por terminal PowerShell: `git add .` → `git commit -m "..."` → `git push` (separados, não com &&)
- Deploy manual quando auto-deploy falhar: `npx vercel --prod`
- Build local para verificar erros: `npm run build 2>&1 | Select-Object -First 20`
- Teste local da Importação de PDF: usar `npx vercel dev` (porta 3000), não `npm run dev` (porta 5173, sem funções serverless)
