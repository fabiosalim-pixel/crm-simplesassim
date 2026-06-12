-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO FASE A — CRM Simples Assim
-- "Um cliente / várias apólices"
-- EXECUTE NO SUPABASE SQL EDITOR antes de rodar o script Node.js
-- ════════════════════════════════════════════════════════════

-- ── PASSO 1: Backup não destrutivo de renovacoes ─────────────
-- Cria uma cópia completa da tabela antes de qualquer alteração.
-- Para remover depois: DROP TABLE renovacoes_backup;
CREATE TABLE IF NOT EXISTS renovacoes_backup AS
  SELECT * FROM renovacoes;

-- Confirmar backup
DO $$
DECLARE
  orig  INT;
  bkp   INT;
BEGIN
  SELECT COUNT(*) INTO orig FROM renovacoes;
  SELECT COUNT(*) INTO bkp  FROM renovacoes_backup;
  IF orig <> bkp THEN
    RAISE EXCEPTION 'Backup incompleto: renovacoes=% vs backup=%', orig, bkp;
  END IF;
  RAISE NOTICE 'Backup OK — % linhas copiadas para renovacoes_backup', bkp;
END $$;

-- ── PASSO 2: Criar tabela clientes ───────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj_norm  TEXT        UNIQUE,           -- apenas dígitos (chave de deduplicação)
  cpf_cnpj       TEXT,                         -- formatado para exibição
  nome           TEXT        NOT NULL,
  telefone       TEXT,
  email          TEXT,
  tipo_pessoa    TEXT        CHECK (tipo_pessoa IN ('PF', 'PJ', '?')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── PASSO 3: Índices ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_norm
  ON clientes (cpf_cnpj_norm);

CREATE INDEX IF NOT EXISTS idx_clientes_nome
  ON clientes (nome);

-- ── PASSO 4: RLS (mesmo padrão das demais tabelas) ───────────
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_clientes" ON clientes;
CREATE POLICY "allow_all_clientes" ON clientes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── PASSO 5: Coluna cliente_id em renovacoes ──────────────────
-- Já existe como UUID nullable — garantir que está presente.
-- (Se já existe, este comando é no-op.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'renovacoes' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE renovacoes ADD COLUMN cliente_id UUID REFERENCES clientes(id);
    RAISE NOTICE 'Coluna cliente_id adicionada a renovacoes';
  ELSE
    RAISE NOTICE 'Coluna cliente_id já existe em renovacoes — OK';
  END IF;
END $$;

-- ── PASSO 6: Índice na FK ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_renovacoes_cliente_id
  ON renovacoes (cliente_id);

-- ── PASSO 7: updated_at automático em clientes ───────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Confirmação ───────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅  SQL Fase A concluído com sucesso.';
  RAISE NOTICE '    Próximo passo: node scripts/migrate-clientes.mjs';
END $$;
