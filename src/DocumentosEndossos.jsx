import { useState, useEffect } from "react";
import { Upload, Paperclip, Download, Trash2, RotateCcw, Plus, X } from "lucide-react";
import { DOC_TIPOS, MOTIVOS_CANCELAMENTO } from "./constants";
import { genId, fmt } from "./utils";
import { loadDocs, uploadDoc, deleteDoc, docPublicUrl } from "./data";

export function DocsSection({ cardId, onApoliceAnexada, onPropostaAnexada, onExtrairDados }) {
  const [docs, setDocs] = useState([]);
  const [tipoSel, setTipoSel] = useState("proposta");
  const [uploading, setUploading] = useState(false);
  const [extraindo, setExtraindo] = useState(null);

  const TIPOS_EXTRAIVEIS = ["proposta", "apolice", "apolice_endosso"];

  const handleExtrair = async (doc) => {
    setExtraindo(doc.id);
    try {
      const resp = await fetch(docPublicUrl(doc.storage_path));
      const blob = await resp.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      });
      const json = await res.json();
      if (json.success && onExtrairDados) {
        onExtrairDados(json.data, doc.tipo);
      } else {
        alert("Não foi possível extrair dados: " + (json.error || "resposta inválida"));
      }
    } catch (e) {
      alert("Erro ao extrair: " + e.message);
    }
    setExtraindo(null);
  };

  useEffect(() => { loadDocs(cardId).then(setDocs); }, [cardId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const doc = await uploadDoc(cardId, tipoSel, file);
    if (doc) {
      setDocs(prev => [doc, ...prev]);
      if (tipoSel === "apolice" && onApoliceAnexada) onApoliceAnexada();
      if (tipoSel === "proposta" && onPropostaAnexada) onPropostaAnexada();
    }
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
              {TIPOS_EXTRAIVEIS.includes(doc.tipo) && (
                <button onClick={() => handleExtrair(doc)} disabled={extraindo === doc.id}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex-shrink-0 disabled:opacity-50 whitespace-nowrap"
                  title="Extrair dados deste PDF via IA">
                  {extraindo === doc.id ? "⏳" : "⚡ Extrair"}
                </button>
              )}
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

export function EndossoSection({ endossos, onChange, onCancelar }) {
  const [form, setForm] = useState(null);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  const TIPOS_ENDOSSO = [
    { id: "substituicao_item",   label: "Substituição de veículo" },
    { id: "alteracao_endereco",  label: "Alteração de endereço/CEP" },
    { id: "alteracao_condutor",  label: "Alteração de condutor" },
    { id: "alteracao_financeira",label: "Ajuste financeiro (endosso)" },
    { id: "cancelamento",        label: "Cancelamento de apólice" },
  ];

  const tipoLabel = (id) => TIPOS_ENDOSSO.find(t => t.id === id)?.label || id;

  const handleSalvar = () => {
    if (!form?.tipo) return;
    if (form.tipo === "cancelamento") {
      if (!form.motivo) { alert("Selecione o motivo do cancelamento antes de confirmar."); return; }
      if (!window.confirm("Cancelar esta apólice?\n\nO card será arquivado como Cancelada. O histórico será preservado.")) return;
      onCancelar({ id: genId(), tipo: "cancelamento", motivo: form.motivo, data: form.data || new Date().toISOString().slice(0, 10) });
      setForm(null);
      return;
    }
    const novo = { id: genId(), ...form, data: form.data || new Date().toISOString().slice(0, 10) };
    onChange([...(endossos || []), novo]);
    setForm(null);
  };

  const renderCampos = () => {
    if (!form) return null;
    if (form.tipo === "substituicao_item") return (
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Nova placa</label><input className={inp} placeholder="ABC-1234" value={form.placaNova||""} onChange={e=>sf("placaNova",e.target.value)}/></div>
        <div><label className={lbl}>Novo chassi</label><input className={inp} value={form.chassiNovo||""} onChange={e=>sf("chassiNovo",e.target.value)}/></div>
        <div><label className={lbl}>Novo modelo</label><input className={inp} value={form.modeloNovo||""} onChange={e=>sf("modeloNovo",e.target.value)}/></div>
        <div><label className={lbl}>Ano fab/mod</label><input className={inp} placeholder="2024/2025" value={form.anoNovo||""} onChange={e=>sf("anoNovo",e.target.value)}/></div>
      </div>
    );
    if (form.tipo === "alteracao_endereco") return (
      <div><label className={lbl}>Novo CEP de risco</label><input className={inp} placeholder="00000-000" value={form.cepNovo||""} onChange={e=>sf("cepNovo",e.target.value)}/></div>
    );
    if (form.tipo === "alteracao_condutor") return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={lbl}>Nome do condutor</label><input className={inp} value={form.condutorNome||""} onChange={e=>sf("condutorNome",e.target.value)}/></div>
        <div><label className={lbl}>CPF</label><input className={inp} placeholder="000.000.000-00" value={form.condutorCpf||""} onChange={e=>sf("condutorCpf",e.target.value)}/></div>
        <div><label className={lbl}>Data de nascimento</label><input type="date" className={inp} value={form.condutorNascimento||""} onChange={e=>sf("condutorNascimento",e.target.value)}/></div>
      </div>
    );
    if (form.tipo === "cancelamento") return (
      <div className="space-y-3">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠️ Esta ação encerrará a apólice e arquivará o card como <strong>Cancelada</strong>. O histórico é sempre preservado.
        </p>
        <div>
          <label className={lbl}>Motivo do cancelamento *</label>
          <select className={inp} value={form.motivo || ""} onChange={e => sf("motivo", e.target.value)}>
            <option value="">Selecione...</option>
            {MOTIVOS_CANCELAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-600 rounded-xl mb-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide cursor-default">
          <RotateCcw size={13} /> Endossos
          {(endossos||[]).length > 0 && (
            <span className="bg-white text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">{(endossos||[]).length}</span>
          )}
        </label>
        <button onClick={() => setForm(form ? null : { tipo: "substituicao_item", data: new Date().toISOString().slice(0,10) })}
          className="flex items-center gap-1 text-xs text-white hover:text-indigo-200 font-semibold transition-colors">
          <Plus size={13} /> Gerar Endosso
        </button>
      </div>
      {form && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo de endosso *</label>
              <select className={inp} value={form.tipo||""} onChange={e=>setForm({ tipo: e.target.value, data: form.data||"" })}>
                {TIPOS_ENDOSSO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Data</label>
              <input type="date" className={inp} value={form.data||""} onChange={e=>sf("data",e.target.value)}/>
            </div>
          </div>
          {renderCampos()}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={()=>setForm(null)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSalvar}
              disabled={form.tipo === "cancelamento" && !form.motivo}
              className={`px-3 py-1.5 text-xs text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${form.tipo==="cancelamento" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
              {form.tipo==="cancelamento" ? "⚠️ Confirmar cancelamento" : "Salvar endosso"}
            </button>
          </div>
        </div>
      )}
      {(endossos||[]).length > 0 ? (
        <div className="space-y-1.5">
          {[...(endossos||[])].reverse().map(e => (
            <div key={e.id} className="flex items-start gap-2 px-2.5 py-2 bg-slate-50 rounded-lg border border-slate-100 group">
              <RotateCcw size={12} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-indigo-700">{tipoLabel(e.tipo)}</span>
                {e.data && <span className="text-xs text-slate-400 ml-2">{fmt(e.data)}</span>}
                {e.placaNova && <div className="text-xs text-slate-500 mt-0.5">Placa: {e.placaNova}{e.modeloNovo ? ` · ${e.modeloNovo}` : ""}</div>}
                {e.cepNovo && <div className="text-xs text-slate-500 mt-0.5">CEP novo: {e.cepNovo}</div>}
                {e.condutorNome && <div className="text-xs text-slate-500 mt-0.5">Condutor: {e.condutorNome}{e.condutorCpf ? ` · ${e.condutorCpf}` : ""}</div>}
              </div>
              <button onClick={() => onChange((endossos||[]).filter(x => x.id !== e.id))} title="Remover endosso"
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity flex-shrink-0 mt-0.5">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : !form && (
        <p className="text-xs text-slate-400">Nenhum endosso registrado.</p>
      )}
    </div>
  );
}
