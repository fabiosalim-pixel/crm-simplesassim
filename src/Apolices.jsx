import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { Briefcase, Search, ChevronRight } from "lucide-react";
import { fmt, fmtBRL, daysUntil } from "./utils";

const hojeStr = () => new Date().toISOString().slice(0, 10);
const SITUACOES_INATIVAS = ["Cancelada", "Não Renovada"];
const ehVigente = (a) => a.data_renovacao >= hojeStr() && !SITUACOES_INATIVAS.includes(a.etiqueta_situacao);
const comissaoDe = (a) => ((Number(a.premio_liquido) || 0) * (Number(a.percentual_comissao) || 0)) / 100;

function ChipVencimento({ dataRenovacao }) {
  const dias = daysUntil(dataRenovacao);
  if (dias === null) return null;
  if (dias < 0) return <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">Vencida</span>;
  if (dias <= 15) return <span className="text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full">⚠ {dias}d</span>;
  if (dias <= 30) return <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">{dias}d</span>;
  return <span className="text-xs text-slate-400 dark:text-slate-500">{dias}d</span>;
}

// ── Apólices — visão de carteira (Fase 3) ─────────────────────
// Diferente de "Renovações" (o Kanban, trabalho em andamento), esta
// tela mostra o que já foi EMITIDO — o livro de negócios fechado.
// Dado já existe todo em renovacoes; nenhuma coluna/tabela nova.
export default function Apolices({ onVerCliente, onAbrirCard }) {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("vigentes"); // vigentes | encerradas | todas
  const [ramoFiltro, setRamoFiltro] = useState("");
  const [seguradoraFiltro, setSeguradoraFiltro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from("renovacoes")
        .select("id, cliente_id, cliente_nome, cpf_cnpj, tipo_seguro, seguradora, apolice_nova, proposta, data_renovacao, valor, premio_liquido, percentual_comissao, etiqueta_pagamento, etiqueta_canal, etiqueta_situacao, arquivado")
        .eq("status_pipeline", "emitida")
        .not("cliente_id", "is", null);
      if (error) { setErro(error.message); setLoading(false); return; }
      setLinhas(data || []);
      setLoading(false);
    })();
  }, []);

  const ramos = useMemo(() => [...new Set(linhas.map((a) => a.tipo_seguro).filter(Boolean))].sort(), [linhas]);
  const seguradoras = useMemo(() => [...new Set(linhas.map((a) => a.seguradora).filter(Boolean))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    return linhas
      .filter((a) => {
        if (statusFiltro === "vigentes" && !ehVigente(a)) return false;
        if (statusFiltro === "encerradas" && ehVigente(a)) return false;
        if (ramoFiltro && a.tipo_seguro !== ramoFiltro) return false;
        if (seguradoraFiltro && a.seguradora !== seguradoraFiltro) return false;
        if (q.length >= 2) {
          const nome = (a.cliente_nome || "").toLowerCase();
          const doc = (a.cpf_cnpj || "").replace(/\D/g, "");
          if (!nome.includes(q) && !(qDigitos.length >= 3 && doc.includes(qDigitos))) return false;
        }
        return true;
      })
      .sort((a, b) => (a.data_renovacao || "").localeCompare(b.data_renovacao || ""));
  }, [linhas, busca, statusFiltro, ramoFiltro, seguradoraFiltro]);

  const resumo = useMemo(() => {
    let premio = 0, comissao = 0;
    for (const a of filtradas) { premio += Number(a.premio_liquido) || 0; comissao += comissaoDe(a); }
    return { qtd: filtradas.length, premio, comissao };
  }, [filtradas]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando apólices...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Apólices</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Carteira emitida — {resumo.qtd} apólice{resumo.qtd !== 1 ? "s" : ""} · {fmtBRL(resumo.premio)} em prêmio · {fmtBRL(resumo.comissao)} em comissão
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[14rem] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
          />
        </div>
        {[
          { id: "vigentes", label: "Vigentes" },
          { id: "encerradas", label: "Encerradas" },
          { id: "todas", label: "Todas" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setStatusFiltro(o.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              statusFiltro === o.id
                ? "bg-blue-600 text-white"
                : "bg-painel dark:bg-painel-dark border border-borda dark:border-borda-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
        <select value={ramoFiltro} onChange={(e) => setRamoFiltro(e.target.value)}
          className="text-xs rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-600 dark:text-slate-300 px-2 py-1.5 outline-none">
          <option value="">Todos os ramos</option>
          {ramos.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={seguradoraFiltro} onChange={(e) => setSeguradoraFiltro(e.target.value)}
          className="text-xs rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-600 dark:text-slate-300 px-2 py-1.5 outline-none">
          <option value="">Todas as seguradoras</option>
          {seguradoras.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Nenhuma apólice encontrada com esses filtros.
        </div>
      ) : (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {filtradas.map((a) => (
            <button
              key={a.id}
              onClick={() => onVerCliente && a.cliente_id && onVerCliente(a.cliente_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Briefcase size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{a.cliente_nome}</span>
                  {a.apolice_nova && <span className="text-xs text-slate-400 dark:text-slate-500">nº {a.apolice_nova}</span>}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {a.tipo_seguro} · {a.seguradora}
                  {a.etiqueta_pagamento ? ` · ${a.etiqueta_pagamento}` : ""}
                  {a.etiqueta_canal ? ` · ${a.etiqueta_canal}` : ""}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(a.valor)}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">comissão {fmtBRL(comissaoDe(a))}</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 w-20">
                <ChipVencimento dataRenovacao={a.data_renovacao} />
                <span className="text-xs text-slate-400 dark:text-slate-500">{fmt(a.data_renovacao)}</span>
              </div>
              {onAbrirCard && !a.arquivado && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onAbrirCard(a.id); }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 flex-shrink-0"
                >
                  <ChevronRight size={12} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
