import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { Shield, Plus, X, ChevronRight, ChevronLeft, Bell, Search, Save, Tag, Filter, AlertTriangle, Paperclip, Download, Trash2, Upload, Archive, Clock, Ban, Users, RotateCcw } from "lucide-react";

const STAGES = [
  { id: "cotacoes",    label: "Cotações e Leads",        short: "Cotações",    badge: "bg-blue-600",    bg: "bg-blue-50",    border: "border-blue-300" },
  { id: "enviada",     label: "Enviada ao Cliente",       short: "Enviada",     badge: "bg-violet-600",  bg: "bg-violet-50",  border: "border-violet-300" },
  { id: "transmitida", label: "Proposta Transmitida",     short: "Transmitida", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-300" },
  { id: "vistoria",    label: "Vistoria / Pend. Emissão", short: "Vistoria",    badge: "bg-red-500",     bg: "bg-red-50",     border: "border-red-300",    optional: true },
  { id: "boleto",      label: "Boleto / Débito",          short: "Pagamento",   badge: "bg-yellow-600",  bg: "bg-yellow-50",  border: "border-yellow-300", optional: true },
  { id: "emitida",     label: "Apólice Emitida",          short: "Emitida",     badge: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-300" },
];

const genId = () => crypto.randomUUID();

const PROSP_STAGES = [
  { id: "FRIA",               label: "Fria",               short: "Fria",      badge: "bg-sky-500",     bg: "bg-sky-50",     border: "border-sky-200" },
  { id: "EM ANDAMENTO",       label: "Em Andamento",       short: "Andamento", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-200" },
  { id: "RECUPERADA",         label: "Recuperada",         short: "Recuperada",badge: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: "PERDIDA DEFINITIVA", label: "Perdida Definitiva", short: "Perdida",   badge: "bg-slate-400",   bg: "bg-slate-50",   border: "border-slate-200" },
];

const DOC_TIPOS = [
  { id: "proposta",       label: "Proposta",         required: true  },
  { id: "apolice",        label: "Apólice",           required: true  },
  { id: "nota_fiscal",    label: "Nota Fiscal",       required: false },
  { id: "laudo_vistoria", label: "Laudo de Vistoria", required: false },
  { id: "cnh",            label: "CNH",               required: false },
  { id: "crlv",           label: "CRLV-e",            required: false },
];

const daysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d + "T12:00:00") - new Date()) / 86400000);
};

const fmt = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const fmtBRL = (v) =>
  v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const maskCpfCnpj = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join(".") + (e ? "-" + e : ""));
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, e, f) =>
    [a, b, c].filter(Boolean).join(".").replace(/^(\d{2})\./, "$1.") + (e ? "/" + e : "") + (f ? "-" + f : ""))
    .replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
};

const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
};

// ── Etiquetas em camadas ──────────────────────────────────────
const SITUACOES = ["Endosso","Não Renovada","Protocolado","Recusada","Renov. Congênere","Renovação","Seguro Novo","Sem Negócio"];
const PAGAMENTOS = ["Boleto","Cartão de Crédito","Débito em Conta","Link de Pagamento","PIX"];
const CANAIS = ["Crosselling","Google","Indicação","LojaCorr","Parceiro","Site"];

const SITUACAO_COR = {
  "Renovação":         "bg-blue-100 text-blue-700",
  "Seguro Novo":       "bg-emerald-100 text-emerald-700",
  "Renov. Congênere":  "bg-violet-100 text-violet-700",
  "Endosso":           "bg-orange-100 text-orange-700",
  "Não Renovada":      "bg-red-100 text-red-700",
  "Recusada":          "bg-red-100 text-red-700",
  "Sem Negócio":       "bg-slate-100 text-slate-500",
  "Protocolado":       "bg-yellow-100 text-yellow-700",
};
const PAGAMENTO_COR = {
  "Boleto":            "bg-amber-100 text-amber-700",
  "Débito em Conta":   "bg-teal-100 text-teal-700",
  "Cartão de Crédito": "bg-purple-100 text-purple-700",
  "PIX":               "bg-emerald-100 text-emerald-700",
  "Link de Pagamento": "bg-indigo-100 text-indigo-700",
};
const CANAL_COR = {
  "Indicação":   "bg-emerald-100 text-emerald-700",
  "Site":        "bg-sky-100 text-sky-700",
  "LojaCorr":    "bg-violet-100 text-violet-700",
  "Parceiro":    "bg-orange-100 text-orange-700",
  "Google":      "bg-red-100 text-red-700",
  "Crosselling": "bg-pink-100 text-pink-700",
};

function TagChip({ label, corMap }) {
  if (!label) return null;
  const cor = corMap[label] || "bg-slate-100 text-slate-500";
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cor}`}>{label}</span>;
}

// ── Supabase helpers ──────────────────────────────────────────
function mapRow(r) {
  return {
    id:            r.id,
    clienteNome:   r.cliente_nome,
    cpfCnpj:       r.cpf_cnpj,
    telefone:      r.telefone,
    email:         r.email,
    tipoSeguro:    r.tipo_seguro,
    seguradora:    r.seguradora,
    veiculo:       r.veiculo,
    dataRenovacao: r.data_renovacao,
    valor:         r.valor,
    status:        r.status_pipeline,
    responsavel:   r.responsavel,
    proposta:      r.proposta,
    apolice:       r.apolice_nova,
    etiquetaSegfy:    r.etiqueta_segfy,
    etiquetaSituacao: r.etiqueta_situacao,
    etiquetaPagamento:r.etiqueta_pagamento,
    etiquetaCanal:    r.etiqueta_canal,
    autoClasseBonus:    r.auto_classe_bonus,
    autoNomeSegurado:   r.auto_nome_segurado,
    autoCondutor:       r.auto_condutor,
    autoDataNasc:       r.auto_data_nascimento,
    autoSexo:           r.auto_sexo,
    autoEstadoCivil:    r.auto_estado_civil,
    autoMenorResidente: r.auto_menor_residente || false,
    autoCepPernoite:    r.auto_cep_pernoite,
    autoPlaca:          r.auto_placa,
    autoModelo:         r.auto_modelo,
    autoAnoFab:         r.auto_ano_fab,
    autoAnoMod:         r.auto_ano_mod,
    autoChassi:         r.auto_chassi,
    arquivado:        r.arquivado || false,
    arquivadoEm:      r.arquivado_em,
    historicoCiclos:  r.historico_ciclos || [],
    anotacoes:        r.observacoes,
    followUps:        r.cotacoes || [],
    mesReferencia:    r.mes_referencia,
  };
}

async function loadCards(arquivados = false) {
  let query = supabase.from("renovacoes").select("*");
  if (arquivados) {
    query = query.eq("arquivado", true);
  } else {
    query = query.neq("arquivado", true);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) { console.error("Erro ao carregar:", error); return []; }
  return (data || []).map(mapRow);
}

async function searchAllCards(q) {
  if (!q || q.length < 2) return [];
  const { data } = await supabase
    .from("renovacoes")
    .select("*")
    .or(`cliente_nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%,auto_placa.ilike.%${q}%`)
    .order("arquivado", { ascending: true })
    .limit(10);
  return (data || []).map(mapRow);
}

async function upsertCard(card) {
  const row = {
    id:              card.id,
    cliente_id:      card.clienteId || null,
    apolice_id:      card.apoliceId || null,
    cliente_nome:    card.clienteNome,
    cpf_cnpj:        card.cpfCnpj,
    telefone:        card.telefone,
    email:           card.email,
    tipo_seguro:     card.tipoSeguro,
    seguradora:      card.seguradora,
    veiculo:         card.veiculo,
    data_renovacao:  card.dataRenovacao || null,
    valor:           card.valor ? Number(card.valor) : null,
    status_pipeline: card.status,
    responsavel:     card.responsavel,
    proposta:        card.proposta,
    apolice_nova:    card.apolice,
    etiqueta_segfy:     card.etiquetaSegfy || false,
    etiqueta_situacao:  card.etiquetaSituacao || null,
    etiqueta_pagamento: card.etiquetaPagamento || null,
    etiqueta_canal:     card.etiquetaCanal || null,
    auto_classe_bonus:     card.autoClasseBonus ? Number(card.autoClasseBonus) : null,
    auto_nome_segurado:    card.autoNomeSegurado || null,
    auto_condutor:         card.autoCondutor || null,
    auto_data_nascimento:  card.autoDataNasc || null,
    auto_sexo:             card.autoSexo || null,
    auto_estado_civil:     card.autoEstadoCivil || null,
    auto_menor_residente:  card.autoMenorResidente || false,
    auto_cep_pernoite:     card.autoCepPernoite || null,
    auto_placa:            card.autoPlaca ? card.autoPlaca.toUpperCase() : null,
    auto_modelo:           card.autoModelo || null,
    auto_ano_fab:          card.autoAnoFab ? Number(card.autoAnoFab) : null,
    auto_ano_mod:          card.autoAnoMod ? Number(card.autoAnoMod) : null,
    auto_chassi:           card.autoChassi || null,
    arquivado:        card.arquivado || false,
    arquivado_em:     card.arquivadoEm || null,
    historico_ciclos: card.historicoCiclos || [],
    observacoes:      card.anotacoes,
    cotacoes:         card.followUps || [],
    mes_referencia:   card.mesReferencia || new Date().toISOString().slice(0, 7),
    atualizado_em:    new Date().toISOString(),
  };
  const { error } = await supabase.from("renovacoes").upsert(row);
  if (error) console.error("Erro ao salvar:", error);
}

async function deleteCard(id) {
  const { error } = await supabase.from("renovacoes").delete().eq("id", id);
  if (error) console.error("Erro ao deletar:", error);
}

// ── Helpers de documentos ──────────────────────────────────────
async function loadDocs(renovacaoId) {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("renovacao_id", renovacaoId)
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function uploadDoc(renovacaoId, tipo, file) {
  const ext = file.name.split(".").pop();
  const path = `${renovacaoId}/${tipo}_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
  if (upErr) { console.error("Erro no upload:", upErr); return null; }
  const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
  const { data, error: dbErr } = await supabase.from("documentos").insert({
    renovacao_id: renovacaoId, tipo, nome_arquivo: file.name, storage_path: path,
  }).select().single();
  if (dbErr) { console.error("Erro ao salvar doc:", dbErr); return null; }
  return { ...data, publicUrl };
}

async function deleteDoc(doc) {
  await supabase.storage.from("documentos").remove([doc.storage_path]);
  await supabase.from("documentos").delete().eq("id", doc.id);
}

function docPublicUrl(storagePath) {
  const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(storagePath);
  return publicUrl;
}

// ── Helpers de prospecção ─────────────────────────────────────
async function criarProspeccao(card) {
  const { data: ex } = await supabase.from("prospeccoes").select("id").eq("renovacao_id", card.id).limit(1);
  if (ex && ex.length > 0) return;
  const dataVenc = card.dataRenovacao ? new Date(card.dataRenovacao + "T12:00:00") : null;
  const dataContato = dataVenc ? new Date(dataVenc.getTime() + (365 - 30) * 86400000) : null;
  const { error } = await supabase.from("prospeccoes").insert({
    id: genId(),
    renovacao_id:          card.id,
    cliente_nome:          card.clienteNome,
    cpf_cnpj:              card.cpfCnpj,
    telefone:              card.telefone,
    email:                 card.email,
    produto:               card.tipoSeguro,
    seguradora_anterior:   card.seguradora,
    valor_anterior:        card.valor ? Number(card.valor) : null,
    data_vencimento_anterior: card.dataRenovacao || null,
    data_prevista_contato: dataContato ? dataContato.toISOString().slice(0, 10) : null,
    status_prospeccao:     "FRIA",
  });
  if (error) console.error("Erro ao criar prospecção:", error);
}

async function loadProspeccoes() {
  const { data, error } = await supabase
    .from("prospeccoes").select("*")
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id:                r.id,
    renovacaoId:       r.renovacao_id,
    clienteNome:       r.cliente_nome,
    cpfCnpj:           r.cpf_cnpj,
    telefone:          r.telefone,
    email:             r.email,
    produto:           r.produto,
    seguradoraAnterior:r.seguradora_anterior,
    valorAnterior:     r.valor_anterior,
    dataVencAnterior:  r.data_vencimento_anterior,
    dataPrevistaContato: r.data_prevista_contato,
    status:            r.status_prospeccao || "FRIA",
    observacoes:       r.observacoes,
    criadoEm:          r.criado_em,
  }));
}

async function upsertProspeccao(p) {
  const { error } = await supabase.from("prospeccoes").upsert({
    id:                    p.id,
    renovacao_id:          p.renovacaoId,
    cliente_nome:          p.clienteNome,
    cpf_cnpj:              p.cpfCnpj,
    telefone:              p.telefone,
    email:                 p.email,
    produto:               p.produto,
    seguradora_anterior:   p.seguradoraAnterior,
    valor_anterior:        p.valorAnterior ? Number(p.valorAnterior) : null,
    data_vencimento_anterior: p.dataVencAnterior || null,
    data_prevista_contato: p.dataPrevistaContato || null,
    status_prospeccao:     p.status,
    observacoes:           p.observacoes || null,
    atualizado_em:         new Date().toISOString(),
  });
  if (error) console.error("Erro ao salvar prospecção:", error);
}

// ── Componentes de Prospecção ─────────────────────────────────
function ProspeccaoTile({ p, onClick }) {
  const dias = p.dataPrevistaContato
    ? Math.ceil((new Date(p.dataPrevistaContato + "T12:00:00") - new Date()) / 86400000)
    : null;
  const urgente = dias !== null && dias <= 7;
  const aviso   = dias !== null && dias > 7 && dias <= 30;
  return (
    <div onClick={() => onClick(p)}
      className={`bg-white rounded-lg p-3 mb-2 shadow-sm cursor-pointer hover:shadow-md transition-all border-l-4 ${urgente ? "border-red-500" : aviso ? "border-yellow-400" : "border-transparent"}`}>
      <div className="font-semibold text-slate-800 text-sm leading-snug">{p.clienteNome}</div>
      <div className="text-xs text-slate-500 mt-1">{p.produto} · {p.seguradoraAnterior}</div>
      {p.valorAnterior && <div className="text-xs font-semibold text-emerald-700 mt-1">{fmtBRL(p.valorAnterior)}</div>}
      {dias !== null && (
        <div className={`text-xs mt-1.5 font-medium ${urgente ? "text-red-600" : aviso ? "text-yellow-600" : "text-slate-400"}`}>
          Contato: {fmt(p.dataPrevistaContato)} {urgente ? "⚠" : ""}
        </div>
      )}
    </div>
  );
}

function ProspeccaoModal({ p, onClose, onSave, onRecuperar }) {
  const [d, setD] = useState({ ...p });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));
  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";
  const stage = PROSP_STAGES.find(s => s.id === d.status) || PROSP_STAGES[0];

  const handleRecuperar = async () => {
    if (!window.confirm("Recuperar este cliente?\n\nA prospecção será marcada como Recuperada e um novo card será criado em Cotações e Leads.")) return;
    setSaving(true);
    await onRecuperar(d);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{d.clienteNome}</h2>
            <span className={`text-xs font-semibold ${stage.badge} text-white px-2.5 py-0.5 rounded-full mt-1 inline-block`}>{stage.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-sm">
            <div><span className="text-xs text-slate-400">Produto</span><div className="font-semibold text-slate-700">{d.produto || "—"}</div></div>
            <div><span className="text-xs text-slate-400">Seguradora anterior</span><div className="font-semibold text-slate-700">{d.seguradoraAnterior || "—"}</div></div>
            <div><span className="text-xs text-slate-400">Valor anterior</span><div className="font-semibold text-emerald-700">{fmtBRL(d.valorAnterior)}</div></div>
            <div><span className="text-xs text-slate-400">Vencimento anterior</span><div className="font-semibold text-slate-700">{fmt(d.dataVencAnterior)}</div></div>
            {d.telefone && <div><span className="text-xs text-slate-400">Telefone</span><div className="font-semibold text-slate-700">{d.telefone}</div></div>}
            {d.email && <div className="col-span-2"><span className="text-xs text-slate-400">E-mail</span><div className="font-semibold text-slate-700">{d.email}</div></div>}
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={d.status} onChange={e => set("status", e.target.value)}>
              {PROSP_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Data prevista de contato</label>
            <input type="date" className={inp} value={d.dataPrevistaContato || ""} onChange={e => set("dataPrevistaContato", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Observações</label>
            <textarea className={`${inp} resize-none`} rows={3} value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} placeholder="Motivo da não renovação, próximos passos..." />
          </div>
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0">
          {d.status !== "RECUPERADA" && d.status !== "PERDIDA DEFINITIVA" && (
            <button onClick={handleRecuperar} disabled={saving}
              className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
              <RotateCcw size={13} /> Recuperar cliente
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={async () => { setSaving(true); await onSave(d); setSaving(false); }} disabled={saving}
              className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspeccoesView({ prospeccoes, onUpdate, onRecuperar }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-3 p-4 h-full" style={{ minWidth: "fit-content" }}>
        {PROSP_STAGES.map(stage => {
          const items = prospeccoes.filter(p => p.status === stage.id);
          return (
            <div key={stage.id} className="flex-shrink-0 flex flex-col" style={{ width: 220 }}>
              <div className={`rounded-t-lg px-3 py-2.5 ${stage.badge} text-white`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs uppercase tracking-wider">{stage.label}</span>
                  <span className="text-xs font-bold bg-white bg-opacity-25 rounded-full w-5 h-5 flex items-center justify-center">{items.length}</span>
                </div>
              </div>
              <div className={`${stage.bg} flex-1 rounded-b-lg p-2 border ${stage.border} border-t-0 min-h-40 overflow-y-auto`} style={{ maxHeight: "calc(100vh - 200px)" }}>
                {items.map(p => <ProspeccaoTile key={p.id} p={p} onClick={setSel} />)}
                {items.length === 0 && <p className="text-xs text-slate-300 text-center mt-4">Nenhuma</p>}
              </div>
            </div>
          );
        })}
      </div>
      {sel && (
        <ProspeccaoModal p={sel} onClose={() => setSel(null)}
          onSave={async (updated) => { await upsertProspeccao(updated); onUpdate(updated); setSel(null); }}
          onRecuperar={async (p) => { await onRecuperar(p); setSel(null); }} />
      )}
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────
function DocsSection({ cardId }) {
  const [docs, setDocs] = useState([]);
  const [tipoSel, setTipoSel] = useState("proposta");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadDocs(cardId).then(setDocs); }, [cardId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const doc = await uploadDoc(cardId, tipoSel, file);
    if (doc) setDocs(prev => [doc, ...prev]);
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Excluir "${doc.nome_arquivo}"?`)) return;
    await deleteDoc(doc);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const tipoLabel = (id) => DOC_TIPOS.find(t => t.id === id)?.label || id;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documentos</p>
      <div className="flex gap-2 mb-3">
        <select value={tipoSel} onChange={e => setTipoSel(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
          {DOC_TIPOS.map(t => (
            <option key={t.id} value={t.id}>{t.label}{t.required ? " *" : ""}</option>
          ))}
        </select>
        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${uploading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-700 text-white"}`}>
          <Upload size={13} /> {uploading ? "Enviando…" : "Anexar"}
          <input type="file" accept=".pdf,.PDF,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum documento anexado.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-100">
              <Paperclip size={12} className="text-slate-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-blue-600 flex-shrink-0 w-24 truncate">{tipoLabel(doc.tipo)}</span>
              <span className="text-xs text-slate-500 flex-1 truncate">{doc.nome_arquivo}</span>
              <a href={docPublicUrl(doc.storage_path)} target="_blank" rel="noreferrer"
                className="text-slate-400 hover:text-blue-600 flex-shrink-0" title="Abrir">
                <Download size={13} />
              </a>
              <button onClick={() => handleDelete(doc)}
                className="text-slate-300 hover:text-red-500 flex-shrink-0" title="Excluir">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Chip({ days, status }) {
  if (status === "emitida" || days === null) return null;
  if (days < 0)   return <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Vencida</span>;
  if (days <= 5)  return <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">⚠ {days}d</span>;
  if (days <= 15) return <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{days}d</span>;
  return <span className="text-xs text-slate-400">{days}d</span>;
}

function CardTile({ card, onClick, onDragStart }) {
  const days = daysUntil(card.dataRenovacao);
  const urgent = days !== null && days <= 5 && card.status !== "emitida";
  const warn   = days !== null && days > 5 && days <= 15 && card.status !== "emitida";
  const pending = (card.followUps || []).filter(f => !f.feito).length;
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("cardId", card.id); e.dataTransfer.effectAllowed = "move"; if (onDragStart) onDragStart(card.id); }}
      onClick={() => onClick(card)}
      className={`bg-white rounded-xl p-2.5 mb-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors border border-slate-200 ${urgent ? "border-l-4 border-l-red-500" : warn ? "border-l-4 border-l-yellow-400" : ""}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex justify-between items-start gap-1">
        <span className="font-semibold text-slate-800 text-sm leading-snug flex-1">{card.clienteNome}</span>
        {card.etiquetaSegfy && <Tag size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />}
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{card.tipoSeguro}{card.seguradora ? ` · ${card.seguradora}` : ""}</div>
      {card.veiculo && card.veiculo !== "—" && <div className="text-xs text-slate-400 truncate">{card.veiculo}</div>}
      {(card.etiquetaSituacao || card.etiquetaPagamento || card.etiquetaCanal) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <TagChip label={card.etiquetaSituacao}  corMap={SITUACAO_COR} />
          <TagChip label={card.etiquetaPagamento} corMap={PAGAMENTO_COR} />
          <TagChip label={card.etiquetaCanal}     corMap={CANAL_COR} />
        </div>
      )}
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-xs font-semibold text-emerald-600">{fmtBRL(card.valor)}</span>
        <Chip days={days} status={card.status} />
      </div>
      {pending > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
          <Bell size={9} /> {pending} pendente{pending > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function Column({ stage, cards, onCard, onAdd, onDrop }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragOver(true); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); const cardId = e.dataTransfer.getData("cardId"); if (cardId) onDrop(cardId, stage.id); };

  return (
    <div className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden" style={{ width: 256, boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}>
      <div className={`flex items-center justify-between px-3 py-2.5 ${stage.badge} text-white`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs uppercase tracking-wide">{stage.label}</span>
          {stage.optional && <span className="text-xs opacity-70 font-normal normal-case">específicos</span>}
        </div>
        <span className="text-xs font-bold bg-white bg-opacity-25 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{cards.length}</span>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 p-2 min-h-40 overflow-y-auto transition-colors ${isDragOver ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "bg-white"}`}
        style={{ maxHeight: "calc(100vh - 185px)" }}>
        {cards.map(c => <CardTile key={c.id} card={c} onClick={onCard} />)}
        <button onClick={() => onAdd(stage.id)} className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors mt-0.5">
          <Plus size={12} /> Adicionar card
        </button>
      </div>
    </div>
  );
}

function Modal({ card, onClose, onSave, onDelete, onArquivar, onDesarquivar, onNaoRenovada }) {
  const [d, setD] = useState({ followUps: [], historicoCiclos: [], ...card });
  const [fuText, setFuText] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [del, setDel] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const stageIdx = STAGES.findIndex(s => s.id === d.status);

  const addFu = () => {
    if (!fuText.trim()) return;
    set("followUps", [...(d.followUps || []), { id: genId(), texto: fuText, data: fuDate, feito: false }]);
    setFuText(""); setFuDate("");
  };
  const toggleFu = (id) => set("followUps", d.followUps.map(f => f.id === id ? { ...f, feito: !f.feito } : f));

  const handleSave = async () => {
    setSaving(true);
    await onSave(d);
    setSaving(false);
  };

  const handleDesarquivarModal = async () => {
    if (!window.confirm("Desarquivar este card?\n\nEle voltará para Cotações e Leads.")) return;
    setSaving(true);
    await onDesarquivar({ ...d, arquivado: false, arquivadoEm: null, status: "cotacoes" });
    setSaving(false);
  };

  const handleNaoRenovadaModal = async () => {
    if (!window.confirm("Marcar como Não Renovada?\n\nO card será arquivado e uma prospecção será criada automaticamente para acompanhamento futuro.")) return;
    setSaving(true);
    await onNaoRenovada({ ...d, etiquetaSituacao: "Não Renovada" });
    setSaving(false);
  };

  const handleArquivar = async () => {
    if (!window.confirm("Confirmar envio ao cliente e arquivar este card?\n\nEle sairá do pipeline e será reativado automaticamente 30 dias antes do próximo vencimento.")) return;
    const ciclo = {
      data_renovacao: d.dataRenovacao,
      seguradora:     d.seguradora,
      valor:          d.valor,
      proposta:       d.proposta,
      apolice:        d.apolice,
      situacao:       d.etiquetaSituacao,
      arquivado_em:   new Date().toISOString(),
    };
    const historico = [...(d.historicoCiclos || []), ciclo];
    setSaving(true);
    await onArquivar({ ...d, historicoCiclos: historico, arquivado: true, arquivadoEm: new Date().toISOString() });
    setSaving(false);
  };

  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{d.clienteNome || "Novo Cliente"}</h2>
            {d.arquivado ? (
              <span className="text-xs font-semibold bg-amber-500 text-white px-2.5 py-0.5 rounded-full mt-1 inline-flex items-center gap-1">
                <Archive size={10} /> Arquivado
              </span>
            ) : (
              <span className={`text-xs font-semibold ${STAGES[stageIdx]?.badge || "bg-slate-500"} text-white px-2.5 py-0.5 rounded-full mt-1 inline-block`}>
                {STAGES[stageIdx]?.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div className="flex gap-2 flex-wrap">
            {stageIdx > 0 && (
              <button onClick={() => set("status", STAGES[stageIdx - 1].id)}
                className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
                <ChevronLeft size={12} /> {STAGES[stageIdx - 1].short}
              </button>
            )}
            {stageIdx < STAGES.length - 1 && (
              <button onClick={() => set("status", STAGES[stageIdx + 1].id)}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg">
                Mover → {STAGES[stageIdx + 1].short} <ChevronRight size={12} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Nome do Cliente *</label>
              <input className={inp} value={d.clienteNome || ""} onChange={e => set("clienteNome", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>CPF / CNPJ</label>
              <input className={inp} value={d.cpfCnpj || ""} onChange={e => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={lbl}>Telefone / WhatsApp</label>
              <input className={inp} value={d.telefone || ""} onChange={e => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input className={inp} value={d.email || ""} onChange={e => set("email", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Responsável</label>
              <input className={inp} value={d.responsavel || ""} onChange={e => set("responsavel", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Produto</label>
              <select className={inp} value={d.tipoSeguro || ""} onChange={e => set("tipoSeguro", e.target.value)}>
                <option value="">Selecione</option>
                {["ACIDENTES PESSOAIS","AUTOMÓVEL","AUXÍLIO FUNERAL","BIKE","CAPITALIZAÇÃO",
                  "CONDOMÍNIO","CONSÓRCIO","DENTAL","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS",
                  "FIANÇA LOCATÍCIA","PET","PREVIDÊNCIA","RC OBRAS","RC PROFISSIONAL",
                  "RESIDENCIAL","RISCO DE ENGENHARIA","RURAL","SAÚDE","SEGURO EVENTO",
                  "SEGURO VIAGEM","TRANSPORTES","VIDA EM GRUPO","VIDA INDIVIDUAL"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Seguradora</label>
              <select className={inp} value={d.seguradora || ""} onChange={e => set("seguradora", e.target.value)}>
                <option value="">Selecione</option>
                {["AKAD SEGUROS","ALFA SEGURADORA","ALIRO","ALLIANZ","AMERICAN LIFE","AMIL","AXA",
                  "AZUL SEGUROS","BB CONSORCIOS","BRADESCO AUTO/RE","BRADESCO SAÚDE","CAPEMISA",
                  "CENTAURO","CHUBB","DARWIN SEGUROS","ESSOR SEGUROS","EZZE SEGUROS","HDI SEGUROS",
                  "ICATU SEGUROS","ITAU CONSORCIOS","ITAU SEGUROS","JUNTO SEGUROS","MAPFRE",
                  "MEDSENIOR","METLIFE","MITSUI SUMITOMO","MONGERAL AEGON","OMINT",
                  "PLATINUM BENEFICIOS","PORTO CONSORCIO","PORTO SEGURO","PORTO SEGURO SAUDE",
                  "PRUDENTIAL","QUALLITY SAÚDE","SUHAI SEGUROS","SUL AMÉRICA","SURA",
                  "TOKIO MARINE","UNIMED NACIONAL","UNIMED SEGUROS SAUDE","YELUM SEGUROS",
                  "ZURICH"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Situação</label>
              <select className={inp} value={d.etiquetaSituacao || ""} onChange={e => set("etiquetaSituacao", e.target.value)}>
                <option value="">Selecione</option>
                {SITUACOES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Pagamento</label>
              <select className={inp} value={d.etiquetaPagamento || ""} onChange={e => set("etiquetaPagamento", e.target.value)}>
                <option value="">Selecione</option>
                {PAGAMENTOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Canal / Origem</label>
              <select className={inp} value={d.etiquetaCanal || ""} onChange={e => set("etiquetaCanal", e.target.value)}>
                <option value="">Selecione</option>
                {CANAIS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Veículo / Bem Segurado</label>
              <input className={inp} placeholder="Placa / Modelo / Endereço / Descrição" value={d.veiculo || ""} onChange={e => set("veiculo", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Data de Renovação</label>
              <input type="date" className={inp} value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Prêmio (R$)</label>
              <input type="number" className={inp} value={d.valor || ""} onChange={e => set("valor", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Nº Proposta</label>
              <input className={inp} value={d.proposta || ""} onChange={e => set("proposta", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Nº Apólice</label>
              <input className={inp} value={d.apolice || ""} onChange={e => set("apolice", e.target.value)} />
            </div>
          </div>

          {d.tipoSeguro === "AUTOMÓVEL" && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">🚗 Dados do Automóvel</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Nome do Segurado</label>
                  <input className={inp} placeholder="Titular do contrato" value={d.autoNomeSegurado || ""} onChange={e => set("autoNomeSegurado", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Classe de Bônus</label>
                  <input type="number" min="0" max="10" className={inp} placeholder="0 a 10" value={d.autoClasseBonus ?? ""} onChange={e => set("autoClasseBonus", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Condutor Principal</label>
                  <input className={inp} placeholder="Nome do condutor" value={d.autoCondutor || ""} onChange={e => set("autoCondutor", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>
                    Data de Nascimento
                    {d.autoDataNasc && (() => {
                      const anos = Math.floor((new Date() - new Date(d.autoDataNasc + "T12:00:00")) / (365.25 * 86400000));
                      return <span className="ml-2 text-blue-600 font-bold normal-case">{anos} anos</span>;
                    })()}
                  </label>
                  <input type="date" className={inp} value={d.autoDataNasc || ""} onChange={e => set("autoDataNasc", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Sexo</label>
                  <select className={inp} value={d.autoSexo || ""} onChange={e => set("autoSexo", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Masculino</option>
                    <option>Feminino</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estado Civil</label>
                  <select className={inp} value={d.autoEstadoCivil || ""} onChange={e => set("autoEstadoCivil", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Solteiro(a)</option>
                    <option>Casado(a)</option>
                    <option>Divorciado(a)</option>
                    <option>Viúvo(a)</option>
                    <option>União Estável</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Placa</label>
                  <input className={inp} placeholder="AAA-0000" value={d.autoPlaca || ""} onChange={e => set("autoPlaca", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className={lbl}>CEP de Pernoite</label>
                  <input className={inp} placeholder="00000-000" value={d.autoCepPernoite || ""}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      set("autoCepPernoite", v.length > 5 ? v.replace(/(\d{5})(\d{1,3})/, "$1-$2") : v);
                    }} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Modelo do Veículo</label>
                  <input className={inp} placeholder="Ex: Honda HR-V EX" value={d.autoModelo || ""} onChange={e => set("autoModelo", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Ano Fabricação</label>
                  <input type="number" className={inp} placeholder="2022" value={d.autoAnoFab || ""} onChange={e => set("autoAnoFab", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Ano Modelo</label>
                  <input type="number" className={inp} placeholder="2023" value={d.autoAnoMod || ""} onChange={e => set("autoAnoMod", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Chassi <span className="font-normal normal-case text-slate-400">(opcional)</span></label>
                  <input className={inp} placeholder="9BWZZZ377VT004251" value={d.autoChassi || ""} onChange={e => set("autoChassi", e.target.value.toUpperCase())} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                      checked={!!d.autoMenorResidente} onChange={e => set("autoMenorResidente", e.target.checked)} />
                    Menor residente no domicílio
                  </label>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" checked={!!d.etiquetaSegfy} onChange={e => set("etiquetaSegfy", e.target.checked)} />
            <Tag size={14} className="text-blue-500" /> Marcado como enviado ao Segfy
          </label>

          <div>
            <label className={lbl}>Anotações / Histórico</label>
            <textarea className={`${inp} resize-none`} rows={3} value={d.anotacoes || ""} onChange={e => set("anotacoes", e.target.value)}
              placeholder="Alterações de perfil, histórico de contato, observações..." />
          </div>

          <div>
            <label className={lbl}>Follow-ups</label>
            <div className="mt-2 space-y-2">
              {(d.followUps || []).map(f => (
                <div key={f.id} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${f.feito ? "bg-slate-50 opacity-60" : "bg-amber-50 border border-amber-200"}`}>
                  <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0" checked={f.feito} onChange={() => toggleFu(f.id)} />
                  <div className="flex-1">
                    <div className={f.feito ? "line-through text-slate-400" : "text-slate-700"}>{f.texto}</div>
                    {f.data && <div className="text-xs text-slate-400 mt-0.5">{fmt(f.data)}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Novo follow-up..." value={fuText} onChange={e => setFuText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFu()} />
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-36"
                value={fuDate} onChange={e => setFuDate(e.target.value)} />
              <button onClick={addFu} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg"><Plus size={16} /></button>
            </div>
          </div>

          <DocsSection cardId={card.id} />

          {(d.historicoCiclos || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Histórico de Renovações
              </p>
              <div className="space-y-2">
                {[...(d.historicoCiclos || [])].reverse().map((c, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-700">{c.seguradora || "—"}</span>
                      <span className="text-emerald-600 font-semibold">{fmtBRL(c.valor)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      <div>Vencimento: {fmt(c.data_renovacao)} · Situação: {c.situacao || "—"}</div>
                      <div>Proposta: {c.proposta || "—"} · Apólice: {c.apolice || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0">
          {!del ? (
            <div className="flex items-center gap-3">
              {d.arquivado ? (
                <button onClick={handleDesarquivarModal} disabled={saving}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                  <Archive size={13} /> Desarquivar
                </button>
              ) : (
                <>
                  {d.status === "emitida" && (
                    <button onClick={handleArquivar} disabled={saving}
                      className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                      <Archive size={13} /> Arquivar
                    </button>
                  )}
                  <button onClick={handleNaoRenovadaModal} disabled={saving}
                    className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                    <Ban size={13} /> {d.etiquetaSituacao === "Não Renovada" ? "Confirmar Não Renovada" : "Não Renovada"}
                  </button>
                </>
              )}
              <button onClick={() => setDel(true)} className="text-sm text-red-400 hover:text-red-600">Excluir card</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm text-red-600">Confirmar exclusão?</span>
              <button onClick={() => onDelete(card.id)} className="text-sm font-bold text-red-600 hover:underline">Sim</button>
              <button onClick={() => setDel(false)} className="text-sm text-slate-500 hover:underline">Não</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddModal({ initialStage, onClose, onAdd }) {
  const [d, setD] = useState({ status: initialStage, tipoSeguro: "AUTOMÓVEL", followUps: [] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  const handleCreate = async () => {
    if (!d.clienteNome?.trim()) return;
    setSaving(true);
    await onAdd({ ...d, id: genId(), criadoEm: new Date().toISOString() });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-5 border-b">
          <h2 className="text-lg font-bold text-slate-900">Novo Card de Renovação</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={lbl}>Nome do Cliente *</label>
            <input autoFocus className={inp} value={d.clienteNome || ""} onChange={e => set("clienteNome", e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>CPF / CNPJ</label>
              <input className={inp} value={d.cpfCnpj || ""} onChange={e => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input className={inp} value={d.telefone || ""} onChange={e => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={lbl}>Produto</label>
              <select className={inp} value={d.tipoSeguro} onChange={e => set("tipoSeguro", e.target.value)}>
                {["ACIDENTES PESSOAIS","AUTOMÓVEL","AUXÍLIO FUNERAL","BIKE","CAPITALIZAÇÃO",
                  "CONDOMÍNIO","CONSÓRCIO","DENTAL","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS",
                  "FIANÇA LOCATÍCIA","PET","PREVIDÊNCIA","RC OBRAS","RC PROFISSIONAL",
                  "RESIDENCIAL","RISCO DE ENGENHARIA","RURAL","SAÚDE","SEGURO EVENTO",
                  "SEGURO VIAGEM","TRANSPORTES","VIDA EM GRUPO","VIDA INDIVIDUAL"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Situação</label>
              <select className={inp} value={d.etiquetaSituacao || ""} onChange={e => set("etiquetaSituacao", e.target.value)}>
                <option value="">Selecione</option>
                {SITUACOES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Seguradora</label>
              <select className={inp} value={d.seguradora || ""} onChange={e => set("seguradora", e.target.value)}>
                <option value="">Selecione</option>
                {["AKAD SEGUROS","ALFA SEGURADORA","ALIRO","ALLIANZ","AMERICAN LIFE","AMIL","AXA",
                  "AZUL SEGUROS","BB CONSORCIOS","BRADESCO AUTO/RE","BRADESCO SAÚDE","CAPEMISA",
                  "CENTAURO","CHUBB","DARWIN SEGUROS","ESSOR SEGUROS","EZZE SEGUROS","HDI SEGUROS",
                  "ICATU SEGUROS","ITAU CONSORCIOS","ITAU SEGUROS","JUNTO SEGUROS","MAPFRE",
                  "MEDSENIOR","METLIFE","MITSUI SUMITOMO","MONGERAL AEGON","OMINT",
                  "PLATINUM BENEFICIOS","PORTO CONSORCIO","PORTO SEGURO","PORTO SEGURO SAUDE",
                  "PRUDENTIAL","QUALLITY SAÚDE","SUHAI SEGUROS","SUL AMÉRICA","SURA",
                  "TOKIO MARINE","UNIMED NACIONAL","UNIMED SEGUROS SAUDE","YELUM SEGUROS",
                  "ZURICH"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Data de Renovação</label>
              <input type="date" className={inp} value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Prêmio (R$)</label>
              <input type="number" className={inp} value={d.valor || ""} onChange={e => set("valor", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>Veículo / Bem Segurado</label>
            <input className={inp} placeholder="Placa / Modelo / Endereço" value={d.veiculo || ""} onChange={e => set("veiculo", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Canal / Origem</label>
              <select className={inp} value={d.etiquetaCanal || ""} onChange={e => set("etiquetaCanal", e.target.value)}>
                <option value="">Selecione</option>
                {CANAIS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Etapa Inicial</label>
              <select className={inp} value={d.status} onChange={e => set("status", e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
            <Plus size={14} /> {saving ? "Salvando..." : "Criar Card"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App principal ─────────────────────────────────────────────
export default function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addStage, setAddStage] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [view, setView] = useState("pipeline");
  const [prospeccoes, setProspeccoes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

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

  // Fechar dropdown ao clicar fora
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

  const handleAdd = async (card) => {
    await upsertCard(card);
    setCards(prev => [card, ...prev]);
  };

  const handleDrop = async (cardId, newStatus) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;
    const updated = { ...card, status: newStatus };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    await upsertCard(updated);
  };

  const handleSave = async (updated) => {
    await upsertCard(updated);
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(null);
  };

  const handleDelete = async (id) => {
    await deleteCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  };

  const handleArquivar = async (card) => {
    await upsertCard(card);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleDesarquivar = async (card) => {
    await upsertCard(card);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleNaoRenovada = async (card) => {
    const updated = { ...card, etiquetaSituacao: "Não Renovada", arquivado: true, arquivadoEm: new Date().toISOString() };
    await upsertCard(updated);
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

  const visible = cards.filter(c => {
    const ms = !search || c.clienteNome?.toLowerCase().includes(search.toLowerCase()) || (c.cpfCnpj || "").includes(search);
    const mm = !filterMonth || (c.dataRenovacao || "").startsWith(filterMonth);
    return ms && mm;
  });

  const urgentes = cards.filter(c => { const d = daysUntil(c.dataRenovacao); return d !== null && d <= 7 && c.status !== "emitida"; }).length;

  const months = Array.from({ length: 8 }, (_, i) => {
    const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() + i - 1);
    return { val: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`, label: dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <Shield size={40} className="text-slate-300 mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400 text-sm">Carregando dados...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#F1F2F4" }}>
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield size={20} className="text-amber-400" />
          <span className="font-bold text-base tracking-tight">CRM Renovações</span>
          <span className="text-slate-500 text-xs ml-1">Simples Assim</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setView("pipeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "pipeline" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Shield size={12} /> Renovações
            </button>
            <button onClick={() => setView("prospeccoes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "prospeccoes" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Users size={12} /> Prospecções
            </button>
          </div>
          {urgentes > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Bell size={11} /> {urgentes} urgente{urgentes !== 1 ? "s" : ""}
            </div>
          )}
          <div className="text-slate-400 text-xs">{cards.length} cards · {cards.filter(c => c.status === "emitida").length} emitidas</div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
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
        <Filter size={13} className="text-slate-400" />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-600"
          value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">Todos os meses</option>
          {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>
        <button onClick={() => setMostrarArquivados(prev => !prev)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${mostrarArquivados ? "bg-amber-100 border-amber-400 text-amber-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
          <Archive size={13} /> {mostrarArquivados ? "Ver Pipeline" : "Arquivados"}
        </button>
        <button onClick={() => setAddStage("cotacoes")}
          className="ml-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={15} /> Novo Card
        </button>
      </div>

      {view === "pipeline" ? (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2.5 p-4 h-full" style={{ minWidth: "fit-content" }}>
            {STAGES.map(s => (
              <Column key={s.id} stage={s}
                cards={visible.filter(c => c.status === s.id)}
                onCard={setSelected} onAdd={setAddStage} onDrop={handleDrop} />
            ))}
          </div>
        </div>
      ) : (
        <ProspeccoesView prospeccoes={prospeccoes} onUpdate={handleProspeccaoUpdate} onRecuperar={handleRecuperar} />
      )}

      {selected && <Modal card={selected} onClose={() => setSelected(null)} onSave={handleSave} onDelete={handleDelete} onArquivar={handleArquivar} onDesarquivar={handleDesarquivar} onNaoRenovada={handleNaoRenovada} />}
      {addStage && <AddModal initialStage={addStage} onClose={() => setAddStage(null)} onAdd={handleAdd} />}
    </div>
  );
}
