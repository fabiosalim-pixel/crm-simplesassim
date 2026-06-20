# Estado Atual — CRM Simples Assim

> Atualizado em 19/06/2026. Não editar manualmente.

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
- `src/App.jsx` — componente principal (~3.300 linhas), monolítico
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

### Import de PDF
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

### Extração de dados em card existente (`handleExtrairDados`, dentro do `Modal`)
- Disparada pelo botão "Extrair" sobre um documento anexado (proposta, apólice ou endosso)
- Preenche **campos vazios** do card a partir do PDF extraído (fill-blank). **Corrigido em 19/06/2026 (N2):** a `dataRenovacao` era a única linha que sobrescrevia incondicionalmente — agora também é fill-blank (`if (!d.dataRenovacao && ...)`), pra não carimbar por cima de uma vigência corrigida à mão (reimport/endosso).
- **Sync da tabela `clientes` — corrigido em 19/06/2026 (N3):** antes gravava `data_nascimento`/endereço sempre que o PDF trazia valor (sobrescrevendo dado bom) e gravava o `cep` cru. Agora **busca o cliente atual e só preenche os campos vazios**, com `maskCEP` no cep — alinhado ao fill-blank do trigger `enriquecer_cliente`.
- Se `tipo === "proposta"` e o card está em `cotacoes` → muda `d.status` para `transmitida` (ou `boleto`) automaticamente (só no estado local do Modal; só persiste no "Salvar", onde a validação de comissão acima entra em ação)
- Se `tipo === "apolice_endosso"` → calcula delta de prêmio líquido (via `moedaParaNumero`) e registra em `endossos`

---

## SEÇÃO 8 — Correções e blindagens implementadas

### Anti-duplicidade de cadastro (duas camadas)
- **Camada 1 (banco):** `norm_doc()` + trigger `enriquecer_cliente` — colapsam CNPJ com zero extra
- **Camada 2 (App.jsx):** `findOrCreateCliente` normaliza com `slice(-14)` antes de buscar (idêntico ao `norm_doc`). Em 19/06 trocou `.maybeSingle()` por `.limit(1)` — ver Sessão 19/06 abaixo.

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