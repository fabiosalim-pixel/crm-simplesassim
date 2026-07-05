import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import {
  Briefcase, TrendingUp, DollarSign, Percent, CalendarClock,
  UserMinus, AlertTriangle, Bell, RefreshCw, ChevronRight,
  Calendar, Users, RotateCcw, Gift, Clock, AlertCircle, X, ArrowRight
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

function Donut({ data }) {
  const total = data.reduce((s, d) => s + Number(d.apolices), 0);
  const r = 54, stroke = 20, C = 2 * Math.PI * r;
  let offset = 0;
  if (total === 0) return <div className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Nenhuma apólice vigente.</div>;
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
            <span className="text-slate-600 dark:text-slate-300 flex-1 truncate">{d.ramo}</span>
            <span className="text-slate-400 dark:text-slate-500 w-5 text-right">{d.apolices}</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium w-24 text-right">{fmtBRL(d.premio)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardProd({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <button onClick={onClick}
      className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 text-left w-full hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all group">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">{value}</div>
          {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon size={18} />
          </div>
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

function CardInfo({ icon: Icon, label, value, sub, color }) {
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

function SeletorPeriodo({ ini, fim, onChange }) {
  const [modo, setModo] = useState("mes");
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
        modo === m ? "bg-blue-600 text-white" : "bg-painel dark:bg-painel-dark border border-borda dark:border-borda-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn("mes", "Mes atual")}
      {btn("15", "15 dias")}
      {btn("30", "30 dias")}
      {btn("90", "90 dias")}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
        modo === "livre" ? "border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark"
      }`}>
        <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
          className="text-xs border-none outline-none bg-transparent text-slate-600 dark:text-slate-300 w-32" />
        <span className="text-slate-400 dark:text-slate-500 text-xs">-&gt;</span>
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
          className="text-xs border-none outline-none bg-transparent text-slate-600 dark:text-slate-300 w-32" />
        <button onClick={() => { setModo("livre"); aplicar("livre", dataIni, dataFim); }}
          className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold hover:bg-blue-700">
          Aplicar
        </button>
      </div>
    </div>
  );
}

function SeletorHorizonte({ dias, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[15, 60, 90].map(d => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
            dias === d ? "bg-violet-600 text-white" : "bg-painel dark:bg-painel-dark border border-borda dark:border-borda-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}>
          {d}d
        </button>
      ))}
    </div>
  );
}

function SeletorAniv({ modo, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {[["hoje","Hoje"], ["15","15 dias"], ["30","30 dias"]].map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
            modo === v ? "bg-amber-500 text-white" : "bg-painel dark:bg-painel-dark border border-borda dark:border-borda-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ModalSemComissao({ cards, loading, total, valorTotal, onClose, onVerKanban }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-painel dark:bg-painel-dark rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-borda dark:border-borda-dark">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle size={18} className="text-indigo-500" />
              Apolices sem comissao cadastrada
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {total} {total === 1 ? "apolice" : "apolices"} &middot; {fmtBRL(valorTotal)} em premio
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">Carregando...</div>
          ) : cards.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">
              Nenhuma apolice sem comissao. Tudo completo!
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-borda dark:border-borda-dark bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.cliente_nome}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.tipo_seguro} &middot; {c.seguradora}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{fmtBRL(c.valor)}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">vence {fmtData(c.data_renovacao)}</div>
                  </div>
                  <div className="ml-3 flex flex-col gap-1 flex-shrink-0">
                    {!c.premio_liquido && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">sem premio liq.</span>
                    )}
                    {!c.percentual_comissao && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">sem % comissao</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-borda dark:border-borda-dark gap-3">
          <button onClick={onClose}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2 rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark">
            Fechar
          </button>
          <button onClick={onVerKanban}
            className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
            Ver no Kanban <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate, onFiltro }) {
  const t = today();
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [periodoIni, setPeriodoIni] = useState(t.slice(0, 7) + "-01");
  const [periodoFim, setPeriodoFim] = useState(t);
  const [renovarDias, setRenovarDias] = useState(30);
  const [modoAniv, setModoAniv] = useState("hoje");
  const [modalSemComissao, setModalSemComissao] = useState(false);
  const [semComissaoCards, setSemComissaoCards] = useState([]);
  const [loadingSemComissao, setLoadingSemComissao] = useState(false);

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

  const abrirSemComissao = async () => {
    setModalSemComissao(true);
    setLoadingSemComissao(true);
    const { data } = await supabase
      .from("renovacoes")
      .select("id, cliente_nome, tipo_seguro, seguradora, data_renovacao, valor, percentual_comissao, premio_liquido")
      .eq("status_pipeline", "emitida")
      .gte("data_renovacao", today())
      .or("percentual_comissao.is.null,premio_liquido.is.null")
      .order("data_renovacao", { ascending: true });
    setSemComissaoCards(data || []);
    setLoadingSemComissao(false);
  };

  const verSemComissaoKanban = () => {
    setModalSemComissao(false);
    if (!onNavigate || !onFiltro) return;
    onFiltro({ semComissao: true });
    onNavigate("pipeline");
  };

  const qtdAniv = modoAniv === "hoje" ? m?.aniv_hoje : modoAniv === "15" ? m?.aniv_15d : m?.aniv_30d;

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <button onClick={() => carregar(periodoIni, periodoFim, renovarDias)}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Producao</h2>
            {m && <p className="text-xs text-slate-400 mt-0.5">{fmtData(m.periodo_inicio)} -&gt; {fmtData(m.periodo_fim)}</p>}
          </div>
          <SeletorPeriodo ini={periodoIni} fim={periodoFim} onChange={onPeriodo} />
        </div>
        {loading ? (
          <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-6">Carregando...</div>
        ) : erro ? (
          <div className="text-center text-red-500 dark:text-red-400 text-sm py-4">{erro}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <CardProd icon={TrendingUp}  label="Apolices emitidas"  color="bg-emerald-100 text-emerald-600"
              value={m.emitidas_periodo} sub="no periodo" onClick={() => navProducao("emitida")} />
            <CardProd icon={DollarSign}  label="Premio produzido"   color="bg-blue-100 text-blue-600"
              value={fmtBRL(m.premio_periodo)} sub="no periodo" onClick={() => navProducao("emitida")} />
            <CardProd icon={Percent}     label="Comissoes"          color="bg-amber-100 text-amber-600"
              value={fmtBRL(m.comissao_periodo)} sub="no periodo" onClick={() => navProducao("emitida")} />
            <CardProd icon={RotateCcw}   label="Taxa de renovacao"  color="bg-violet-100 text-violet-600"
              value={`${m.taxa_renovacao}%`} sub={`${m.emitidas_periodo} de ${m.total_periodo}`}
              onClick={() => navProducao("emitida")} />
            <CardProd icon={UserMinus}   label="Perdidos"           color="bg-red-100 text-red-600"
              value={m.perdidas_periodo} sub="nao renovados" onClick={() => navProducao("nao_renovada")} />
            <CardInfo icon={CalendarClock} label="Proj. comissao 60d" color="bg-sky-100 text-sky-600"
              value={fmtBRL(m.projecao_comissao_60d)} sub="estimativa" />
          </div>
        )}
      </div>

      {!loading && m && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Carteira atual</h2>
            <div className="grid grid-cols-2 gap-3">
              <CardInfo icon={Briefcase}     label="Apolices vigentes"   color="bg-blue-100 text-blue-600"
                value={`${m.carteira_qtd}`} sub={fmtBRL(m.carteira_valor)} />
              <CardInfo icon={DollarSign}    label="Comissao da carteira" color="bg-amber-100 text-amber-600"
                value={fmtBRL(m.carteira_comissao)} sub="recorrente" />
              <CardProd icon={AlertTriangle} label="Sinistros abertos"   color="bg-orange-100 text-orange-600"
                value={m.sinistros_abertos} sub="em andamento" onClick={() => navProducao("sinistros")} />
              <CardProd icon={Bell}          label="Urgentes (5 dias)"   color="bg-rose-100 text-rose-600"
                value={m.urgentes_5d} sub="vencem em breve"
                onClick={() => { onFiltro && onFiltro({ urgentes: true }); onNavigate && onNavigate("pipeline"); }} />
              <div className="col-span-2">
                <CardProd icon={AlertCircle} label="Sem comissao"        color="bg-indigo-100 text-indigo-600"
                  value={m.sem_comissao_qtd ?? 0}
                  sub={m.sem_comissao_qtd > 0 ? `${fmtBRL(m.sem_comissao_valor)} em premio` : "Tudo completo"}
                  onClick={abrirSemComissao} />
              </div>
            </div>
          </div>
          <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mix de carteira por ramo</h2>
            <Donut data={m.mix_carteira || []} />
          </div>
        </div>
      )}

      {!loading && m && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">A renovar</h2>
              <SeletorHorizonte dias={renovarDias} onChange={onRenovar} />
            </div>
            <button onClick={navRenovar}
              className="w-full flex items-center justify-between bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl p-4 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors group">
              <div>
                <div className="text-3xl font-bold text-violet-700 dark:text-violet-300">{m.a_renovar_qtd}</div>
                <div className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">apolices nos proximos {m.renovar_dias} dias</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fmtBRL(m.a_renovar_premio)} em premio</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Clock size={28} className="text-violet-300 dark:text-violet-700 group-hover:text-violet-500 dark:group-hover:text-violet-500 transition-colors" />
                <ChevronRight size={14} className="text-violet-300 dark:text-violet-700 group-hover:text-violet-500 dark:group-hover:text-violet-500" />
              </div>
            </button>
          </div>
          <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aniversariantes</h2>
              <SeletorAniv modo={modoAniv} onChange={setModoAniv} />
            </div>
            <button onClick={navAniversariantes}
              className="w-full flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors group">
              <div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{qtdAniv ?? 0}</div>
                <div className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                  {modoAniv === "hoje" ? "fazem aniversario hoje" : `nos proximos ${modoAniv} dias`}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Clique para ver e enviar parabens</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Gift size={28} className="text-amber-300 dark:text-amber-700 group-hover:text-amber-500 dark:group-hover:text-amber-500 transition-colors" />
                <ChevronRight size={14} className="text-amber-300 dark:text-amber-700 group-hover:text-amber-500 dark:group-hover:text-amber-500" />
              </div>
            </button>
          </div>
        </div>
      )}

      {modalSemComissao && (
        <ModalSemComissao
          cards={semComissaoCards}
          loading={loadingSemComissao}
          total={m?.sem_comissao_qtd ?? 0}
          valorTotal={m?.sem_comissao_valor ?? 0}
          onClose={() => setModalSemComissao(false)}
          onVerKanban={verSemComissaoKanban}
        />
      )}

    </div>
  );
}
