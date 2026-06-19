# Auditoria Técnica — CRM Simples Assim
**Data:** 19/06/2026 · **Escopo:** repositório inteiro (App.jsx, Dashboard.jsx, Segurados.jsx, supabase.js, api/extract-pdf.js)
**Natureza:** somente leitura. Nenhum arquivo foi alterado. Relatório de achados apenas.

> Contexto: ~30 apólices reais serão migradas para produção em julho. Os achados estão ordenados por
> severidade pensando nessa janela. O nº de linha é aproximado (arquivo monolítico de ~3.700 linhas).

---

## Resumo executivo

A boa notícia primeiro: a **simetria leitura/escrita da tabela `renovacoes` está íntegra**. Comparei
campo a campo `mapRow` (linhas 197–293) contra `upsertCard` (319–416): as únicas diferenças são colunas
gerenciadas pelo banco (`criado_em` só lido, `atualizado_em` só escrito) e a coluna morta `apolice_id`.
Nenhum campo financeiro ou de bloco por ramo sumiu — o medo registrado na SEÇÃO 10 do `estado-atual` não
se concretizou nesta versão. O cálculo de comissão (`premio_liquido × % ÷ 100`) está **consistente** nos
três pontos que o reproduzem (Modal, Dashboard, Segurados).

O risco real não está em campo trocado — está em **erros de banco engolidos silenciosamente** e em
**dois caminhos divergentes para o mesmo estado de pipeline**. Para uma migração de 30 apólices, o
achado **C1** é o que pode causar perda de dado sem ninguém perceber.

| # | Severidade | Tema | Efeito |
|---|-----------|------|--------|
| C1 | 🔴 Crítico | `upsertCard` engole erro + UI otimista | Save falha mas usuário vê "✅ sucesso"; dado se perde no reload |
| C2 | 🔴 Crítico | Assinatura da RPC `dashboard_metrics` | Código passa 3 params; doc diz que função não tem params → dashboard pode quebrar 100% |
| M1 | 🟠 Médio | Guarda de comissão burlável | Arrastar card p/ "emitida" pula validação de líquido+% |
| M2 | 🟠 Médio | `data_emissao` ausente num dos caminhos | Card vira "emitida" via anexo sem data de emissão; depois grava data errada |
| M3 | 🟠 Médio | Inputs de valor crus no ImportModal + dupla conversão | "2.500" sem decimais vira 2,50; inconsistência com o resto do app |
| B1 | 🟡 Baixo | `apolice_id` coluna morta | Escrita sempre `null` |
| B2 | 🟡 Baixo | Normalização de CPF/CNPJ parcial no front | Edge de 12–13 dígitos diverge do `norm_doc` → duplicado |
| B3 | 🟡 Baixo | Dois parsers idênticos (`parseBRL` / `moedaParaNumero`) | Risco de divergência futura |
| B4 | 🟡 Baixo | `novoCard` de recuperação sem `criadoEm` e com `valor` numérico cru | Inconsistência de exibição até recarregar |
| B5 | 🟡 Baixo | `c.nome.split(" ")` sem guarda | Quebra se nome for nulo (raro) |

---

## 🔴 CRÍTICO

### C1 — `upsertCard` engole o erro do banco e a UI sempre confirma sucesso
**Arquivo:** `src/App.jsx` · **Linhas:** 318–419 (def), 3356–3395 (handlers), 3402–3419

`upsertCard` não retorna nada e, em caso de falha, só faz `console.error`:

```js
const { error } = await supabase.from("renovacoes").upsert(row);
if (error) console.error("Erro ao salvar:", error);   // linha 417–418 — falha some no console
```

Todos os handlers tratam o save como se sempre tivesse dado certo:

- `handleSave` (3385–3393): chama `await upsertCard(updated)` e logo depois mostra
  `showToast("✅ ... atualizado(s) com sucesso")` **sem checar erro**.
- `handleAdd` (3356–3358): `await upsertCard(card)` → `setCards([card, ...])` independente do resultado.
- `handleArquivar` (3402–3406) e `handleNaoRenovada` (3414–3419): fazem `upsertCard` e em seguida
  **removem o card da tela** (`setCards(filter)`). Se o upsert falhar, o card some da UI mas continua
  como estava no banco — e o usuário acha que arquivou.
- `handleDrop` (3361–3370): move o card no estado local e só então faz o upsert; erro não reverte a UI.

**O que acontece na prática:** qualquer falha de upsert — coluna nova que ainda não existe naquela base,
violação de RLS, tipo inválido, queda de rede — é invisível. O usuário vê "✅ salvo", fecha o card, e na
próxima recarga o dado não está lá. Numa migração de 30 apólices, dá pra "salvar" várias e perceber a
perda só depois. O próprio código já reconhece esse risco em `handleApoliceAnexada` (linha 3497):
*"UPDATE direto — evita falha silenciosa do upsertCard por colunas novas"* — ou seja, o problema é
conhecido pontualmente, mas não tratado de forma geral.

**Correção sugerida:** fazer `upsertCard` retornar o `error` (ou lançar). Nos handlers, checar e só então
atualizar UI / mostrar toast; em falha, exibir o erro real e **não** remover o card:

```js
async function upsertCard(card) {
  const { error } = await supabase.from("renovacoes").upsert(row);
  if (error) console.error("Erro ao salvar:", error);
  return error;            // <-- devolve o erro
}
// no handler:
const err = await upsertCard(updated);
if (err) { alert("Não foi possível salvar: " + err.message); return; }
// só depois: setCards(...) / showToast(...)
```

Prioridade máxima antes da migração de julho.

---

### C2 — Chamada da RPC `dashboard_metrics` com 3 parâmetros que a doc diz não existir
**Arquivo:** `src/Dashboard.jsx` · **Linha:** 261–265

```js
const { data, error } = await supabase.rpc("dashboard_metrics", {
  p_inicio: ini || periodoIni,
  p_fim: fim || periodoFim,
  p_renovar_dias: rdias || renovarDias,
});
```

O código chama a função com `p_inicio`, `p_fim`, `p_renovar_dias`. Mas o `estado-atual-crm.md` (SEÇÃO 3)
documenta a assinatura como **`dashboard_metrics() → jsonb`, sem parâmetros**. O PostgREST resolve a função
pelo nome **e** pela lista de argumentos nomeados; se a função instalada na base de produção for a versão
sem argumentos, esta chamada retorna `PGRST202 / function not found` e **o dashboard inteiro quebra**
(cai no `setErro(error.message)` da linha 266).

**O que acontece na prática:** ou a documentação está desatualizada (a função foi reescrita com params e
ninguém atualizou o md), ou a função em produção ainda é a sem-args e o dashboard vai falhar no primeiro
load. Não dá pra saber sem consultar o banco — e é exatamente o tipo de divergência assinatura↔chamada que
você pediu pra caçar.

**Correção sugerida:** confirmar a assinatura real nas **duas** bases antes de julho:

```sql
select p.proname, pg_get_function_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname = 'dashboard_metrics';
```

Se vier sem args, ou ajustar a função para aceitar `p_inicio/p_fim/p_renovar_dias`, ou remover os params
da chamada. Atualizar o `estado-atual` depois, porque hoje ele e o código se contradizem.

---

## 🟠 MÉDIO

### M1 — A guarda de "líquido + % obrigatórios" é burlável por drag-and-drop
**Arquivo:** `src/App.jsx` · **Linhas:** 3376–3382 (guarda), 3361–3370 (`handleDrop`), 3492–3505 (`handleApoliceAnexada`)

`handleSave` exige prêmio líquido e percentual de comissão antes de avançar para `transmitida`/`emitida`:

```js
if (indoParaTransmitida || indoParaEmitida) {
  if (liquidoVazio || percentualVazio) { window.alert(...); return; }
}
```

Mas essa validação **só existe no `handleSave`** (botão Salvar do modal). Os outros caminhos que mudam de
status não a aplicam:

- `handleDrop` (arrastar o card no Kanban) leva para qualquer coluna, inclusive `emitida`, sem checar nada.
- `handleApoliceAnexada` promove para `emitida` ao anexar a apólice, sem checar comissão.

**O que acontece na prática:** card vai para "Apólice Emitida" sem prêmio líquido / sem % de comissão.
Só é recuperado depois pelo filtro manual "Sem comissão" (linha 3464) e pelo card do dashboard. Para a
integridade financeira da carteira migrada, é um furo.

**Correção sugerida:** extrair a validação para uma função (`podeAvancar(card, novoStatus)`) e aplicá-la
também em `handleDrop` e `handleApoliceAnexada`. Em drag inválido, reverter a posição e avisar.

---

### M2 — `handleApoliceAnexada` promove para "emitida" sem gravar `data_emissao`
**Arquivo:** `src/App.jsx` · **Linhas:** 3492–3505 vs 378 vs 3361–3370

Há dois caminhos para um card chegar a `emitida`, e eles divergem:

- Via **drag** → `handleDrop` → `upsertCard`, e o upsert preenche a data (linha 378):
  `data_emissao: card.dataEmissao || (card.status === 'emitida' ? hoje : null)`.
- Via **anexar apólice** → `handleApoliceAnexada` faz um UPDATE direto só com `status_pipeline` e
  `apolice_anexada` (linhas 3498–3500). **Não grava `data_emissao`.**

```js
const { error } = await supabase.from("renovacoes")
  .update({ status_pipeline: novoStatus, apolice_anexada: true })   // falta data_emissao
  .eq("id", cardId);
```

**O que acontece na prática:** card emitido por anexo fica com `data_emissao = null`. Pior: quando o usuário
abrir e salvar esse card depois, o fallback da linha 378 carimba **a data da edição** como data de emissão —
que pode ser semanas depois da emissão real. Qualquer métrica por mês de emissão fica distorcida.

**Correção sugerida:** no UPDATE de `handleApoliceAnexada`, incluir
`data_emissao: card.dataEmissao || new Date().toISOString().slice(0,10)` quando `novoStatus === 'emitida'`.

---

### M3 — ImportModal: inputs de valor sem máscara + dupla conversão de moeda
**Arquivo:** `src/App.jsx` · **Linhas:** 3187, 3191 (inputs crus), 2825–2828 (`parseBRL`), 340–343 (`moedaParaNumero` no upsert)

No ImportModal, os campos financeiros guardam o texto cru, sem `maskMoeda` (diferente do Modal de edição,
linhas 1592/1597/2424, que mascaram):

```js
<input value={form.valor} onChange={e => setF("valor", e.target.value)} />            // 3187 — cru
<input value={form.premioLiquido} onChange={e => setF("premioLiquido", e.target.value)} /> // 3191 — cru
```

Na criação, o card é montado com `parseBRL(form.valor)` (2825) → já vira **número**. Em seguida
`upsertCard` aplica `moedaParaNumero(card.valor)` (340) **de novo**, sobre um número. Para os valores no
formato do PDF ("1.481,68") é idempotente, então não corrompe no fluxo feliz. O problema é o valor digitado
manualmente **sem decimais**: tanto `parseBRL` quanto `moedaParaNumero` tratam o último separador como
decimal, então `"2.500"` → **2,5** e `"1.200"` → **1,2**. Como aqui não há máscara guiando o usuário a
digitar centavos, o erro é fácil de cometer na revisão de um import.

**O que acontece na prática:** prêmio/parcela revisado à mão com milhar sem vírgula é gravado 1000× menor.

**Correção sugerida:** aplicar `maskMoeda` nesses dois inputs (igual aos demais) e, já que o valor passará
a vir mascarado, parar de chamar `parseBRL` aqui — deixar o `moedaParaNumero` do `upsertCard` ser o único
ponto de conversão (ver B3).

---

## 🟡 BAIXO

### B1 — Coluna `apolice_id` é escrita mas nunca lida (campo morto)
**Arquivo:** `src/App.jsx` · **Linha:** 322 (`apolice_id: card.apoliceId || null`)

`upsertCard` grava `apolice_id` a partir de `card.apoliceId`, mas `mapRow` nunca produz `apoliceId` e nada
no app o popula. Resultado: a coluna é sempre `null`. Sem efeito funcional, mas é dívida de schema que
confunde (o `diagnostico-relacao-cliente-apolice.txt` já apontava o `cliente_id` como FK morta; aqui é a
irmã `apolice_id`). Sugestão: remover a escrita ou documentar como reservada.

### B2 — Normalização de CPF/CNPJ no front não cobre 12–13 dígitos
**Arquivo:** `src/App.jsx` · **Linhas:** 544–552 (`findOrCreateCliente`)

O front só corta para os últimos 14 dígitos quando `length > 14`; não corta para 11 num CPF com lixo de
12–13 dígitos. O `norm_doc` do banco mantém "últimos 14 (CNPJ) ou 11 (CPF)". Em casos de borda os dois
divergem, e a busca por `cpf_cnpj_norm` não acha o cliente existente → cria duplicado. Além disso,
`.maybeSingle()` (551) **lança erro** se já houver mais de um cliente com o mesmo norm, podendo abortar a
criação do card. Baixo porque depende de dado sujo, mas relevante na migração. Sugestão: espelhar a regra
do `norm_doc` no JS e trocar `maybeSingle()` por `limit(1)` + pegar o primeiro.

### B3 — Dois parsers de moeda com lógica idêntica
**Arquivo:** `src/App.jsx` · **Linhas:** 102–117 (`moedaParaNumero`) e 2592–2607 (`parseBRL`)

São byte-a-byte a mesma lógica. Manter dois convites a que um seja corrigido e o outro não. Sugestão:
eliminar `parseBRL` e usar `moedaParaNumero` em todo lugar (ver M3).

### B4 — `novoCard` da recuperação de prospecção sem `criadoEm` e com `valor` numérico cru
**Arquivo:** `src/App.jsx` · **Linhas:** 3438–3455 (`handleRecuperar`)

O card criado ao recuperar uma prospecção recebe `valor: prosp.valorAnterior` (número puro), enquanto todos
os outros cards em memória carregam `valor` como string mascarada (via `numeroParaMoeda` no `mapRow`). Até
o próximo reload, abrir esse card no modal pode exibir o valor sem formatação. Também não seta `criadoEm`,
então alertas que dependem dele (linha 55, 63) ficam inertes até recarregar. Cosmético/transitório.

### B5 — `c.nome.split(" ")` sem proteção a nome nulo
**Arquivo:** `src/App.jsx` · **Linhas:** 713, 716 (mensagens de aniversário)

`encodeURIComponent(`...${c.nome.split(" ")[0]}...`)` quebra se `c.nome` for `null`. O resto do componente
usa `c.nome?.` (719), então é inconsistente. Cliente sem nome é raro, mas o `findOrCreateCliente` chega a
inserir `"(sem nome)"` como fallback — logo é possível. Sugestão: `(c.nome || "").split(" ")[0]`.

---

## Itens verificados e SEM problema (para registro)

- **Simetria `mapRow` ↔ `upsertCard` (renovacoes):** íntegra. Diff só em `criado_em` (lido/DB), `atualizado_em`
  (escrito/DB), `apolice_id` (B1). Todos os blocos por ramo (imóvel, vida, equip, viagem) e os campos
  financeiros (`premio_liquido`, `percentual_comissao`, `numero_parcelas`, `valor_parcela`,
  `vencimento_primeira_parcela`, `vigencia_inicio`, `etiqueta_segfy`) estão nos dois lados.
- **camelCase ↔ snake_case:** os nomes do formulário batem com as chaves de `mapRow`/`upsertCard`.
  `condutorDiferente` é flag de UI corretamente não persistida (deriva `autoCondutor`/`autoCpfCondutor`).
- **Cálculo de comissão:** `premio_liquido × % ÷ 100` idêntico no Modal (1606), Dashboard (consumo da RPC) e
  Segurados (190, 438).
- **Funções referenciadas:** `mapPagamento`, `parseBRL`, `findOrCreateCliente`, `genId`, `buscaCEP`,
  `maskCEP`, `showToast`, `today`, `hojeStr` — todas declaradas. Nenhuma referência órfã encontrada.
- **`.toUpperCase()` em campo de valor:** todos guardados (`card.autoPlaca ? ...`, `(d.segurado?.nome||"")`,
  `e.target.value.toUpperCase()` em inputs sempre string). Sem risco de null aqui.
- **`extract-pdf.js`:** respostas de erro (405/400/500) não trazem `success:false`, mas trazem `error`, e o
  front trata via `result.error` (2663). Funciona; só é inconsistente em forma.

---

## Recomendação de ordem de correção antes de julho
1. **C1** (save silencioso) — bloqueia a migração; é o que pode perder dado sem aviso.
2. **C2** (assinatura da RPC) — verificar nas duas bases; quebra o dashboard inteiro se divergente.
3. **M2** + **M1** — integridade de "emitida" (data de emissão e comissão).
4. **M3** — antes de importar PDFs em volume.
5. Baixos — quando sobrar fôlego.
