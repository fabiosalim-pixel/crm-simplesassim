/**
 * DRY-RUN — Migração "um cliente / várias apólices"
 * CRM Simples Assim
 *
 * Executa uma análise dos dados existentes SEM gravar nada no banco.
 * Produz um relatório completo para aprovação antes da migração real.
 *
 * Como rodar (no terminal, na raiz do projeto):
 *   node scripts/dryrun-clientes.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Ler .env ──────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const SUPABASE_URL  = envVars['VITE_SUPABASE_URL'];
const SUPABASE_KEY  = envVars['VITE_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Não encontrei VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utilitários ────────────────────────────────────────────────
const norm     = v  => (v || '').replace(/\D/g, '');
const tipoPess = d  => d.length === 11 ? 'PF' : d.length === 14 ? 'PJ' : '?';
const pad      = (s, n) => String(s).padEnd(n);
const sep      = '─'.repeat(60);

// ── Buscar dados ───────────────────────────────────────────────
console.log('\nBuscando dados em renovacoes…');
const { data: rows, error } = await supabase
  .from('renovacoes')
  .select('id, cliente_nome, cpf_cnpj, telefone, email, criado_em')
  .order('criado_em', { ascending: false });

if (error) {
  console.error('❌  Erro ao buscar dados:', error.message);
  process.exit(1);
}

// ── Separar com/sem CPF ────────────────────────────────────────
const semCpf = rows.filter(r => !norm(r.cpf_cnpj));
const comCpf = rows.filter(r =>  norm(r.cpf_cnpj));

// ── Agrupar por CPF normalizado (mais recente = índice 0) ──────
const byKey = new Map();
for (const r of comCpf) {
  const key = norm(r.cpf_cnpj);
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(r);
}

// ── Detectar conflitos ─────────────────────────────────────────
const conflicts = [];
for (const [cpfNorm, group] of byKey.entries()) {
  if (group.length === 1) continue;
  const ref    = group[0]; // mais recente → será o registro "master"
  const diffs  = [];

  for (const r of group.slice(1)) {
    const row_diffs = [];

    if ((r.cliente_nome || '').trim().toLowerCase() !==
        (ref.cliente_nome || '').trim().toLowerCase())
      row_diffs.push(`nome:     "${r.cliente_nome}" ≠ "${ref.cliente_nome}"`);

    if (norm(r.telefone) !== norm(ref.telefone) && r.telefone && ref.telefone)
      row_diffs.push(`telefone: "${r.telefone}" ≠ "${ref.telefone}"`);

    if ((r.email || '').toLowerCase() !== (ref.email || '').toLowerCase()
        && r.email && ref.email)
      row_diffs.push(`e-mail:   "${r.email}" ≠ "${ref.email}"`);

    if (row_diffs.length) {
      diffs.push({ cardId: r.id, data: r.criado_em?.slice(0, 10), diffs: row_diffs });
    }
  }

  if (diffs.length) {
    conflicts.push({
      cpfNorm,
      tipo:   tipoPess(cpfNorm),
      master: ref,
      cards:  group.length,
      diffs,
    });
  }
}

// ── Simular tabela clientes ────────────────────────────────────
// (o que seria criado — sem gravar)
const clientesSimulados = [];

for (const [cpfNorm, group] of byKey.entries()) {
  const ref = group[0];
  clientesSimulados.push({
    cpf_cnpj_norm: cpfNorm,
    cpf_cnpj:      ref.cpf_cnpj,
    nome:          ref.cliente_nome,
    telefone:      ref.telefone,
    email:         ref.email,
    tipo_pessoa:   tipoPess(cpfNorm),
    cards:         group.length,
    semCpf:        false,
  });
}

for (const r of semCpf) {
  clientesSimulados.push({
    cpf_cnpj_norm: '',
    cpf_cnpj:      '',
    nome:          r.cliente_nome || '(sem nome)',
    telefone:      r.telefone,
    email:         r.email,
    tipo_pessoa:   '?',
    cards:         1,
    semCpf:        true,
    cardId:        r.id,
  });
}

// ── Imprimir relatório ─────────────────────────────────────────
const L = console.log;

L('\n' + '═'.repeat(60));
L('  DRY-RUN — MIGRAÇÃO "CLIENTE / APÓLICES" (sem gravar nada)');
L('  CRM Simples Assim · ' + new Date().toLocaleString('pt-BR'));
L('═'.repeat(60));

L('\n📊  RESUMO GERAL');
L(sep);
L(pad('Total de cards analisados',        40) + rows.length);
L(pad('Cards com CPF/CNPJ',               40) + comCpf.length);
L(pad('Cards SEM CPF/CNPJ (rev. manual)', 40) + semCpf.length);
L(sep);
L(pad('Clientes únicos que seriam criados',40) + clientesSimulados.length);
L(pad('  → identificados por CPF/CNPJ',   40) + byKey.size);
L(pad('  → sem CPF (1 por card)',          40) + semCpf.length);
L(sep);
L(pad('Cards que casariam com cliente',   40) + comCpf.length);
L(pad('Conflitos de dados detectados',    40) + conflicts.length);

// Tabela de clientes com múltiplos cards
const multi = [...byKey.entries()].filter(([, g]) => g.length > 1);
if (multi.length) {
  L('\n📋  CLIENTES COM MÚLTIPLOS CARDS (agrupamento por CPF)');
  L(sep);
  L(pad('CPF/CNPJ', 16) + pad('Tipo', 5) + pad('Cards', 7) + 'Nome (master)');
  L(sep);
  for (const [cpfNorm, group] of multi) {
    L(pad(group[0].cpf_cnpj || cpfNorm, 16) +
      pad(tipoPess(cpfNorm), 5) +
      pad(group.length, 7) +
      (group[0].cliente_nome || ''));
  }
}

if (conflicts.length) {
  L('\n⚠️   CONFLITOS DE DADOS (mesmo CPF, campos divergentes)');
  L('     Estratégia: adotar dados do card mais recente como master.');
  L(sep);
  for (const c of conflicts) {
    L(`\n  CPF/CNPJ: ${c.cpfNorm} (${c.tipo}) — ${c.cards} cards`);
    L(`  Master (mais recente): "${c.master.cliente_nome}" — ${c.master.criado_em?.slice(0,10)}`);
    for (const diff of c.diffs) {
      L(`  Card ${diff.cardId.slice(0,8)}… (${diff.data}):`);
      for (const d of diff.diffs) L(`    • ${d}`);
    }
  }
}

if (semCpf.length) {
  L('\n🔍  CARDS SEM CPF/CNPJ — precisam de revisão manual');
  L(sep);
  for (const r of semCpf) {
    L(`  ID   : ${r.id}`);
    L(`  Nome : ${r.cliente_nome || '(sem nome)'}`);
    L(`  Data : ${(r.criado_em || '').slice(0, 10)}`);
    L('');
  }
}

L('\n' + '═'.repeat(60));
L('  ✅  Nenhum dado foi alterado — dry-run concluído.');
L('  Aguardando aprovação para executar a migração real.');
L('═'.repeat(60) + '\n');
