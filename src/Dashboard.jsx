import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import {
  Briefcase, TrendingUp, DollarSign, Percent, CalendarClock,
  UserMinus, AlertTriangle, Bell, RefreshCw, ChevronRight,
  Calendar, Users, RotateCcw, Gift, Clock
} from "lucide-react";

const fmtBRL = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d) => {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};
const subDays = (d, n) => addDays(d, -n);

const RAMO_CORES = ["#2563eb","#7c3aed","#f97316","#dc2626","#ca8a04","#059669","#0ea5e9","#db2777","#64748b"];

// ── Gráfico rosca ─────────────────────────────────────────────────
function Donut({ data }) {
  const total = data.reduce((s, d) => s + Number(d.apolices), 0);
  const r = 54, stroke = 20, C = 2 * Math.PI * r;
  let offset = 0;
  if (total === 0) return <div className="text-sm text-slate-400 py-6 text-center">Nenhuma apólice vigente.</div>;
  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90 flex-shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (Number(d.apolices) / total) * C;
          const seg = <circle key={i} cx="70" cy="70" r={r} fill="none"
            stroke={RAMO_CORES[i % RAMO_CORES.length]} strokeWidth={stroke}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return seg;
        })}
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RAMO_CORES[i % RAMO_CORES.length] }} />
            <span className="text-slate-600 flex-1 truncate">{d.ramo}</span>
            <span className="text-slate-400 w-5 text-right">{d.apolices}</span>
            <span className="text-slate-500 font-medium w-24 text-right">{fmtBRL(d.premio)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card clicável de produção ─────────────────────────────────────
function CardProd({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-left w-full hover:shadow-md hover:border-slate-200 transition-all group">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-slate-800 mt-1 truncate">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5 truncate">{sub}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={18} />
          </div>
          <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
        </div>
      </div>
    </button>
  );
}

// ── Card informativo (não clicável) ──────────────────────────────
function CardInfo({ icon: Icon, label, value, sub, color }) {
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

// ── Seletor de período ────────────────────────────────────────────
function SeletorPeriodo({ ini, fim, onChange }) {
  const [modo, setModo] = useState("mes"); // mes | 15 | 30 | 90 | livre
  const [dataIni, setDataIni] = useState(ini);
  const [dataFim, setDataFim] = useState(fim);

  const aplicar = useCallback((m, di, df) => {
    const t = today();
    let i, f;
    if (m === "mes") { i = t.slice(0, 7) + "-01"; f = t; }
    else if (m === "15") { i = subDays(t, 15); f = t; }
    else if (m === "30") { i = subDays(t, 30); f = t; }
    else if (m === "90") { i = subDays(t, 90); f = t; }
    else { i = di; f = df; }
    onChange(i, f);
  }, [onChange]);

  const btn = (m, label) => (
    <button onClick={() => { setModo(m); aplicar(m, dataIni, dataFim); }}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
        modo === m ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn("mes", "Mês atual")}
      {btn("15", "15 dias")}
      {btn("30", "30 dias")}
      {btn("90", "90 dias")}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
        modo === "livre" ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
      }`}>
        <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
          className="text-xs border-none outline-none bg-transparent text-slate-600 w-32" />
        <span className="text-slate-400 text-xs">→</span>
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
          className="text-xs border-none outline-none bg-transparent text-slate-600 w-32" />
        <button onClick={() => { setModo("livre"); aplicar("livre", dataIni, dataFim); }}
          className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold hover:bg-blue-700">
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ── Seletor de horizonte (para frente) ───────────────────────────
function SeletorHorizonte({ dias, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[15, 60, 90].map(d => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
            dias === d ? "bg-violet-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}>
          {d}d
        </button>
      ))}
    </div>
  );
}

// ── Seletor de aniversariantes ───────────────────────────────────
function SeletorAniv({ modo, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[["hoje","Hoje"], ["15","15 dias"], ["30","30 dias"]].map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
            modo === v ? "bg-amber-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ── Dashboard principal ──────────────────────────────────────────
export default function Dashboard({ onNavigate, onFiltro }) {
  const t = today();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [periodoIni, setPeriodoIni] = useState(t.slice(0, 7) + "-01");
  const [periodoFim, setPeriodoFim] = useState(t);
  const [renovarDias, setRenovarDias] = useState(30);
  const [modoAniv, setModoAniv] = useState("hoje");

  const carregar = useCallback(async (ini, fim, rdias) => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase.rpc("dashboard_metrics", {
      p_inicio: ini || periodoIni,
      p_fim: fim || periodoFim,
      p_renovar_dias: rdias || renovarDias,
    });
    if (error) { setErro(error.message); setLoading(false); return; }
    setM(data);
    setLoading(false);
  }, [periodoIni, periodoFim, renovarDias]);

  useEffect(() => { carregar(periodoIni, periodoFim, renovarDias); }, []);

  const onPeriodo = (ini, fim) => {
    setPeriodoIni(ini);
    setPeriodoFim(fim);
    carregar(ini, fim, renovarDias);
  };

  const onRenovar = (d) => {
    setRenovarDias(d);
    carregar(periodoIni, periodoFim, d);
  };

  const navProducao = (filtroStatus) => {
    if (!onNavigate || !onFiltro) return;
    onFiltro({ status: filtroStatus, dataIni: periodoIni, dataFim: periodoFim });
    onNavigate("pipeline");
  };

  const navAniversariantes = () => {
    if (!onNavigate) return;
    onNavigate("aniversariantes");
  };

  const navRenovar = () => {
    if (!onNavigate || !onFiltro) return;
    onFiltro({ renovar: true, renovarDias });
    onNavigate("pipeline");
  };

  const qtdAniv = modoAniv === "hoje" ? m?.aniv_hoje : modoAniv === "15" ? m?.aniv_15d : m?.aniv_30d;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ background: "#F1F2F4" }}>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
        <button onClick={() => carregar(periodoIni, periodoFim, renovarDias)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── REGIÃO 1: PRODUÇÃO ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Produção</h2>
            {m && <p className="text-xs text-slate-400 mt-0.5">{fmtData(m.periodo_inicio)} → {fmtData(m.periodo_fim)}</p>}
          </div>
          <SeletorPeriodo ini={periodoIni} fim={periodoFim} onChange={onPeriodo} />
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-6">Carregando...</div>
        ) : erro ? (
          <div className="text-center text-red-500 text-sm py-4">{erro}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <CardProd icon={TrendingUp}  label="Apólices emitidas"  color="bg-emerald-100 text-emerald-600"
              value={m.emitidas_periodo} sub="no período"
              onClick={() => navProducao("emitida")} />
            <CardProd icon={DollarSign}  label="Prêmio produzido"   color="bg-blue-100 text-blue-600"
              value={fmtBRL(m.premio_periodo)} sub="no período"
              onClick={() => navProducao("emitida")} />
            <CardProd icon={Percent}     label="Comissões"          color="bg-amber-100 text-amber-600"
              value={fmtBRL(m.comissao_periodo)} sub="no período"
              onClick={() => navProducao("emitida")} />
            <CardProd icon={RotateCcw}   label="Taxa de renovação"  color="bg-violet-100 text-violet-600"
              value={`${m.taxa_renovacao}%`} sub={`${m.emitidas_periodo} de ${m.total_periodo}`}
              onClick={() => navProducao("emitida")} />
            <CardProd icon={UserMinus}   label="Perdidos"           color="bg-red-100 text-red-600"
              value={m.perdidas_periodo} sub="não renovados"
              onClick={() => navProducao("nao_renovada")} />
            <CardInfo icon={CalendarClock} label="Proj. comissão 60d" color="bg-sky-100 text-sky-600"
              value={fmtBRL(m.projecao_comissao_60d)} sub="estimativa" />
          </div>
        )}
      </div>

      {/* ── REGIÃO 2: CARTEIRA + MIX ── */}
      {!loading && m && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Carteira atual</h2>
            <div className="grid grid-cols-2 gap-3">
              <CardInfo icon={Briefcase}     label="Apólices vigentes"  color="bg-blue-100 text-blue-600"
                value={`${m.carteira_qtd}`} sub={fmtBRL(m.carteira_valor)} />
              <CardInfo icon={DollarSign}    label="Comissão da carteira" color="bg-amber-100 text-amber-600"
                value={fmtBRL(m.carteira_comissao)} sub="recorrente" />
              <CardProd icon={AlertTriangle} label="Sinistros abertos"  color="bg-orange-100 text-orange-600"
                value={m.sinistros_abertos} sub="em andamento"
                onClick={() => navProducao("sinistros")} />
              <CardProd icon={Bell}          label="Urgentes (≤5 dias)" color="bg-rose-100 text-rose-600"
                value={m.urgentes_5d} sub="vencem em breve"
                onClick={() => { onFiltro && onFiltro({ urgentes: true }); onNavigate && onNavigate("pipeline"); }} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Mix de carteira por ramo</h2>
            <Donut data={m.mix_carteira || []} />
          </div>
        </div>
      )}

      {/* ── REGIÕES 3 + 4: A RENOVAR + ANIVERSARIANTES ── */}
      {!loading && m && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* REGIÃO 3: A RENOVAR */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700">A renovar</h2>
              <SeletorHorizonte dias={renovarDias} onChange={onRenovar} />
            </div>
            <button onClick={navRenovar}
              className="w-full flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl p-4 hover:bg-violet-100 transition-colors group">
              <div>
                <div className="text-3xl font-bold text-violet-700">{m.a_renovar_qtd}</div>
                <div className="text-xs text-violet-500 mt-0.5">apólices nos próximos {m.renovar_dias} dias</div>
                <div className="text-xs text-slate-500 mt-1">{fmtBRL(m.a_renovar_premio)} em prêmio</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Clock size={28} className="text-violet-300 group-hover:text-violet-500 transition-colors" />
                <ChevronRight size={14} className="text-violet-300 group-hover:text-violet-500" />
              </div>
            </button>
          </div>

          {/* REGIÃO 4: ANIVERSARIANTES */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Aniversariantes</h2>
              <SeletorAniv modo={modoAniv} onChange={setModoAniv} />
            </div>
            <button onClick={navAniversariantes}
              className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors group">
              <div>
                <div className="text-3xl font-bold text-amber-600">{qtdAniv ?? 0}</div>
                <div className="text-xs text-amber-500 mt-0.5">
                  {modoAniv === "hoje" ? "fazem aniversário hoje" : `nos próximos ${modoAniv} dias`}
                </div>
                <div className="text-xs text-slate-400 mt-1">Clique para ver e enviar parabéns</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Gift size={28} className="text-amber-300 group-hover:text-amber-500 transition-colors" />
                <ChevronRight size={14} className="text-amber-300 group-hover:text-amber-500" />
              </div>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
