import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { Shield, Plus, X, ChevronRight, ChevronLeft, Bell, Search, Save, Tag, Filter, AlertTriangle, Paperclip, Download, Trash2, Upload, Archive, Clock, Ban, RotateCcw } from "lucide-react";
import { Layout } from "./Layout";
import Dashboard from "./Dashboard";
import Segurados from "./Segurados";
import CrossSell from "./CrossSell";
import {
  STAGES, PROSP_STAGES, DOC_TIPOS,
  RAMOS_IMOVEL, RAMOS_VIDA, RAMOS_EQUIP, RAMOS_VIAGEM,
  SITUACOES, PAGAMENTOS, CANAIS,
  SITUACAO_COR, PAGAMENTO_COR, CANAL_COR,
} from "./constants";
import {
  genId, daysUntil, isTransmitidaExpirada, isApoliceAlerta, isVistoriaAlerta, isBoletoAlerta,
  fmt, fmtBRL, maskCpfCnpj, isCNPJ, maskMoeda, moedaParaNumero, numeroParaMoeda,
  buscaCEP, maskCEP, maskPhone, mapPagamento,
} from "./utils";
import {
  mapRow, loadCards, searchAllCards, upsertCard, faltaComissaoParaAvancar, deleteCard,
  loadDocs, uploadDoc, deleteDoc, docPublicUrl,
  criarProspeccao, loadProspeccoes, upsertProspeccao,
  searchClientes, findOrCreateCliente,
} from "./data";
import { AniversariantesView, ProspeccoesView } from "./Prospeccoes";
import { PainelSinistros, Column, ApoliceRow } from "./PipelineUI";
import { DocsSection, EndossoSection } from "./DocumentosEndossos";
import { Modal } from "./ModalCard";
import { AddModal, ClienteModal, LoginScreen } from "./ModaisCadastro";

// ── Importação de PDF ────────────────────────────────────────

import { ImportModal } from "./ImportPDF";

// ── App principal ─────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined); // undefined=carregando, null=sem sessão
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addStage, setAddStage] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [view, setView] = useState("pipeline");
  const [onlyUrgentes, setOnlyUrgentes] = useState(false);
  const [onlySemComissao, setOnlySemComissao] = useState(false);
  const [onlyComSinistro, setOnlyComSinistro] = useState(false);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterPeriodo, setFilterPeriodo] = useState(null);
  const [prospeccoes, setProspeccoes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clienteModal, setClienteModal] = useState(null);
  const [clienteParaAbrir, setClienteParaAbrir] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("crm-theme") || "light");
  const searchRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setLoading(true);
    loadCards(mostrarArquivados).then(c => { setCards(c); setLoading(false); });
  }, [mostrarArquivados]);

  useEffect(() => {
    if (view === "prospeccoes") {
      loadProspeccoes().then(setProspeccoes);
    }
  }, [view]);

  // Busca global com debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    const t = setTimeout(() => {
      searchAllCards(searchQuery).then(res => { setSearchResults(res); setSearchOpen(res.length > 0); });
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Persistência do tema claro/escuro
  useEffect(() => {
    localStorage.setItem("crm-theme", theme);
  }, [theme]);

  // Fechar dropdown ao clicar fora
  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectResult = (card) => {
    setSelected(card);
    setSearchQuery("");
    setSearchOpen(false);
  };

  // Navegação central: qualquer clique normal no menu limpa o cliente
  // pré-selecionado (evita reabrir por acidente um cliente antigo vindo
  // do Cross-sell). Só é preenchido explicitamente por quem chama com
  // { clienteId }.
  const navigateTo = (v, { clienteId = null } = {}) => {
    setClienteParaAbrir(clienteId);
    setView(v);
  };

  const handleAdd = async (card) => {
    const err = await upsertCard(card);
    if (err) { window.alert("Não foi possível salvar: " + err.message); return; }
    setCards(prev => [card, ...prev]);
  };

  const handleDrop = async (cardId, newStatus) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;
    const msgComissao = faltaComissaoParaAvancar(card, newStatus, card.status);
    if (msgComissao) { window.alert(msgComissao); return; }
    const updated = {
      ...card, status: newStatus,
      transmitidaEm: newStatus === "transmitida" && !card.transmitidaEm ? new Date().toISOString() : (card.transmitidaEm || null),
    };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    const err = await upsertCard(updated);
    if (err) {
      setCards(prev => prev.map(c => c.id === cardId ? card : c));
      window.alert("Não foi possível mover o card: " + err.message);
    }
  };

  const handleSave = async (updated) => {
    const anterior = cards.find(c => c.id === updated.id);
    const msgComissao = faltaComissaoParaAvancar(updated, updated.status, anterior?.status);
    if (msgComissao) { window.alert(msgComissao); return; }
    const recemArquivado = updated.arquivado && anterior && !anterior.arquivado;
    const err = await upsertCard(updated);
    if (err) { window.alert("Não foi possível salvar: " + err.message); return; }
    if (recemArquivado) {
      setCards(prev => prev.filter(c => c.id !== updated.id));
      setSelected(null);
    } else {
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      const camposIgnorar = ["followUps","sinistros","endossos","historicoCiclos","criadoEm","arquivadoEm","transmitidaEm"];
      const qtd = anterior ? Object.keys(updated).filter(k => !camposIgnorar.includes(k) && JSON.stringify(updated[k]) !== JSON.stringify(anterior[k])).length : 0;
      showToast(`✅ ${qtd > 0 ? `${qtd} campo${qtd !== 1 ? "s" : ""} atualizado${qtd !== 1 ? "s" : ""}` : "Card salvo"} com sucesso.`);
    }
  };
  const handleDelete = async (id) => {
    await deleteCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  };

  const handleArquivar = async (card) => {
    const err = await upsertCard(card);
    if (err) { window.alert("Não foi possível arquivar: " + err.message); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleDesarquivar = async (card) => {
    const err = await upsertCard(card);
    if (err) { window.alert("Não foi possível desarquivar: " + err.message); return; }
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleNaoRenovada = async (card) => {
    const updated = { ...card, etiquetaSituacao: "Não Renovada", arquivado: true, arquivadoEm: new Date().toISOString() };
    const err = await upsertCard(updated);
    if (err) { window.alert("Não foi possível arquivar como Não Renovada: " + err.message); return; }
    await criarProspeccao(updated);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleProspeccaoUpdate = (updated) => {
    setProspeccoes(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleRecuperar = async (prosp) => {
    // Marca prospecção como recuperada
    const updatedProsp = { ...prosp, status: "RECUPERADA" };
    await upsertProspeccao(updatedProsp);
    setProspeccoes(prev => prev.map(p => p.id === updatedProsp.id ? updatedProsp : p));
    // Cria novo card no pipeline com dados do cliente
    const dataVenc = prosp.dataVencAnterior
      ? new Date(prosp.dataVencAnterior + "T12:00:00")
      : null;
    const novaData = dataVenc
      ? new Date(dataVenc.setFullYear(dataVenc.getFullYear() + 1)).toISOString().slice(0, 10)
      : null;
    const novoCard = {
      id: genId(),
      clienteNome:      prosp.clienteNome,
      cpfCnpj:          prosp.cpfCnpj,
      telefone:         prosp.telefone,
      email:            prosp.email,
      tipoSeguro:       prosp.produto,
      seguradora:       prosp.seguradoraAnterior,
      dataRenovacao:    novaData,
      valor:            prosp.valorAnterior,
      status:           "cotacoes",
      etiquetaSituacao: "Renovação",
      historicoCiclos:  [],
      followUps:        [],
      arquivado:        false,
    };
    await upsertCard(novoCard);
    setCards(prev => [novoCard, ...prev]);
    setView("pipeline");
  };

  const visible = cards
    .filter(c => {
      const ms = !search || c.clienteNome?.toLowerCase().includes(search.toLowerCase()) || (c.cpfCnpj || "").includes(search);
      const mm = !filterMonth || (c.dataRenovacao || "").startsWith(filterMonth);
      const mu = !onlyUrgentes || (() => { const dd = daysUntil(c.dataRenovacao); return dd !== null && dd <= 5 && c.status !== "emitida"; })();
      const mc = !onlySemComissao || (c.status === "emitida" && (!c.percentualComissao || !c.premioLiquido));
      const msin = !onlyComSinistro || (c.sinistros || []).some(s => s.status !== "Encerrado");
      const mst = !filterStatus || c.status === filterStatus;
      const mp = !filterPeriodo || (c.dataEmissao && c.dataEmissao >= filterPeriodo.ini && c.dataEmissao <= filterPeriodo.fim);
      return ms && mm && mu && mc && msin && mst && mp;
    })
    .sort((a, b) => {
      const da = a.dataRenovacao || "9999-99";
      const db = b.dataRenovacao || "9999-99";
      return da < db ? -1 : da > db ? 1 : 0;
    });

  const urgentes = cards.filter(c => { const d = daysUntil(c.dataRenovacao); return d !== null && d <= 5 && c.status !== "emitida"; }).length;
  const apolicesPendentes = cards.filter(isApoliceAlerta).length;
  const vistoriasPendentes = cards.filter(isVistoriaAlerta).length;
  const boletosPendentes = cards.filter(isBoletoAlerta).length;

  const handlePropostaAnexada = async (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.status !== "enviada") return;
    const agora = new Date().toISOString();
    const { error } = await supabase.from("renovacoes")
      .update({ status_pipeline: "transmitida", transmitida_em: agora })
      .eq("id", cardId);
    if (error) { console.error("Erro ao mover card:", error); alert("Erro ao mover card: " + error.message); return; }
    const updated = { ...card, status: "transmitida", transmitidaEm: agora };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    setSelected(updated);
  };

  const handleApoliceAnexada = async (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const novoStatus = (card.status === "transmitida" || card.status === "vistoria" || card.status === "boleto")
      ? "emitida" : card.status;
    const msgComissao = faltaComissaoParaAvancar(card, novoStatus, card.status);
    if (msgComissao) { window.alert(msgComissao); return; }
    const dataEmissao = novoStatus === "emitida" ? (card.dataEmissao || new Date().toISOString().slice(0, 10)) : card.dataEmissao;
    const patch = { status_pipeline: novoStatus, apolice_anexada: true };
    if (novoStatus === "emitida") patch.data_emissao = dataEmissao;
    // UPDATE direto — evita falha silenciosa do upsertCard por colunas novas
    const { error } = await supabase.from("renovacoes")
      .update(patch)
      .eq("id", cardId);
    if (error) { console.error("Erro ao mover card:", error); alert("Erro ao mover card: " + error.message); return; }
    const updated = { ...card, apoliceAnexada: true, status: novoStatus, dataEmissao };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    setSelected(updated);
  };

  const months = Array.from({ length: 8 }, (_, i) => {
    const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() + i - 1);
    return { val: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`, label: dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });

  if (session === undefined) return (
    <div className="h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
      <Shield size={40} className="text-amber-400 animate-pulse" />
    </div>
  );

  if (!session) return <LoginScreen />;

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <Shield size={40} className="text-slate-300 mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400 text-sm">Carregando...</p>
      </div>
    </div>
  );

  const userName = session?.user?.email
    ? session.user.email.split("@")[0].replace(/^(.)/, (c) => c.toUpperCase())
    : "Administrador";

  const limparFiltrosDashboard = () => {
    setFilterStatus(null);
    setFilterPeriodo(null);
    setOnlyComSinistro(false);
  };

  const topBarContent = (
    <div className="px-5 py-2 flex items-center gap-2.5">
      <div className="relative" ref={searchRef}>
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
        <input
          className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 w-72"
          placeholder="Buscar cliente, CPF, placa..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setSearch(e.target.value); }}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          onKeyDown={e => e.key === "Escape" && (setSearchOpen(false), setSearchQuery(""), setSearch(""))}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setSearch(""); setSearchOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </button>
        )}
        {searchOpen && (
          <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
            <div className="px-3 py-2 border-b bg-slate-50">
              <span className="text-xs text-slate-400 font-medium">{searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}</span>
            </div>
            {searchResults.map(card => {
              const stage = STAGES.find(s => s.id === card.status);
              return (
                <button key={card.id} onClick={() => handleSelectResult(card)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 text-sm truncate">{card.clienteNome}</span>
                      {card.arquivado && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5">
                          <Archive size={9} /> Arquivado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {card.tipoSeguro} · {card.seguradora}
                      {card.autoPlaca && ` · ${card.autoPlaca}`}
                      {card.cpfCnpj && ` · ${card.cpfCnpj}`}
                    </div>
                  </div>
                  {!card.arquivado && stage && (
                    <span className={`text-xs text-white px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${stage.badge}`}>
                      {stage.short}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {urgentes > 0 && (
        <button onClick={() => { setView("pipeline"); setOnlyUrgentes(true); }}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer">
          <Bell size={11} /> {urgentes} urgente{urgentes !== 1 ? "s" : ""}
        </button>
      )}
      {apolicesPendentes > 0 && (
        <div className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <Paperclip size={11} /> {apolicesPendentes} apólice{apolicesPendentes !== 1 ? "s" : ""} pendente{apolicesPendentes !== 1 ? "s" : ""}
        </div>
      )}
      {vistoriasPendentes > 0 && (
        <div className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <AlertTriangle size={11} /> {vistoriasPendentes} vistoria{vistoriasPendentes !== 1 ? "s" : ""} pendente{vistoriasPendentes !== 1 ? "s" : ""}
        </div>
      )}
      {boletosPendentes > 0 && (
        <div className="flex items-center gap-1.5 bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <Bell size={11} /> {boletosPendentes} boleto{boletosPendentes !== 1 ? "s" : ""} vencendo
        </div>
      )}
      <div className="text-slate-400 text-xs ml-auto">{cards.length} cards · {cards.filter(c => c.status === "emitida").length} emitidas</div>
    </div>
  );

  return (
    <Layout
      active={view}
      onNavigate={navigateTo}
      padded={view !== "pipeline"}
      topBar={topBarContent}
      userName={userName}
      userRole="Corretor"
      onLogout={() => supabase.auth.signOut()}
      theme={theme}
      onToggleTheme={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
    >
      {view === "home" ? (
        <Dashboard
          onNavigate={(v) => setView(v)}
          onFiltro={(f) => {
            if (f.urgentes) {
              setOnlyUrgentes(true); setOnlySemComissao(false); setOnlyComSinistro(false);
              setFilterStatus(null); setFilterPeriodo(null);
            }
            if (f.renovar) {
              setOnlyUrgentes(false); setOnlySemComissao(false); setOnlyComSinistro(false);
              setFilterStatus(null); setFilterPeriodo(null);
            }
            if (f.semComissao) {
              setOnlySemComissao(true); setOnlyUrgentes(false); setOnlyComSinistro(false);
              setFilterStatus(null); setFilterPeriodo(null);
            }
            if (f.status === "emitida") {
              setFilterStatus("emitida");
              setFilterPeriodo({ ini: f.dataIni, fim: f.dataFim });
              setOnlyUrgentes(false); setOnlySemComissao(false); setOnlyComSinistro(false);
            }
            if (f.status === "sinistros") {
              setOnlyComSinistro(true);
              setOnlyUrgentes(false); setOnlySemComissao(false);
              setFilterStatus(null); setFilterPeriodo(null);
            }
            // f.status === "nao_renovada": cards "Não Renovada" são arquivados
            // e migram para a Captação (prospecções) — não existem mais no
            // board ativo do Pipeline. Sem efeito aqui por ora — ver nota na
            // entrega deste arquivo.
          }}
        />
      ) : view === "segurados" ? (
        <Segurados initialSelId={clienteParaAbrir} />
      ) : view === "crosssell" ? (
        <CrossSell onVerCliente={(id) => navigateTo("segurados", { clienteId: id })} />
      ) : view === "aniversariantes" ? (
        <AniversariantesView onVerCliente={(id) => navigateTo("segurados", { clienteId: id })} />
      ) : view === "prospeccoes" ? (
        <ProspeccoesView prospeccoes={prospeccoes} onUpdate={handleProspeccaoUpdate} onRecuperar={handleRecuperar} />
      ) : view === "documentos" ? (
        <div className="max-w-2xl">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Documentos</h1>
          <p className="text-sm text-slate-500 mb-5">
            Importação automática de propostas, apólices e endossos via IA.
          </p>
          <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center">
            <Upload size={32} className="text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
              Envie um PDF de proposta, apólice ou endosso. Os dados são extraídos
              automaticamente e um novo card é criado no Pipeline.
            </p>
            <button onClick={() => setImportModal(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Upload size={15} /> Importar PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="bg-painel dark:bg-painel-dark border-b border-borda dark:border-borda-dark px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
            <button onClick={() => setMostrarArquivados(prev => !prev)}
              title={mostrarArquivados ? "Voltar ao pipeline" : "Ver apólices arquivadas"}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${mostrarArquivados ? "bg-amber-100 border-amber-300 text-amber-700 font-semibold" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              <Archive size={12} /> {mostrarArquivados ? "Arquivados" : "Arquivados"}
            </button>
            <Filter size={13} className="text-slate-400" />
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-600"
              value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">Todos os meses</option>
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            {onlyUrgentes && (
              <button onClick={() => setOnlyUrgentes(false)}
                className="flex items-center gap-1.5 bg-red-100 border border-red-300 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors">
                <Bell size={11} /> Só urgentes (≤5 dias) <X size={12} className="ml-0.5" />
              </button>
            )}
            {(filterStatus || onlyComSinistro) && (
              <button onClick={limparFiltrosDashboard}
                className="flex items-center gap-1.5 bg-indigo-100 border border-indigo-300 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-indigo-200 transition-colors">
                <Filter size={11} /> Filtro do Dashboard <X size={12} className="ml-0.5" />
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setImportModal(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <Upload size={15} /> Importar PDF
              </button>
              <button onClick={() => setAddStage("cotacoes")}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <Plus size={15} /> Novo card
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2.5 p-4 h-full" style={{ minWidth: "fit-content" }}>
                {STAGES.map(s => (
                  <Column key={s.id} stage={s}
                    cards={visible.filter(c => c.status === s.id)}
                    onCard={setSelected} onAdd={setAddStage} onDrop={handleDrop} />
                ))}
              </div>
            </div>
            <PainelSinistros cards={cards} onCard={setSelected} />
          </div>
        </div>
      )}

      {selected && <Modal card={selected} onClose={() => setSelected(null)} onSave={handleSave} onDelete={handleDelete} onArquivar={handleArquivar} onDesarquivar={handleDesarquivar} onNaoRenovada={handleNaoRenovada} onVerCliente={(id) => { setSelected(null); setClienteModal(id); }} onApoliceAnexada={() => handleApoliceAnexada(selected.id)} onPropostaAnexada={() => handlePropostaAnexada(selected.id)} onExtrairDados={(data, tipo) => { setCards(prev => prev.map(c => c.id === selected.id ? { ...c } : c)); }} />}
      {addStage && <AddModal initialStage={addStage} onClose={() => setAddStage(null)} onAdd={handleAdd} />}
      {clienteModal && <ClienteModal clienteId={clienteModal} onClose={() => setClienteModal(null)} onAbrirCard={(c) => { setClienteModal(null); setSelected(c); }} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onAdd={handleAdd} />}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          {toast}
        </div>
      )}
    </Layout>
  );
}
