import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { AlertTriangle, Filter, ChevronRight, X, Plus } from "lucide-react";
import { genId, fmt } from "./utils";

const SN_STATUS = ["Aberto", "Documentação", "Aguardando Seguradora", "Em Regulação", "Encerrado"];
const SN_DOCS   = ["BO", "Fotos", "NF", "CNH", "CRLV", "Laudo"];
const SN_TIPOS  = ["Colisão", "Roubo/Furto", "Incêndio", "Vida", "Danos Elétricos", "RC", "Outros"];

const SN_STATUS_COR = {
  "Aberto":                "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  "Documentação":          "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  "Aguardando Seguradora": "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  "Em Regulação":          "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  "Encerrado":             "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
};

// ── Sinistros — visão consolidada de carteira, com atuação direta ──
// Antes, sinistros só apareciam espalhados: painel fixo do Kanban
// (PainelSinistros em PipelineUI.jsx), aba dentro do modal do card
// (ModalCard.jsx) e painel na ficha do cliente (SinistrosCliente em
// Segurados.jsx). Esta tela consolida a visão de todos os sinistros
// da carteira e permite agir sem precisar abrir o card.
//
// IMPORTANTE — escopo desta tela (por design, não é limitação de
// tempo):
// - Ações disponíveis aqui: mudar status, registrar contato com a
//   seguradora, marcar/desmarcar documento do checklist.
// - Criar um sinistro novo ou excluir um sinistro continua exclusivo
//   do modal do card (ModalCard.jsx) — são ações menos frequentes,
//   ligadas ao momento de abrir/fechar a apólice, e manter só ali
//   evita ter duas telas fazendo a mesma coisa de formas diferentes.
// - Escrita: update direto só na coluna `sinistros` da renovação
//   específica (supabase.update), nunca reaproveitando upsertCard —
//   que reconstrói a linha inteira da apólice e exigiria carregar
//   todos os campos do card só para editar um sinistro.
export default function Sinistros({ onVerCliente, onAbrirCard }) {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [contatoForm, setContatoForm] = useState({});
  const [salvandoId, setSalvandoId] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoForm, setNovoForm] = useState({ renovacaoId: "", tipo: "", protocolo: "", dataOcorrencia: "", descricao: "", status: "Aberto" });
  const [buscaApolice, setBuscaApolice] = useState("");
  const [buscaApoliceOpen, setBuscaApoliceOpen] = useState(false);
  const [apoliceSelecionada, setApoliceSelecionada] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from("renovacoes")
        .select("id, cliente_id, cliente_nome, cpf_cnpj, tipo_seguro, seguradora, sinistros")
        .not("cliente_id", "is", null);
      if (error) { setErro(error.message); setLoading(false); return; }
      setLinhas(data || []);
      setLoading(false);
    })();
  }, []);

  // Grava a mudança direto na coluna sinistros da renovação específica.
  // Otimista: atualiza a tela já, e desfaz se o Supabase recusar.
  const salvarSinistros = async (renovacaoId, novosSinistros) => {
    const anterior = linhas;
    setLinhas((prev) => prev.map((l) => (l.id === renovacaoId ? { ...l, sinistros: novosSinistros } : l)));
    setSalvandoId(renovacaoId);
    const { error } = await supabase.from("renovacoes").update({ sinistros: novosSinistros }).eq("id", renovacaoId);
    setSalvandoId(null);
    if (error) {
      setLinhas(anterior);
      window.alert("Não foi possível salvar: " + error.message);
    }
  };

  const mudarStatus = (renovacaoId, sinistros, sinId, novoStatus) => {
    const novo = sinistros.map((s) =>
      s.id === sinId
        ? { ...s, status: novoStatus, dataEncerramento: novoStatus === "Encerrado" ? (s.dataEncerramento || new Date().toISOString().slice(0, 10)) : s.dataEncerramento }
        : s
    );
    salvarSinistros(renovacaoId, novo);
  };

  const registrarContato = (renovacaoId, sinistros, sinId) => {
    const cf = contatoForm[sinId];
    if (!cf?.data || !cf?.descricao) return;
    const novo = sinistros.map((s) =>
      s.id === sinId ? { ...s, contatos: [...(s.contatos || []), { id: genId(), data: cf.data, descricao: cf.descricao }] } : s
    );
    salvarSinistros(renovacaoId, novo);
    setContatoForm((p) => ({ ...p, [sinId]: {} }));
  };

  const toggleDoc = (renovacaoId, sinistros, sinId, doc) => {
    const novo = sinistros.map((s) =>
      s.id === sinId ? { ...s, docs: (s.docs || []).includes(doc) ? s.docs.filter((d) => d !== doc) : [...(s.docs || []), doc] } : s
    );
    salvarSinistros(renovacaoId, novo);
  };

  // Cria um sinistro novo direto nesta tela — mesmo formato de objeto
  // usado em ModalCard.jsx (addSinistro), para não criar um modelo de
  // dados paralelo.
  const criarSinistro = async () => {
    if (!novoForm.renovacaoId || !novoForm.tipo) return;
    const linha = linhas.find((l) => l.id === novoForm.renovacaoId);
    if (!linha) return;
    const novoSinistro = {
      id: genId(),
      tipo: novoForm.tipo,
      protocolo: novoForm.protocolo || "",
      descricao: novoForm.descricao || "",
      dataOcorrencia: novoForm.dataOcorrencia || "",
      dataPrevistaResolucao: "",
      dataEncerramento: "",
      status: novoForm.status || "Aberto",
      docs: [],
      contatos: [],
      observacoes: "",
    };
    const novosSinistros = [...(linha.sinistros || []), novoSinistro];
    await salvarSinistros(novoForm.renovacaoId, novosSinistros);
    setNovoForm({ renovacaoId: "", tipo: "", protocolo: "", dataOcorrencia: "", descricao: "", status: "Aberto" });
    setBuscaApolice("");
    setApoliceSelecionada(null);
    setNovoAberto(false);
    setAberto(novoSinistro.id);
  };

  const resultadosBusca = useMemo(() => {
    const q = buscaApolice.trim().toLowerCase();
    if (q.length < 2) return [];
    const qDigitos = q.replace(/\D/g, "");
    return linhas
      .filter((l) => {
        const nome = (l.cliente_nome || "").toLowerCase();
        const doc = (l.cpf_cnpj || "").replace(/\D/g, "");
        return nome.includes(q) || (qDigitos.length >= 3 && doc.includes(qDigitos));
      })
      .slice(0, 8);
  }, [buscaApolice, linhas]);

  const todos = useMemo(() => {
    return linhas.flatMap((a) =>
      (a.sinistros || []).map((s) => ({
        ...s,
        renovacao_id: a.id,
        renovacao_sinistros: a.sinistros || [],
        cliente_id: a.cliente_id,
        cliente_nome: a.cliente_nome,
        tipo_seguro: a.tipo_seguro,
        seguradora: a.seguradora,
      }))
    );
  }, [linhas]);

  const abertos = useMemo(() => todos.filter((s) => s.status !== "Encerrado"), [todos]);
  const encerrados = useMemo(() => todos.filter((s) => s.status === "Encerrado"), [todos]);

  const contagemPorStatus = useMemo(() => {
    const m = {};
    for (const st of SN_STATUS) m[st] = 0;
    for (const s of todos) m[s.status] = (m[s.status] || 0) + 1;
    return m;
  }, [todos]);

  const lista = useMemo(() => {
    const base = verEncerrados ? todos : abertos;
    const filtrada = filtroStatus ? base.filter((s) => s.status === filtroStatus) : base;
    return filtrada.slice().sort((a, b) => (a.dataOcorrencia || "").localeCompare(b.dataOcorrencia || ""));
  }, [todos, abertos, verEncerrados, filtroStatus]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando sinistros...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Sinistros</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNovoAberto((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
          >
            <Plus size={13} /> Novo sinistro
          </button>
          {encerrados.length > 0 && (
            <button onClick={() => setVerEncerrados((v) => !v)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              {verEncerrados ? "Ocultar encerrados" : `Ver encerrados (${encerrados.length})`}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Todos os sinistros da carteira. Clique num sinistro para atuar — mudar status, registrar
        contato ou marcar documento — sem precisar abrir o card.
      </p>

      {novoAberto && (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Novo sinistro</h2>
            <button onClick={() => { setNovoAberto(false); setBuscaApolice(""); setApoliceSelecionada(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block md:col-span-2 relative">
              <span className="text-xs text-slate-400 dark:text-slate-500">Cliente / apólice *</span>
              {apoliceSelecionada ? (
                <div className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {apoliceSelecionada.cliente_nome} — {apoliceSelecionada.tipo_seguro} ({apoliceSelecionada.seguradora})
                  </span>
                  <button
                    onClick={() => { setApoliceSelecionada(null); setNovoForm((p) => ({ ...p, renovacaoId: "" })); }}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={buscaApolice}
                    onChange={(e) => { setBuscaApolice(e.target.value); setBuscaApoliceOpen(true); }}
                    onFocus={() => setBuscaApoliceOpen(true)}
                    onBlur={() => setTimeout(() => setBuscaApoliceOpen(false), 150)}
                    placeholder="Busca por nome ou CPF/CNPJ..."
                    className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
                  />
                  {buscaApoliceOpen && buscaApolice.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-painel dark:bg-painel-dark rounded-xl shadow-xl border border-borda dark:border-borda-dark z-20 overflow-hidden">
                      {resultadosBusca.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-slate-400 dark:text-slate-500">Nenhum resultado.</div>
                      ) : (
                        resultadosBusca.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => {
                              setApoliceSelecionada(l);
                              setNovoForm((p) => ({ ...p, renovacaoId: l.id }));
                              setBuscaApolice("");
                              setBuscaApoliceOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-borda dark:border-borda-dark last:border-b-0"
                          >
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{l.cliente_nome}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                              {l.cpf_cnpj || "—"} · {l.tipo_seguro} · {l.seguradora}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 dark:text-slate-500">Tipo *</span>
              <select
                value={novoForm.tipo}
                onChange={(e) => setNovoForm((p) => ({ ...p, tipo: e.target.value }))}
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
              >
                <option value="">Selecione...</option>
                {SN_TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 dark:text-slate-500">Status</span>
              <select
                value={novoForm.status}
                onChange={(e) => setNovoForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
              >
                {SN_STATUS.filter((s) => s !== "Encerrado").map((st) => <option key={st}>{st}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 dark:text-slate-500">Protocolo</span>
              <input
                value={novoForm.protocolo}
                onChange={(e) => setNovoForm((p) => ({ ...p, protocolo: e.target.value }))}
                placeholder="Ex: 2024-001234"
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 dark:text-slate-500">Data da ocorrência</span>
              <input
                type="date"
                value={novoForm.dataOcorrencia}
                onChange={(e) => setNovoForm((p) => ({ ...p, dataOcorrencia: e.target.value }))}
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">Descrição</span>
              <textarea
                rows={2}
                value={novoForm.descricao}
                onChange={(e) => setNovoForm((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Descreva o que aconteceu..."
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={criarSinistro}
              disabled={!novoForm.renovacaoId || !novoForm.tipo}
              className="text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg disabled:opacity-40"
            >
              Criar sinistro
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {SN_STATUS.filter((st) => st !== "Encerrado").map((st) => (
          <button
            key={st}
            onClick={() => setFiltroStatus((f) => (f === st ? null : st))}
            className={`bg-painel dark:bg-painel-dark rounded-xl border shadow-sm p-3 text-left transition-colors ${
              filtroStatus === st ? "border-red-400 dark:border-red-500" : "border-borda dark:border-borda-dark"
            }`}
          >
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contagemPorStatus[st] || 0}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{st}</div>
          </button>
        ))}
      </div>

      {filtroStatus && (
        <button onClick={() => setFiltroStatus(null)}
          className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Filter size={11} /> Filtro: {filtroStatus} ✕
        </button>
      )}

      {lista.length === 0 ? (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          {verEncerrados ? "Nenhum sinistro encontrado." : "Nenhum sinistro aberto — tudo em dia."}
        </div>
      ) : (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {lista.map((s) => {
            const exp = aberto === s.id;
            const cf = contatoForm[s.id] || {};
            const salvando = salvandoId === s.renovacao_id;
            return (
              <div key={s.id} className={exp ? "bg-slate-50 dark:bg-slate-800/60" : "bg-painel dark:bg-painel-dark"}>
                <button
                  onClick={() => setAberto(exp ? null : s.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                >
                  <AlertTriangle size={16} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.cliente_nome}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SN_STATUS_COR[s.status] || "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {s.tipo} · {s.tipo_seguro} · {s.seguradora}
                      {s.protocolo ? ` · Protocolo ${s.protocolo}` : ""}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {s.dataOcorrencia && <span className="mr-3">Ocorrência: {fmt(s.dataOcorrencia)}</span>}
                      {s.dataPrevistaResolucao && <span className="mr-3">Previsão: {fmt(s.dataPrevistaResolucao)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
                    {onVerCliente && s.cliente_id && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); onVerCliente(s.cliente_id); }}
                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5"
                      >
                        Ver cliente <ChevronRight size={12} />
                      </span>
                    )}
                    {onAbrirCard && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); onAbrirCard(s.renovacao_id); }}
                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline"
                      >
                        Abrir card
                      </span>
                    )}
                  </div>
                </button>

                {exp && (
                  <div className="px-4 pb-4 space-y-3">
                    {s.descricao && <div className="text-xs text-slate-500 dark:text-slate-400">{s.descricao}</div>}

                    {/* Status + checklist */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex flex-wrap gap-1.5">
                        {SN_DOCS.map((doc) => {
                          const marcado = (s.docs || []).includes(doc);
                          return (
                            <span
                              key={doc}
                              onClick={() => toggleDoc(s.renovacao_id, s.renovacao_sinistros, s.id, doc)}
                              className={`text-xs px-2 py-0.5 rounded-full cursor-pointer font-medium ${
                                marcado
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                  : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
                              }`}
                            >
                              {doc}
                            </span>
                          );
                        })}
                      </div>
                      <select
                        value={s.status}
                        disabled={salvando}
                        onChange={(e) => mudarStatus(s.renovacao_id, s.renovacao_sinistros, s.id, e.target.value)}
                        className="text-xs border border-borda dark:border-borda-dark rounded-lg px-2 py-1 bg-painel dark:bg-painel-dark text-slate-700 dark:text-slate-200 outline-none focus:border-slate-300 dark:focus:border-slate-500 disabled:opacity-60"
                      >
                        {SN_STATUS.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    </div>

                    {/* Histórico de contatos */}
                    <div className="border-t border-borda dark:border-borda-dark pt-3">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Histórico de contatos com a seguradora</div>
                      {(s.contatos || []).length > 0 && (
                        <div className="space-y-1 mb-2">
                          {s.contatos.map((c) => (
                            <div key={c.id} className="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                              <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">{fmt(c.data)}</span>
                              <span>{c.descricao}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 items-end flex-wrap">
                        <input
                          type="date"
                          value={cf.data || ""}
                          onChange={(e) => setContatoForm((p) => ({ ...p, [s.id]: { ...cf, data: e.target.value } }))}
                          className="text-xs border border-borda dark:border-borda-dark rounded-lg px-2 py-1 bg-painel dark:bg-painel-dark text-slate-700 dark:text-slate-200 outline-none"
                        />
                        <input
                          placeholder="Descrição do contato..."
                          value={cf.descricao || ""}
                          onChange={(e) => setContatoForm((p) => ({ ...p, [s.id]: { ...cf, descricao: e.target.value } }))}
                          className="flex-1 min-w-[10rem] text-xs border border-borda dark:border-borda-dark rounded-lg px-2 py-1 bg-painel dark:bg-painel-dark text-slate-700 dark:text-slate-200 outline-none"
                        />
                        <button
                          disabled={!cf.data || !cf.descricao || salvando}
                          onClick={() => registrarContato(s.renovacao_id, s.renovacao_sinistros, s.id)}
                          className="text-xs bg-slate-700 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white px-2 py-1 rounded-lg disabled:opacity-40"
                        >
                          + Registrar
                        </button>
                      </div>
                    </div>

                    {s.observacoes && (
                      <div className="border-t border-borda dark:border-borda-dark pt-3">
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold mb-0.5">Observações</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">{s.observacoes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
