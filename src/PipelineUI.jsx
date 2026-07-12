import { useState } from "react";
import { Tag, Bell, Paperclip, AlertTriangle, Clock, Plus, Archive, ChevronRight } from "lucide-react";
import { STAGES, SITUACAO_COR, PAGAMENTO_COR, CANAL_COR } from "./constants";
import { daysUntil, isApoliceAlerta, isVistoriaAlerta, isBoletoAlerta, isTransmitidaExpirada } from "./utils";

function TagChip({ label, corMap }) {
  if (!label) return null;
  const cor = corMap[label] || "bg-slate-100 text-slate-500";
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cor}`}>{label}</span>;
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
  const apoliceAlert = isApoliceAlerta(card);
  const vistoriaAlert = isVistoriaAlerta(card);
  const boletoAlert = isBoletoAlerta(card);
  const pending = (card.followUps || []).filter(f => !f.feito).length;
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("cardId", card.id); e.dataTransfer.effectAllowed = "move"; if (onDragStart) onDragStart(card.id); }}
      onClick={() => onClick(card)}
      className={`bg-white dark:bg-slate-800 rounded-xl p-2.5 mb-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border ${apoliceAlert ? "border-red-400 border-2" : vistoriaAlert ? "border-orange-400 border-2" : boletoAlert ? "border-yellow-500 border-2" : urgent ? "border-l-4 border-l-red-500 border-slate-200 dark:border-slate-700" : warn ? "border-l-4 border-l-yellow-400 border-slate-200 dark:border-slate-700" : "border-slate-200 dark:border-slate-700"}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex justify-between items-start gap-1">
        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-snug flex-1">{card.clienteNome}</span>
        {card.etiquetaSegfy && <Tag size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />}
      </div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{card.tipoSeguro}{card.seguradora ? ` · ${card.seguradora}` : ""}</div>
      {card.veiculo && card.veiculo !== "—" && <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{card.veiculo}</div>}
      {(card.etiquetaSituacao || card.etiquetaPagamento || card.etiquetaCanal) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <TagChip label={card.etiquetaSituacao}  corMap={SITUACAO_COR} />
          <TagChip label={card.etiquetaPagamento} corMap={PAGAMENTO_COR} />
          <TagChip label={card.etiquetaCanal}     corMap={CANAL_COR} />
        </div>
      )}
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{card.valor ? `R$ ${card.valor}` : "—"}</span>
        <Chip days={days} status={card.status} />
      </div>
      {pending > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
          <Bell size={9} /> {pending} pendente{pending > 1 ? "s" : ""}
        </div>
      )}
      {apoliceAlert && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-600 font-semibold">
          <Paperclip size={9} /> Apólice pendente
        </div>
      )}
      {vistoriaAlert && (
        <div className="mt-1 flex items-center gap-1 text-xs text-orange-600 font-semibold">
          <AlertTriangle size={9} /> Vistoria pendente
        </div>
      )}
      {boletoAlert && (
        <div className="mt-1 flex items-center gap-1 text-xs text-yellow-700 font-semibold">
          <Bell size={9} /> Boleto vencendo
        </div>
      )}
      {(card.sinistros || []).filter(s => s.status !== "Encerrado").length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-500 font-semibold">
          <AlertTriangle size={9} /> {(card.sinistros || []).filter(s => s.status !== "Encerrado").length} sinistro{(card.sinistros || []).filter(s => s.status !== "Encerrado").length > 1 ? "s" : ""} aberto{(card.sinistros || []).filter(s => s.status !== "Encerrado").length > 1 ? "s" : ""}
        </div>
      )}
      {isTransmitidaExpirada(card) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-orange-600 font-semibold">
          <Clock size={9} /> Proposta sem retorno (+5 dias)
        </div>
      )}
      {card.autoDataNasc && (() => {
        const dt = new Date(card.autoDataNasc + "T12:00:00");
        const hoje = new Date();
        const aniv = new Date(hoje.getFullYear(), dt.getMonth(), dt.getDate());
        const diff = Math.ceil((aniv - hoje) / 86400000);
        if (diff < 0 || diff > 7) return null;
        return (
          <div className="mt-1 flex items-center gap-1 text-xs text-pink-600 font-semibold">
            🎂 {diff === 0 ? "Aniversário hoje!" : `Aniversário em ${diff}d`}
          </div>
        );
      })()}
    </div>
  );
}

export function Column({ stage, cards, onCard, onAdd, onDrop }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragOver(true); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); const cardId = e.dataTransfer.getData("cardId"); if (cardId) onDrop(cardId, stage.id); };

  return (
    <div className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ width: 256, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
      <div className={`flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 border-b-2 ${stage.accent}`}>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{stage.label}</span>
          <span className="text-xs font-normal normal-case text-slate-400 dark:text-slate-500">{cards.length}</span>
          {stage.optional && <span className="text-xs opacity-70 font-normal normal-case text-slate-400 dark:text-slate-500">· específicos</span>}
        </div>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 p-2 min-h-40 overflow-y-auto transition-colors ${isDragOver ? "bg-blue-50 dark:bg-slate-700 ring-2 ring-blue-300 dark:ring-blue-600 ring-inset" : "bg-white dark:bg-slate-800"}`}
        style={{ maxHeight: "calc(100vh - 185px)" }}>
        {cards.map(c => <CardTile key={c.id} card={c} onClick={onCard} />)}
        <button onClick={() => onAdd(stage.id)} className="w-full text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mt-0.5">
          <Plus size={12} /> Adicionar card
        </button>
      </div>
    </div>
  );
}

// ── Perfil do cliente ─────────────────────────────────────────
export function ApoliceRow({ card, onClick }) {
  const stage = STAGES.find(s => s.id === card.status);
  return (
    <button onClick={() => onClick(card)}
      className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 border border-slate-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700 text-sm">{card.tipoSeguro}</span>
          {card.seguradora && <span className="text-xs text-slate-400">{card.seguradora}</span>}
          {card.autoPlaca && <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">{card.autoPlaca}</span>}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {card.dataRenovacao && `Renov. ${card.dataRenovacao}`}
          {card.valor ? ` · R$ ${card.valor}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {card.arquivado ? (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Archive size={9} /> Arquivado
          </span>
        ) : stage ? (
          <span className={`text-xs text-white px-2 py-0.5 rounded-full ${stage.badge}`}>{stage.short}</span>
        ) : null}
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </button>
  );
}
