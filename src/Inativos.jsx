import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { UserMinus, Search, ChevronRight } from "lucide-react";
import { fmt } from "./utils";

const hojeStr = () => new Date().toISOString().slice(0, 10);

const SITUACAO_COR = {
  "Cancelada":     "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  "Não Renovada":  "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
};

// ── Inativos — visão de carteira (Fase 3) ──────────────────────
// Cliente sem NENHUMA apólice vigente hoje, cuja última apólice
// terminou por Cancelamento (com motivo) ou Não Renovação. Cliente
// com outra apólice ainda vigente em outro ramo continua ativo —
// mesmo que uma apólice específica tenha sido cancelada.
export default function Inativos({ onVerCliente }) {
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [situacaoFiltro, setSituacaoFiltro] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);
      const { data, error } = await supabase
        .from("renovacoes")
        .select("id, cliente_id, cliente_nome, cpf_cnpj, tipo_seguro, seguradora, data_renovacao, status_pipeline, etiqueta_situacao, motivo_cancelamento, atualizado_em")
        .not("cliente_id", "is", null);
      if (error) { setErro(error.message); setLoading(false); return; }
      setLinhas(data || []);
      setLoading(false);
    })();
  }, []);

  const inativos = useMemo(() => {
    const porCliente = {};
    for (const a of linhas) (porCliente[a.cliente_id] = porCliente[a.cliente_id] || []).push(a);

    const SITUACOES_INATIVAS = ["Cancelada", "Não Renovada"];
    const resultado = [];
    for (const [clienteId, aps] of Object.entries(porCliente)) {
      const temVigente = aps.some(
        (a) => a.status_pipeline === "emitida" && a.data_renovacao >= hojeStr() && !SITUACOES_INATIVAS.includes(a.etiqueta_situacao)
      );
      if (temVigente) continue;

      const candidatas = aps
        .filter((a) => a.etiqueta_situacao === "Cancelada" || a.etiqueta_situacao === "Não Renovada")
        .sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || ""));
      if (candidatas.length === 0) continue;

      const ultima = candidatas[0];
      resultado.push({
        clienteId,
        clienteNome: ultima.cliente_nome,
        cpfCnpj: ultima.cpf_cnpj,
        tipoSeguro: ultima.tipo_seguro,
        seguradora: ultima.seguradora,
        situacao: ultima.etiqueta_situacao,
        motivo: ultima.motivo_cancelamento,
        dataFim: ultima.atualizado_em,
      });
    }
    return resultado.sort((a, b) => (b.dataFim || "").localeCompare(a.dataFim || ""));
  }, [linhas]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    return inativos.filter((c) => {
      if (situacaoFiltro && c.situacao !== situacaoFiltro) return false;
      if (q.length >= 2) {
        const nome = (c.clienteNome || "").toLowerCase();
        const doc = (c.cpfCnpj || "").replace(/\D/g, "");
        if (!nome.includes(q) && !(qDigitos.length >= 3 && doc.includes(qDigitos))) return false;
      }
      return true;
    });
  }, [inativos, busca, situacaoFiltro]);

  const contagem = useMemo(() => {
    const m = { Cancelada: 0, "Não Renovada": 0 };
    for (const c of inativos) m[c.situacao] = (m[c.situacao] || 0) + 1;
    return m;
  }, [inativos]);

  if (loading)
    return <div className="flex-1 p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Carregando...</div>;
  if (erro)
    return <div className="flex-1 p-8 text-center text-red-500 dark:text-red-400 text-sm">Erro: {erro}</div>;

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Inativos</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Clientes sem nenhuma apólice vigente hoje, cuja última apólice foi cancelada ou não renovada.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
        <button
          onClick={() => setSituacaoFiltro((f) => (f === "Cancelada" ? "" : "Cancelada"))}
          className={`bg-painel dark:bg-painel-dark rounded-xl border shadow-sm p-3 text-left transition-colors ${
            situacaoFiltro === "Cancelada" ? "border-red-400 dark:border-red-500" : "border-borda dark:border-borda-dark"
          }`}
        >
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contagem.Cancelada || 0}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Cancelada</div>
        </button>
        <button
          onClick={() => setSituacaoFiltro((f) => (f === "Não Renovada" ? "" : "Não Renovada"))}
          className={`bg-painel dark:bg-painel-dark rounded-xl border shadow-sm p-3 text-left transition-colors ${
            situacaoFiltro === "Não Renovada" ? "border-red-400 dark:border-red-500" : "border-borda dark:border-borda-dark"
          }`}
        >
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contagem["Não Renovada"] || 0}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Não Renovada</div>
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-borda dark:border-borda-dark bg-painel dark:bg-painel-dark text-slate-800 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-500"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum cliente inativo encontrado com esses filtros.
        </div>
      ) : (
        <div className="bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {filtrados.map((c) => (
            <button
              key={c.clienteId}
              onClick={() => onVerCliente && onVerCliente(c.clienteId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <UserMinus size={16} className="text-slate-500 dark:text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.clienteNome}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SITUACAO_COR[c.situacao] || "bg-slate-100 text-slate-500"}`}>
                    {c.situacao}
                  </span>
                  {c.motivo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      {c.motivo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {c.tipoSeguro} · {c.seguradora} · {fmt((c.dataFim || "").slice(0, 10))}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
