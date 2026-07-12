import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { Percent, TrendingUp, Wallet, Building2, ShieldCheck, DollarSign } from "lucide-react";
import { fmtBRL } from "./utils";

const hojeStr = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const comissaoDe = (a) => {
  const premio = Number(a.premio_liquido) || 0;
  const pct = Number(a.percentual_comissao) || 0;
  return (premio * pct) / 100;
};

function SeletorPeriodo({ periodo, setPeriodo, iniLivre, fimLivre, setIniLivre, setFimLivre }) {
  const opcoes = [
    { id: "mes", label: "Mês atual" },
    { id: "15", label: "15 dias" },
    { id: "30", label: "30 dias" },
    { id: "90", label: "90 dias" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => setPeriodo(o.id)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            periodo === o.id
              ? "bg-blue-600 text-white"
              : "bg-painel dark:bg-painel-dark border border-borda dark:border-borda-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${
        periodo === "livre" ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark"
      }`}>
        <input type="date" value={iniLivre} onChange={(e) => { setIniLivre(e.target.value); setPeriodo("livre"); }}
          className="text-xs border-none outline-none bg-transparent text-slate-600 dark:text-slate-300 w-32" />
        <span className="text-slate-400 dark:text-slate-500 text-xs">→</span>
        <input type="date" value={fimLivre} onChange={(e) => { setFimLivre(e.target.value); setPeriodo("livre"); }}
          className="text-xs border-none outline-none bg-transparent text-slate-600 dark:text-slate-300 w-32" />
      </div>
    </div>
  );
}

function CardStat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">{value}</div>
          {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</div>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function Quebra({ titulo, icon: Icon, linhas, totalGeral }) {
  return (
    <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-slate-400 dark:text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{titulo}</h2>
      </div>
      {linhas.length === 0 ? (
        <div className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Nenhuma apólice emitida no período.</div>
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => {
            const pct = totalGeral > 0 ? (l.comissao / totalGeral) * 100 : 0;
            return (
              <div key={l.nome}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 dark:text-slate-200 truncate">{l.nome}</span>
                  <span className="text-slate-800 dark:text-slate-100 font-semibold flex-shrink-0 ml-2">{fmtBRL(l.comissao)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 w-16 text-right flex-shrink-0">
                    {l.qtd} apólice{l.qtd !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Comissões — versão estimada ─────────────────────────────
// Agregação de premio_liquido × percentual_comissao (dado que já
// alimenta o Dashboard hoje), quebrada por seguradora e por produto,
// num período selecionável. NÃO é a versão financeira detalhada
// (comissao_parcelas/comissao_movimentos) — essa continua pausada,
// aguardando regras reais de pagamento por seguradora.
export default function Comissoes() {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [periodo, setPeriodo] = useState("mes");
  const [iniLivre, setIniLivre] = useState(diasAtras(30));
  const [fimLivre, setFimLivre] = useState(hojeStr());

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from("renovacoes")
        .select("tipo_seguro, seguradora, premio_liquido, percentual_comissao, data_emissao, status_pipeline")
        .eq("status_pipeline", "emitida")
        .not("data_emissao", "is", null);
      if (error) { setErro(error.message); setLoading(false); return; }
      setLinhas(data || []);
      setLoading(false);
    })();
  }, []);

  const { ini, fim } = useMemo(() => {
    const hoje = new Date();
    if (periodo === "livre") return { ini: iniLivre, fim: fimLivre };
    if (periodo === "mes") {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
      return { ini: primeiroDia, fim: hojeStr() };
    }
    const dias = Number(periodo);
    return { ini: diasAtras(dias), fim: hojeStr() };
  }, [periodo, iniLivre, fimLivre]);

  const doPeriodo = useMemo(
    () => linhas.filter((a) => a.data_emissao >= ini && a.data_emissao <= fim),
    [linhas, ini, fim]
  );

  const resumo = useMemo(() => {
    let comissaoTotal = 0, premioTotal = 0, semComissaoQtd = 0;
    for (const a of doPeriodo) {
      comissaoTotal += comissaoDe(a);
      premioTotal += Number(a.premio_liquido) || 0;
      if (!a.percentual_comissao || !a.premio_liquido) semComissaoQtd++;
    }
    return {
      comissaoTotal,
      premioTotal,
      qtd: doPeriodo.length,
      ticketMedio: doPeriodo.length > 0 ? comissaoTotal / doPeriodo.length : 0,
      semComissaoQtd,
    };
  }, [doPeriodo]);

  const agrupar = (campo) => {
    const m = {};
    for (const a of doPeriodo) {
      const bruto = (a[campo] || "Não informado").trim();
      const chave = bruto.toUpperCase();
      if (!m[chave]) m[chave] = { nome: chave, comissao: 0, qtd: 0 };
      m[chave].comissao += comissaoDe(a);
      m[chave].qtd += 1;
    }
    return Object.values(m).sort((x, y) => y.comissao - x.comissao);
  };

  const porSeguradora = useMemo(() => agrupar("seguradora"), [doPeriodo]);
  const porProduto = useMemo(() => agrupar("tipo_seguro"), [doPeriodo]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando comissões...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Comissões</h1>
        <SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} iniLivre={iniLivre} fimLivre={fimLivre} setIniLivre={setIniLivre} setFimLivre={setFimLivre} />
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        {ini} → {fim} · versão estimada (prêmio líquido × percentual de comissão) — não é o financeiro detalhado.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <CardStat icon={DollarSign} label="Comissão do período" value={fmtBRL(resumo.comissaoTotal)} color="bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" />
        <CardStat icon={TrendingUp} label="Prêmio líquido" value={fmtBRL(resumo.premioTotal)} sub={`${resumo.qtd} apólices emitidas`} color="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" />
        <CardStat icon={Percent} label="Ticket médio" value={fmtBRL(resumo.ticketMedio)} sub="comissão por apólice" color="bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400" />
        <CardStat icon={Wallet} label="Sem comissão" value={resumo.semComissaoQtd} sub="faltando % ou prêmio líq." color="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Quebra titulo="Por seguradora" icon={ShieldCheck} linhas={porSeguradora} totalGeral={resumo.comissaoTotal} />
        <Quebra titulo="Por produto" icon={Building2} linhas={porProduto} totalGeral={resumo.comissaoTotal} />
      </div>
    </div>
  );
}
