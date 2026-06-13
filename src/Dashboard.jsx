import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Shield, AlertTriangle, TrendingUp, Clock, CheckCircle, DollarSign } from "lucide-react";

const STAGES = [
  { id: "cotacoes",    label: "Cotações e Leads",        cor: "bg-blue-600"    },
  { id: "enviada",     label: "Enviada ao Cliente",       cor: "bg-violet-600"  },
  { id: "transmitida", label: "Proposta Transmitida",     cor: "bg-orange-500"  },
  { id: "vistoria",    label: "Vistoria / Pend. Emissão", cor: "bg-red-500"     },
  { id: "boleto",      label: "Boleto / Débito",          cor: "bg-yellow-600"  },
  { id: "emitida",     label: "Apólice Emitida",          cor: "bg-emerald-600" },
  { id: "crosselling", label: "Crosselling",              cor: "bg-purple-600"  },
];

const fmtBRL = (v) =>
  v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00";

const diasAte = (dataStr) => {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataStr + "T00:00:00");
  return Math.round((alvo - hoje) / 86400000);
};

export default function Dashboard() {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("renovacoes")
        .select("id, cliente_nome, status_pipeline, data_renovacao, premio_liquido, percentual_comissao, transmitida_em, seguradora, produto")
        .neq("status_pipeline", "arquivada");
      setCards(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Carregando dashboard…
      </div>
    );
  }

  const total        = cards.length;
  const emitidas     = cards.filter(c => c.status_pipeline === "emitida").length;
  const transmitidas = cards.filter(c => c.status_pipeline === "transmitida").length;

  const comissaoTotal = cards.reduce((acc, c) => {
    if (c.premio_liquido && c.percentual_comissao) {
      return acc + (Number(c.premio_liquido) * Number(c.percentual_comissao) / 100);
    }
    return acc;
  }, 0);

  const alerta5dias = cards.filter(c => {
    if (c.status_pipeline !== "transmitida" || !c.transmitida_em) return false;
    return (Date.now() - new Date(c.transmitida_em)) / 86400000 > 5;
  });

  const renovacoes30 = cards
    .filter(c => { const d = diasAte(c.data_renovacao); return d !== null && d >= 0 && d <= 30; })
    .sort((a, b) => diasAte(a.data_renovacao) - diasAte(b.data_renovacao));

  const vencidas = cards.filter(c => { const d = diasAte(c.data_renovacao); return d !== null && d < 0; });

  const porStage = STAGES.map(s => ({
    ...s,
    count: cards.filter(c => c.status_pipeline === s.id).length,
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h2 className="text-xl font-bold text-slate-800">Visão Geral</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Shield size={18} className="text-blue-600" />}
            label="Total ativo"
            value={total}
            sub="renovações no pipeline"
            bg="bg-blue-50"
          />
          <MetricCard
            icon={<CheckCircle size={18} className="text-emerald-600" />}
            label="Apólices emitidas"
            value={emitidas}
            sub={`${transmitidas} aguardando emissão`}
            bg="bg-emerald-50"
          />
          <MetricCard
            icon={<DollarSign size={18} className="text-indigo-600" />}
            label="Comissão estimada"
            value={fmtBRL(comissaoTotal)}
            sub="sobre prêmios com % cadastrado"
            bg="bg-indigo-50"
            small
          />
          <MetricCard
            icon={<Clock size={18} className="text-orange-600" />}
            label="Renovações em 30 dias"
            value={renovacoes30.length}
            sub={vencidas.length > 0 ? `⚠️ ${vencidas.length} vencida(s)` : "Sem vencimentos próximos"}
            bg="bg-orange-50"
            subRed={vencidas.length > 0}
          />
        </div>

        {alerta5dias.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                {alerta5dias.length} proposta{alerta5dias.length > 1 ? "s" : ""} transmitida{alerta5dias.length > 1 ? "s" : ""} há mais de 5 dias sem apólice
              </span>
            </div>
            <div className="space-y-1.5">
              {alerta5dias.map(c => {
                const dias = Math.floor((Date.now() - new Date(c.transmitida_em)) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{c.cliente_nome || "—"}</span>
                    <span className="text-xs text-slate-500">{c.seguradora || "—"}</span>
                    <span className="text-xs font-semibold text-red-600">{dias} dias aguardando</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Pipeline por etapa</h3>
            </div>
            <div className="space-y-2.5">
              {porStage.filter(s => s.count > 0).map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.cor}`} />
                  <span className="text-sm text-slate-600 flex-1">{s.label}</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{s.count}</span>
                  <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.cor}`}
                      style={{ width: total > 0 ? `${Math.round((s.count / total) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
              {porStage.every(s => s.count === 0) && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum card no pipeline.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Renovações nos próximos 30 dias</h3>
            </div>
            {renovacoes30.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhuma renovação nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {renovacoes30.slice(0, 8).map(c => {
                  const d = diasAte(c.data_renovacao);
                  const urgente = d <= 7;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{c.cliente_nome || "—"}</p>
                        <p className="text-xs text-slate-400">{c.seguradora || "—"} · {c.produto || "—"}</p>
                      </div>
                      <div className={`flex-shrink-0 ml-3 text-xs font-semibold px-2 py-0.5 rounded-full ${urgente ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {d === 0 ? "Hoje" : d === 1 ? "Amanhã" : `${d} dias`}
                      </div>
                    </div>
                  );
                })}
                {renovacoes30.length > 8 && (
                  <p className="text-xs text-slate-400 text-center pt-1">
                    + {renovacoes30.length - 8} outras renovações
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        {vencidas.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-700">Vigências vencidas ainda no pipeline</h3>
              <span className="ml-auto text-xs text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">{vencidas.length}</span>
            </div>
            <div className="space-y-2">
              {vencidas.slice(0, 6).map(c => {
                const d = Math.abs(diasAte(c.data_renovacao));
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{c.cliente_nome || "—"}</p>
                      <p className="text-xs text-slate-400">{c.seguradora || "—"}</p>
                    </div>
                    <span className="flex-shrink-0 ml-3 text-xs font-semibold text-slate-500">
                      Venceu há {d} dia{d !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
              {vencidas.length > 6 && (
                <p className="text-xs text-slate-400 text-center pt-1">+ {vencidas.length - 6} outros</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, bg, small, subRed }) {
  return (
    <div className={`${bg} rounded-xl border border-slate-200 p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className={`font-bold text-slate-800 leading-tight ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className={`text-xs mt-1 ${subRed ? "text-red-600 font-semibold" : "text-slate-500"}`}>{sub}</p>
    </div>
  );
}
