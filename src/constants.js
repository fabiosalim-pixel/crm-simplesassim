// ── Constantes do Pipeline (Kanban) ──────────────────────────────
export const STAGES = [
  { id: "cotacoes",    label: "Cotações e Leads",        short: "Cotações",    badge: "bg-slate-600 dark:bg-slate-500",    bg: "bg-slate-50",    border: "border-slate-200", accent: "border-slate-400" },
  { id: "enviada",     label: "Enviada ao Cliente",       short: "Enviada",     badge: "bg-slate-700 dark:bg-slate-600",    bg: "bg-slate-50",    border: "border-slate-300", accent: "border-slate-500" },
  { id: "transmitida", label: "Proposta Transmitida",     short: "Transmitida", badge: "bg-slate-800 dark:bg-slate-700",    bg: "bg-slate-100",   border: "border-slate-300", accent: "border-slate-600" },
  { id: "vistoria",    label: "Vistoria / Pend. Emissão", short: "Vistoria",    badge: "bg-amber-600",                      bg: "bg-amber-50",    border: "border-amber-300",  optional: true, accent: "border-amber-500" },
  { id: "boleto",      label: "Boleto / Débito",          short: "Pagamento",   badge: "bg-amber-700",                      bg: "bg-amber-50",    border: "border-amber-300",  optional: true, accent: "border-amber-600" },
  { id: "emitida",      label: "Apólice Emitida",          short: "Emitida",     badge: "bg-emerald-700 dark:bg-emerald-600", bg: "bg-emerald-50",   border: "border-emerald-300", accent: "border-emerald-500" },
];

export const PROSP_STAGES = [
  { id: "FRIA",               label: "Fria",               short: "Fria",      badge: "bg-sky-500",     bg: "bg-sky-50",     border: "border-sky-200" },
  { id: "EM ANDAMENTO",       label: "Em Andamento",       short: "Andamento", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-200" },
  { id: "RECUPERADA",         label: "Recuperada",         short: "Recuperada",badge: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: "PERDIDA DEFINITIVA", label: "Perdida Definitiva", short: "Perdida",   badge: "bg-slate-400",   bg: "bg-slate-50",   border: "border-slate-200" },
];

export const DOC_TIPOS = [
  { id: "proposta",          label: "Proposta",             required: true  },
  { id: "apolice",           label: "Apólice",              required: true  },
  { id: "proposta_endosso",  label: "Proposta de Endosso",  required: false },
  { id: "apolice_endosso",   label: "Apólice de Endosso",   required: false },
  { id: "nota_fiscal",       label: "Nota Fiscal",          required: false },
  { id: "laudo_vistoria",    label: "Laudo de Vistoria",    required: false },
  { id: "cnh",               label: "CNH",                  required: false },
  { id: "crlv",              label: "CRLV-e",               required: false },
  { id: "outros",            label: "Outros",               required: false },
];

// ── Etiquetas em camadas ──────────────────────────────────────
export const RAMOS_IMOVEL = ["EMPRESARIAL","RESIDENCIAL","CONDOMÍNIO","FIANÇA LOCATÍCIA","RC OBRAS","RISCO DE ENGENHARIA","RURAL"];
export const RAMOS_VIDA = ["VIDA INDIVIDUAL","VIDA EM GRUPO","ACIDENTES PESSOAIS"];
export const RAMOS_EQUIP = ["BIKE","EQUIPAMENTOS PORTÁTEIS"];
export const RAMOS_VIAGEM = ["SEGURO VIAGEM"];

export const SITUACOES = ["Cancelada","Endosso","Não Renovada","Protocolado","Recusada","Renov. Congênere","Renovação","Seguro Novo","Sem Negócio"];
export const MOTIVOS_CANCELAMENTO = ["A pedido do cliente","Inadimplência","Outro"];
export const PAGAMENTOS = ["Boleto","Cartão de Crédito","Débito em Conta","Link de Pagamento","PIX"];
export const CANAIS = ["Google","Indicação","Site","Cliente da Corretora","Outros/Não informado"];

export const SITUACAO_COR = {
  "Renovação":         "bg-blue-100 text-blue-700",
  "Seguro Novo":       "bg-emerald-100 text-emerald-700",
  "Renov. Congênere":  "bg-violet-100 text-violet-700",
  "Cancelada":         "bg-slate-200 text-slate-600",
  "Endosso":           "bg-orange-100 text-orange-700",
  "Não Renovada":      "bg-red-100 text-red-700",
  "Recusada":          "bg-red-100 text-red-700",
  "Sem Negócio":       "bg-slate-100 text-slate-500",
  "Protocolado":       "bg-yellow-100 text-yellow-700",
};
export const PAGAMENTO_COR = {
  "Boleto":            "bg-amber-100 text-amber-700",
  "Débito em Conta":   "bg-teal-100 text-teal-700",
  "Cartão de Crédito": "bg-purple-100 text-purple-700",
  "PIX":               "bg-emerald-100 text-emerald-700",
  "Link de Pagamento": "bg-indigo-100 text-indigo-700",
};
export const CANAL_COR = {
  "Indicação":   "bg-emerald-100 text-emerald-700",
  "Site":        "bg-sky-100 text-sky-700",
  "LojaCorr":    "bg-violet-100 text-violet-700",
  "Parceiro":    "bg-orange-100 text-orange-700",
  "Google":      "bg-red-100 text-red-700",
  "Crosselling": "bg-pink-100 text-pink-700",
  "Cliente da Corretora": "bg-blue-100 text-blue-700",
  "Outros/Não informado": "bg-slate-100 text-slate-600",
};
