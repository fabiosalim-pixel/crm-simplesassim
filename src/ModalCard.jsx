import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import {
  X, ChevronRight, ChevronLeft, Users, Archive, Tag, Shield, Plus,
  AlertTriangle, Ban, Save, Clock, Trash2,
} from "lucide-react";
import { STAGES, CANAIS, PAGAMENTOS, RAMOS_IMOVEL, RAMOS_VIDA, RAMOS_EQUIP, RAMOS_VIAGEM } from "./constants";
import {
  genId, maskCpfCnpj, maskPhone, maskCEP, buscaCEP, maskMoeda, moedaParaNumero, numeroParaMoeda,
  fmtBRL, fmt, mapPagamento,
} from "./utils";
import { DocsSection, EndossoSection } from "./DocumentosEndossos";

export function Modal({ card, onClose, onSave, onDelete, onArquivar, onDesarquivar, onNaoRenovada, onVerCliente, onApoliceAnexada, onPropostaAnexada, onExtrairDados }) {
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
    const SN_STATUS_COR_PILL = {
      "Aberto":                "bg-red-100 text-red-700",
      "Documentação":          "bg-amber-100 text-amber-700",
      "Aguardando Seguradora": "bg-blue-100 text-blue-700",
      "Em Regulação":          "bg-violet-100 text-violet-700",
    };

    // Campos que mudam a cada ciclo de renovação — a proposta/apólice extraída
    // é sempre a fonte mais atual, então sobrescrevem o valor anterior do card.
    if (data.apolice?.vigenciaFim) updates.dataRenovacao = data.apolice.vigenciaFim;
    if (data.apolice?.vigenciaInicio) updates.vigenciaInicio = data.apolice.vigenciaInicio;
    if (data.financeiro?.premioTotal) updates.valor = numeroParaMoeda(moedaParaNumero(data.financeiro.premioTotal));
    if (data.financeiro?.premioLiquido) updates.premioLiquido = numeroParaMoeda(moedaParaNumero(data.financeiro.premioLiquido));
    if (data.apolice?.seguradora) updates.seguradora = data.apolice.seguradora;
    if (data.apolice?.numeroProposta) updates.proposta = data.apolice.numeroProposta;
    if (data.apolice?.numeroApolice) updates.apolice = data.apolice.numeroApolice;
    if (data.financeiro?.formaPagamento) updates.etiquetaPagamento = mapPagamento(data.financeiro.formaPagamento);
    if (data.segurado?.telefone) updates.telefone = maskPhone(data.segurado.telefone);
    if (data.segurado?.email) updates.email = data.segurado.email;
    if (data.segurado?.estadoCivil) updates.autoEstadoCivil = data.segurado.estadoCivil;
    if (data.veiculo?.condutorNome) updates.autoCondutor = data.veiculo.condutorNome;
    if (data.veiculo?.condutorCpf) updates.autoCpfCondutor = data.veiculo.condutorCpf;
    if (data.veiculo?.condutorNascimento) updates.autoNascimentoCondutor = data.veiculo.condutorNascimento;
    if (data.veiculo?.condutorEstadoCivil) updates.autoEstadoCivilCondutor = data.veiculo.condutorEstadoCivil;
    if (typeof data.veiculo?.condutor1825anos === "boolean") updates.autoCondutor1825 = data.veiculo.condutor1825anos;
    if (data.endereco) {
      const e = data.endereco;
      if (e.cep) updates.enderecoCep = maskCEP(e.cep);
      if (e.logradouro) updates.enderecoLogradouro = e.logradouro;
      if (e.numero) updates.enderecoNumero = e.numero;
      if (e.complemento) updates.enderecoComplemento = e.complemento;
      if (e.bairro) updates.enderecoBairro = e.bairro;
      if (e.cidade) updates.enderecoCidade = e.cidade;
      if (e.uf) updates.enderecoUf = e.uf;
    }
    if (tipo === "apolice_endosso" && data.financeiro?.premioLiquido) {
      const delta = moedaParaNumero(data.financeiro.premioLiquido);
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
      // Se for proposta e card ainda em cotações → avança para transmitida automaticamente
if (tipo === "proposta" && d.status === "cotacoes") {
  const formaPag = updates.etiquetaPagamento || d.etiquetaPagamento;
  const FORMAS_BOLETO = ["Boleto", "Débito em Conta", "Link de Pagamento"];
  updates.status = FORMAS_BOLETO.includes(formaPag) ? "boleto" : "transmitida";
  updates.transmitidaEm = new Date().toISOString();
  updates.etiquetaSituacao = updates.etiquetaSituacao || d.etiquetaSituacao || "Renovação";
}
      setD(prev => ({ ...prev, ...updates }));

      // Sincroniza dados permanentes do segurado na tabela clientes (data nascimento + endereço)
      const clienteId = d.clienteId;
      if (clienteId) {
        const clienteUpdates = {};
        if (data.segurado?.dataNascimento) clienteUpdates.data_nascimento = data.segurado.dataNascimento;
        if (data.endereco?.cep)         clienteUpdates.cep          = data.endereco.cep;
        if (data.endereco?.logradouro)  clienteUpdates.logradouro   = data.endereco.logradouro;
        if (data.endereco?.numero)      clienteUpdates.numero        = data.endereco.numero;
        if (data.endereco?.complemento) clienteUpdates.complemento  = data.endereco.complemento;
        if (data.endereco?.bairro)      clienteUpdates.bairro        = data.endereco.bairro;
        if (data.endereco?.cidade)      clienteUpdates.cidade        = data.endereco.cidade;
        if (data.endereco?.uf)          clienteUpdates.estado        = data.endereco.uf;
        if (Object.keys(clienteUpdates).length > 0) {
          supabase.from("clientes").update(clienteUpdates).eq("id", clienteId).then(({ error }) => {
            if (error) console.error("Erro ao atualizar cliente:", error);
          });
        }
      }

      const msg = updates.status === "transmitida"
        ? `✅ ${Object.keys(updates).length} campo(s) preenchido(s). Card movido para Proposta Transmitida. Revise e salve.`
        : `✅ ${Object.keys(updates).length} campo(s) preenchido(s) com dados do PDF. Revise e salve.`;
      alert(msg);
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
      valor:          moedaParaNumero(d.valor),
      proposta:       d.proposta,
      apolice:        d.apolice,
      situacao:       d.etiquetaSituacao,
      arquivado_em:   new Date().toISOString(),
    };
    const historico = [...(d.historicoCiclos || []), ciclo];
    setSaving(true);
    await onArquivar({ ...d, historicoCiclos: historico, arquivado: true, arquivadoEm: new Date().toISOString(), dataEmissao: d.dataEmissao || new Date().toISOString().slice(0, 10) });
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
            <div className="col-span-2 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📍 Endereço do cliente</p>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>CEP</label>
                  <input className={inp} placeholder="00000-000" value={d.enderecoCep || ""}
                    onChange={e => set("enderecoCep", maskCEP(e.target.value))}
                    onBlur={async e => {
                      const r = await buscaCEP(e.target.value);
                      if (r) setD(prev => ({ ...prev,
                        enderecoLogradouro: r.logradouro || prev.enderecoLogradouro,
                        enderecoBairro: r.bairro || prev.enderecoBairro,
                        enderecoCidade: r.cidade || prev.enderecoCidade,
                        enderecoUf: r.uf || prev.enderecoUf }));
                    }} />
                </div>
                <div className="col-span-4">
                  <label className={lbl}>Logradouro</label>
                  <input className={inp} value={d.enderecoLogradouro || ""} onChange={e => set("enderecoLogradouro", e.target.value)} placeholder="Rua, avenida, quadra..." />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Número</label>
                  <input className={inp} value={d.enderecoNumero || ""} onChange={e => set("enderecoNumero", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <label className={lbl}>Complemento</label>
                  <input className={inp} value={d.enderecoComplemento || ""} onChange={e => set("enderecoComplemento", e.target.value)} placeholder="Bloco, apto, lote..." />
                </div>
                <div className="col-span-3">
                  <label className={lbl}>Bairro</label>
                  <input className={inp} value={d.enderecoBairro || ""} onChange={e => set("enderecoBairro", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Cidade</label>
                  <input className={inp} value={d.enderecoCidade || ""} onChange={e => set("enderecoCidade", e.target.value)} />
                </div>
                <div className="col-span-1">
                  <label className={lbl}>UF</label>
                  <input className={inp} maxLength={2} placeholder="DF" value={d.enderecoUf || ""} onChange={e => set("enderecoUf", e.target.value.toUpperCase())} />
                </div>
              </div>
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
              <label className={lbl}>Vigência início</label>
              <input type="date" className={inp} value={d.vigenciaInicio || ""} onChange={e => set("vigenciaInicio", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Vigência fim (data renovação)</label>
              <input type="date" className={inp} value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Prêmio (R$){d.etiquetaSituacao === "Renovação Congênere" ? " *" : ""}</label>
              <input inputMode="numeric" className={`${inp} ${d.etiquetaSituacao === "Renovação Congênere" ? "border-amber-300" : ""}`}
                value={d.valor || ""} onChange={e => set("valor", maskMoeda(e.target.value))}
                placeholder={d.etiquetaSituacao === "Renovação Congênere" ? "Valor do ano anterior" : "0,00"} />
            </div>
            <div>
              <label className={lbl}>Prêmio líquido (R$)</label>
              <input inputMode="numeric" className={inp} value={d.premioLiquido || ""} onChange={e => set("premioLiquido", maskMoeda(e.target.value))} placeholder="Base da comissão" />
            </div>
            <div>
              <label className={lbl}>Comissão (%)</label>
              <input type="number" className={inp} value={d.percentualComissao || ""} onChange={e => set("percentualComissao", e.target.value)} placeholder="Ex: 20" />
            </div>
            <div>
              <label className={lbl}>Comissão (R$)</label>
              <input className={`${inp} bg-slate-50 text-slate-600`} disabled
                value={moedaParaNumero(d.premioLiquido) && d.percentualComissao ? fmtBRL(moedaParaNumero(d.premioLiquido) * Number(d.percentualComissao) / 100) : "—"} />
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
                  <input className={inp} placeholder="00000-000" value={d.imovelCep || ""}
                    onChange={e => set("imovelCep", maskCEP(e.target.value))}
                    onBlur={async e => {
                      const r = await buscaCEP(e.target.value);
                      if (r) setD(prev => ({ ...prev,
                        imovelLogradouro: r.logradouro || prev.imovelLogradouro,
                        imovelBairro: r.bairro || prev.imovelBairro,
                        imovelCidade: r.cidade || prev.imovelCidade,
                        imovelUf: r.uf || prev.imovelUf }));
                    }} />
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

          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" checked={!!d.etiquetaSegfy} onChange={e => set("etiquetaSegfy", e.target.checked)} />
            <Tag size={14} className="text-blue-500" /> Enviado ao SegFy
          </label>

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
