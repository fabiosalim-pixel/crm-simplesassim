import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { Search, Paperclip, Download, ChevronRight } from "lucide-react";
import { fmt } from "./utils";
import { DOC_TIPOS } from "./constants";
import { docPublicUrl } from "./data";

// ── Documentos — repositório transversal (Fase 3) ──────────────
// Busca/abre documentos já anexados em qualquer apólice, sem precisar
// abrir o card. Upload e exclusão continuam exclusivos do DocsSection
// dentro do modal do card — aqui é só encontrar e abrir.
export default function Documentos({ onVerCliente, onAbrirCard }) {
  const [docs, setDocs] = useState([]);
  const [renovacoes, setRenovacoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const [docsRes, renRes] = await Promise.all([
        supabase.from("documentos").select("*").order("criado_em", { ascending: false }),
        supabase.from("renovacoes").select("id, cliente_id, cliente_nome, cpf_cnpj, tipo_seguro, seguradora"),
      ]);
      if (docsRes.error) { setErro(docsRes.error.message); setLoading(false); return; }
      if (renRes.error) { setErro(renRes.error.message); setLoading(false); return; }
      const mapa = {};
      for (const r of renRes.data || []) mapa[r.id] = r;
      setRenovacoes(mapa);
      setDocs(docsRes.data || []);
      setLoading(false);
    })();
  }, []);

  const tipoLabel = (id) => DOC_TIPOS.find((t) => t.id === id)?.label || id;

  const enriquecidos = useMemo(
    () => docs.map((d) => ({ ...d, apolice: renovacoes[d.renovacao_id] || null })),
    [docs, renovacoes]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    return enriquecidos.filter((d) => {
      if (tipoFiltro && d.tipo !== tipoFiltro) return false;
      if (q.length >= 2) {
        const nome = (d.apolice?.cliente_nome || "").toLowerCase();
        const doc = (d.apolice?.cpf_cnpj || "").replace(/\D/g, "");
        const arquivo = (d.nome_arquivo || "").toLowerCase();
        const bate = nome.includes(q) || arquivo.includes(q) || (qDigitos.length >= 3 && doc.includes(qDigitos));
        if (!bate) return false;
      }
      return true;
    });
  }, [enriquecidos, busca, tipoFiltro]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando documentos...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Documentos</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Todos os documentos anexados na carteira — {docs.length} arquivo{docs.length !== 1 ? "s" : ""} no total.
        Upload e exclusão continuam pelo card.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, CPF/CNPJ ou nome do arquivo..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
          />
        </div>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
          className="text-xs rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-600 dark:text-slate-300 px-2 py-1.5 outline-none">
          <option value="">Todos os tipos</option>
          {DOC_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum documento encontrado com esses filtros.
        </div>
      ) : (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {filtrados.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Paperclip size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">{tipoLabel(d.tipo)}</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {d.apolice?.cliente_nome || "Cliente não encontrado"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                  {d.nome_arquivo}
                  {d.apolice && ` · ${d.apolice.tipo_seguro} · ${d.apolice.seguradora}`}
                </div>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{fmt(d.criado_em?.slice(0, 10))}</div>
              <a href={docPublicUrl(d.storage_path)} target="_blank" rel="noreferrer"
                className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex-shrink-0" title="Abrir documento">
                <Download size={15} />
              </a>
              {onVerCliente && d.apolice?.cliente_id && (
                <span
                  role="button"
                  onClick={() => onVerCliente(d.apolice.cliente_id)}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5 flex-shrink-0"
                >
                  Cliente <ChevronRight size={12} />
                </span>
              )}
              {onAbrirCard && (
                <span
                  role="button"
                  onClick={() => onAbrirCard(d.renovacao_id)}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline flex-shrink-0"
                >
                  Card
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
