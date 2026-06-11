/**
 * MIGRAÇÃO FASE A — dados
 * Insere clientes únicos e liga cada card ao seu cliente via cliente_id.
 *
 * PRÉ-REQUISITO: execute migrate-fase-a.sql no Supabase SQL Editor primeiro.
 *
 * Como rodar:
 *   node scripts/migrate-clientes.mjs
 *
 * Regras aplicadas (aprovadas no dry-run):
 *   • Deduplicação por CPF/CNPJ normalizado
 *   • Conflito de nome → adotar o card mais recente como master
 *   • Cards SEM CPF → ignorar (não cria cliente)
 *   • Card de teste (id: 2ca56e04…) → ignorar explicitamente
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

// ── Config ────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
);

const SUPABASE_URL = envVars['VITE_SUPABASE_URL'];
const SUPABASE_KEY = envVars['VITE_SUPABASE_ANON_KEY'];
const CARD_TESTE_ID = '2ca56e04-c7c3-436d-bd63-fd009b9184a4'; // ignorar

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utilitários ────────────────────────────────────────────────
const norm     = v  => (v || '').replace(/\D/g, '');
const tipoPess = d  => d.length === 11 ? 'PF' : d.length === 14 ? 'PJ' : '?';
const genId    = () => crypto.randomUUID();
const log      = (...a) => console.log(...a);
const err      = (...a) => console.error('❌ ', ...a);

// ── 1. Buscar renovacoes ───────────────────────────────────────
log('\n🔍  Buscando cards em renovacoes…');
const { data: rows, error: fetchErr } = await supabase
  .from('renovacoes')
  .select('id, cliente_nome, cpf_cnpj, telefone, email, criado_em')
  .order('criado_em', { ascending: false });

if (fetchErr) { err('Erro ao buscar:', fetchErr.message); process.exit(1); }
log(`    ${rows.length} cards encontrados`);

// ── 2. Filtrar: ignorar sem CPF e card de teste ────────────────
const elegíveis = rows.filter(r =>
  norm(r.cpf_cnpj) &&
  r.id !== CARD_TESTE_ID
);
log(`    ${elegíveis.length} cards elegíveis (com CPF, excluindo teste)`);

// ── 3. Agrupar por CPF normalizado (mais recente = master) ────
const byKey = new Map();
for (const r of elegíveis) {
  const key = norm(r.cpf_cnpj);
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(r);
}
log(`    ${byKey.size} clientes únicos a criar\n`);

// ── 4. Verificar se clientes já foram criados (idempotência) ──
const { data: existentes } = await supabase
  .from('clientes')
  .select('cpf_cnpj_norm, id');
const jaExiste = new Map((existentes || []).map(c => [c.cpf_cnpj_norm, c.id]));
if (jaExiste.size) {
  log(`⚠️   ${jaExiste.size} cliente(s) já existem no banco — serão pulados.`);
}

// ── 5. Inserir clientes novos ──────────────────────────────────
log('📥  Inserindo clientes…');
const clienteMap = new Map(); // cpf_norm → id (para usar no passo seguinte)

// Absorver os já existentes no mapa
for (const [cpfNorm, clienteId] of jaExiste.entries()) {
  clienteMap.set(cpfNorm, clienteId);
}

const paraInserir = [];
for (const [cpfNorm, group] of byKey.entries()) {
  if (jaExiste.has(cpfNorm)) continue; // já existe
  const master = group[0]; // mais recente
  const id = genId();
  paraInserir.push({
    id,
    cpf_cnpj_norm: cpfNorm,
    cpf_cnpj:      master.cpf_cnpj,
    nome:          master.cliente_nome || '(sem nome)',
    telefone:      master.telefone || null,
    email:         master.email || null,
    tipo_pessoa:   tipoPess(cpfNorm),
  });
  clienteMap.set(cpfNorm, id);
}

if (paraInserir.length === 0) {
  log('    Nenhum cliente novo para inserir.');
} else {
  const { error: insErr } = await supabase.from('clientes').insert(paraInserir);
  if (insErr) { err('Falha ao inserir clientes:', insErr.message); process.exit(1); }
  log(`    ✅  ${paraInserir.length} cliente(s) inserido(s):`);
  for (const c of paraInserir) {
    log(`       ${c.cpf_cnpj} (${c.tipo_pessoa}) — ${c.nome}`);
  }
}

// ── 6. Atualizar cliente_id em cada card ──────────────────────
log('\n🔗  Vinculando cards aos clientes…');
let atualizados = 0;
let pulados = 0;
const erros = [];

for (const r of elegíveis) {
  const cpfNorm  = norm(r.cpf_cnpj);
  const clienteId = clienteMap.get(cpfNorm);
  if (!clienteId) { pulados++; continue; }

  const { error: updErr } = await supabase
    .from('renovacoes')
    .update({ cliente_id: clienteId })
    .eq('id', r.id);

  if (updErr) {
    erros.push({ cardId: r.id, nome: r.cliente_nome, erro: updErr.message });
  } else {
    atualizados++;
  }
}

log(`    ✅  ${atualizados} card(s) vinculado(s)`);
if (pulados)      log(`    ⏭️   ${pulados} card(s) pulado(s) (sem CPF ou já vinculado)`);
if (erros.length) {
  log(`    ⚠️   ${erros.length} erro(s) ao atualizar:`);
  for (const e of erros) log(`       ${e.cardId} (${e.nome}): ${e.erro}`);
}

// ── 7. Verificação final ──────────────────────────────────────
log('\n🔎  Verificando resultado…');
const { data: verify } = await supabase
  .from('renovacoes')
  .select('id, cliente_id, cliente_nome, cpf_cnpj')
  .not('cpf_cnpj', 'is', null)
  .neq('id', CARD_TESTE_ID);

const vinculados  = (verify || []).filter(r => r.cliente_id);
const naoVinc     = (verify || []).filter(r => !r.cliente_id && norm(r.cpf_cnpj));

log(`    Cards com CPF e cliente_id preenchido : ${vinculados.length}`);
if (naoVinc.length) {
  log(`    ⚠️  Cards com CPF mas SEM cliente_id  : ${naoVinc.length}`);
  for (const r of naoVinc) log(`       ${r.id} — ${r.cliente_nome}`);
}

// ── Relatório final ────────────────────────────────────────────
log('\n' + '═'.repeat(55));
log('  RELATÓRIO DA MIGRAÇÃO');
log('═'.repeat(55));
log(`  Clientes criados      : ${paraInserir.length}`);
log(`  Cards vinculados      : ${atualizados}`);
log(`  Cards ignorados       : ${rows.length - elegíveis.length} (sem CPF / teste)`);
log(`  Erros                 : ${erros.length}`);
log(`  Dados originais       : INTACTOS (backup em renovacoes_backup)`);
log('═'.repeat(55));

if (erros.length === 0 && naoVinc.length === 0) {
  log('\n  ✅  Migração concluída com sucesso.');
  log('  Próximo passo: Fase B — parar nova duplicação no AddModal.\n');
} else {
  log('\n  ⚠️  Migração concluída com pendências. Verifique os itens acima.\n');
}
