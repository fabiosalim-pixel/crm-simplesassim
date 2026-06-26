import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { Shield, Plus, X, Search, Users } from "lucide-react";
import { CANAIS } from "./constants";
import { genId, maskCpfCnpj, maskPhone, maskMoeda, fmtBRL } from "./utils";
import { mapRow, searchClientes, findOrCreateCliente } from "./data";
import { ApoliceRow } from "./PipelineUI";

export function AddModal({ initialStage, onClose, onAdd }) {
  const [d, setD] = useState({ status: "cotacoes", tipoSeguro: "", followUps: [], dataRenovacao: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState({});
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [clienteVinculado, setClienteVinculado] = useState(null);
  const buscaRef = useRef(null);

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  // Debounce busca de clientes
  useEffect(() => {
    if (busca.length < 2) { setSugestoes([]); setBuscaAberta(false); return; }
    const t = setTimeout(() => {
      searchClientes(busca).then(res => { setSugestoes(res); setBuscaAberta(res.length > 0); });
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const h = e => { if (buscaRef.current && !buscaRef.current.contains(e.target)) setBuscaAberta(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selecionarCliente = (c) => {
    setD(p => ({ ...p, clienteId: c.id, clienteNome: c.nome, cpfCnpj: c.cpf_cnpj || p.cpfCnpj, telefone: c.telefone || p.telefone, email: c.email || p.email }));
    setClienteVinculado(c);
    setBusca("");
    setBuscaAberta(false);
  };

  const limparCliente = () => {
    setD(p => ({ ...p, clienteId: null, clienteNome: "", cpfCnpj: "", telefone: "", email: "" }));
    setClienteVinculado(null);
    setBusca("");
  };

  const handleCreate = async () => {
    const e = {};
    if (!d.clienteNome?.trim()) e.clienteNome = true;
    if (!d.cpfCnpj?.trim()) e.cpfCnpj = true;
    if (!d.telefone?.trim()) e.telefone = true;
    if (Object.keys(e).length) { setErrs(e); return; }
    setSaving(true);
    const clienteId = d.clienteId || await findOrCreateCliente({
      nome: d.clienteNome, cpfCnpj: d.cpfCnpj, telefone: d.telefone, email: d.email,
    });
    await onAdd({ ...d, id: genId(), clienteId, criadoEm: new Date().toISOString() });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-5 border-b">
          <h2 className="text-lg font-bold text-slate-900">Novo Atendimento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* ── Busca de cliente existente ─────────────────── */}
          <div ref={buscaRef} className="relative">
            <label className={lbl}>Buscar cliente existente</label>
            {clienteVinculado ? (
              <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg">
                <Users size={14} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-emerald-800 truncate">{clienteVinculado.nome}</span>
                  {clienteVinculado.cpf_cnpj && <span className="text-xs text-emerald-600 ml-2">{clienteVinculado.cpf_cnpj}</span>}
                </div>
                <button onClick={limparCliente} className="text-emerald-400 hover:text-emerald-700 flex-shrink-0" title="Desvincular"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="pl-8 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="Digite nome ou CPF/CNPJ..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    onFocus={() => sugestoes.length > 0 && setBuscaAberta(true)}
                  />
                </div>
                {buscaAberta && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                    {sugestoes.map(c => (
                      <button key={c.id} onClick={() => selecionarCliente(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 transition-colors flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 text-sm truncate">{c.nome}</div>
                          <div className="text-xs text-slate-400">{c.cpf_cnpj} · {c.tipo_pessoa}</div>
                        </div>
                      </button>
                    ))}
                    <div className="px-4 py-2 bg-slate-50 text-xs text-slate-400">
                      Não encontrou? Preencha os campos abaixo para criar novo cliente.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className={lbl}>Nome do cliente *</label>
            <input autoFocus className={`${inp} ${clienteVinculado ? "bg-slate-50 text-slate-500" : errs.clienteNome ? "border-red-400 ring-1 ring-red-300" : ""}`}
              value={d.clienteNome || ""} onChange={e => { set("clienteNome", e.target.value.toUpperCase()); setErrs(p => ({...p, clienteNome: false})); }}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              readOnly={!!clienteVinculado} />
            {errs.clienteNome && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>CPF / CNPJ *</label>
              <input className={`${inp} ${clienteVinculado ? "bg-slate-50 text-slate-500" : errs.cpfCnpj ? "border-red-400 ring-1 ring-red-300" : ""}`}
                value={d.cpfCnpj || ""} onChange={e => { set("cpfCnpj", maskCpfCnpj(e.target.value)); setErrs(p => ({...p, cpfCnpj: false})); }}
                placeholder="000.000.000-00" readOnly={!!clienteVinculado} />
              {errs.cpfCnpj && <p className="text-xs text-red-500 mt-1">Obrigatório</p>}
            </div>
            <div>
              <label className={lbl}>Telefone *</label>
              <input className={`${inp} ${clienteVinculado ? "bg-slate-50 text-slate-500" : errs.telefone ? "border-red-400 ring-1 ring-red-300" : ""}`}
                value={d.telefone || ""} onChange={e => { set("telefone", maskPhone(e.target.value)); setErrs(p => ({...p, telefone: false})); }}
                placeholder="(00) 00000-0000" readOnly={!!clienteVinculado} />
              {errs.telefone && <p className="text-xs text-red-500 mt-1">Obrigatório</p>}
            </div>
            <div>
              <label className={lbl}>Produto</label>
              <select className={inp} value={d.tipoSeguro} onChange={e => set("tipoSeguro", e.target.value)}>
                <option value="">Selecione</option>
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
                <option value="Seguro Novo">Seguro Novo</option>
                <option value="Renovação Congênere">Renovação Congênere</option>
                <option value="Renovação">Renovação</option>
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
              <label className={lbl}>Data de renovação</label>
              <input type="date" className={inp} value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Prêmio (R$)</label>
              <input inputMode="numeric" className={inp} value={d.valor || ""} onChange={e => set("valor", maskMoeda(e.target.value))} placeholder="0,00" />
            </div>
          </div>
          <div>
            <label className={lbl}>Veículo / Bem Segurado</label>
            <input className={inp} placeholder="Placa / Modelo / Endereço" value={d.veiculo || ""} onChange={e => set("veiculo", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Canal de origem</label>
              <select className={inp} value={d.etiquetaCanal || ""} onChange={e => set("etiquetaCanal", e.target.value)}>
                <option value="">Selecione</option>
                {CANAIS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Etapa inicial</label>
              <div className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">Cotações e Leads</div>
            </div>
          </div>
          {d.status === "boleto" && (
            <div>
              <label className={lbl}>📅 Data de vencimento</label>
              <input type="date" className={inp} value={d.dataAlerta || ""} onChange={e => set("dataAlerta", e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
            <Plus size={14} /> {saving ? "Salvando..." : "Criar card"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Perfil do cliente ─────────────────────────────────────────
export function ClienteModal({ clienteId, onClose, onAbrirCard }) {
  const [cliente, setCliente] = useState(null);
  const [apolices, setApolices] = useState([]);
  const [loadingC, setLoadingC] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingC(true);
      const [{ data: c }, { data: rows }] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", clienteId).single(),
        supabase.from("renovacoes").select("*").eq("cliente_id", clienteId).order("data_renovacao", { ascending: false }),
      ]);
      setCliente(c);
      setApolices((rows || []).map(mapRow));
      setLoadingC(false);
    }
    load();
  }, [clienteId]);

  if (loadingC) return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-slate-500 text-sm">Carregando...</div>
    </div>
  );

  const ativas = apolices.filter(a => !a.arquivado);
  const arquivadas = apolices.filter(a => a.arquivado);
  const emitidas = ativas.filter(a => a.status === "emitida");
  const totalPremio = ativas.reduce((sum, a) => sum + (Number(a.valor) || 0), 0);
  const taxaRenov = ativas.length > 0 ? Math.round(emitidas.length / ativas.length * 100) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>

        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{cliente?.nome}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cliente?.tipo_pessoa === "PJ" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                {cliente?.tipo_pessoa === "PF" ? "Pessoa Física" : cliente?.tipo_pessoa === "PJ" ? "Pessoa Jurídica" : "—"}
              </span>
            </div>
            <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-3">
              {cliente?.cpf_cnpj && <span>{cliente.cpf_cnpj}</span>}
              {cliente?.telefone && <span>{cliente.telefone}</span>}
              {cliente?.email && <span>{cliente.email}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b flex-shrink-0">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-slate-800">{ativas.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Apólices ativas</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-base font-bold text-emerald-700 leading-tight mt-0.5">{fmtBRL(totalPremio)}</div>
            <div className="text-xs text-slate-400 mt-0.5">Prêmio total</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{emitidas.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Emitidas</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-amber-700">{taxaRenov !== null ? `${taxaRenov}%` : "—"}</div>
            <div className="text-xs text-slate-400 mt-0.5">Taxa renovação</div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {apolices.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Nenhuma apólice encontrada.</p>
          )}
          {ativas.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ativas ({ativas.length})</p>
              <div className="space-y-2">
                {ativas.map(a => <ApoliceRow key={a.id} card={a} onClick={onAbrirCard} />)}
              </div>
            </div>
          )}
          {arquivadas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Histórico ({arquivadas.length})</p>
              <div className="space-y-2">
                {arquivadas.map(a => <ApoliceRow key={a.id} card={a} onClick={onAbrirCard} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) setErro("E-mail ou senha incorretos.");
  }

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Shield size={40} className="text-amber-400 mb-3" />
          <h1 className="text-white text-2xl font-bold tracking-tight">CRM Renovações</h1>
          <p className="text-slate-400 text-sm mt-1">Simples Assim Corretora</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-1.5">E-mail</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500"
              placeholder="seu@email.com.br"
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-1.5">Senha</label>
            <input
              type="password" required
              value={senha} onChange={e => setSenha(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500"
              placeholder="••••••••"
            />
          </div>
          {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold text-sm rounded-lg py-2.5 transition-colors mt-1">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
