import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { Target, Building2, User } from "lucide-react";
import { fmtBRL } from "./utils";

const hojeStr = () => new Date().toISOString().slice(0, 10);
const ehVigente = (a) => a.status_pipeline === "emitida" && a.data_renovacao >= hojeStr();
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

// ── Cross-sell — visão de carteira ─────────────────────────────
// Inverte a lógica que já existia por cliente (dentro da Ficha em
// Segurados.jsx): aqui olhamos a carteira inteira e ranqueamos os
// clientes com oportunidade, em vez de olhar 1 cliente por vez.
export default function CrossSell({ onVerCliente }) {
  const [clientes, setClientes] = useState([]);
  const [apolices, setApolices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const [cli, ren] = await Promise.all([
        supabase.from("clientes").select("*"),
        supabase.from("renovacoes").select("*").not("cliente_id", "is", null),
      ]);
      if (cli.error) { setErro(cli.error.message); setLoading(false); return; }
      if (ren.error) { setErro(ren.error.message); setLoading(false); return; }
      setClientes(cli.data || []);
      setApolices(ren.data || []);
      setLoading(false);
    })();
  }, []);

  const porCliente = useMemo(() => {
    const m = {};
    for (const a of apolices) (m[a.cliente_id] = m[a.cliente_id] || []).push(a);
    return m;
  }, [apolices]);

  // Universo de ramos que a corretora trabalha hoje (data-driven,
  // mesma lógica já usada em Segurados.jsx)
  const universo = useMemo(() => {
    const s = new Set();
    for (const a of apolices) if (a.tipo_seguro) s.add(a.tipo_seguro);
    return [...s].sort();
  }, [apolices]);

  const ranking = useMemo(() => {
    if (universo.length === 0) return [];
    const linhas = clientes
      .map((c) => {
        const aps = porCliente[c.id] || [];
        if (aps.length === 0) return null;
        const ramosCliente = new Set(aps.map((a) => norm(a.tipo_seguro)).filter(Boolean));
        const oportunidades = universo.filter((r) => !ramosCliente.has(norm(r)));
        if (oportunidades.length === 0) return null;
        const vigentes = aps.filter(ehVigente);
        const premioAtivo = vigentes.reduce((s, a) => s + Number(a.valor || 0), 0);
        return { cliente: c, oportunidades, vigentesQtd: vigentes.length, premioAtivo };
      })
      .filter(Boolean);

    // Critério: mais engajado primeiro (mais apólices vigentes),
    // empate resolvido por maior prêmio ativo.
    return linhas.sort((a, b) => {
      if (b.vigentesQtd !== a.vigentesQtd) return b.vigentesQtd - a.vigentesQtd;
      return b.premioAtivo - a.premioAtivo;
    });
  }, [clientes, porCliente, universo]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando oportunidades...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Cross-sell</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Clientes com apólice vigente que ainda não têm todos os ramos que você trabalha hoje,
        ordenados pelos mais engajados primeiro.
      </p>

      <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 mb-4 flex items-center gap-3 max-w-xs">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Target size={18} />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{ranking.length}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {ranking.length === 1 ? "cliente com oportunidade" : "clientes com oportunidade"}
          </div>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Nenhuma oportunidade no momento — todos os clientes com apólice vigente já têm todos os ramos que você trabalha.
        </div>
      ) : (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {ranking.map(({ cliente: c, oportunidades, vigentesQtd, premioAtivo }) => (
            <button
              key={c.id}
              onClick={() => onVerCliente && onVerCliente(c.id)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                {c.tipo_pessoa === "PJ"
                  ? <Building2 size={16} className="text-slate-500 dark:text-slate-300" />
                  : <User size={16} className="text-slate-500 dark:text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.nome}</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
                    {vigentesQtd} vigente{vigentesQtd !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">
                  {fmtBRL(premioAtivo)} em prêmio ativo
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {oportunidades.map((r) => (
                    <span
                      key={r}
                      className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
