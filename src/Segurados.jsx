import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import {
  Search, ChevronLeft, User, Building2, Phone, Mail, MapPin, Shield, Calendar
} from "lucide-react";

const fmtBRL = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

const hojeStr = () => new Date().toISOString().slice(0, 10);

const ehVigente = (a) => a.status_pipeline === "emitida" && a.data_renovacao >= hojeStr();

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-slate-700 truncate">{value || "—"}</div>
      </div>
    </div>
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

function Ficha({ cliente: c, apolices: aps, onBack }) {
  const ativas = aps.filter(ehVigente).length;
  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#F1F2F4" }}>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft size={16} /> Voltar para a lista
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            {c.tipo_pessoa === "PJ" ? <Building2 size={20} className="text-slate-500" /> : <User size={20} className="text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800">{c.nome}</h1>
            <div className="text-xs text-slate-400">{c.cpf_cnpj} · {c.tipo_pessoa || "PF"}{c.status ? ` · ${c.status}` : ""}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-4 text-sm">
          <Info icon={Phone} label="Telefone" value={c.telefone || c.whatsapp} />
          <Info icon={Mail} label="E-mail" value={c.email} />
          <Info icon={Calendar} label="Nascimento" value={c.data_nascimento ? fmtData(c.data_nascimento) : null} />
          <Info icon={MapPin} label="Cidade" value={c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : null} />
          <Info icon={User} label="Profissão" value={c.profissao} />
          <Info icon={Shield} label="Origem" value={c.origem} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Histórico de apólices <span className="text-slate-400 font-normal">({aps.length} · {ativas} vigente{ativas !== 1 ? "s" : ""})</span>
        </h2>
        {aps.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">Nenhuma apólice registrada para este cliente.</div>
        ) : (
          <div className="space-y-2">
            {aps.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{a.tipo_seguro || "—"} · {a.seguradora || "—"}</div>
                  <div className="text-xs text-slate-400 truncate">
                    Vencimento: {fmtData(a.data_renovacao)}{a.apolice_nova ? ` · Apólice ${a.apolice_nova}` : ""}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-slate-600">{fmtBRL(a.valor)}</div>
                  <StatusPill a={a} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

  const porCliente = useMemo(() => {
    const m = {};
    for (const a of apolices) {
      (m[a.cliente_id] = m[a.cliente_id] || []).push(a);
    }
    return m;
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
      return <Ficha cliente={c} apolices={aps} onBack={() => setSelId(null)} />;
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
          const aps = porCliente[c.id] || [];
          const ativas = aps.filter(ehVigente).length;
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
                <div className="text-xs text-slate-500">{aps.length} apólice{aps.length !== 1 ? "s" : ""}</div>
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
