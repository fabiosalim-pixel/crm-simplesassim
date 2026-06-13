import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import {
  Briefcase, TrendingUp, DollarSign, Percent,
  CalendarClock, UserMinus, AlertTriangle, Bell, RefreshCw
} from "lucide-react";

const fmtBRL = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RAMO_CORES = ["#2563eb", "#7c3aed", "#f97316", "#dc2626", "#ca8a04", "#059669", "#0ea5e9", "#db2777", "#64748b"];

function Donut({ data }) {
  const total = data.reduce((s, d) => s + Number(d.apolices), 0);
  const r = 60, stroke = 22, C = 2 * Math.PI * r;
  let offset = 0;

  if (total === 0) {
    return <div className="text-sm text-slate-400 py-8 text-center">Nenhuma apólice vigente ainda.</div>;
  }

  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90 flex-shrink-0">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (Number(d.apolices) / total) * C;
          const seg = (
            <circle key={i} cx="80" cy="80" r={r} fill="none"
              stroke={RAMO_CORES[i % RAMO_CORES.length]} strokeWidth={stroke}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: RAMO_CORES[i % RAMO_CORES.length] }} />
            <span className="text-slate-700 flex-1 truncate">{d.ramo}</span>
            <span className="text-slate-400">{d.apolices}</span>
            <span className="text-slate-500 font-medium w-28 text-right">{fmtBRL(d.premio)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-slate-800 mt-1 truncate">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5 truncate">{sub}</div>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase.rpc("dashboard_metrics");
    if (error) { setErro(error.message); setLoading(false); return; }
    setM(data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  if (loading) return <div className="flex-1 p-8 text-center text-slate-400 text-sm">Carregando indicadores...</div>;
  if (erro) return <div className="flex-1 p-8 text-center text-red-500 text-sm">Erro ao carregar: {erro}</div>;
  if (!m) return null;

  const cards = [
    { icon: Briefcase,     label: "Carteira ativa",        value: `${m.carteira_qtd} apólices`,       sub: fmtBRL(m.carteira_valor),            color: "bg-blue-100 text-blue-600" },
    { icon: TrendingUp,    label: "Prêmio do mês",         value: fmtBRL(m.premio_mes),                                                         color: "bg-emerald-100 text-emerald-600" },
    { icon: DollarSign,    label: "Comissão do mês",       value: fmtBRL(m.comissao_mes),                                                       color: "bg-amber-100 text-amber-600" },
    { icon: Percent,       label: "Taxa de renovação",     value: `${m.taxa_renovacao}%`,             sub: `${m.emitidas_mes} de ${m.total_mes} no mês`, color: "bg-violet-100 text-violet-600" },
    { icon: CalendarClock, label: "Receita projetada 60d", value: fmtBRL(m.projecao_comissao_60d),                                              color: "bg-sky-100 text-sky-600" },
    { icon: UserMinus,     label: "Perdidos no mês",       value: m.perdidos_mes,                                                               color: "bg-red-100 text-red-600" },
    { icon: AlertTriangle, label: "Sinistros abertos",     value: m.sinistros_abertos,                                                          color: "bg-orange-100 text-orange-600" },
    { icon: Bell,          label: "Urgentes (≤5 dias)",    value: m.urgentes_5d,                                                                color: "bg-rose-100 text-rose-600" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F1F2F4" }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
        <button onClick={carregar}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {cards.map((c, i) => <Card key={i} {...c} />)}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Mix de Carteira por ramo</h2>
        <Donut data={m.mix_carteira || []} />
      </div>
    </div>
  );
}
