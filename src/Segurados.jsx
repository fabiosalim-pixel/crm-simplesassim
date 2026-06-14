import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import {
  Search, ChevronLeft, User, Building2, Phone, MessageCircle, Mail,
  MapPin, Shield, Calendar, Briefcase, FileText, Pencil, Check, X, Target,
  Cake, AlertTriangle, UserMinus, Zap
} from "lucide-react";

const fmtBRL = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const fmtFone = (v) => {
  const d = (v || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || null;
};

const hojeStr = () => new Date().toISOString().slice(0, 10);

const ehVigente = (a) => a.status_pipeline === "emitida" && a.data_renovacao >= hojeStr();

const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

const calcIdade = (d) => {
  if (!d) return null;
  const n = new Date(d + "T00:00:00");
  const h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
  return i;
};

const montaEndereco = (c) =>
  [
    [c.logradouro, c.numero].filter(Boolean).join(", "),
    c.complemento,
    c.bairro,
    [c.cidade, c.estado].filter(Boolean).join("/"),
    c.cep && `CEP ${c.cep}`,
  ]
    .filter(Boolean)
    .join(" · ");

const CORES_GATILHO = {
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  red:    "bg-red-50 text-red-700 border-red-200",
  amber:  "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  slate:  "bg-slate-50 text-slate-600 border-slate-200",
};

function calcGatilhos(c, aps) {
  const out = [];
  const hoje0 = new Date(hojeStr() + "T00:00:00");

  // Aniversário no mês
  if (c.data_nascimento) {
    const nasc = new Date(c.data_nascimento + "T00:00:00");
    if (nasc.getMonth() === hoje0.getMonth()) {
      const dd = String(nasc.getDate()).padStart(2, "0");
      const mm = String(nasc.getMonth() + 1).padStart(2, "0");
      out.push({ cor: "violet", icon: Cake, texto: `Aniversário em ${dd}/${mm}` });
    }
  }

  // Apólice vigente OU renovação em andamento vencendo em ≤30 dias
  const vig = aps.filter(ehVigente);
  const emAberto = aps.filter(
    (a) =>
      !a.arquivado &&
      a.status_pipeline !== "emitida" &&
      !["Não Renovada", "Cancelada", "Recusada", "Sem Negócio"].includes(a.etiqueta_situacao || "")
  );
  const venc = [...vig, ...emAberto]
    .map((a) => ({ a, dias: Math.round((new Date(a.data_renovacao + "T00:00:00") - hoje0) / 86400000) }))
    .filter((x) => x.dias >= 0 && x.dias <= 30)
    .sort((x, y) => x.dias - y.dias);
  if (venc.length) {
    const v = venc[0];
    out.push({
      cor: v.dias <= 7 ? "red" : "amber", icon: AlertTriangle,
      texto: `${v.a.tipo_seguro || "Apólice"} vence em ${v.dias} dia${v.dias !== 1 ? "s" : ""} (${fmtData(v.a.data_renovacao)})`,
    });
  }

  // Contato incompleto
  const faltam = [];
  if (!(c.telefone || "").trim() && !(c.whatsapp || "").trim()) faltam.push("telefone");
  if (!(c.email || "").trim()) faltam.push("e-mail");
  if (faltam.length) out.push({ cor: "slate", icon: Phone, texto: `Contato incompleto: falta ${faltam.join(" e ")}` });

  // Cliente realmente parado: sem vigente E sem renovação em aberto
  if (vig.length === 0 && emAberto.length === 0) {
    out.push({
      cor: "orange", icon: UserMinus,
      texto: aps.length ? "Sem apólice vigente — oportunidade de reativação" : "Sem apólices — cliente para captação",
    });
  }

  return out;
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-slate-700 break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", placeholder, full }) {
  return (
    <label className={`block ${full ? "md:col-span-3" : ""}`}>
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white outline-none focus:border-slate-300"
      />
    </label>
  );
}

function StatusPill({ a }) {
  let txt = a.etiqueta_situacao || a.status_pipeline || "—";
  let cls = "bg-slate-100 text-slate-600";
  if (ehVigente(a)) { txt = "Vigente"; cls = "bg-emerald-100 text-emerald-700"; }
  else if (a.etiqueta_situacao === "Não Renovada") { txt = "Não renovada"; cls = "bg-red-100 text-red-600"; }
  else if (a.arquivado) { cls = "bg-slate-100 text-slate-500"; }
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{txt}</span>;
}

function DetalheApolice({ a }) {
  const comissaoValor = (Number(a.premio_liquido || 0) * Number(a.percentual_comissao || 0)) / 100;
  const campos = [
    { l: "Nº Apólice",       v: a.apolice_nova },
    { l: "Nº Proposta",      v: a.proposta },
    { l: "Seguradora",       v: a.seguradora },
    { l: "Ramo",             v: a.tipo_seguro },
    { l: "Situação",         v: a.etiqueta_situacao },
    { l: "Vigência fim",     v: fmtData(a.data_renovacao) },
    { l: "Prêmio total",     v: fmtBRL(a.valor) },
    { l: "Prêmio líquido",   v: a.premio_liquido ? fmtBRL(a.premio_liquido) : null },
    { l: "Comissão (%)",     v: a.percentual_comissao ? `${a.percentual_comissao}%` : null },
    { l: "Comissão (R$)",    v: comissaoValor > 0 ? fmtBRL(comissaoValor) : null },
    { l: "Pagamento",        v: a.etiqueta_pagamento },
    { l: "Canal/Origem",     v: a.etiqueta_canal },
    { l: "Mês referência",   v: a.mes_referencia },
  ].filter(({ v }) => v);

  const ehAuto = norm(a.tipo_seguro || "").startsWith("AUTO");
  const autoCampos = !ehAuto ? [] : [
    { l: "Placa",            v: a.auto_placa },
    { l: "Modelo",           v: a.auto_modelo },
    { l: "Ano fab/mod",      v: a.auto_ano_fab && a.auto_ano_mod ? `${a.auto_ano_fab}/${a.auto_ano_mod}` : null },
    { l: "Segurado",         v: a.auto_nome_segurado },
    { l: "CPF segurado",     v: a.auto_cpf_segurado },
    { l: "Condutor",         v: a.auto_condutor },
  ].filter(({ v }) => v);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        {campos.map(({ l, v }) => (
          <div key={l}>
            <div className="text-xs text-slate-400">{l}</div>
            <div className="text-xs font-medium text-slate-700">{v}</div>
          </div>
        ))}
      </div>
      {autoCampos.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Veículo / Condutor</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {autoCampos.map(({ l, v }) => (
              <div key={l}>
                <div className="text-xs text-slate-400">{l}</div>
                <div className="text-xs font-medium text-slate-700">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApolicesExpandiveis({ aps, ativas }) {
  const [aberto, setAberto] = useState(null);

  // Agrupa por ramo + seguradora, ordena ciclos do mais recente para o mais antigo
  const grupos = useMemo(() => {
    const map = {};
    for (const a of aps) {
      const chave = `${norm(a.tipo_seguro || "")}_${norm(a.seguradora || "")}`;
      if (!map[chave]) map[chave] = { ramo: a.tipo_seguro || "—", seguradora: a.seguradora || "—", ciclos: [] };
      map[chave].ciclos.push(a);
    }
    return Object.values(map).map((g) => ({
      ...g,
      ciclos: g.ciclos.sort((x, y) => (y.data_renovacao || "").localeCompare(x.data_renovacao || "")),
    })).sort((x, y) => (y.ciclos[0]?.data_renovacao || "").localeCompare(x.ciclos[0]?.data_renovacao || ""));
  }, [aps]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Histórico de apólices{" "}
        <span className="text-slate-400 font-normal">
          ({aps.length} · {ativas} vigente{ativas !== 1 ? "s" : ""})
        </span>
      </h2>
      {aps.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">Nenhuma apólice registrada para este cliente.</div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => {
            const vigente = g.ciclos.find(ehVigente);
            const ultimo = g.ciclos[0];
            return (
              <div key={`${g.ramo}_${g.seguradora}`} className="rounded-lg border border-slate-200 overflow-hidden">
                {/* Cabeçalho do grupo (ramo + seguradora) */}
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{g.ramo}</span>
                    <span className="text-xs text-slate-400 ml-2">{g.seguradora}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {vigente
                      ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Vigente</span>
                      : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Encerrada</span>}
                    <span className="text-xs text-slate-500 font-medium">{g.ciclos.length} ciclo{g.ciclos.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {/* Ciclos */}
                <div className="divide-y divide-slate-100">
                  {g.ciclos.map((a) => {
                    const exp = aberto === a.id;
                    return (
                      <div key={a.id} className={exp ? "bg-slate-50" : "bg-white"}>
                        <button
                          onClick={() => setAberto(exp ? null : a.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                          <span className={`text-slate-300 text-xs transition-transform flex-shrink-0 ${exp ? "rotate-90" : ""}`}>▶</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-500">
                              Venc. {fmtData(a.data_renovacao)}
                              {a.apolice_nova ? ` · Apólice ${a.apolice_nova}` : ""}
                              {a.proposta ? ` · Proposta ${a.proposta}` : ""}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-sm font-medium text-slate-700">{fmtBRL(a.valor)}</div>
                            <StatusPill a={a} />
                          </div>
                        </button>
                        {exp && (
                          <div className="px-4 pb-4">
                            <DetalheApolice a={a} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Ficha({ cliente, apolices: aps, universo, onBack, onSaved }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(cliente);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => { setForm(cliente); setEditando(false); setErro(null); }, [cliente]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const cancelar = () => { setForm(cliente); setErro(null); setEditando(false); };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const campos = {
      nome: form.nome, cpf_cnpj: form.cpf_cnpj, tipo_pessoa: form.tipo_pessoa,
      data_nascimento: form.data_nascimento || null, profissao: form.profissao,
      telefone: form.telefone, whatsapp: form.whatsapp, email: form.email,
      cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento,
      bairro: form.bairro, cidade: form.cidade, estado: form.estado,
      status: form.status, origem: form.origem, observacoes: form.observacoes,
    };
    const { data, error } = await supabase.from("clientes").update(campos).eq("id", cliente.id).select().single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSaved(data);
    setEditando(false);
  };

  const c = cliente;
  const ativas = aps.filter(ehVigente).length;
  const idade = calcIdade(c.data_nascimento);
  const endereco = montaEndereco(c);
  const gatilhos = calcGatilhos(c, aps);

  // Valor do cliente
  const premioAtivo = aps.filter(ehVigente).reduce((s, a) => s + Number(a.valor || 0), 0);
  const comissaoAcum = aps
    .filter((a) => a.status_pipeline === "emitida")
    .reduce((s, a) => s + (Number(a.premio_liquido || 0) * Number(a.percentual_comissao || 0)) / 100, 0);

  // Cross-sell (data-driven: ramos da carteira × ramos do cliente)
  const ramosCliente = new Set(aps.map((a) => norm(a.tipo_seguro)).filter(Boolean));
  const possui = universo.filter((r) => ramosCliente.has(norm(r)));
  const oportunidades = universo.filter((r) => !ramosCliente.has(norm(r)));

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F1F2F4" }}>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft size={16} /> Voltar para a lista
      </button>

      {/* Dados do cliente */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            {c.tipo_pessoa === "PJ" ? <Building2 size={20} className="text-slate-500" /> : <User size={20} className="text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 break-words">{c.nome}</h1>
            <div className="text-xs text-slate-400">{c.cpf_cnpj} · {c.tipo_pessoa || "PF"}{c.status ? ` · ${c.status}` : ""}</div>
          </div>
          {!editando ? (
            <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex-shrink-0">
              <Pencil size={13} /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={cancelar} disabled={salvando} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white">
                <X size={13} /> Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="flex items-center gap-1 text-xs text-white px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60">
                <Check size={13} /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}
        </div>

        {erro && <div className="mt-3 text-xs text-red-500">Erro ao salvar: {erro}</div>}

        {!editando ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-4 text-sm">
              <Info icon={Calendar} label="Nascimento" value={c.data_nascimento ? `${fmtData(c.data_nascimento)}${idade != null ? ` (${idade} anos)` : ""}` : null} />
              <Info icon={Briefcase} label="Profissão" value={c.profissao} />
              <Info icon={Shield} label="Origem" value={c.origem} />
              <Info icon={Phone} label="Telefone" value={fmtFone(c.telefone)} />
              <Info icon={MessageCircle} label="WhatsApp" value={fmtFone(c.whatsapp)} />
              <Info icon={Mail} label="E-mail" value={c.email} />
              <Info icon={MapPin} label="Endereço" value={endereco} />
              <Info icon={User} label="Status" value={c.status} />
            </div>
            {c.observacoes && (
              <div className="mt-4 flex items-start gap-2 text-sm">
                <FileText size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-400">Observações</div>
                  <div className="text-slate-700 whitespace-pre-wrap">{c.observacoes}</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <Campo label="Nome / Razão social" value={form.nome} onChange={set("nome")} full />
            <Campo label="CPF / CNPJ" value={form.cpf_cnpj} onChange={set("cpf_cnpj")} />
            <label className="block">
              <span className="text-xs text-slate-400">Pessoa</span>
              <select value={form.tipo_pessoa || ""} onChange={set("tipo_pessoa")} className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white outline-none focus:border-slate-300">
                <option value="">—</option>
                <option value="PF">Física</option>
                <option value="PJ">Jurídica</option>
              </select>
            </label>
            <Campo label="Status" value={form.status} onChange={set("status")} />
            <Campo label="Nascimento" value={form.data_nascimento} onChange={set("data_nascimento")} type="date" />
            <Campo label="Profissão" value={form.profissao} onChange={set("profissao")} />
            <Campo label="Origem" value={form.origem} onChange={set("origem")} />
            <Campo label="Telefone" value={form.telefone} onChange={set("telefone")} />
            <Campo label="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} />
            <Campo label="E-mail" value={form.email} onChange={set("email")} />
            <Campo label="CEP" value={form.cep} onChange={set("cep")} />
            <Campo label="Logradouro" value={form.logradouro} onChange={set("logradouro")} />
            <Campo label="Número" value={form.numero} onChange={set("numero")} />
            <Campo label="Complemento" value={form.complemento} onChange={set("complemento")} />
            <Campo label="Bairro" value={form.bairro} onChange={set("bairro")} />
            <Campo label="Cidade" value={form.cidade} onChange={set("cidade")} />
            <Campo label="Estado (UF)" value={form.estado} onChange={set("estado")} />
            <label className="block md:col-span-3">
              <span className="text-xs text-slate-400">Observações</span>
              <textarea value={form.observacoes || ""} onChange={set("observacoes")} rows={3} className="w-full mt-0.5 px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 bg-white outline-none focus:border-slate-300" />
            </label>
          </div>
        )}
      </div>

      {/* Gatilhos de ação */}
      {gatilhos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Ações sugeridas</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {gatilhos.map((g, i) => (
              <span key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${CORES_GATILHO[g.cor]}`}>
                <g.icon size={12} /> {g.texto}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Valor do cliente */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniStat label="Prêmio ativo" value={fmtBRL(premioAtivo)} />
        <MiniStat label="Comissão acumulada" value={fmtBRL(comissaoAcum)} />
        <MiniStat label="Apólices" value={`${aps.length} · ${ativas} vigente${ativas !== 1 ? "s" : ""}`} />
      </div>

      {/* Cross-sell */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={15} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Oportunidades de cross-sell</h2>
        </div>
        {oportunidades.length === 0 ? (
          <div className="text-sm text-slate-400">Este cliente já tem todos os ramos que você trabalha hoje.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {oportunidades.map((r) => (
              <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">{r}</span>
            ))}
          </div>
        )}
        {possui.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">Já possui: {possui.join(" · ")}</div>
        )}
      </div>

      {/* Histórico de apólices */}
      <ApolicesExpandiveis aps={aps} ativas={ativas} />
    </div>
  );
}

export default function Segurados() {
  const [clientes, setClientes] = useState([]);
  const [apolices, setApolices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const [cli, ren] = await Promise.all([
        supabase.from("clientes").select("*").order("nome"),
        supabase.from("renovacoes").select("*").not("cliente_id", "is", null),
      ]);
      if (cli.error) { setErro(cli.error.message); setLoading(false); return; }
      if (ren.error) { setErro(ren.error.message); setLoading(false); return; }
      setClientes(cli.data || []);
      setApolices(ren.data || []);
      setLoading(false);
    })();
  }, []);

  const onSaved = (atualizado) =>
    setClientes((lista) => lista.map((c) => (c.id === atualizado.id ? atualizado : c)));

  const porCliente = useMemo(() => {
    const m = {};
    for (const a of apolices) (m[a.cliente_id] = m[a.cliente_id] || []).push(a);
    return m;
  }, [apolices]);

  // Universo de ramos que a corretora trabalha hoje (data-driven)
  const universo = useMemo(() => {
    const s = new Set();
    for (const a of apolices) if (a.tipo_seguro) s.add(a.tipo_seguro);
    return [...s].sort();
  }, [apolices]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) => (c.nome || "").toLowerCase().includes(q) || (c.cpf_cnpj || "").toLowerCase().includes(q)
    );
  }, [clientes, busca]);

  if (loading) return <div className="flex-1 p-8 text-center text-slate-400 text-sm">Carregando segurados...</div>;
  if (erro) return <div className="flex-1 p-8 text-center text-red-500 text-sm">Erro: {erro}</div>;

  if (selId) {
    const c = clientes.find((x) => x.id === selId);
    if (c) {
      const aps = (porCliente[selId] || []).slice().sort((a, b) => (b.data_renovacao || "").localeCompare(a.data_renovacao || ""));
      return <Ficha cliente={c} apolices={aps} universo={universo} onBack={() => setSelId(null)} onSaved={onSaved} />;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F1F2F4" }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-slate-800">
          Segurados <span className="text-slate-400 font-normal text-sm">({clientes.length})</span>
        </h1>
      </div>

      <div className="relative mb-3 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white outline-none focus:border-slate-300"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {listaFiltrada.map((c) => {
          const apsC = porCliente[c.id] || [];
          const ativas = apsC.filter(ehVigente).length;
          return (
            <button key={c.id} onClick={() => setSelId(c.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                {c.tipo_pessoa === "PJ" ? <Building2 size={16} className="text-slate-500" /> : <User size={16} className="text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{c.nome}</div>
                <div className="text-xs text-slate-400 truncate">{c.cpf_cnpj || "—"} · {c.cidade || "—"}{c.estado ? `/${c.estado}` : ""}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-slate-500">{apsC.length} apólice{apsC.length !== 1 ? "s" : ""}</div>
                {ativas > 0 && <div className="text-xs text-emerald-600 font-medium">{ativas} vigente{ativas !== 1 ? "s" : ""}</div>}
              </div>
            </button>
          );
        })}
        {listaFiltrada.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Nenhum segurado encontrado.</div>
        )}
      </div>
    </div>
  );
}
