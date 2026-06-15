import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { Shield, Plus, X, ChevronRight, ChevronLeft, Bell, Search, Save, Tag, Filter, AlertTriangle, Paperclip, Download, Trash2, Upload, Archive, Clock, Ban, Users, RotateCcw, Home } from "lucide-react";
import Dashboard from "./Dashboard";
import Segurados from "./Segurados";

const STAGES = [
  { id: "cotacoes",    label: "Cotações e Leads",        short: "Cotações",    badge: "bg-blue-600",    bg: "bg-blue-50",    border: "border-blue-300" },
  { id: "enviada",     label: "Enviada ao Cliente",       short: "Enviada",     badge: "bg-violet-600",  bg: "bg-violet-50",  border: "border-violet-300" },
  { id: "transmitida", label: "Proposta Transmitida",     short: "Transmitida", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-300" },
  { id: "vistoria",    label: "Vistoria / Pend. Emissão", short: "Vistoria",    badge: "bg-red-500",     bg: "bg-red-50",     border: "border-red-300",    optional: true },
  { id: "boleto",      label: "Boleto / Débito",          short: "Pagamento",   badge: "bg-yellow-600",  bg: "bg-yellow-50",  border: "border-yellow-300", optional: true },
  { id: "emitida",      label: "Apólice Emitida",          short: "Emitida",     badge: "bg-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-300" },
  { id: "crosselling",  label: "Crosselling",              short: "Crosselling", badge: "bg-purple-600",  bg: "bg-purple-50",   border: "border-purple-300" },
];

const genId = () => crypto.randomUUID();

const PROSP_STAGES = [
  { id: "FRIA",               label: "Fria",               short: "Fria",      badge: "bg-sky-500",     bg: "bg-sky-50",     border: "border-sky-200" },
  { id: "EM ANDAMENTO",       label: "Em Andamento",       short: "Andamento", badge: "bg-orange-500",  bg: "bg-orange-50",  border: "border-orange-200" },
  { id: "RECUPERADA",         label: "Recuperada",         short: "Recuperada",badge: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { id: "PERDIDA DEFINITIVA", label: "Perdida Definitiva", short: "Perdida",   badge: "bg-slate-400",   bg: "bg-slate-50",   border: "border-slate-200" },
];

const DOC_TIPOS = [
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

const daysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d + "T12:00:00") - new Date()) / 86400000);
};

const isTransmitidaExpirada = (card) => {
  if (card.status !== "transmitida" || card.arquivado) return false;
  // criadoEm or dataRenovacao — use updated_at proxy via transmitidaEm if available, else skip
  if (!card.transmitidaEm) return false;
  const dias = Math.ceil((new Date() - new Date(card.transmitidaEm)) / 86400000);
  return dias >= 5;
};

const isApoliceAlerta = (card) => {
  if (card.status !== "transmitida") return false;
  if (card.etiquetaSituacao === "Seguro Novo") return false;
  if (card.apoliceAnexada) return false;
  if (!card.criadoEm) return false;
  const dias = Math.floor((Date.now() - new Date(card.criadoEm)) / 86400000);
  return dias >= 7;
};

const isVistoriaAlerta = (card) => {
  if (card.status !== "vistoria") return false;
  if (!card.criadoEm) return false;
  const dias = Math.floor((Date.now() - new Date(card.criadoEm)) / 86400000);
  return dias >= 5;
};

const isBoletoAlerta = (card) => {
  if (card.status !== "boleto") return false;
  if (!card.dataAlerta) return false;
  return new Date(card.dataAlerta + "T23:59:59") <= new Date();
};

const fmt = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const fmtBRL = (v) =>
  v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const maskCpfCnpj = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join(".") + (e ? "-" + e : ""));
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, e, f) =>
    [a, b, c].filter(Boolean).join(".").replace(/^(\d{2})\./, "$1.") + (e ? "/" + e : "") + (f ? "-" + f : ""))
    .replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
};

const isCNPJ = (v) => (v || "").replace(/\D/g, "").length > 11;

const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
};

// ── Etiquetas em camadas ──────────────────────────────────────
const RAMOS_IMOVEL = ["EMPRESARIAL","RESIDENCIAL","CONDOMÍNIO","FIANÇA LOCATÍCIA","RC OBRAS","RISCO DE ENGENHARIA","RURAL"];
const RAMOS_VIDA = ["VIDA INDIVIDUAL","VIDA EM GRUPO","ACIDENTES PESSOAIS"];
const RAMOS_EQUIP = ["BIKE","EQUIPAMENTOS PORTÁTEIS"];
const RAMOS_VIAGEM = ["SEGURO VIAGEM"];

const SITUACOES = ["Cancelada","Endosso","Não Renovada","Protocolado","Recusada","Renov. Congênere","Renovação","Seguro Novo","Sem Negócio"];
const PAGAMENTOS = ["Boleto","Cartão de Crédito","Débito em Conta","Link de Pagamento","PIX"];
const CANAIS = ["Google","Indicação","Site"];

const SITUACAO_COR = {
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
const PAGAMENTO_COR = {
  "Boleto":            "bg-amber-100 text-amber-700",
  "Débito em Conta":   "bg-teal-100 text-teal-700",
  "Cartão de Crédito": "bg-purple-100 text-purple-700",
  "PIX":               "bg-emerald-100 text-emerald-700",
  "Link de Pagamento": "bg-indigo-100 text-indigo-700",
};
const CANAL_COR = {
  "Indicação":   "bg-emerald-100 text-emerald-700",
  "Site":        "bg-sky-100 text-sky-700",
  "LojaCorr":    "bg-violet-100 text-violet-700",
  "Parceiro":    "bg-orange-100 text-orange-700",
  "Google":      "bg-red-100 text-red-700",
  "Crosselling": "bg-pink-100 text-pink-700",
};

function TagChip({ label, corMap }) {
  if (!label) return null;
  const cor = corMap[label] || "bg-slate-100 text-slate-500";
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cor}`}>{label}</span>;
}

// ── Supabase helpers ──────────────────────────────────────────
function mapRow(r) {
  return {
    id:            r.id,
    clienteNome:   r.cliente_nome,
    cpfCnpj:       r.cpf_cnpj,
    telefone:      r.telefone,
    email:         r.email,
    endereco:      r.endereco || null,
    tipoSeguro:    r.tipo_seguro,
    seguradora:    r.seguradora,
    veiculo:       r.veiculo,
    dataRenovacao: r.data_renovacao,
    valor:         r.valor,
    status:        r.status_pipeline,
    responsavel:   r.responsavel,
    proposta:      r.proposta,
    apolice:       r.apolice_nova,
    etiquetaSegfy:    r.etiqueta_segfy,
    etiquetaSituacao: r.etiqueta_situacao,
    etiquetaPagamento:r.etiqueta_pagamento,
    etiquetaCanal:    r.etiqueta_canal,
    autoClasseBonus:    r.auto_classe_bonus,    autoNomeSegurado:         r.auto_nome_segurado,
    autoCpfSegurado:          r.auto_cpf_segurado,
    autoNascimentoSegurado:   r.auto_nascimento_segurado,
    autoCondutor:             r.auto_condutor,
    autoCpfCondutor:          r.auto_cpf_condutor,
    autoNascimentoCondutor:   r.auto_nascimento_condutor,
    autoDataNasc:       r.auto_data_nascimento,
    autoSexo:           r.auto_sexo,
    autoEstadoCivil:    r.auto_estado_civil,
    autoEstadoCivilCondutor: r.auto_estado_civil_condutor,
    autoTipoUtilizacao:  r.auto_tipo_utilizacao,
    autoCondutor1825:    r.auto_condutor_1825 || false,
    autoMenorResidente: r.auto_menor_residente || false,
    autoCepPernoite:    r.auto_cep_pernoite,
    autoPlaca:          r.auto_placa,
    autoModelo:         r.auto_modelo,
    autoAnoFab:         r.auto_ano_fab,
    autoAnoMod:         r.auto_ano_mod,
    autoChassi:         r.auto_chassi,
    arquivado:        r.arquivado || false,
    arquivadoEm:      r.arquivado_em,
    transmitidaEm:    r.transmitida_em || null,
    historicoCiclos:  r.historico_ciclos || [],
    anotacoes:        r.observacoes,
    followUps:        r.cotacoes || [],
    sinistros:        r.sinistros || [],
    mesReferencia:    r.mes_referencia,
    clienteId:        r.cliente_id,
    criadoEm:         r.criado_em,
    apoliceAnexada:   r.apolice_anexada || false,
    autoEnviadaCliente: r.auto_enviada_cliente || false,
    endossos:         r.endossos || [],
    dataAlerta:       r.data_alerta || null,
    imovelCep:         r.imovel_cep || null,
    imovelLogradouro:  r.imovel_logradouro || null,
    imovelNumero:      r.imovel_numero || null,
    imovelComplemento: r.imovel_complemento || null,
    imovelBairro:      r.imovel_bairro || null,
    imovelCidade:      r.imovel_cidade || null,
    imovelUf:          r.imovel_uf || null,
    imovelAtividade:   r.imovel_atividade || null,
    imovelTipo:        r.imovel_tipo || null,
    imovelValorRisco:  r.imovel_valor_risco || null,
    vidaCapitalMorte:     r.vida_capital_morte || null,
    vidaCapitalInvalidez: r.vida_capital_invalidez || null,
    vidaCapitalFuneral:   r.vida_capital_funeral || null,
    vidaBeneficiarios:    r.vida_beneficiarios || [],
    equipTipo:           r.equip_tipo || null,
    equipMarca:          r.equip_marca || null,
    equipModelo:         r.equip_modelo || null,
    equipSerie:          r.equip_serie || null,
    equipDataAquisicao:  r.equip_data_aquisicao || null,
    equipValorAquisicao: r.equip_valor_aquisicao || null,
    viagemDestino:     r.viagem_destino || null,
    viagemOrigem:      r.viagem_origem || null,
    viagemMotivo:      r.viagem_motivo || null,
    viagemDataIda:     r.viagem_data_ida || null,
    viagemDataVolta:   r.viagem_data_volta || null,
    viagemFaixaEtaria: r.viagem_faixa_etaria || null,
  };
}

async function loadCards(arquivados = false) {
  let query = supabase.from("renovacoes").select("*");
  if (arquivados) {
    query = query.eq("arquivado", true);
  } else {
    query = query.neq("arquivado", true);
  }
  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) { console.error("Erro ao carregar:", error); return []; }
  return (data || []).map(mapRow);
}

async function searchAllCards(q) {
  if (!q || q.length < 2) return [];
  const { data } = await supabase
    .from("renovacoes")
    .select("*")
    .or(`cliente_nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%,auto_placa.ilike.%${q}%`)
    .order("arquivado", { ascending: true })
    .limit(10);
  return (data || []).map(mapRow);
}

async function upsertCard(card) {
  const row = {
    id:              card.id,
    cliente_id:      card.clienteId || null,
    apolice_id:      card.apoliceId || null,
    cliente_nome:    card.clienteNome,
    cpf_cnpj:        card.cpfCnpj,
    telefone:        card.telefone,
    email:           card.email,
    endereco:        card.endereco || null,
    tipo_seguro:     card.tipoSeguro,
    seguradora:      card.seguradora,
    veiculo:         card.veiculo,
    data_renovacao:  card.dataRenovacao || null,
    valor:           card.valor ? Number(card.valor) : null,
    status_pipeline: card.status,
    responsavel:     card.responsavel,
    proposta:        card.proposta,
    apolice_nova:    card.apolice,
    etiqueta_segfy:     card.etiquetaSegfy || false,
    etiqueta_situacao:  card.etiquetaSituacao || null,
    etiqueta_pagamento: card.etiquetaPagamento || null,
    etiqueta_canal:     card.etiquetaCanal || null,
    auto_classe_bonus:     card.autoClasseBonus ? Number(card.autoClasseBonus) : null,
    auto_nome_segurado:          card.autoNomeSegurado || null,
    auto_cpf_segurado:           card.autoCpfSegurado || null,
    auto_nascimento_segurado:    card.autoNascimentoSegurado || null,
    auto_condutor:               card.autoCondutor || null,
    auto_cpf_condutor:           card.autoCpfCondutor || null,
    auto_nascimento_condutor:    card.autoNascimentoCondutor || null,
    auto_data_nascimento:  card.autoDataNasc || null,
    auto_sexo:             card.autoSexo || null,
    auto_estado_civil:     card.autoEstadoCivil || null,
    auto_estado_civil_condutor: card.autoEstadoCivilCondutor || null,
    auto_tipo_utilizacao:  card.autoTipoUtilizacao || null,
    auto_condutor_1825:    card.autoCondutor1825 || false,
    auto_menor_residente:  card.autoMenorResidente || false,
    auto_cep_pernoite:     card.autoCepPernoite || null,
    auto_placa:            card.autoPlaca ? card.autoPlaca.toUpperCase() : null,
    auto_modelo:           card.autoModelo || null,
    auto_ano_fab:          card.autoAnoFab ? Number(card.autoAnoFab) : null,
    auto_ano_mod:          card.autoAnoMod ? Number(card.autoAnoMod) : null,
    auto_chassi:           card.autoChassi || null,
    arquivado:        card.arquivado || false,
    arquivado_em:     card.arquivadoEm || null,
    transmitida_em:   card.transmitidaEm || null,
    historico_ciclos: card.historicoCiclos || [],
    observacoes:      card.anotacoes,
    cotacoes:         card.followUps || [],
    sinistros:        card.sinistros || [],
    mes_referencia:   card.mesReferencia || new Date().toISOString().slice(0, 7),
    atualizado_em:    new Date().toISOString(),
    apolice_anexada:  card.apoliceAnexada || false,
    auto_enviada_cliente: card.autoEnviadaCliente || false,
    endossos:         card.endossos || [],
    data_alerta:      card.dataAlerta || null,
    imovel_cep:         card.imovelCep || null,
    imovel_logradouro:  card.imovelLogradouro || null,
    imovel_numero:      card.imovelNumero || null,
    imovel_complemento: card.imovelComplemento || null,
    imovel_bairro:      card.imovelBairro || null,
    imovel_cidade:      card.imovelCidade || null,
    imovel_uf:          card.imovelUf || null,
    imovel_atividade:   card.imovelAtividade || null,
    imovel_tipo:        card.imovelTipo || null,
    imovel_valor_risco: card.imovelValorRisco ? Number(card.imovelValorRisco) : null,
    vida_capital_morte:     card.vidaCapitalMorte ? Number(card.vidaCapitalMorte) : null,
    vida_capital_invalidez: card.vidaCapitalInvalidez ? Number(card.vidaCapitalInvalidez) : null,
    vida_capital_funeral:   card.vidaCapitalFuneral ? Number(card.vidaCapitalFuneral) : null,
    vida_beneficiarios:     card.vidaBeneficiarios || [],
    equip_tipo:            card.equipTipo || null,
    equip_marca:           card.equipMarca || null,
    equip_modelo:          card.equipModelo || null,
    equip_serie:           card.equipSerie || null,
    equip_data_aquisicao:  card.equipDataAquisicao || null,
    equip_valor_aquisicao: card.equipValorAquisicao ? Number(card.equipValorAquisicao) : null,
    viagem_destino:      card.viagemDestino || null,
    viagem_origem:       card.viagemOrigem || null,
    viagem_motivo:       card.viagemMotivo || null,
    viagem_data_ida:     card.viagemDataIda || null,
    viagem_data_volta:   card.viagemDataVolta || null,
    viagem_faixa_etaria: card.viagemFaixaEtaria || null,
  };
  const { error } = await supabase.from("renovacoes").upsert(row);
  if (error) console.error("Erro ao salvar:", error);
}

async function deleteCard(id) {
  const { error } = await supabase.from("renovacoes").delete().eq("id", id);
  if (error) console.error("Erro ao deletar:", error);
}

// ── Helpers de documentos ──────────────────────────────────────
async function loadDocs(renovacaoId) {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("renovacao_id", renovacaoId)
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function uploadDoc(renovacaoId, tipo, file) {
  const ext = file.name.split(".").pop();
  const path = `${renovacaoId}/${tipo}_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
  if (upErr) { console.error("Erro no upload:", upErr); return null; }
  const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
  const { data, error: dbErr } = await supabase.from("documentos").insert({
    renovacao_id: renovacaoId, tipo, nome_arquivo: file.name, storage_path: path,
  }).select().single();
  if (dbErr) { console.error("Erro ao salvar doc:", dbErr); return null; }
  if (tipo === "apolice") {
    await supabase.from("renovacoes").update({ apolice_anexada: true }).eq("id", renovacaoId);
  }
  return { ...data, publicUrl };
}

async function deleteDoc(doc) {
  await supabase.storage.from("documentos").remove([doc.storage_path]);
  await supabase.from("documentos").delete().eq("id", doc.id);
}

function docPublicUrl(storagePath) {
  const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(storagePath);
  return publicUrl;
}

// ── Helpers de prospecção ─────────────────────────────────────
async function criarProspeccao(card) {
  const { data: ex } = await supabase.from("prospeccoes").select("id").eq("renovacao_id", card.id).limit(1);
  if (ex && ex.length > 0) return;
  const dataVenc = card.dataRenovacao ? new Date(card.dataRenovacao + "T12:00:00") : null;
  const dataContato = dataVenc ? new Date(dataVenc.getTime() + (365 - 30) * 86400000) : null;
  const { error } = await supabase.from("prospeccoes").insert({
    id: genId(),
    renovacao_id:          card.id,
    cliente_nome:          card.clienteNome,
    cpf_cnpj:              card.cpfCnpj,
    telefone:              card.telefone,
    email:                 card.email,
    produto:               card.tipoSeguro,
    seguradora_anterior:   card.seguradora,
    valor_anterior:        card.valor ? Number(card.valor) : null,
    data_vencimento_anterior: card.dataRenovacao || null,
    data_prevista_contato: dataContato ? dataContato.toISOString().slice(0, 10) : null,
    status_prospeccao:     "FRIA",
  });
  if (error) console.error("Erro ao criar prospecção:", error);
}

async function loadProspeccoes() {
  const { data, error } = await supabase
    .from("prospeccoes").select("*")
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id:                r.id,
    renovacaoId:       r.renovacao_id,
    clienteNome:       r.cliente_nome,
    cpfCnpj:           r.cpf_cnpj,
    telefone:          r.telefone,
    email:             r.email,
    produto:           r.produto,
    seguradoraAnterior:r.seguradora_anterior,
    valorAnterior:     r.valor_anterior,
    dataVencAnterior:  r.data_vencimento_anterior,
    dataPrevistaContato: r.data_prevista_contato,
    status:            r.status_prospeccao || "FRIA",
    observacoes:       r.observacoes,
    criadoEm:          r.criado_em,
  }));
}

async function upsertProspeccao(p) {
  const { error } = await supabase.from("prospeccoes").upsert({
    id:                    p.id,
    renovacao_id:          p.renovacaoId,
    cliente_nome:          p.clienteNome,
    cpf_cnpj:              p.cpfCnpj,
    telefone:              p.telefone,
    email:                 p.email,
    produto:               p.produto,
    seguradora_anterior:   p.seguradoraAnterior,
    valor_anterior:        p.valorAnterior ? Number(p.valorAnterior) : null,
    data_vencimento_anterior: p.dataVencAnterior || null,
    data_prevista_contato: p.dataPrevistaContato || null,
    status_prospeccao:     p.status,
    observacoes:           p.observacoes || null,
    atualizado_em:         new Date().toISOString(),
  });
  if (error) console.error("Erro ao salvar prospecção:", error);
}

// ── Helpers de cliente ───────────────────────────────────────
async function searchClientes(q) {
  if (!q || q.length < 2) return [];
  const normQ = q.replace(/\D/g, "");
  const filter = normQ.length >= 3
    ? `cpf_cnpj_norm.ilike.${normQ}%,nome.ilike.%${q}%`
    : `nome.ilike.%${q}%`;
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, cpf_cnpj, cpf_cnpj_norm, telefone, email, tipo_pessoa")
    .or(filter)
    .limit(8);
  return data || [];
}

async function findOrCreateCliente({ nome, cpfCnpj, telefone, email }) {
  // Normalização robusta: só dígitos; se vier com zero a mais, mantém os 14 últimos (CNPJ) / 11 (CPF)
  let normCpf = (cpfCnpj || "").replace(/\D/g, "");
  if (normCpf.length > 14) normCpf = normCpf.slice(-14);
  if (normCpf) {
    const { data: existing } = await supabase
      .from("clientes").select("id")
      .eq("cpf_cnpj_norm", normCpf).maybeSingle();
    if (existing) return existing.id;
  }
  const id = genId();
  const tipoPessoa = normCpf.length === 11 ? "PF" : normCpf.length === 14 ? "PJ" : "?";
  const { error } = await supabase.from("clientes").insert({
    id,
    cpf_cnpj_norm: normCpf || null,
    cpf_cnpj:      cpfCnpj || null,
    nome:          nome || "(sem nome)",
    telefone:      telefone || null,
    email:         email || null,
    tipo_pessoa:   normCpf ? tipoPessoa : "?",
  });
  if (error) { console.error("Erro ao criar cliente:", error); return null; }
  return id;
}

// ── Componentes de Prospecção ─────────────────────────────────
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

function ProspeccoesView({ prospeccoes, onUpdate, onRecuperar }) {
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

// ── Componentes ───────────────────────────────────────────────
function DocsSection({ cardId, onApoliceAnexada, onPropostaAnexada, onExtrairDados }) {
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

function EndossoSection({ endossos, onChange, onCancelar }) {
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
      if (!window.confirm("Cancelar esta apólice?\n\nO card será arquivado como Cancelada. O histórico será preservado.")) return;
      onCancelar({ id: genId(), tipo: "cancelamento", data: form.data || new Date().toISOString().slice(0, 10) });
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
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        ⚠️ Esta ação encerrará a apólice e arquivará o card como <strong>Cancelada</strong>. O histórico é sempre preservado.
      </p>
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
              className={`px-3 py-1.5 text-xs text-white rounded-lg font-semibold ${form.tipo==="cancelamento" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
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
      className={`bg-white rounded-xl p-2.5 mb-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors border ${apoliceAlert ? "border-red-400 border-2" : vistoriaAlert ? "border-orange-400 border-2" : boletoAlert ? "border-yellow-500 border-2" : urgent ? "border-l-4 border-l-red-500 border-slate-200" : warn ? "border-l-4 border-l-yellow-400 border-slate-200" : "border-slate-200"}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex justify-between items-start gap-1">
        <span className="font-semibold text-slate-800 text-sm leading-snug flex-1">{card.clienteNome}</span>
        {card.etiquetaSegfy && <Tag size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />}
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{card.tipoSeguro}{card.seguradora ? ` · ${card.seguradora}` : ""}</div>
      {card.veiculo && card.veiculo !== "—" && <div className="text-xs text-slate-400 truncate">{card.veiculo}</div>}
      {(card.etiquetaSituacao || card.etiquetaPagamento || card.etiquetaCanal) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <TagChip label={card.etiquetaSituacao}  corMap={SITUACAO_COR} />
          <TagChip label={card.etiquetaPagamento} corMap={PAGAMENTO_COR} />
          <TagChip label={card.etiquetaCanal}     corMap={CANAL_COR} />
        </div>
      )}
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-xs font-semibold text-emerald-600">{fmtBRL(card.valor)}</span>
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
const SN_STATUS_COR_PILL = {
  "Aberto":                "bg-red-100 text-red-700",
  "Documentação":          "bg-amber-100 text-amber-700",
  "Aguardando Seguradora": "bg-blue-100 text-blue-700",
  "Em Regulação":          "bg-violet-100 text-violet-700",
};

function PainelSinistros({ cards, onCard }) {
  const itens = cards.flatMap(c =>
    (c.sinistros || [])
      .filter(s => s.status !== "Encerrado")
      .map(s => ({ ...s, card: c }))
  ).sort((a, b) => (a.dataOcorrencia || "").localeCompare(b.dataOcorrencia || ""));

  return (
    <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2 bg-white sticky top-0">
        <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700">Sinistros abertos</span>
        {itens.length > 0 && (
          <span className="ml-auto text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">{itens.length}</span>
        )}
      </div>
      {itens.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-8 px-3">Nenhum sinistro aberto.</div>
      ) : (
        <div className="p-2 space-y-2">
          {itens.map(s => (
            <div key={s.id}
              onClick={() => onCard(s.card)}
              className="bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:border-red-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-semibold text-slate-700">{s.tipo}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SN_STATUS_COR_PILL[s.status] || "bg-slate-100 text-slate-500"}`}>{s.status}</span>
              </div>
              <div className="text-xs text-slate-600 font-medium truncate">{s.card.clienteNome}</div>
              <div className="text-xs text-slate-400 truncate">{s.card.tipoSeguro} · {s.card.seguradora}</div>
              {s.protocolo && <div className="text-xs text-slate-400 mt-0.5">Prot: {s.protocolo}</div>}
              {s.dataPrevistaResolucao && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Previsão: {new Date(s.dataPrevistaResolucao + "T00:00:00").toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function Column({ stage, cards, onCard, onAdd, onDrop }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragOver(true); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); const cardId = e.dataTransfer.getData("cardId"); if (cardId) onDrop(cardId, stage.id); };

  return (
    <div className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden" style={{ width: 256, boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}>
      <div className={`flex items-center justify-between px-3 py-2.5 ${stage.badge} text-white`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs uppercase tracking-wide">{stage.label}</span>
          {stage.optional && <span className="text-xs opacity-70 font-normal normal-case">específicos</span>}
        </div>
        <span className="text-xs font-bold bg-white bg-opacity-25 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{cards.length}</span>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 p-2 min-h-40 overflow-y-auto transition-colors ${isDragOver ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "bg-white"}`}
        style={{ maxHeight: "calc(100vh - 185px)" }}>
        {cards.map(c => <CardTile key={c.id} card={c} onClick={onCard} />)}
        <button onClick={() => onAdd(stage.id)} className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors mt-0.5">
          <Plus size={12} /> Adicionar card
        </button>
      </div>
    </div>
  );
}

function Modal({ card, onClose, onSave, onDelete, onArquivar, onDesarquivar, onNaoRenovada, onVerCliente, onApoliceAnexada, onPropostaAnexada, onExtrairDados }) {
  const [d, setD] = useState({ followUps: [], historicoCiclos: [], ...card });
  const [fuText, setFuText] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [del, setDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snForm, setSnForm] = useState(null);
  const [condutorDif, setCondutorDif] = useState(!!(card.autoCondutor && card.autoCondutor !== card.autoNomeSegurado));

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));

  const handleExtrairDados = (data, tipo) => {
    const updates = {};
    const parseBRLlocal = (s) => {
      if (!s) return null;
      const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? null : n;
    };

    const SN_STATUS_COR_PILL = {
  "Aberto":                "bg-red-100 text-red-700",
  "Documentação":          "bg-amber-100 text-amber-700",
  "Aguardando Seguradora": "bg-blue-100 text-blue-700",
  "Em Regulação":          "bg-violet-100 text-violet-700",
};

function PainelSinistros({ cards, onCard }) {
  const itens = cards.flatMap(c =>
    (c.sinistros || [])
      .filter(s => s.status !== "Encerrado")
      .map(s => ({ ...s, card: c }))
  ).sort((a, b) => (a.dataOcorrencia || "").localeCompare(b.dataOcorrencia || ""));

  return (
    <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center gap-2 bg-white sticky top-0">
        <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700">Sinistros abertos</span>
        {itens.length > 0 && (
          <span className="ml-auto text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">{itens.length}</span>
        )}
      </div>
      {itens.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-8 px-3">Nenhum sinistro aberto.</div>
      ) : (
        <div className="p-2 space-y-2">
          {itens.map(s => (
            <div key={s.id}
              onClick={() => onCard(s.card)}
              className="bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:border-red-300 hover:shadow-sm transition-all">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-semibold text-slate-700">{s.tipo}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SN_STATUS_COR_PILL[s.status] || "bg-slate-100 text-slate-500"}`}>{s.status}</span>
              </div>
              <div className="text-xs text-slate-600 font-medium truncate">{s.card.clienteNome}</div>
              <div className="text-xs text-slate-400 truncate">{s.card.tipoSeguro} · {s.card.seguradora}</div>
              {s.protocolo && <div className="text-xs text-slate-400 mt-0.5">Prot: {s.protocolo}</div>}
              {s.dataPrevistaResolucao && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Previsão: {new Date(s.dataPrevistaResolucao + "T00:00:00").toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
    if (data.apolice?.vigenciaFim) updates.dataRenovacao = data.apolice.vigenciaFim;
    if (!d.valor && data.financeiro?.premioTotal) updates.valor = parseBRLlocal(data.financeiro.premioTotal);
    if (!d.premioLiquido && data.financeiro?.premioLiquido) updates.premioLiquido = parseBRLlocal(data.financeiro.premioLiquido);
    if (!d.seguradora && data.apolice?.seguradora) updates.seguradora = data.apolice.seguradora;
    if (!d.proposta && data.apolice?.numeroProposta) updates.proposta = data.apolice.numeroProposta;
    if (!d.apolice && data.apolice?.numeroApolice) updates.apolice = data.apolice.numeroApolice;
    if (tipo === "apolice_endosso" && data.financeiro?.premioLiquido) {
      const delta = parseBRLlocal(data.financeiro.premioLiquido);
      if (delta) {
        const novoEndosso = {
          id: Math.random().toString(36).slice(2),
          tipo: "alteracao_financeira",
          data: data.apolice?.dataEmissao || new Date().toISOString().slice(0, 10),
          premioLiquidoDelta: delta,
        };
        updates.endossos = [...(d.endossos || []), novoEndosso];
      }
    }
    if (Object.keys(updates).length > 0) {
      setD(prev => ({ ...prev, ...updates }));
      alert("✅ " + Object.keys(updates).length + " campo(s) preenchido(s) com dados do PDF. Revise e salve.");
    } else {
      alert("Nenhum campo novo encontrado no documento (campos já preenchidos foram mantidos).");
    }
  };

  const addBeneficiario = () => set("vidaBeneficiarios", [...(d.vidaBeneficiarios || []), { id: genId(), nome: "", parentesco: "", cpf: "", percentual: "" }]);
  const removeBeneficiario = (id) => set("vidaBeneficiarios", (d.vidaBeneficiarios || []).filter(b => b.id !== id));
  const updateBeneficiario = (id, campo, valor) => set("vidaBeneficiarios", (d.vidaBeneficiarios || []).map(b => b.id === id ? { ...b, [campo]: valor } : b));

  // Sync card prop changes (e.g. after handleApoliceAnexada updates selected)
  useEffect(() => {
    setD(prev => ({ ...prev, status: card.status, apoliceAnexada: card.apoliceAnexada }));
  }, [card.status, card.apoliceAnexada]);

  const stageIdx = STAGES.findIndex(s => s.id === d.status);

  const addFu = () => {
    if (!fuText.trim()) return;
    set("followUps", [...(d.followUps || []), { id: genId(), texto: fuText, data: fuDate, feito: false }]);
    setFuText(""); setFuDate("");
  };
  const toggleFu = (id) => set("followUps", d.followUps.map(f => f.id === id ? { ...f, feito: !f.feito } : f));

  const SN_STATUS = ["Aberto","Documentação","Aguardando Seguradora","Em Regulação","Encerrado"];
  const SN_DOCS   = ["BO","Fotos","NF","CNH","CRLV","Laudo"];

  const addSinistro = () => {
    if (!snForm?.tipo) return;
    const novo = {
      id: genId(), tipo: snForm.tipo, protocolo: snForm.protocolo || "",
      descricao: snForm.descricao || "", dataOcorrencia: snForm.dataOcorrencia || "",
      dataPrevistaResolucao: snForm.dataPrevistaResolucao || "",
      dataEncerramento: snForm.dataEncerramento || "",
      status: snForm.status || "Aberto",
      docs: snForm.docs || [],
      contatos: [],
      observacoes: snForm.observacoes || "",
    };
    set("sinistros", [...(d.sinistros || []), novo]);
    setSnForm(null);
  };
  const removeSinistro = (id) => set("sinistros", (d.sinistros || []).filter(s => s.id !== id));
  const updateSinistroStatus = (id, status) => set("sinistros", (d.sinistros || []).map(s =>
    s.id === id ? { ...s, status, dataEncerramento: status === "Encerrado" ? (s.dataEncerramento || new Date().toISOString().slice(0,10)) : s.dataEncerramento } : s));
  const addContatoSinistro = (sinId, contato) => set("sinistros", (d.sinistros || []).map(s =>
    s.id === sinId ? { ...s, contatos: [...(s.contatos||[]), { id: genId(), ...contato }] } : s));
  const toggleDocSinistro = (sinId, doc) => set("sinistros", (d.sinistros || []).map(s =>
    s.id === sinId ? { ...s, docs: (s.docs||[]).includes(doc) ? s.docs.filter(d=>d!==doc) : [...(s.docs||[]),doc] } : s));
  const [snContatoForm, setSnContatoForm] = useState({});

  const handleSave = async () => {
    setSaving(true);
    await onSave(d);
    setSaving(false);
  };

  const handleDesarquivarModal = async () => {
    if (!window.confirm("Desarquivar este card?\n\nEle voltará para Cotações e Leads.")) return;
    setSaving(true);
    await onDesarquivar({ ...d, arquivado: false, arquivadoEm: null, status: "cotacoes" });
    setSaving(false);
  };

  const handleNaoRenovadaModal = async () => {
    if (!window.confirm("Marcar como não renovada?\n\nO card será arquivado e uma prospecção será criada automaticamente para acompanhamento futuro.")) return;
    setSaving(true);
    await onNaoRenovada({ ...d, etiquetaSituacao: "Não Renovada" });
    setSaving(false);
  };

  const handleCancelarApolice = async (endosso) => {
    const updated = { ...d, endossos: [...(d.endossos||[]), endosso], etiquetaSituacao: "Cancelada", arquivado: true, arquivadoEm: new Date().toISOString() };
    await onArquivar(updated);
  };

  const handleArquivar = async () => {
    if (!window.confirm("Confirmar envio ao cliente e arquivar este card?\n\nEle sairá do pipeline e será reativado automaticamente 30 dias antes do próximo vencimento.")) return;
    const ciclo = {
      data_renovacao: d.dataRenovacao,
      seguradora:     d.seguradora,
      valor:          d.valor,
      proposta:       d.proposta,
      apolice:        d.apolice,
      situacao:       d.etiquetaSituacao,
      arquivado_em:   new Date().toISOString(),
    };
    const historico = [...(d.historicoCiclos || []), ciclo];
    setSaving(true);
    await onArquivar({ ...d, historicoCiclos: historico, arquivado: true, arquivadoEm: new Date().toISOString() });
    setSaving(false);
  };

  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{d.clienteNome || "Novo cliente"}</h2>
            {d.clienteId && onVerCliente && (
              <button onClick={() => onVerCliente(d.clienteId)}
                className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm">
                <Users size={12} /> Ver histórico do cliente
              </button>
            )}
            {d.arquivado ? (
              <span className="text-xs font-semibold bg-amber-500 text-white px-2.5 py-0.5 rounded-full mt-1 inline-flex items-center gap-1">
                <Archive size={10} /> Arquivado
              </span>
            ) : (
              <span className={`text-xs font-semibold ${STAGES[stageIdx]?.badge || "bg-slate-500"} text-white px-2.5 py-0.5 rounded-full mt-1 inline-block`}>
                {STAGES[stageIdx]?.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div className="flex gap-2 flex-wrap">
            {stageIdx > 0 && (
              <button onClick={() => set("status", STAGES[stageIdx - 1].id)}
                className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
                <ChevronLeft size={12} /> {STAGES[stageIdx - 1].short}
              </button>
            )}
            {stageIdx < STAGES.length - 1 && (
              <button onClick={() => set("status", STAGES[stageIdx + 1].id)}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg">
                Mover → {STAGES[stageIdx + 1].short} <ChevronRight size={12} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Nome do cliente *</label>
              <input className={inp} value={d.clienteNome || ""} onChange={e => set("clienteNome", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>CPF / CNPJ</label>
              <input className={inp} value={d.cpfCnpj || ""} onChange={e => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={lbl}>Telefone / WhatsApp</label>
              <input className={inp} value={d.telefone || ""} onChange={e => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input className={inp} value={d.email || ""} onChange={e => set("email", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Endereço</label>
              <input className={inp} value={d.endereco || ""} onChange={e => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro, cidade, UF" />
            </div>
            <div>
              <label className={lbl}>Responsável</label>
              <input className={inp} value={d.responsavel || ""} onChange={e => set("responsavel", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Produto</label>
              <select className={inp} value={d.tipoSeguro || ""} onChange={e => set("tipoSeguro", e.target.value)}>
                <option value="">Selecione</option>
                {["ACIDENTES PESSOAIS","AUTOMÓVEL","AUXÍLIO FUNERAL","BIKE","CAPITALIZAÇÃO",
                  "CONDOMÍNIO","CONSÓRCIO","DENTAL","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS",
                  "FIANÇA LOCATÍCIA","PET","PREVIDÊNCIA","RC OBRAS","RC PROFISSIONAL",
                  "RESIDENCIAL","RISCO DE ENGENHARIA","RURAL","SAÚDE","SEGURO EVENTO",
                  "SEGURO VIAGEM","TRANSPORTES","VIDA EM GRUPO","VIDA INDIVIDUAL"].map(t => <option key={t}>{t}</option>)}
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
              <label className={lbl}>Situação</label>
              <select className={inp} value={d.etiquetaSituacao || ""} onChange={e => set("etiquetaSituacao", e.target.value)}>
                <option value="">Selecione</option>
                <option value="Seguro Novo">Seguro Novo</option>
                <option value="Renovação Congênere">Renovação Congênere</option>
                <option value="Renovação">Renovação</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Forma de pagamento</label>
              <select className={inp} value={d.etiquetaPagamento || ""} onChange={e => set("etiquetaPagamento", e.target.value)}>
                <option value="">Selecione</option>
                {PAGAMENTOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {d.status === "boleto" && (
              <div>
                <label className={lbl}>📅 Data de vencimento</label>
                <input type="date" className={inp} value={d.dataAlerta || ""} onChange={e => set("dataAlerta", e.target.value)} />
              </div>
            )}
            <div className="col-span-2">
              <label className={lbl}>Canal de origem</label>
              <select className={inp} value={d.etiquetaCanal || ""} onChange={e => set("etiquetaCanal", e.target.value)}>
                <option value="">Selecione</option>
                {CANAIS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {d.tipoSeguro !== "AUTOMÓVEL" && !RAMOS_IMOVEL.includes(d.tipoSeguro) && !RAMOS_VIDA.includes(d.tipoSeguro) && !RAMOS_EQUIP.includes(d.tipoSeguro) && !RAMOS_VIAGEM.includes(d.tipoSeguro) && (
              <div className="col-span-2">
                <label className={lbl}>Bem segurado / descrição</label>
                <input className={inp} placeholder="Descrição do bem ou risco segurado" value={d.veiculo || ""} onChange={e => set("veiculo", e.target.value)} />
              </div>
            )}
            <div>
              <label className={lbl}>Data de renovação</label>
              <input type="date" className={inp} value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Prêmio (R$){d.etiquetaSituacao === "Renovação Congênere" ? " *" : ""}</label>
              <input type="number" className={`${inp} ${d.etiquetaSituacao === "Renovação Congênere" ? "border-amber-300" : ""}`}
                value={d.valor || ""} onChange={e => set("valor", e.target.value)}
                placeholder={d.etiquetaSituacao === "Renovação Congênere" ? "Valor do ano anterior" : ""} />
            </div>
            <div>
              <label className={lbl}>Nº da proposta</label>
              <input className={inp} value={d.proposta || ""} onChange={e => set("proposta", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Nº da apólice</label>
              <input className={inp} value={d.apolice || ""} onChange={e => set("apolice", e.target.value)} />
            </div>
          </div>

          {d.tipoSeguro === "AUTOMÓVEL" && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">🚗 Dados do automóvel</p>
              <div className="grid grid-cols-2 gap-4">
                <div className={condutorDif ? "" : "col-span-2"}>
                  <label className={lbl}>Segurado (titular)</label>
                  <input className={inp} placeholder="Titular do contrato" value={d.autoNomeSegurado || ""} onChange={e => set("autoNomeSegurado", e.target.value)} />
                </div>
                {condutorDif && (
                  <div>
                    <label className={lbl}>Condutor principal</label>
                    <input className={inp} placeholder="Nome do condutor" value={d.autoCondutor || ""} onChange={e => set("autoCondutor", e.target.value)} />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                      checked={condutorDif}
                      onChange={e => {
                        setCondutorDif(e.target.checked);
                        if (!e.target.checked) set("autoCondutor", d.autoNomeSegurado || "");
                      }} />
                    <span className="text-sm text-slate-600">Condutor diferente do segurado</span>
                  </label>
                </div>
                <div>
                  <label className={lbl}>Classe de bônus</label>
                  <input type="number" min="0" max="10" className={inp} placeholder="0 a 10" value={d.autoClasseBonus ?? ""} onChange={e => set("autoClasseBonus", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>
                    Data de nascimento {condutorDif ? "(condutor)" : ""}
                    {d.autoDataNasc && (() => {
                      const anos = Math.floor((new Date() - new Date(d.autoDataNasc + "T12:00:00")) / (365.25 * 86400000));
                      return <span className="ml-2 text-blue-600 font-bold normal-case">{anos} anos</span>;
                    })()}
                  </label>
                  <input type="date" className={inp} value={d.autoDataNasc || ""} onChange={e => set("autoDataNasc", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Sexo</label>
                  <select className={inp} value={d.autoSexo || ""} onChange={e => set("autoSexo", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Masculino</option>
                    <option>Feminino</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estado civil</label>
                  <select className={inp} value={d.autoEstadoCivil || ""} onChange={e => set("autoEstadoCivil", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Solteiro(a)</option>
                    <option>Casado(a)</option>
                    <option>Divorciado(a)</option>
                    <option>Viúvo(a)</option>
                    <option>União Estável</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Placa</label>
                  <input className={inp} placeholder="AAA-0000" value={d.autoPlaca || ""} onChange={e => set("autoPlaca", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className={lbl}>CEP de pernoite</label>
                  <input className={inp} placeholder="00000-000" value={d.autoCepPernoite || ""}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      set("autoCepPernoite", v.length > 5 ? v.replace(/(\d{5})(\d{1,3})/, "$1-$2") : v);
                    }} />
                </div>
                <div>
                  <label className={lbl}>Tipo de utilização</label>
                  <select className={inp} value={d.autoTipoUtilizacao || ""} onChange={e => set("autoTipoUtilizacao", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Particular</option>
                    <option>Táxi</option>
                    <option>Comercial</option>
                    <option>Uber/App</option>
                    <option>Mototáxi</option>
                    <option>Escolar</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estado civil (condutor)</label>
                  <select className={inp} value={d.autoEstadoCivilCondutor || ""} onChange={e => set("autoEstadoCivilCondutor", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Solteiro(a)</option>
                    <option>Casado(a)</option>
                    <option>Divorciado(a)</option>
                    <option>Viúvo(a)</option>
                    <option>União Estável</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-1">
                  <input type="checkbox" id="condutor1825" checked={d.autoCondutor1825 || false} onChange={e => set("autoCondutor1825", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="condutor1825" className="text-sm text-slate-700 cursor-pointer">Cobertura para condutor de 18 a 25 anos contratada</label>
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Modelo do veículo</label>
                  <input className={inp} placeholder="Ex: Honda HR-V EX" value={d.autoModelo || ""} onChange={e => set("autoModelo", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Ano de fabricação</label>
                  <input type="number" className={inp} placeholder="2022" value={d.autoAnoFab || ""} onChange={e => set("autoAnoFab", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Ano do modelo</label>
                  <input type="number" className={inp} placeholder="2023" value={d.autoAnoMod || ""} onChange={e => set("autoAnoMod", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Chassi <span className="font-normal normal-case text-slate-400">(opcional)</span></label>
                  <input className={inp} placeholder="9BWZZZ377VT004251" value={d.autoChassi || ""} onChange={e => set("autoChassi", e.target.value.toUpperCase())} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                      checked={!!d.autoMenorResidente} onChange={e => set("autoMenorResidente", e.target.checked)} />
                    Menor residente no domicílio
                  </label>
                </div>
              </div>
            </div>
          )}

          {RAMOS_IMOVEL.includes(d.tipoSeguro) && (
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50 space-y-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">🏢 Local de risco / bem segurado</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Endereço (logradouro)</label>
                  <input className={inp} placeholder="Rua, avenida, quadra..." value={d.imovelLogradouro || ""} onChange={e => set("imovelLogradouro", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Número</label>
                  <input className={inp} value={d.imovelNumero || ""} onChange={e => set("imovelNumero", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Complemento</label>
                  <input className={inp} placeholder="Sala, bloco, andar..." value={d.imovelComplemento || ""} onChange={e => set("imovelComplemento", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Bairro</label>
                  <input className={inp} value={d.imovelBairro || ""} onChange={e => set("imovelBairro", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>CEP</label>
                  <input className={inp} placeholder="00000-000" value={d.imovelCep || ""} onChange={e => set("imovelCep", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Cidade</label>
                  <input className={inp} value={d.imovelCidade || ""} onChange={e => set("imovelCidade", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>UF</label>
                  <input className={inp} maxLength={2} placeholder="DF" value={d.imovelUf || ""} onChange={e => set("imovelUf", e.target.value.toUpperCase())} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Atividade / ocupação</label>
                  <input className={inp} placeholder="Ex: Escritório, Shopping, Residência..." value={d.imovelAtividade || ""} onChange={e => set("imovelAtividade", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Tipo de bem</label>
                  <select className={inp} value={d.imovelTipo || ""} onChange={e => set("imovelTipo", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Prédio</option>
                    <option>Conteúdo</option>
                    <option>Prédio e Conteúdo</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Valor em risco (R$)</label>
                  <input type="number" className={inp} placeholder="Valor declarado" value={d.imovelValorRisco || ""} onChange={e => set("imovelValorRisco", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {RAMOS_VIDA.includes(d.tipoSeguro) && (
            <div className="border border-rose-200 rounded-xl p-4 bg-rose-50 space-y-4">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">❤️ Dados do seguro de vida / pessoas</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Capital morte (R$)</label>
                  <input type="number" className={inp} placeholder="0,00" value={d.vidaCapitalMorte || ""} onChange={e => set("vidaCapitalMorte", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Capital invalidez (R$)</label>
                  <input type="number" className={inp} placeholder="0,00" value={d.vidaCapitalInvalidez || ""} onChange={e => set("vidaCapitalInvalidez", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Assistência funeral (R$)</label>
                  <input type="number" className={inp} placeholder="0,00" value={d.vidaCapitalFuneral || ""} onChange={e => set("vidaCapitalFuneral", e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={lbl}>Beneficiários</label>
                  <button onClick={addBeneficiario} className="flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 font-semibold transition-colors">
                    <Plus size={13} /> Adicionar beneficiário
                  </button>
                </div>
                {(d.vidaBeneficiarios || []).length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Nenhum beneficiário cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {(d.vidaBeneficiarios || []).map(b => (
                      <div key={b.id} className="bg-white border border-rose-200 rounded-lg p-3 grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <label className="text-xs text-slate-400">Nome</label>
                          <input className={inp} value={b.nome || ""} onChange={e => updateBeneficiario(b.id, "nome", e.target.value)} />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-400">Parentesco</label>
                          <input className={inp} placeholder="Filho(a), Cônjuge..." value={b.parentesco || ""} onChange={e => updateBeneficiario(b.id, "parentesco", e.target.value)} />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-400">CPF</label>
                          <input className={inp} value={b.cpf || ""} onChange={e => updateBeneficiario(b.id, "cpf", maskCpfCnpj(e.target.value))} />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-slate-400">%</label>
                          <input type="number" className={inp} value={b.percentual || ""} onChange={e => updateBeneficiario(b.id, "percentual", e.target.value)} />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button onClick={() => removeBeneficiario(b.id)} className="text-slate-300 hover:text-red-500 pb-2"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const soma = (d.vidaBeneficiarios || []).reduce((s, b) => s + (Number(b.percentual) || 0), 0);
                      if (soma === 0) return null;
                      return (
                        <div className={`text-xs font-semibold text-right pr-2 ${soma === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                          Total: {soma}%{soma !== 100 ? " (deve somar 100%)" : " ✓"}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {RAMOS_EQUIP.includes(d.tipoSeguro) && (
            <div className="border border-cyan-200 rounded-xl p-4 bg-cyan-50 space-y-4">
              <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">🚲 Dados do equipamento</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Tipo de equipamento</label>
                  <input className={inp} placeholder="Bike, notebook, drone..." value={d.equipTipo || ""} onChange={e => set("equipTipo", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Marca</label>
                  <input className={inp} placeholder="Ex: Scott" value={d.equipMarca || ""} onChange={e => set("equipMarca", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Modelo</label>
                  <input className={inp} placeholder="Ex: Scott Addict 20 Disc" value={d.equipModelo || ""} onChange={e => set("equipModelo", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Nº de série / chassi</label>
                  <input className={inp} value={d.equipSerie || ""} onChange={e => set("equipSerie", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Data de aquisição</label>
                  <input type="date" className={inp} value={d.equipDataAquisicao || ""} onChange={e => set("equipDataAquisicao", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Valor de aquisição (R$)</label>
                  <input type="number" className={inp} placeholder="0,00" value={d.equipValorAquisicao || ""} onChange={e => set("equipValorAquisicao", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {RAMOS_VIAGEM.includes(d.tipoSeguro) && (
            <div className="border border-teal-200 rounded-xl p-4 bg-teal-50 space-y-4">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">✈️ Dados da viagem</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Origem</label>
                  <input className={inp} placeholder="Ex: Brasil" value={d.viagemOrigem || ""} onChange={e => set("viagemOrigem", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Destino</label>
                  <input className={inp} placeholder="Ex: Portugal, França" value={d.viagemDestino || ""} onChange={e => set("viagemDestino", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Data de ida</label>
                  <input type="date" className={inp} value={d.viagemDataIda || ""} onChange={e => set("viagemDataIda", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Data de volta</label>
                  <input type="date" className={inp} value={d.viagemDataVolta || ""} onChange={e => set("viagemDataVolta", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Motivo da viagem</label>
                  <input className={inp} placeholder="Turismo/Lazer, Trabalho..." value={d.viagemMotivo || ""} onChange={e => set("viagemMotivo", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Faixa etária</label>
                  <input className={inp} placeholder="Ex: De 50 a 69 anos" value={d.viagemFaixaEtaria || ""} onChange={e => set("viagemFaixaEtaria", e.target.value)} />
                </div>
              </div>
              {d.viagemDataIda && d.viagemDataVolta && (
                <p className="text-xs text-teal-600 font-medium">
                  Período: {Math.max(0, Math.round((new Date(d.viagemDataVolta) - new Date(d.viagemDataIda)) / 86400000) + 1)} dia(s)
                </p>
              )}
            </div>
          )}

          {d.status === "emitida" && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                checked={d.autoEnviadaCliente || false}
                onChange={e => {
                  set("autoEnviadaCliente", e.target.checked);
                  if (e.target.checked) {
                    set("arquivado", true);
                    set("arquivadoEm", new Date().toISOString());
                  } else {
                    set("arquivado", false);
                    set("arquivadoEm", null);
                  }
                }} />
              <Shield size={14} className="text-indigo-500" />
              <span className="font-medium">Apólice enviada ao cliente</span>
              {d.autoEnviadaCliente && <span className="text-xs text-indigo-600 font-semibold">(será arquivada ao salvar)</span>}
            </label>
          )}

          <div>
            <label className={lbl}>Anotações / histórico</label>
            <textarea className={`${inp} resize-none`} rows={3} value={d.anotacoes || ""} onChange={e => set("anotacoes", e.target.value)}
              placeholder="Alterações de perfil, histórico de contato, observações..." />
          </div>

          <div>
            <label className={lbl}>Follow-ups</label>
            <div className="mt-2 space-y-2">
              {(d.followUps || []).map(f => (
                <div key={f.id} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${f.feito ? "bg-slate-50 opacity-60" : "bg-amber-50 border border-amber-200"}`}>
                  <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0" checked={f.feito} onChange={() => toggleFu(f.id)} />
                  <div className="flex-1">
                    <div className={f.feito ? "line-through text-slate-400" : "text-slate-700"}>{f.texto}</div>
                    {f.data && <div className="text-xs text-slate-400 mt-0.5">{fmt(f.data)}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Novo follow-up..." value={fuText} onChange={e => setFuText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFu()} />
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-36"
                value={fuDate} onChange={e => setFuDate(e.target.value)} />
              <button onClick={addFu} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg"><Plus size={16} /></button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-3 py-2 bg-red-600 rounded-xl mb-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide cursor-default">
                <AlertTriangle size={13} /> Sinistros
                {(d.sinistros || []).filter(s => s.status !== "Encerrado").length > 0 && (
                  <span className="bg-white text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {(d.sinistros || []).filter(s => s.status !== "Encerrado").length} aberto{(d.sinistros || []).filter(s => s.status !== "Encerrado").length !== 1 ? "s" : ""}
                  </span>
                )}
              </label>
              <button onClick={() => setSnForm(snForm ? null : { status: "Aberto" })}
                className="flex items-center gap-1 text-xs text-white hover:text-red-200 font-semibold transition-colors">
                <Plus size={13} /> Registrar sinistro
              </button>
            </div>
            {snForm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Tipo *</label>
                    <select className={inp} value={snForm.tipo || ""} onChange={e => setSnForm(p => ({ ...p, tipo: e.target.value }))}>
                      <option value="">Selecione</option>
                      {["Colisão","Roubo/Furto","Incêndio","Vida","Danos Elétricos","RC","Outros"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Protocolo / Nº sinistro</label>
                    <input className={inp} placeholder="Ex: 2024-001234" value={snForm.protocolo || ""} onChange={e => setSnForm(p => ({ ...p, protocolo: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Data de ocorrência</label>
                    <input type="date" className={inp} value={snForm.dataOcorrencia || ""} onChange={e => setSnForm(p => ({ ...p, dataOcorrencia: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Status</label>
                    <select className={inp} value={snForm.status || "Aberto"} onChange={e => setSnForm(p => ({ ...p, status: e.target.value }))}>
                      {SN_STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Descrição do ocorrido</label>
                    <textarea className={inp} rows={2} placeholder="Descreva o que aconteceu..." value={snForm.descricao || ""} onChange={e => setSnForm(p => ({ ...p, descricao: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Data prevista de resolução</label>
                    <input type="date" className={inp} value={snForm.dataPrevistaResolucao || ""} onChange={e => setSnForm(p => ({ ...p, dataPrevistaResolucao: e.target.value }))} />
                  </div>
                  {snForm.status === "Encerrado" && (
                    <div>
                      <label className={lbl}>Data de encerramento</label>
                      <input type="date" className={inp} value={snForm.dataEncerramento || ""} onChange={e => setSnForm(p => ({ ...p, dataEncerramento: e.target.value }))} />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className={lbl}>Documentos</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {SN_DOCS.map(doc => (
                        <label key={doc} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={(snForm.docs||[]).includes(doc)}
                            onChange={() => setSnForm(p => ({ ...p, docs: (p.docs||[]).includes(doc) ? p.docs.filter(d=>d!==doc) : [...(p.docs||[]),doc] }))} />
                          {doc}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Observações</label>
                    <textarea className={inp} rows={2} placeholder="Observações adicionais..." value={snForm.observacoes || ""} onChange={e => setSnForm(p => ({ ...p, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setSnForm(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                  <button onClick={addSinistro} disabled={!snForm.tipo}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50">
                    Registrar
                  </button>
                </div>
              </div>
            )}
            {(d.sinistros || []).length > 0 ? (
              <div className="space-y-3">
                {(d.sinistros || []).map(s => {
                  const cor = {
                    "Aberto": "bg-red-100 text-red-700",
                    "Documentação": "bg-amber-100 text-amber-700",
                    "Aguardando Seguradora": "bg-blue-100 text-blue-700",
                    "Em Regulação": "bg-violet-100 text-violet-700",
                    "Encerrado": "bg-emerald-100 text-emerald-700"
                  }[s.status] || "bg-slate-100 text-slate-600";
                  const cf = snContatoForm[s.id] || {};
                  return (
                    <div key={s.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      {/* Cabeçalho do sinistro */}
                      <div className="flex items-start gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-700 text-sm">{s.tipo}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>{s.status}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                            {s.protocolo && <div>Protocolo: {s.protocolo}</div>}
                            {s.dataOcorrencia && <div>Ocorrência: {fmt(s.dataOcorrencia)}</div>}
                            {s.dataPrevistaResolucao && <div>Previsão: {fmt(s.dataPrevistaResolucao)}</div>}
                            {s.dataEncerramento && <div>Encerrado em: {fmt(s.dataEncerramento)}</div>}
                            {s.descricao && <div className="text-slate-500 mt-1">{s.descricao}</div>}
                          </div>
                          {/* Checklist de documentos */}
                          {SN_DOCS.some(doc => (s.docs||[]).includes(doc)) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {SN_DOCS.filter(doc => (s.docs||[]).includes(doc)).map(doc => (
                                <span key={doc} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">{doc} ✓</span>
                              ))}
                              {SN_DOCS.filter(doc => !(s.docs||[]).includes(doc)).map(doc => (
                                <span key={doc} className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-slate-200"
                                  onClick={() => toggleDocSinistro(s.id, doc)}>{doc}</span>
                              ))}
                            </div>
                          )}
                          {!SN_DOCS.some(doc => (s.docs||[]).includes(doc)) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {SN_DOCS.map(doc => (
                                <span key={doc} className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-slate-200"
                                  onClick={() => toggleDocSinistro(s.id, doc)}>{doc}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none bg-white"
                            value={s.status} onChange={e => updateSinistroStatus(s.id, e.target.value)}>
                            {SN_STATUS.map(st => <option key={st}>{st}</option>)}
                          </select>
                          <button onClick={() => removeSinistro(s.id)} className="text-slate-300 hover:text-red-400 ml-1"><X size={14} /></button>
                        </div>
                      </div>
                      {/* Histórico de contatos */}
                      <div className="border-t border-slate-200 px-3 py-2 bg-white">
                        <div className="text-xs font-semibold text-slate-500 mb-2">Histórico de contatos com a seguradora</div>
                        {(s.contatos||[]).length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {(s.contatos||[]).map(c => (
                              <div key={c.id} className="text-xs text-slate-600 flex gap-2">
                                <span className="text-slate-400 flex-shrink-0">{fmt(c.data)}</span>
                                <span>{c.descricao}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 items-end">
                          <input type="date" className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                            value={cf.data || ""} onChange={e => setSnContatoForm(p => ({ ...p, [s.id]: { ...cf, data: e.target.value } }))} />
                          <input className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                            placeholder="Descrição do contato..."
                            value={cf.descricao || ""} onChange={e => setSnContatoForm(p => ({ ...p, [s.id]: { ...cf, descricao: e.target.value } }))} />
                          <button
                            disabled={!cf.data || !cf.descricao}
                            onClick={() => { addContatoSinistro(s.id, { data: cf.data, descricao: cf.descricao }); setSnContatoForm(p => ({ ...p, [s.id]: {} })); }}
                            className="text-xs bg-slate-700 hover:bg-slate-900 text-white px-2 py-1 rounded-lg disabled:opacity-40">
                            + Registrar
                          </button>
                        </div>
                      </div>
                      {/* Observações */}
                      {s.observacoes && (
                        <div className="border-t border-slate-200 px-3 py-2 bg-white">
                          <div className="text-xs text-slate-400 font-semibold mb-0.5">Observações</div>
                          <div className="text-xs text-slate-600">{s.observacoes}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : !snForm && (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum sinistro registrado.</p>
            )}
          </div>

          {(d.apolice || d.apoliceAnexada) && (
            <EndossoSection
              endossos={d.endossos || []}
              onChange={v => set("endossos", v)}
              onCancelar={handleCancelarApolice}
            />
          )}

          <DocsSection cardId={card.id} onApoliceAnexada={onApoliceAnexada} onPropostaAnexada={onPropostaAnexada} onExtrairDados={handleExtrairDados} />

          {(d.historicoCiclos || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Histórico de renovações
              </p>
              <div className="space-y-2">
                {[...(d.historicoCiclos || [])].reverse().map((c, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-700">{c.seguradora || "—"}</span>
                      <span className="text-emerald-600 font-semibold">{fmtBRL(c.valor)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      <div>Vencimento: {fmt(c.data_renovacao)} · Situação: {c.situacao || "—"}</div>
                      <div>Proposta: {c.proposta || "—"} · Apólice: {c.apolice || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0">
          {!del ? (
            <div className="flex items-center gap-3">
              {d.arquivado ? (
                <button onClick={handleDesarquivarModal} disabled={saving}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                  <Archive size={13} /> Desarquivar
                </button>
              ) : (
                <>
                  {d.status === "emitida" && (
                    <button onClick={handleArquivar} disabled={saving}
                      className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                      <Archive size={13} /> Arquivar
                    </button>
                  )}
                  <button onClick={handleNaoRenovadaModal} disabled={saving}
                    className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                    <Ban size={13} /> {d.etiquetaSituacao === "Não Renovada" ? "Confirmar Não Renovada" : "Não Renovada"}
                  </button>
                </>
              )}
              <button onClick={() => setDel(true)} className="text-sm text-red-400 hover:text-red-600">Excluir card</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm text-red-600">Confirmar exclusão?</span>
              <button onClick={() => onDelete(card.id)} className="text-sm font-bold text-red-600 hover:underline">Sim</button>
              <button onClick={() => setDel(false)} className="text-sm text-slate-500 hover:underline">Não</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
              <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddModal({ initialStage, onClose, onAdd }) {
  const [d, setD] = useState({ status: "cotacoes", tipoSeguro: "AUTOMÓVEL", followUps: [], dataRenovacao: new Date().toISOString().slice(0,10) });
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
              <input type="number" className={inp} value={d.valor || ""} onChange={e => set("valor", e.target.value)} />
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
function ApoliceRow({ card, onClick }) {
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
          {card.valor ? ` · ${fmtBRL(card.valor)}` : ""}
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

function ClienteModal({ clienteId, onClose, onAbrirCard }) {
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

// ── Importação de PDF ────────────────────────────────────────
function parseBRL(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function mapPagamento(s) {
  if (!s) return "";
  const sl = s.toLowerCase();
  if (sl.includes("boleto")) return "Boleto";
  if (sl.includes("débito") || sl.includes("debito")) return "Débito em Conta";
  if (sl.includes("cartão") || sl.includes("cartao") || sl.includes("crédito") || sl.includes("credito")) return "Cartão de Crédito";
  if (sl.includes("pix")) return "PIX";
  if (sl.includes("link")) return "Link de Pagamento";
  return "";
}

function ImportModal({ onClose, onAdd }) {
  const [step, setStep] = useState(1);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("proposta");
  const [form, setForm] = useState({
    clienteNome: "", cpfCnpj: "", telefone: "", email: "",
    seguradora: "", tipoSeguro: "AUTOMÓVEL", proposta: "", apolice: "",
    dataRenovacao: "", etiquetaSituacao: "", etiquetaPagamento: "", etiquetaCanal: "",
    autoPlaca: "", autoModelo: "", autoAnoFab: "", autoAnoMod: "",
    autoChassi: "", autoCepPernoite: "",
    autoNomeSegurado: "", autoCpfSegurado: "", autoNascimentoSegurado: "", autoEstadoCivil: "",
    autoCondutor: "", autoCpfCondutor: "", autoNascimentoCondutor: "", autoEstadoCivilCondutor: "",
    autoTipoUtilizacao: "Particular", autoCondutor1825: false,
    condutorDiferente: false,
    valor: "", status: "transmitida",
    arquivado: false, arquivadoEm: null,
  });

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const processarPDF = async () => {
    if (!arquivo || !lgpdOk) return;
    setStep(2);
    setErro("");
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });

      const resp = await fetch("/api/extract-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdfBase64: b64 }),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || "Falha na extração");

      const d = result.data;
      const temVeiculo = !!(d.veiculo?.placa || d.veiculo?.modelo);
      const minhaCorretora = (d.corretor || "").toUpperCase().includes("SIMPLES ASSIM");

      // Calcular dias restantes para o vencimento
      const vigFim = d.apolice?.vigenciaFim || "";
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const daysLeft = vigFim ? Math.ceil((new Date(vigFim) - hoje) / 86400000) : null;

      // Roteamento por corretora + tipo + prazo
      const isApoliceMinha = minhaCorretora && d.tipoDocumento === "apolice";
      const arquivarImport = isApoliceMinha && daysLeft !== null && daysLeft > 30;
      const importStatus = !minhaCorretora ? "cotacoes"
        : isApoliceMinha && daysLeft !== null && daysLeft <= 30 ? "cotacoes"
        : d.tipoDocumento === "apolice" ? "emitida" : "transmitida";
      const importSituacao = !minhaCorretora ? "Renovação Congênere"
        : (d.apolice?.tipoOperacao || "Renovação");

      setForm({
        clienteNome:             (d.segurado?.nome || "").toUpperCase(),
        cpfCnpj:                 d.segurado?.cpfCnpj || "",
        telefone:                d.segurado?.telefone || "",
        email:                   d.segurado?.email || "",
        seguradora:              d.apolice?.seguradora || "",
        tipoSeguro:              temVeiculo ? "AUTOMÓVEL" : "AUTOMÓVEL",
        proposta:                d.apolice?.numeroProposta || "",
        apolice:                 d.apolice?.numeroApolice || "",
        dataRenovacao:           d.apolice?.vigenciaFim || "",
        etiquetaSituacao:        importSituacao,
        etiquetaPagamento:       mapPagamento(d.financeiro?.formaPagamento),
        etiquetaCanal:           "",
        autoPlaca:               d.veiculo?.placa || "",
        autoModelo:              d.veiculo?.modelo || "",
        autoAnoFab:              d.veiculo?.anoFab || "",
        autoAnoMod:              d.veiculo?.anoMod || "",
        autoChassi:              d.veiculo?.chassi || "",
        autoCepPernoite:         d.veiculo?.cepPernoite || "",
        autoNomeSegurado:        (d.segurado?.nome || "").toUpperCase(),
        autoCpfSegurado:         d.segurado?.cpfCnpj || "",
        autoNascimentoSegurado:  d.segurado?.dataNascimento || "",
        autoCondutor:            (d.veiculo?.condutorNome || "").toUpperCase(),
        autoCpfCondutor:         d.veiculo?.condutorCpf || "",
        autoNascimentoCondutor:  d.veiculo?.condutorNascimento || "",
        autoEstadoCivil:         d.segurado?.estadoCivil || "",
        autoEstadoCivilCondutor: d.veiculo?.condutorEstadoCivil || "",
        autoTipoUtilizacao:      d.veiculo?.tipoUtilizacao || "Particular",
        autoCondutor1825:        d.veiculo?.condutor1825anos || false,
        condutorDiferente:       !!(d.veiculo?.condutorNome && (d.veiculo?.condutorNome||"").toUpperCase() !== (d.segurado?.nome||"").toUpperCase()),
        valor:                   d.financeiro?.premioTotal || "",
        status:                  importStatus,
        arquivado:               arquivarImport,
        arquivadoEm:             arquivarImport ? new Date().toISOString() : null,
      });
      setTipoDoc(d.tipoDocumento === "apolice" ? "apolice" : "proposta");
      setStep(3);
    } catch (e) {
      setErro(e.message);
      setStep(1);
    }
  };

  const criarCard = async () => {
    if (!form.clienteNome) return;
    if (form.cpfCnpj && !isCNPJ(form.cpfCnpj) && !form.autoNascimentoSegurado) {
      window.alert("CPF informado — preencha a Data de Nascimento antes de salvar.");
      return;
    }

    // ── Detecção de duplicata ──────────────────────────────────────────────
    const dupeInfo = [];
    if (form.proposta) {
      const { data } = await supabase.from("renovacoes").select("id,cliente_nome").eq("proposta", form.proposta).eq("arquivado", false).limit(1);
      if (data?.length) dupeInfo.push(`proposta nº ${form.proposta} já existe para ${data[0].cliente_nome}`);
    }
    if (form.autoPlaca) {
      const { data } = await supabase.from("renovacoes").select("id,cliente_nome").eq("auto_placa", form.autoPlaca).eq("arquivado", false).limit(1);
      if (data?.length) dupeInfo.push(`placa ${form.autoPlaca} já existe para ${data[0].cliente_nome}`);
    }
    if (!form.autoPlaca && form.autoChassi) {
      const { data } = await supabase.from("renovacoes").select("id,cliente_nome").eq("auto_chassi", form.autoChassi).eq("arquivado", false).limit(1);
      if (data?.length) dupeInfo.push(`chassi ${form.autoChassi} já existe para ${data[0].cliente_nome}`);
    }
    if (dupeInfo.length > 0) {
      const ok = window.confirm(
        `⚠️ Card duplicado detectado:

• ${dupeInfo.join("\n• ")}\n\nDeseja criar mesmo assim?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const clienteId = await findOrCreateCliente({
        nome:     form.clienteNome,
        cpfCnpj:  form.cpfCnpj,
        telefone: form.telefone,
        email:    form.email,
      });
      const card = {
        id:                genId(),
        clienteId,
        clienteNome:       form.clienteNome,
        cpfCnpj:           form.cpfCnpj,
        telefone:          form.telefone,
        email:             form.email,
        seguradora:        form.seguradora,
        tipoSeguro:        form.tipoSeguro,
        proposta:          form.proposta,
        apolice:           form.apolice,
        dataRenovacao:     form.dataRenovacao || null,
        etiquetaSituacao:  form.etiquetaSituacao || null,
        etiquetaPagamento: form.etiquetaPagamento || null,
        autoPlaca:         form.autoPlaca,
        autoModelo:        form.autoModelo,
        autoAnoFab:        form.autoAnoFab,
        autoAnoMod:        form.autoAnoMod,
        autoChassi:        form.autoChassi,
        autoCepPernoite:   form.autoCepPernoite,
        autoTipoUtilizacao: form.autoTipoUtilizacao || "Particular",
        autoCondutor1825:   form.autoCondutor1825 || false,
        autoNomeSegurado:         form.autoNomeSegurado,
        autoCpfSegurado:          form.autoCpfSegurado,
        autoNascimentoSegurado:   form.autoNascimentoSegurado,
        autoCondutor:             form.condutorDiferente ? form.autoCondutor : form.autoNomeSegurado,
        autoCpfCondutor:          form.condutorDiferente ? form.autoCpfCondutor : form.autoCpfSegurado,
        autoNascimentoCondutor:   form.condutorDiferente ? form.autoNascimentoCondutor : form.autoNascimentoSegurado,
        autoDataNasc:             form.condutorDiferente ? (form.autoNascimentoCondutor || form.autoNascimentoSegurado) : form.autoNascimentoSegurado,
        autoEstadoCivil:          form.autoEstadoCivil || null,
        autoEstadoCivilCondutor:  form.condutorDiferente ? (form.autoEstadoCivilCondutor || null) : (form.autoEstadoCivil || null),
        etiquetaCanal:            form.etiquetaCanal || null,
        valor:                    parseBRL(form.valor),
        status:            form.status || "transmitida",
        followUps:         [],
        sinistros:         [],
        historicoCiclos:   [],
        arquivado:         form.arquivado || false,
        arquivadoEm:       form.arquivadoEm || null,
      };
      await onAdd(card);
      if (arquivo) {
        await uploadDoc(card.id, tipoDoc, arquivo);
      }
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300";
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";
  const produtos = ["ACIDENTES PESSOAIS","AUTOMÓVEL","AUXÍLIO FUNERAL","BIKE","CAPITALIZAÇÃO",
    "CONDOMÍNIO","CONSÓRCIO","DENTAL","EMPRESARIAL","EQUIPAMENTOS PORTÁTEIS","FIANÇA LOCATÍCIA",
    "PET","PREVIDÊNCIA","RC OBRAS","RC PROFISSIONAL","RESIDENCIAL","RISCO DE ENGENHARIA",
    "RURAL","SAÚDE","SEGURO EVENTO","SEGURO VIAGEM","TRANSPORTES","VIDA EM GRUPO","VIDA INDIVIDUAL"];
  const seguradoras = ["AKAD SEGUROS","ALFA SEGURADORA","ALIRO","ALLIANZ","AMERICAN LIFE","AMIL","AXA",
    "AZUL SEGUROS","BB CONSORCIOS","BRADESCO AUTO/RE","BRADESCO SAÚDE","CAPEMISA","CENTAURO","CHUBB",
    "DARWIN SEGUROS","ESSOR SEGUROS","EZZE SEGUROS","HDI SEGUROS","ICATU SEGUROS","ITAU CONSORCIOS",
    "ITAU SEGUROS","JUNTO SEGUROS","MAPFRE","MEDSENIOR","METLIFE","MITSUI SUMITOMO","MONGERAL AEGON",
    "OMINT","PLATINUM BENEFICIOS","PORTO CONSORCIO","PORTO SEGURO","PORTO SEGURO SAUDE","PRUDENTIAL",
    "QUALLITY SAÚDE","SUHAI SEGUROS","SUL AMÉRICA","SURA","TOKIO MARINE","UNIMED NACIONAL",
    "UNIMED SEGUROS SAUDE","YELUM SEGUROS","ZURICH"];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>

        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Importar PDF</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {step === 1 && "Proposta ou apólice — a IA extrai os dados automaticamente"}
              {step === 2 && "Aguarde — a IA está lendo o documento..."}
              {step === 3 && "Revise os dados extraídos antes de salvar"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {step === 1 && (
          <div className="px-6 py-6 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                  checked={lgpdOk} onChange={e => setLgpdOk(e.target.checked)} />
                <span className="text-sm text-slate-700">
                  Confirmo que o cliente autorizou a utilização de seus dados pessoais conforme a{" "}
                  <strong>LGPD (Lei nº 13.709/2018)</strong>.
                </span>
              </label>
            </div>
            <div>
              <label className={lbl}>Arquivo PDF</label>
              <label
                className={`mt-2 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors ${lgpdOk ? "cursor-pointer border-slate-300 hover:border-blue-400 hover:bg-blue-50" : "border-slate-200 opacity-40 cursor-not-allowed"}`}
                onDragOver={e => { if (!lgpdOk) return; e.preventDefault(); e.currentTarget.classList.add("border-blue-500","bg-blue-50"); }}
                onDragLeave={e => { e.currentTarget.classList.remove("border-blue-500","bg-blue-50"); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-500","bg-blue-50");
                  if (!lgpdOk) return;
                  const f = e.dataTransfer.files[0];
                  if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) setArquivo(f);
                }}>
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-sm text-slate-500 text-center px-4">
                  {arquivo ? arquivo.name : "Arraste o PDF aqui ou clique para selecionar"}
                </span>
                {arquivo && <span className="text-xs text-slate-400 mt-1">{(arquivo.size / 1024).toFixed(0)} KB</span>}
                <input type="file" accept=".pdf,application/pdf" className="hidden" disabled={!lgpdOk}
                  onChange={e => setArquivo(e.target.files[0] || null)} />
              </label>
            </div>
            {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={processarPDF} disabled={!lgpdOk || !arquivo}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Upload size={14} /> Processar PDF
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="px-6 py-16 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-700 font-semibold">A IA está lendo o documento...</p>
            <p className="text-sm text-slate-400">Isso leva alguns segundos</p>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {form.arquivado ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800 font-semibold">
                  <Archive size={14} /> Apólice com +30 dias para vencer — será <strong>arquivada</strong> e entrará em renovação automaticamente
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                  <Shield size={14} /> {form.status === "cotacoes" ? "Vence em breve — entrará direto em Cotações e Leads" : "Cliente novo — revise e corrija se necessário antes de salvar"}
                </div>
              )}

              <div>
                <p className={`${lbl} mb-3`}>Dados do segurado</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Nome completo *</label>
                    <input className={inp} value={form.clienteNome} onChange={e => setF("clienteNome", e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label className={lbl}>CPF / CNPJ</label>
                    <input className={inp} value={form.cpfCnpj} onChange={e => setF("cpfCnpj", e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Telefone</label>
                    <input className={inp} value={form.telefone} onChange={e => setF("telefone", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>E-mail</label>
                    <input className={inp} value={form.email} onChange={e => setF("email", e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <p className={`${lbl} mb-3`}>Dados da apólice</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Seguradora</label>
                    <select className={inp} value={form.seguradora} onChange={e => setF("seguradora", e.target.value)}>
                      <option value="">Selecione</option>
                      {seguradoras.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Produto</label>
                    <select className={inp} value={form.tipoSeguro} onChange={e => setF("tipoSeguro", e.target.value)}>
                      {produtos.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Nº da proposta</label>
                    <input className={inp} value={form.proposta} onChange={e => setF("proposta", e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Nº da apólice</label>
                    <input className={inp} value={form.apolice} onChange={e => setF("apolice", e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Vigência fim (data renovação)</label>
                    <input type="date" className={inp} value={form.dataRenovacao} onChange={e => setF("dataRenovacao", e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Situação</label>
                    <select className={inp} value={form.etiquetaSituacao} onChange={e => setF("etiquetaSituacao", e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="Seguro Novo">Seguro Novo</option>
                      <option value="Renovação Congênere">Renovação Congênere</option>
                      <option value="Renovação">Renovação</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Canal de origem</label>
                    <select className={inp} value={form.etiquetaCanal} onChange={e => setF("etiquetaCanal", e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="Google">Google</option>
                      <option value="Indicação">Indicação</option>
                      <option value="Site">Site</option>
                    </select>
                  </div>
                </div>
              </div>

              {(form.autoPlaca || form.autoModelo) && (
                <div>
                  <p className={`${lbl} mb-3`}>Veículo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Placa</label>
                      <input className={inp} value={form.autoPlaca} onChange={e => setF("autoPlaca", e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <label className={lbl}>Modelo</label>
                      <input className={inp} value={form.autoModelo} onChange={e => setF("autoModelo", e.target.value)} />
                    </div>
                    <div>
                      <label className={lbl}>Ano fabricação</label>
                      <input className={inp} value={form.autoAnoFab} onChange={e => setF("autoAnoFab", e.target.value)} />
                    </div>
                    <div>
                      <label className={lbl}>Ano modelo</label>
                      <input className={inp} value={form.autoAnoMod} onChange={e => setF("autoAnoMod", e.target.value)} />
                    </div>
                    {form.autoChassi && (
                      <div className="col-span-2">
                        <label className={lbl}>Chassi</label>
                        <input className={inp} value={form.autoChassi} onChange={e => setF("autoChassi", e.target.value.toUpperCase())} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-blue-100 pt-4 mt-2">
                    <p className={`${lbl} mb-3`}>Segurado</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={lbl}>Nome</label>
                        <input className={inp} value={form.autoNomeSegurado} onChange={e => setF("autoNomeSegurado", e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={lbl}>CPF / CNPJ</label>
                        <input className={inp} placeholder="CPF ou CNPJ" value={form.autoCpfSegurado} onChange={e => setF("autoCpfSegurado", maskCpfCnpj(e.target.value))} />
                      </div>
                      {!isCNPJ(form.autoCpfSegurado) && (
                        <div>
                          <label className={lbl}>Data de nascimento</label>
                          <input type="date" className={inp} value={form.autoNascimentoSegurado} onChange={e => setF("autoNascimentoSegurado", e.target.value)} />
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                      <input type="checkbox" className="w-4 h-4 rounded accent-blue-600"
                        checked={form.condutorDiferente} onChange={e => setF("condutorDiferente", e.target.checked)} />
                      <span className="text-sm text-slate-600">Condutor principal diferente do segurado</span>
                    </label>

                    {form.condutorDiferente && (
                      <div className="mt-3">
                        <p className={`${lbl} mb-3`}>Condutor principal</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className={lbl}>Nome</label>
                            <input className={inp} value={form.autoCondutor} onChange={e => setF("autoCondutor", e.target.value.toUpperCase())} />
                          </div>
                          <div>
                            <label className={lbl}>CPF</label>
                            <input className={inp} placeholder="000.000.000-00" value={form.autoCpfCondutor} onChange={e => setF("autoCpfCondutor", e.target.value)} />
                          </div>
                          <div>
                            <label className={lbl}>Data de nascimento</label>
                            <input type="date" className={inp} value={form.autoNascimentoCondutor} onChange={e => setF("autoNascimentoCondutor", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(form.autoPlaca || form.autoModelo) && (
                <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
                  <p className={`${lbl} mb-3 font-semibold`}>Perfil de risco do veículo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Tipo de utilização</label>
                      <select className={inp} value={form.autoTipoUtilizacao || "Particular"} onChange={e => setF("autoTipoUtilizacao", e.target.value)}>
                        <option>Particular</option>
                        <option>Táxi</option>
                        <option>Comercial</option>
                        <option>Uber/App</option>
                        <option>Mototáxi</option>
                        <option>Escolar</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Estado civil (condutor)</label>
                      <select className={inp} value={form.autoEstadoCivilCondutor || form.autoEstadoCivil || ""} onChange={e => setF("autoEstadoCivilCondutor", e.target.value)}>
                        <option value="">Selecione</option>
                        <option>Solteiro(a)</option>
                        <option>Casado(a)</option>
                        <option>Divorciado(a)</option>
                        <option>Viúvo(a)</option>
                        <option>União Estável</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center gap-2 mt-1">
                      <input type="checkbox" id="imp-condutor1825" checked={form.autoCondutor1825 || false}
                        onChange={e => setF("autoCondutor1825", e.target.checked)}
                        className="w-4 h-4 accent-indigo-600" />
                      <label htmlFor="imp-condutor1825" className="text-sm text-slate-700 cursor-pointer">
                        Cobertura para condutor de 18 a 25 anos contratada
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className={`${lbl} mb-3`}>Financeiro</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Prêmio total (R$)</label>
                    <input className={inp} placeholder="Ex: 1.481,68" value={form.valor} onChange={e => setF("valor", e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Forma de pagamento</label>
                    <select className={inp} value={form.etiquetaPagamento} onChange={e => setF("etiquetaPagamento", e.target.value)}>
                      <option value="">Selecione</option>
                      {PAGAMENTOS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0">
              <button onClick={() => { setStep(1); setErro(""); }} className="text-sm text-slate-500 hover:text-slate-700">← Voltar</button>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={criarCard} disabled={saving || !form.clienteNome}
                  className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
                  <Save size={14} /> {saving ? "Salvando..." : "Criar card"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── App principal ─────────────────────────────────────────────
// ── Login Screen ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
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

export default function App() {
  const [session, setSession] = useState(undefined); // undefined=carregando, null=sem sessão
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [addStage, setAddStage] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [view, setView] = useState("pipeline");
  const [prospeccoes, setProspeccoes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clienteModal, setClienteModal] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [toast, setToast] = useState(null);
  const searchRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    setLoading(true);
    loadCards(mostrarArquivados).then(c => { setCards(c); setLoading(false); });
  }, [mostrarArquivados]);

  useEffect(() => {
    if (view === "prospeccoes") {
      loadProspeccoes().then(setProspeccoes);
    }
  }, [view]);

  // Busca global com debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    const t = setTimeout(() => {
      searchAllCards(searchQuery).then(res => { setSearchResults(res); setSearchOpen(res.length > 0); });
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fechar dropdown ao clicar fora
  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectResult = (card) => {
    setSelected(card);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleAdd = async (card) => {
    await upsertCard(card);
    setCards(prev => [card, ...prev]);
  };

  const handleDrop = async (cardId, newStatus) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;
    const updated = {
      ...card, status: newStatus,
      transmitidaEm: newStatus === "transmitida" && !card.transmitidaEm ? new Date().toISOString() : (card.transmitidaEm || null),
    };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    await upsertCard(updated);
  };

  const handleSave = async (updated) => {
    const anterior = cards.find(c => c.id === updated.id);
    const recemArquivado = updated.arquivado && anterior && !anterior.arquivado;
    await upsertCard(updated);
    if (recemArquivado) {
      setCards(prev => prev.filter(c => c.id !== updated.id));
      setSelected(null);
    } else {
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      const camposIgnorar = ["followUps","sinistros","endossos","historicoCiclos","criadoEm","arquivadoEm","transmitidaEm"];
      const qtd = anterior ? Object.keys(updated).filter(k => !camposIgnorar.includes(k) && JSON.stringify(updated[k]) !== JSON.stringify(anterior[k])).length : 0;
      showToast(`✅ ${qtd > 0 ? `${qtd} campo${qtd !== 1 ? "s" : ""} atualizado${qtd !== 1 ? "s" : ""}` : "Card salvo"} com sucesso.`);
    }
  };
  const handleDelete = async (id) => {
    await deleteCard(id);
    setCards(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  };

  const handleArquivar = async (card) => {
    await upsertCard(card);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleDesarquivar = async (card) => {
    await upsertCard(card);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleNaoRenovada = async (card) => {
    const updated = { ...card, etiquetaSituacao: "Não Renovada", arquivado: true, arquivadoEm: new Date().toISOString() };
    await upsertCard(updated);
    await criarProspeccao(updated);
    setCards(prev => prev.filter(c => c.id !== card.id));
    setSelected(null);
  };

  const handleProspeccaoUpdate = (updated) => {
    setProspeccoes(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleRecuperar = async (prosp) => {
    // Marca prospecção como recuperada
    const updatedProsp = { ...prosp, status: "RECUPERADA" };
    await upsertProspeccao(updatedProsp);
    setProspeccoes(prev => prev.map(p => p.id === updatedProsp.id ? updatedProsp : p));
    // Cria novo card no pipeline com dados do cliente
    const dataVenc = prosp.dataVencAnterior
      ? new Date(prosp.dataVencAnterior + "T12:00:00")
      : null;
    const novaData = dataVenc
      ? new Date(dataVenc.setFullYear(dataVenc.getFullYear() + 1)).toISOString().slice(0, 10)
      : null;
    const novoCard = {
      id: genId(),
      clienteNome:      prosp.clienteNome,
      cpfCnpj:          prosp.cpfCnpj,
      telefone:         prosp.telefone,
      email:            prosp.email,
      tipoSeguro:       prosp.produto,
      seguradora:       prosp.seguradoraAnterior,
      dataRenovacao:    novaData,
      valor:            prosp.valorAnterior,
      status:           "cotacoes",
      etiquetaSituacao: "Renovação",
      historicoCiclos:  [],
      followUps:        [],
      arquivado:        false,
    };
    await upsertCard(novoCard);
    setCards(prev => [novoCard, ...prev]);
    setView("pipeline");
  };

  const visible = cards
    .filter(c => {
      const ms = !search || c.clienteNome?.toLowerCase().includes(search.toLowerCase()) || (c.cpfCnpj || "").includes(search);
      const mm = !filterMonth || (c.dataRenovacao || "").startsWith(filterMonth);
      return ms && mm;
    })
    .sort((a, b) => {
      const da = a.dataRenovacao || "9999-99";
      const db = b.dataRenovacao || "9999-99";
      return da < db ? -1 : da > db ? 1 : 0;
    });

  const urgentes = cards.filter(c => { const d = daysUntil(c.dataRenovacao); return d !== null && d <= 7 && c.status !== "emitida"; }).length;
  const apolicesPendentes = cards.filter(isApoliceAlerta).length;
  const vistoriasPendentes = cards.filter(isVistoriaAlerta).length;
  const boletosPendentes = cards.filter(isBoletoAlerta).length;

  const handlePropostaAnexada = async (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.status !== "enviada") return;
    const agora = new Date().toISOString();
    const { error } = await supabase.from("renovacoes")
      .update({ status_pipeline: "transmitida", transmitida_em: agora })
      .eq("id", cardId);
    if (error) { console.error("Erro ao mover card:", error); alert("Erro ao mover card: " + error.message); return; }
    const updated = { ...card, status: "transmitida", transmitidaEm: agora };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    setSelected(updated);
  };

  const handleApoliceAnexada = async (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const novoStatus = (card.status === "transmitida" || card.status === "vistoria" || card.status === "boleto")
      ? "emitida" : card.status;
    // UPDATE direto — evita falha silenciosa do upsertCard por colunas novas
    const { error } = await supabase.from("renovacoes")
      .update({ status_pipeline: novoStatus, apolice_anexada: true })
      .eq("id", cardId);
    if (error) { console.error("Erro ao mover card:", error); alert("Erro ao mover card: " + error.message); return; }
    const updated = { ...card, apoliceAnexada: true, status: novoStatus };
    setCards(prev => prev.map(c => c.id === cardId ? updated : c));
    setSelected(updated);
  };

  const months = Array.from({ length: 8 }, (_, i) => {
    const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() + i - 1);
    return { val: `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`, label: dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });

  if (session === undefined) return (
    <div className="h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
      <Shield size={40} className="text-amber-400 animate-pulse" />
    </div>
  );

  if (!session) return <LoginScreen />;

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <Shield size={40} className="text-slate-300 mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400 text-sm">Carregando...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#F1F2F4" }}>
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield size={20} className="text-amber-400" />
          <span className="font-bold text-base tracking-tight">CRM Renovações</span>
          <span className="text-slate-500 text-xs ml-1">Simples Assim</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-800 rounded-lg flex items-center p-0.5 gap-0.5">
            <button onClick={() => setView("home")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "home" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Home size={12} /> Home
            </button>
            <button onClick={() => setView("segurados")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "segurados" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Users size={12} /> Segurados
            </button>
            <button onClick={() => setView("pipeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "pipeline" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Shield size={12} /> Renovações
            </button>
            <button onClick={() => setView("prospeccoes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "prospeccoes" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>
              <Users size={12} /> Prospecções
            </button>
          </div>
          {urgentes > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Bell size={11} /> {urgentes} urgente{urgentes !== 1 ? "s" : ""}
            </div>
          )}
          {apolicesPendentes > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Paperclip size={11} /> {apolicesPendentes} apólice{apolicesPendentes !== 1 ? "s" : ""} pendente{apolicesPendentes !== 1 ? "s" : ""}
            </div>
          )}
          {vistoriasPendentes > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <AlertTriangle size={11} /> {vistoriasPendentes} vistoria{vistoriasPendentes !== 1 ? "s" : ""} pendente{vistoriasPendentes !== 1 ? "s" : ""}
            </div>
          )}
          {boletosPendentes > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <Bell size={11} /> {boletosPendentes} boleto{boletosPendentes !== 1 ? "s" : ""} vencendo
            </div>
          )}
          <div className="text-slate-400 text-xs">{cards.length} cards · {cards.filter(c => c.status === "emitida").length} emitidas</div>
          <button onClick={() => supabase.auth.signOut()}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded transition-colors" title="Sair">
            Sair
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center gap-2.5 flex-shrink-0">
        <div className="relative" ref={searchRef}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <input
            className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 w-72"
            placeholder="Buscar cliente, CPF, placa..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearch(e.target.value); }}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onKeyDown={e => e.key === "Escape" && (setSearchOpen(false), setSearchQuery(""), setSearch(""))}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearch(""); setSearchOpen(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
          {searchOpen && (
            <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              <div className="px-3 py-2 border-b bg-slate-50">
                <span className="text-xs text-slate-400 font-medium">{searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}</span>
              </div>
              {searchResults.map(card => {
                const stage = STAGES.find(s => s.id === card.status);
                return (
                  <button key={card.id} onClick={() => handleSelectResult(card)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm truncate">{card.clienteNome}</span>
                        {card.arquivado && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5">
                            <Archive size={9} /> Arquivado
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {card.tipoSeguro} · {card.seguradora}
                        {card.autoPlaca && ` · ${card.autoPlaca}`}
                        {card.cpfCnpj && ` · ${card.cpfCnpj}`}
                      </div>
                    </div>
                    {!card.arquivado && stage && (
                      <span className={`text-xs text-white px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${stage.badge}`}>
                        {stage.short}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={() => setMostrarArquivados(prev => !prev)}
          title={mostrarArquivados ? "Voltar ao pipeline" : "Ver apólices arquivadas"}
          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${mostrarArquivados ? "bg-amber-100 border-amber-300 text-amber-700 font-semibold" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
          <Archive size={12} /> {mostrarArquivados ? "Arquivados" : "Arquivados"}
        </button>
        <Filter size={13} className="text-slate-400" />
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-600"
          value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">Todos os meses</option>
          {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setImportModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Upload size={15} /> Importar PDF
          </button>
          <button onClick={() => setAddStage("cotacoes")}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus size={15} /> Novo card
          </button>
        </div>
      </div>

      {view === "home" ? (
        <Dashboard />
      ) : view === "segurados" ? (
        <Segurados />
      ) : view === "pipeline" ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-2.5 p-4 h-full" style={{ minWidth: "fit-content" }}>
              {STAGES.map(s => (
                <Column key={s.id} stage={s}
                  cards={visible.filter(c => c.status === s.id)}
                  onCard={setSelected} onAdd={setAddStage} onDrop={handleDrop} />
              ))}
            </div>
          </div>
          <PainelSinistros cards={cards} onCard={setSelected} />
        </div>
      ) : (
        <ProspeccoesView prospeccoes={prospeccoes} onUpdate={handleProspeccaoUpdate} onRecuperar={handleRecuperar} />
      )}

      {selected && <Modal card={selected} onClose={() => setSelected(null)} onSave={handleSave} onDelete={handleDelete} onArquivar={handleArquivar} onDesarquivar={handleDesarquivar} onNaoRenovada={handleNaoRenovada} onVerCliente={(id) => { setSelected(null); setClienteModal(id); }} onApoliceAnexada={() => handleApoliceAnexada(selected.id)} onPropostaAnexada={() => handlePropostaAnexada(selected.id)} onExtrairDados={(data, tipo) => {}} />}
      {addStage && <AddModal initialStage={addStage} onClose={() => setAddStage(null)} onAdd={handleAdd} />}
      {clienteModal && <ClienteModal clienteId={clienteModal} onClose={() => setClienteModal(null)} onAbrirCard={(c) => { setClienteModal(null); setSelected(c); }} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onAdd={handleAdd} />}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
