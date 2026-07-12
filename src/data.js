import { supabase } from "./supabase";
import { genId, moedaParaNumero, numeroParaMoeda } from "./utils";

// ── Supabase helpers ──────────────────────────────────────────
export function mapRow(r) {
  return {
    id:            r.id,
    clienteNome:   r.cliente_nome,
    cpfCnpj:       r.cpf_cnpj,
    telefone:      r.telefone,
    email:         r.email,
    endereco:      r.endereco || null,
    enderecoCep:         r.endereco_cep || null,
    enderecoLogradouro:  r.endereco_logradouro || null,
    enderecoNumero:      r.endereco_numero || null,
    enderecoComplemento: r.endereco_complemento || null,
    enderecoBairro:      r.endereco_bairro || null,
    enderecoCidade:      r.endereco_cidade || null,
    enderecoUf:          r.endereco_uf || null,
    tipoSeguro:    r.tipo_seguro,
    seguradora:    r.seguradora,
    veiculo:       r.veiculo,
    dataRenovacao: r.data_renovacao,
vigenciaInicio: r.vigencia_inicio,
    valor:         numeroParaMoeda(r.valor),
premioLiquido:      numeroParaMoeda(r.premio_liquido),
numeroParcelas:     r.numero_parcelas,
valorParcela:       numeroParaMoeda(r.valor_parcela),
vencimentoPrimeiraParcela: r.vencimento_primeira_parcela,
percentualComissao: r.percentual_comissao,    status:        r.status_pipeline,
    responsavel:   r.responsavel,
    proposta:      r.proposta,
    apolice:       r.apolice_nova,
    etiquetaSegfy:    r.etiqueta_segfy,
    etiquetaSituacao: r.etiqueta_situacao,
    motivoCancelamento: r.motivo_cancelamento,
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
autoZeroKm:         r.auto_zero_km || false,
autoCombustivel:    r.auto_combustivel,
    arquivado:        r.arquivado || false,
    arquivadoEm:      r.arquivado_em,
    dataEmissao:      r.data_emissao || null,
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

export async function loadCards(arquivados = false) {
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

export async function searchAllCards(q) {
  if (!q || q.length < 2) return [];
  const { data } = await supabase
    .from("renovacoes")
    .select("*")
    .or(`cliente_nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%,auto_placa.ilike.%${q}%`)
    .order("arquivado", { ascending: true })
    .limit(10);
  return (data || []).map(mapRow);
}

export async function upsertCard(card) {
  const row = {
    id:              card.id,
    cliente_id:      card.clienteId || null,
    apolice_id:      card.apoliceId || null,
    cliente_nome:    card.clienteNome,
    cpf_cnpj:        card.cpfCnpj,
    telefone:        card.telefone,
    email:           card.email,
    endereco:        card.endereco || null,
    endereco_cep:         card.enderecoCep || null,
    endereco_logradouro:  card.enderecoLogradouro || null,
    endereco_numero:      card.enderecoNumero || null,
    endereco_complemento: card.enderecoComplemento || null,
    endereco_bairro:      card.enderecoBairro || null,
    endereco_cidade:      card.enderecoCidade || null,
    endereco_uf:          card.enderecoUf || null,
    tipo_seguro:     card.tipoSeguro,
    seguradora:      card.seguradora,
    veiculo:         card.veiculo,
    data_renovacao:  card.dataRenovacao || null,
vigencia_inicio: card.vigenciaInicio || null,
    valor:           moedaParaNumero(card.valor),
premio_liquido:      moedaParaNumero(card.premioLiquido),
numero_parcelas:      card.numeroParcelas ? Number(card.numeroParcelas) : null,
valor_parcela:        moedaParaNumero(card.valorParcela),
vencimento_primeira_parcela: card.vencimentoPrimeiraParcela || null,
percentual_comissao: card.percentualComissao ? Number(card.percentualComissao) : null,
    status_pipeline: card.status,
    responsavel:     card.responsavel,
    proposta:        card.proposta,
    apolice_nova:    card.apolice,
    etiqueta_segfy:     card.etiquetaSegfy || false,
    etiqueta_situacao:  card.etiquetaSituacao || null,
    motivo_cancelamento: card.motivoCancelamento || null,
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
auto_zero_km:          card.autoZeroKm || false,
auto_combustivel:      card.autoCombustivel || null,
    arquivado:        card.arquivado || false,
    arquivado_em:     card.arquivadoEm || null,
    data_emissao:     card.dataEmissao || (card.status === 'emitida' ? new Date().toISOString().slice(0, 10) : null),
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
  return error;
}

export function faltaComissaoParaAvancar(card, novoStatus, statusAnterior) {
  const indoParaTransmitida = novoStatus === "transmitida" && statusAnterior !== "transmitida";
  const indoParaEmitida = novoStatus === "emitida" && statusAnterior !== "emitida";
  if (!indoParaTransmitida && !indoParaEmitida) return null;
  const liquidoVazio = !card.premioLiquido || String(card.premioLiquido).trim() === "";
  const percentualVazio = card.percentualComissao === undefined || card.percentualComissao === null || String(card.percentualComissao).trim() === "";
  if (liquidoVazio || percentualVazio) {
    return `Prêmio líquido e percentual de comissão são obrigatórios para avançar para ${indoParaEmitida ? "Apólice Emitida" : "Proposta Transmitida"}. Preencha esses campos antes de continuar.`;
  }
  return null;
}

export async function deleteCard(id) {
  const { error } = await supabase.from("renovacoes").delete().eq("id", id);
  if (error) console.error("Erro ao deletar:", error);
}

// ── Helpers de documentos ──────────────────────────────────────
export async function loadDocs(renovacaoId) {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("renovacao_id", renovacaoId)
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function uploadDoc(renovacaoId, tipo, file) {
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

export async function deleteDoc(doc) {
  await supabase.storage.from("documentos").remove([doc.storage_path]);
  await supabase.from("documentos").delete().eq("id", doc.id);
}

export function docPublicUrl(storagePath) {
  const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(storagePath);
  return publicUrl;
}

// ── Helpers de prospecção ─────────────────────────────────────
export async function criarProspeccao(card) {
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
    valor_anterior:        moedaParaNumero(card.valor),
    data_vencimento_anterior: card.dataRenovacao || null,
    data_prevista_contato: dataContato ? dataContato.toISOString().slice(0, 10) : null,
    status_prospeccao:     "FRIA",
  });
  if (error) console.error("Erro ao criar prospecção:", error);
}

export async function loadProspeccoes() {
  const { data, error } = await supabase
    .from("prospeccoes").select("*")
    .not("renovacao_id", "is", null)
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

export async function upsertProspeccao(p) {
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

// ── Funil de Vendas — leads novos do site/Google (renovacao_id IS NULL) ──
// Discriminador de tabela: prospeccoes.renovacao_id NULL = lead novo (aqui);
// NOT NULL = recuperação de Não Renovada (Captação, loadProspeccoes acima).
// Usa a coluna `status` (distinta de `status_prospeccao`, que é só da Captação).
export async function loadFunilVendas() {
  const { data, error } = await supabase
    .from("prospeccoes")
    .select("*")
    .is("renovacao_id", null)
    .order("criado_em", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({
    id:          r.id,
    clienteNome: r.cliente_nome,
    telefone:    r.telefone,
    email:       r.email,
    produto:     r.produto,
    observacoes: r.observacoes,
    detalhes:    r.detalhes || {},
    estagio:     r.status || "lead_recebido",
    criadoEm:    r.criado_em,
  }));
}

export async function atualizarEstagioLead(id, estagio) {
  const { error } = await supabase
    .from("prospeccoes")
    .update({ status: estagio, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Erro ao atualizar estágio do lead:", error);
  return !error;
}

// Graduação: cria o card em renovacoes já na etapa "Enviada ao Cliente",
// desempacotando os campos de veículo do jsonb `detalhes` quando aplicável.
// Marca o lead como "convertido" — mantém renovacao_id NULL de propósito,
// pra não virar um falso registro de recuperação em loadProspeccoes().
export async function graduarLead(lead) {
  const det = lead.detalhes || {};
  const card = {
    id:               genId(),
    clienteNome:      lead.clienteNome,
    telefone:         lead.telefone,
    email:            lead.email,
    tipoSeguro:       lead.produto,
    status:           "enviada",
    etiquetaSituacao: "Seguro Novo",
    etiquetaCanal:    "Site",
    mesReferencia:    new Date().toISOString().slice(0, 7),
    observacoes:      lead.observacoes || null,
  };
  if (lead.produto === "AUTOMÓVEL" && det.fluxo === "novo") {
    card.autoPlaca               = det.placa || null;
    card.autoModelo              = det.modelo || null;
    card.autoAnoFab               = det.ano || null;
    card.autoAnoMod               = det.ano || null;
    card.autoChassi              = det.chassi || null;
    card.autoCpfCondutor         = det.cpf_condutor || null;
    card.autoEstadoCivilCondutor = det.estado_civil || null;
    card.autoCepPernoite         = det.cep_pernoite || null;
    card.autoTipoUtilizacao      = det.tipo_utilizacao || null;
    card.autoCondutor1825        = typeof det.condutor_18_25 === "boolean" ? det.condutor_18_25 : null;
  }
  const erroCard = await upsertCard(card);
  if (erroCard) { console.error("Erro ao criar card na graduação:", erroCard); return false; }
  const { error: erroLead } = await supabase
    .from("prospeccoes")
    .update({ status: "convertido", atualizado_em: new Date().toISOString() })
    .eq("id", lead.id);
  if (erroLead) console.error("Erro ao marcar lead como convertido:", erroLead);
  return true;
}

export async function descartarLead(id) {
  const { error } = await supabase
    .from("prospeccoes")
    .update({ status: "perdido", atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("Erro ao descartar lead:", error);
  return !error;
}

// ── Helpers de cliente ───────────────────────────────────────
export async function searchClientes(q) {
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

export async function findOrCreateCliente({ nome, cpfCnpj, telefone, email, enderecoCep, enderecoLogradouro, enderecoNumero, enderecoComplemento, enderecoBairro, enderecoCidade, enderecoUf }) {
  // Normalização robusta: só dígitos; se vier com zero a mais, mantém os 14 últimos (CNPJ) / 11 (CPF)
  let normCpf = (cpfCnpj || "").replace(/\D/g, "");
  if (normCpf.length > 14) normCpf = normCpf.slice(-14);
  if (normCpf) {
    const { data: existing } = await supabase
      .from("clientes").select("id")
      .eq("cpf_cnpj_norm", normCpf).limit(1);
    if (existing && existing.length) return existing[0].id;
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
    cep:           enderecoCep || null,
    logradouro:    enderecoLogradouro || null,
    numero:        enderecoNumero || null,
    complemento:   enderecoComplemento || null,
    bairro:        enderecoBairro || null,
    cidade:        enderecoCidade || null,
    estado:        enderecoUf || null,
  });
  if (error) { console.error("Erro ao criar cliente:", error); return null; }
  return id;
}
