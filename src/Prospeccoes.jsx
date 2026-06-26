import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { X, Save, RotateCcw } from "lucide-react";
import { PROSP_STAGES } from "./constants";
import { fmt, fmtBRL } from "./utils";
import { upsertProspeccao } from "./data";

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
            {d.autoDataNasc && <div><span className="text-xs text-slate-400">Data de nascimento</span><div className="font-semibold text-slate-700">{new Date(d.autoDataNasc + "T12:00:00").toLocaleDateString("pt-BR")}</div></div>}
            {d.endereco && <div className="col-span-2"><span className="text-xs text-slate-400">Endereço</span><div className="font-semibold text-slate-700">{d.endereco}</div></div>}
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

export function AniversariantesView({ onVerCliente }) {
  const [modo, setModo] = useState("hoje");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const hoje = new Date();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");

  const carregarAniversariantes = async (m) => {
    setLoading(true);
    const { data, error } = await supabase.from("clientes").select("*").not("data_nascimento", "is", null);
    if (error) { setLoading(false); return; }

    const hoje2 = new Date();
    const filtrados = (data || []).filter(c => {
      if (!c.data_nascimento) return false;
      const [, cMm, cDd] = c.data_nascimento.split("-");
      const anivEsteAno = new Date(hoje2.getFullYear(), Number(cMm) - 1, Number(cDd));
      if (m === "hoje") return cMm === mm && cDd === dd;
      const diffDias = Math.ceil((anivEsteAno - hoje2) / 86400000);
      const limite = m === "15" ? 15 : 30;
      return diffDias >= 0 && diffDias <= limite;
    });

    filtrados.sort((a, b) => {
      const [, am, ad] = a.data_nascimento.split("-");
      const [, bm, bd] = b.data_nascimento.split("-");
      return (Number(am) * 100 + Number(ad)) - (Number(bm) * 100 + Number(bd));
    });

    setClientes(filtrados);
    setLoading(false);
  };

  useEffect(() => { carregarAniversariantes(modo); }, [modo]);

  const fmtData = (d) => {
    if (!d) return "";
    const [, m2, dd2] = d.split("-");
    return `${dd2}/${m2}`;
  };

  const calcIdade = (d) => {
    if (!d) return "";
    const [y] = d.split("-");
    return new Date().getFullYear() - Number(y);
  };

  const msgWhatsApp = (c) =>
    encodeURIComponent(`Olá ${(c.nome || "").split(" ")[0]}, tudo bem? 🎂 A equipe da Simples Assim deseja um feliz aniversário! Que este novo ano seja repleto de realizações. Um abraço!`);

  const msgEmail = (c) =>
    encodeURIComponent(`Feliz Aniversário, ${(c.nome || "").split(" ")[0]}! 🎉 A equipe Simples Assim deseja um dia muito especial e um novo ano repleto de conquistas. Um abraço!`);

  const visiveis = clientes.filter(c =>
    !busca || c.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const btnModo = (v, label) => (
    <button key={v} onClick={() => setModo(v)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
        modo === v ? "bg-amber-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F1F2F4" }}>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">🎂 Aniversariantes</h2>
            <p className="text-xs text-slate-400 mt-0.5">{visiveis.length} cliente{visiveis.length !== 1 ? "s" : ""} encontrado{visiveis.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[["hoje","Hoje"], ["15","Próximos 15 dias"], ["30","Próximos 30 dias"]].map(([v, l]) => btnModo(v, l))}
          </div>
        </div>

        {/* Busca */}
        <div className="px-4 py-3 border-b border-slate-100">
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="Buscar por nome..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : visiveis.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum aniversariante {modo === "hoje" ? "hoje" : `nos próximos ${modo} dias`}.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {visiveis.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {(c.nome || "?")[0]}
                </div>

                {/* Dados */}
                <div className="flex-1 min-w-0">
                  <button onClick={() => onVerCliente && onVerCliente(c.id)}
                    className="font-semibold text-slate-800 text-sm hover:text-blue-600 text-left truncate block">
                    {c.nome}
                  </button>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.data_nascimento && (
                      <span className="text-xs text-amber-600 font-semibold">
                        🎂 {fmtData(c.data_nascimento)} · {calcIdade(c.data_nascimento)} anos
                      </span>
                    )}
                    {c.email && <span className="text-xs text-slate-400 truncate">{c.email}</span>}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(c.whatsapp || c.telefone) && (
                    <a href={`https://wa.me/55${(c.whatsapp || c.telefone).replace(/\D/g, "")}?text=${msgWhatsApp(c)}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.527 5.847L.057 23.886a.5.5 0 0 0 .612.612l6.101-1.474A11.949 11.949 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.98 0-3.83-.574-5.388-1.563l-.385-.232-3.995.965.982-3.918-.252-.4A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                      </svg>
                      WhatsApp
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}?subject=Feliz%20Aniversário!%20🎂&body=${msgEmail(c)}`}
                      className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      ✉️ E-mail
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProspeccoesView({ prospeccoes, onUpdate, onRecuperar }) {
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
                {items.length === 0 && <p className="text-xs text-slate-300 text-center mt-4">Nenhuma prospecção.</p>}
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
