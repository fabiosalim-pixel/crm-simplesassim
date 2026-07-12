import { useState } from "react";
import { UserPlus, Phone, Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { FUNIL_ESTAGIOS } from "./constants";
import { fmt } from "./utils";

function LeadCard({ lead, onAvancar, onGraduar, onDescartar }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="bg-painel dark:bg-painel-dark rounded-lg border border-borda dark:border-borda-dark p-3 mb-2 shadow-sm">
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-start justify-between text-left">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{lead.clienteNome}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{lead.produto || "—"}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">{fmt((lead.criadoEm || "").slice(0, 10))}</div>
        </div>
        {aberto ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />}
      </button>

      {aberto && (
        <div className="mt-2 pt-2 border-t border-borda dark:border-borda-dark space-y-2">
          {lead.telefone && <div className="text-xs text-slate-500 dark:text-slate-400">Tel: {lead.telefone}</div>}
          {lead.email && <div className="text-xs text-slate-500 dark:text-slate-400">E-mail: {lead.email}</div>}
          {lead.observacoes && (
            <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2">
              {lead.observacoes}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {lead.estagio === "lead_recebido" && (
          <button onClick={() => onAvancar(lead.id, "contato_realizado")}
            className="flex items-center gap-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg">
            <Phone size={11} /> Confirmar contato
          </button>
        )}
        {lead.estagio === "contato_realizado" && (
          <button onClick={() => onGraduar(lead)}
            className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg">
            <Send size={11} /> Enviar cotação
          </button>
        )}
        <button onClick={() => onDescartar(lead.id)}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded-lg">
          <X size={11} /> Descartar
        </button>
      </div>
    </div>
  );
}

// ── Funil de Vendas ─────────────────────────────────────────
// Leads novos do site/Google (nunca vão direto pro Kanban — nascem
// aqui, qualificados, e só entram em Renovações no momento da
// graduação, já na etapa "Enviada ao Cliente").
export default function FunilVendas({ leads, onAvancar, onGraduar, onDescartar }) {
  const [verConvertidos, setVerConvertidos] = useState(false);

  const ativos = leads.filter((l) => l.estagio === "lead_recebido" || l.estagio === "contato_realizado");
  const convertidos = leads.filter((l) => l.estagio === "convertido");

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Funil de Vendas</h1>
        {convertidos.length > 0 && (
          <button onClick={() => setVerConvertidos((v) => !v)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
            {verConvertidos ? "Ocultar convertidos" : `Ver convertidos (${convertidos.length})`}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
        Leads do site e Google, qualificados antes de entrar no Kanban. "Enviar cotação" cria o card
        direto em Renovações, na etapa Enviada ao Cliente.
      </p>

      <div className="flex gap-3" style={{ minWidth: "fit-content" }}>
        {FUNIL_ESTAGIOS.map((estagio) => {
          const itens = ativos.filter((l) => l.estagio === estagio.id);
          return (
            <div key={estagio.id} className="flex-shrink-0" style={{ width: 280 }}>
              <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg text-white text-xs font-bold uppercase tracking-wide ${estagio.badge}`}>
                <span className="flex items-center gap-1.5"><UserPlus size={12} /> {estagio.label}</span>
                <span className="bg-white/25 rounded-full w-5 h-5 flex items-center justify-center">{itens.length}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-t-0 border-borda dark:border-borda-dark rounded-b-lg p-2 min-h-[10rem]">
                {itens.length === 0 ? (
                  <p className="text-xs text-slate-300 dark:text-slate-600 text-center mt-4">Nenhum lead.</p>
                ) : (
                  itens.map((l) => (
                    <LeadCard key={l.id} lead={l} onAvancar={onAvancar} onGraduar={onGraduar} onDescartar={onDescartar} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {verConvertidos && convertidos.length > 0 && (
        <div className="mt-4 bg-painel dark:bg-painel-dark rounded-xl border border-borda dark:border-borda-dark shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden max-w-lg">
          {convertidos.map((l) => (
            <div key={l.id} className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">{l.clienteNome}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{l.produto} · convertido</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
