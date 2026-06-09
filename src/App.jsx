import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Shield, Plus, X, ChevronRight, ChevronLeft, Bell, Search, Save, Tag, Filter, AlertTriangle } from "lucide-react";

const STAGES = [
  { id: "cotacoes",    label: "Cotações e Leads",        short: "Cotações",    badge: "bg-blue-600",    bg: "bg-blue-50",    border: "border-blue-300" },
  { id: "enviada",     label: "Enviada ao Cliente",       short: "Enviada",     badge: "bg-violet-600",  bg: "bg-violet-50",  border: "border-violet-300" },
  { id: "transmitida", label: "Proposta Transmitida",     short: "Transmitida", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-300" },
  { id: "vistoria",    label: "Vistoria / Pend. Emissão", short: "Vistoria",    badge: "bg-red-500",     bg: "bg-red-50",     border: "border-red-300",    optional: true },
  { id: "boleto",      label: "Boleto / Débito",          short: "Pagamento",   badge: "bg-yellow-600",  bg: "bg-yellow-50",  border: "border-yellow-300", optional: true },
  { id: "emitida",     label: "Apólice Emitida",          short: "Emitida",     badge: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-300" },
];

const genId = () => crypto.randomUUID();

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

// ── Supabase helpers ──────────────────────────────────────────
async function loadCards() {
  const { data, error } = await supabase
    .from("renovacoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) { console.error("Erro ao carregar:", error); return []; }
  return (data || []).map(r => ({
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
    etiquetaSegfy: r.etiqueta_segfy,
    anotacoes:     r.observacoes,
    followUps:     r.cotacoes || [],
    mesReferencia: r.mes_referencia,
  }));
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
    etiqueta_segfy:  card.etiquetaSegfy || false,
    observacoes:     card.anotacoes,
    cotacoes:        card.followUps || [],
    mes_referencia:  card.mesReferencia || new Date().toISOString().slice(0, 7),
    atualizado_em:   new Date().toISOString(),
  };
  const { error } = await supabase.from("renovacoes").upsert(row);
  if (error) console.error("Erro ao salvar:", error);
}

async function deleteCard(id) {
  const { error } = await supabase.from("renovacoes").delete().eq("id", id);
  if (error) console.error("Erro ao deletar:", error);
}

// ── Componentes ───────────────────────────────────────────────
function Chip({ days, status }) {
  if (status === "emitida" || days === null) return null;
  if (days < 0)   return <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Vencida</span>;
  if (days <= 5)  return <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">⚠ {days}d</span>;
  if (days <= 15) return <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{days}d</span>;
  return <span className="text-xs text-slate-400">{days}d</span>;
}

function CardTile({ card, onClick }) {
  const days = daysUntil(card.dataRenovacao);
  const urgent = days !== null && days <= 5 && card.status !== "emitida";
  const warn   = days !== null && days > 5 && days <= 15 && card.status !== "emitida";
  const pending = (card.followUps || []).filter(f => !f.feito).length;
  return (
    <div onClick={() => onClick(card)}
      className={`bg-white rounded-lg p-3 mb-2 shadow-sm cursor-pointer hover:shadow-md transition-all border-l-4 ${urgent ? "border-red-500" : warn ? "border-yellow-400" : "border-transparent"}`}>
      <div className="flex justify-between items-start gap-1">
        <span className="font-semibold text-slate-800 text-sm leading-snug flex-1">{card.clienteNome}</span>
        {card.etiquetaSegfy && <Tag size={11} className="text-blue-500 mt-0.5 flex-shrink-0" />}
      </div>
      <div className="text-xs text-slate-500 mt-1">{card.tipoSeguro} · {card.seguradora}</div>
      {card.veiculo && card.veiculo !== "—" && <div className="text-xs text-slate-400 mt-0.5 truncate">{card.veiculo}</div>}
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs font-semibold text-emerald-700">{fmtBRL(card.valor)}</span>
        <Chip days={days} status={card.status} />
      </div>
      {pending > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
          <Bell size={10} /> {pending} follow-up{pending > 1 ? "s" : ""} pendente{pending > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function Column({ stage, cards, onCard, onAdd }) {
  return (
    <div className="flex-shrink-0 flex flex-col" style={{ width: 210 }}>
      <div className={`rounded-t-lg px-3 py-2.5 ${stage.badge} text-white`}>
        <div className="flex justify-between items-center">
          <span className="font-bold text-xs uppercase tracking-wider">{stage.short}</span>
          <span className="text-xs font-bold bg-white bg-opacity-25 rounded-full w-5 h-5 flex items-center justify-center">{cards.length}</span>
        </div>
        {stage.optional && <p className="text-xs text-white opacity-70 mt-0.5">casos específicos</p>}
      </div>
      <div className={`${stage.bg} flex-1 rounded-b-lg p-2 border ${stage.border} border-t-0 min-h-40 overflow-y-auto`} style={{ maxHeight: "calc(100vh - 200px)" }}>
        {cards.map(c => <CardTile key={c.id} card={c} onClick={onCard} />)}
        <button onClick={() => onAdd(stage.id)} className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 py-1 px-1 rounded hover:bg-white transition-colors mt-1">
          <Plus size={12} /> Adicionar
        </button>
      </div>
    </div>
  );
}

function Modal({ card, onClose, onSave, onDelete }) {
  const [d, setD] = useState({ followUps: [], ...card });
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

  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{d.clienteNome || "Novo Cliente"}</h2>
            <span className={`text-xs font-semibold ${STAGES[stageIdx]?.badge || "bg-slate-500"} text-white px-2.5 py-0.5 rounded-full mt-1 inline-block`}>
              {STAGES[stageIdx]?.label}
            </span>
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
              <input className={inp} value={d.cpfCnpj || ""} onChange={e => set("cpfCnpj", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Telefone / WhatsApp</label>
              <input className={inp} value={d.telefone || ""} onChange={e => set("telefone", e.target.value)} />
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
              <label className={lbl}>Tipo de Seguro</label>
              <select className={inp} value={d.tipoSeguro || ""} onChange={e => set("tipoSeguro", e.target.value)}>
                <option value="">Selecione</option>
                {["AUTOMÓVEL","BIKE","CONDOMÍNIO","CONSÓRCIO","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS",
                  "FIANÇA LOCATÍCIA","DENTAL","RESIDENCIAL","PET","PREVIDÊNCIA","CAPITALIZAÇÃO",
                  "RC PROFISSIONAL","RISCO DE ENGENHARIA","RURAL","SAÚDE","SEGURO EVENTO",
                  "SEGURO VIAGEM","TRANSPORTES","VIDA INDIVIDUAL","VIDA EM GRUPO",
                  "ACIDENTES PESSOAIS","AUXÍLIO FUNERAL","RC OBRAS"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Seguradora</label>
              <select className={inp} value={d.seguradora || ""} onChange={e => set("seguradora", e.target.value)}>
                <option value="">Selecione</option>
                {["AKAD SEGUROS","ALFA SEGURADORA","ALIRO","ALLIANZ","AMERICAN LIFE","AMIL","AXA",
                  "AZUL SEGUROS","BRADESCO AUTO/RE","BRADESCO SAÚDE","CAPEMISA","CENTAURO",
                  "CHUBB","DARWIN SEGUROS","ESSOR SEGUROS","EZZE SEGUROS","HDI SEGUROS",
                  "ICATU SEGUROS","ITAU SEGUROS","JUNTO SEGUROS","MAPFRE","MEDSENIOR",
                  "METLIFE","MITSUI SUMITOMO","MONGERAL AEGON","OMINT","PLATINUM BENEFICIOS",
                  "PORTO SEGURO","PORTO SEGURO SAUDE","PORTO CONSORCIO","PRUDENTIAL",
                  "QUALLITY SAÚDE","BB CONSORCIOS","ITAU CONSORCIOS","SUHAI SEGUROS",
                  "SUL AMÉRICA","SURA","TOKIO MARINE","UNIMED NACIONAL","UNIMED SEGUROS SAUDE",
                  "YELUM SEGUROS","ZURICH"].map(s => <option key={s}>{s}</option>)}
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
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0">
          {!del ? (
            <button onClick={() => setDel(true)} className="text-sm text-red-400 hover:text-red-600">Excluir card</button>
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
              <input className={inp} value={d.cpfCnpj || ""} onChange={e => set("cpfCnpj", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input className={inp} value={d.telefone || ""} onChange={e => set("telefone", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Tipo de Seguro</label>
              <select className={inp} value={d.tipoSeguro} onChange={e => set("tipoSeguro", e.target.value)}>
                {["AUTOMÓVEL","BIKE","CONDOMÍNIO","CONSÓRCIO","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS",
                  "FIANÇA LOCATÍCIA","DENTAL","RESIDENCIAL","PET","PREVIDÊNCIA","CAPITALIZAÇÃO",
                  "RC PROFISSIONAL","RISCO DE ENGENHARIA","RURAL","SAÚDE","SEGURO EVENTO",
                  "SEGURO VIAGEM","TRANSPORTES","VIDA INDIVIDUAL","VIDA EM GRUPO",
                  "ACIDENTES PESSOAIS","AUXÍLIO FUNERAL","RC OBRAS"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Seguradora</label>
              <select className={inp} value={d.seguradora || ""} onChange={e => set("seguradora", e.target.value)}>
                <option value="">Selecione</option>
                {["AKAD SEGUROS","ALFA SEGURADORA","ALIRO","ALLIANZ","AMERICAN LIFE","AMIL","AXA",
                  "AZUL SEGUROS","BRADESCO AUTO/RE","BRADESCO SAÚDE","CAPEMISA","CENTAURO",
                  "CHUBB","DARWIN SEGUROS","ESSOR SEGUROS","EZZE SEGUROS","HDI SEGUROS",
                  "ICATU SEGUROS","ITAU SEGUROS","JUNTO SEGUROS","MAPFRE","MEDSENIOR",
                  "METLIFE","MITSUI SUMITOMO","MONGERAL AEGON","OMINT","PLATINUM BENEFICIOS",
                  "PORTO SEGURO","PORTO SEGURO SAUDE","PORTO CONSORCIO","PRUDENTIAL",
                  "QUALLITY SAÚDE","BB CONSORCIOS","ITAU CONSORCIOS","SUHAI SEGUROS",
                  "SUL AMÉRICA","SURA","TOKIO MARINE","UNIMED NACIONAL","UNIMED SEGUROS SAUDE",
                  "YELUM SEGUROS","ZURICH"].map(s => <option key={s}>{s}</option>)}
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
          <div>
            <label className={lbl}>Etapa Inicial</label>
            <select className={inp} value={d.status} onChange={e => set("status", e.target.value)}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
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

  useEffect(() => {
    loadCards().then(c => { setCards(c); setLoading(false); });
  }, []);

  const handleAdd = async (card) => {
    await upsertCard(card);
    setCards(prev => [card, ...prev]);
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
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield size={20} className="text-amber-400" />
          <span className="font-bold text-base tracking-tight">CRM Renovações</span>
          <span className="text-slate-500 text-xs ml-1">Simples Assim</span>
        </div>
        <div className="flex items-center gap-3">
          {urgentes > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Bell size={11} /> {urgentes} urgente{urgentes !== 1 ? "s" : ""}
            </div>
          )}
          <div className="text-slate-400 text-xs">{cards.length} cards · {cards.filter(c => c.status === "emitida").length} emitidas</div>
        </div>
      </header>

      <div className="bg-white border-b px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 w-52"
            placeholder="Cliente ou CPF/CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Filter size={13} className="text-slate-400" />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-600"
          value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">Todos os meses</option>
          {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>
        <button onClick={() => setAddStage("cotacoes")}
          className="ml-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={15} /> Novo Card
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: "fit-content" }}>
          {STAGES.map(s => (
            <Column key={s.id} stage={s}
              cards={visible.filter(c => c.status === s.id)}
              onCard={setSelected} onAdd={setAddStage} />
          ))}
        </div>
      </div>

      {selected && <Modal card={selected} onClose={() => setSelected(null)} onSave={handleSave} onDelete={handleDelete} />}
      {addStage && <AddModal initialStage={addStage} onClose={() => setAddStage(null)} onAdd={handleAdd} />}
    </div>
  );
}
