import { useState } from "react";
import { supabase } from "./supabase";
import { Upload, X, Archive, Shield, Save } from "lucide-react";
import { CANAIS, PAGAMENTOS } from "./constants";
import { genId, isCNPJ, maskCEP, maskCpfCnpj, maskMoeda, moedaParaNumero, mapPagamento } from "./utils";
import { findOrCreateCliente, uploadDoc } from "./data";

export function ImportModal({ onClose, onAdd }) {
  const [step, setStep] = useState(1);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("proposta");
  const [form, setForm] = useState({
  clienteNome: "", cpfCnpj: "", telefone: "", email: "",
  enderecoCep: "", enderecoLogradouro: "", enderecoNumero: "", enderecoComplemento: "",
  enderecoBairro: "", enderecoCidade: "", enderecoUf: "",
  seguradora: "", tipoSeguro: "", proposta: "", apolice: "",
  dataRenovacao: "", dataEmissao: "", vigenciaInicio: "", etiquetaSituacao: "", etiquetaPagamento: "", etiquetaCanal: "",
  autoPlaca: "", autoModelo: "", autoAnoFab: "", autoAnoMod: "",
  autoChassi: "", autoCepPernoite: "", autoClasseBonus: "", autoZeroKm: false, autoCombustivel: "",
  autoNomeSegurado: "", autoCpfSegurado: "", autoNascimentoSegurado: "", autoEstadoCivil: "",
  autoCondutor: "", autoCpfCondutor: "", autoNascimentoCondutor: "", autoEstadoCivilCondutor: "",
  autoTipoUtilizacao: "Particular", autoCondutor1825: false,
  condutorDiferente: false,
  valor: "", premioLiquido: "", percentualComissao: "", numeroParcelas: "", valorParcela: "", vencimentoPrimeiraParcela: "",
status: "transmitida",
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
const pagamentoMapeado = mapPagamento(d.financeiro?.formaPagamento);
const FORMAS_BOLETO = ["Boleto", "Débito em Conta", "Link de Pagamento"];
let importStatus = !minhaCorretora ? "cotacoes"
  : isApoliceMinha && daysLeft !== null && daysLeft <= 30 ? "cotacoes"
  : d.tipoDocumento === "apolice" ? "emitida" : "transmitida";
if (importStatus === "transmitida" && FORMAS_BOLETO.includes(pagamentoMapeado)) importStatus = "boleto";
const importSituacao = !minhaCorretora ? "Renovação Congênere"
  : (d.apolice?.tipoOperacao || "Renovação");

      setForm({        
        clienteNome:             (d.segurado?.nome || "").toUpperCase(),
        cpfCnpj:                 d.segurado?.cpfCnpj || "",
        telefone:                d.segurado?.telefone || "",
        email:                   d.segurado?.email || "",
        enderecoCep:             d.endereco?.cep ? maskCEP(d.endereco.cep) : "",
        enderecoLogradouro:      d.endereco?.logradouro || "",
        enderecoNumero:          d.endereco?.numero || "",
        enderecoComplemento:     d.endereco?.complemento || "",
        enderecoBairro:         d.endereco?.bairro || "",
        enderecoCidade:         d.endereco?.cidade || "",
        enderecoUf:          d.endereco?.uf || "",
        seguradora:              d.apolice?.seguradora || "",
        tipoSeguro:              temVeiculo ? "AUTOMÓVEL" : "",
        proposta:                d.apolice?.numeroProposta || "",
        apolice:                 d.apolice?.numeroApolice || "",
dataRenovacao:           d.apolice?.vigenciaFim || "",
dataEmissao:             d.apolice?.dataEmissao || "",
vigenciaInicio:          d.apolice?.vigenciaInicio || "",
        etiquetaSituacao:        importSituacao,
        etiquetaPagamento:       mapPagamento(d.financeiro?.formaPagamento),
        etiquetaCanal:           "",
        autoPlaca:               d.veiculo?.placa || "",
        autoModelo:              d.veiculo?.modelo || "",
        autoAnoFab:              d.veiculo?.anoFab || "",
        autoAnoMod:              d.veiculo?.anoMod || "",
        autoChassi:              d.veiculo?.chassi || "",
autoCepPernoite:         d.veiculo?.cepPernoite || "",
autoClasseBonus:         d.apolice?.classeBonus || "",
autoZeroKm:              d.veiculo?.zeroKm || false,
autoCombustivel:         d.veiculo?.combustivel || "",
        autoNomeSegurado:        (d.segurado?.nome || "").toUpperCase(),
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
premioLiquido:           d.financeiro?.premioLiquido || "",
numeroParcelas:          d.financeiro?.numeroParcelas || "",
valorParcela:            d.financeiro?.valorParcela || "",
vencimentoPrimeiraParcela: d.financeiro?.vencimentoPrimeiraParcela || "",
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
        enderecoCep:         form.enderecoCep,
        enderecoLogradouro:  form.enderecoLogradouro,
        enderecoNumero:      form.enderecoNumero,
        enderecoComplemento: form.enderecoComplemento,
        enderecoBairro:      form.enderecoBairro,
        enderecoCidade:      form.enderecoCidade,
        enderecoUf:          form.enderecoUf,
      });
      const card = {
  id:                genId(),
  clienteId,
  clienteNome:       form.clienteNome,
  cpfCnpj:           form.cpfCnpj,
  telefone:          form.telefone,
  email:             form.email,
  enderecoCep:         form.enderecoCep || null,
  enderecoLogradouro:  form.enderecoLogradouro || null,
  enderecoNumero:      form.enderecoNumero || null,
  enderecoComplemento: form.enderecoComplemento || null,
  enderecoBairro:      form.enderecoBairro || null,
  enderecoCidade:      form.enderecoCidade || null,
  enderecoUf:          form.enderecoUf || null,
  seguradora:        form.seguradora,
  tipoSeguro:        form.tipoSeguro,
  proposta:          form.proposta,
  apolice:           form.apolice,
dataRenovacao:     form.dataRenovacao || null,
dataEmissao:       form.dataEmissao || null,
vigenciaInicio:    form.vigenciaInicio || null,
  etiquetaSituacao:  form.etiquetaSituacao || null,
  etiquetaPagamento: form.etiquetaPagamento || null,
  autoPlaca:         form.autoPlaca,
  autoClasseBonus:   form.autoClasseBonus || null,
autoZeroKm:        form.autoZeroKm || false,
autoCombustivel:   form.autoCombustivel || null,
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
       valor:                    moedaParaNumero(form.valor),
premioLiquido:            moedaParaNumero(form.premioLiquido),
percentualComissao:       form.percentualComissao ? form.percentualComissao.replace(",", ".") : null,
numeroParcelas:           form.numeroParcelas || null,
valorParcela:             moedaParaNumero(form.valorParcela),
vencimentoPrimeiraParcela: form.vencimentoPrimeiraParcela || null,
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
  <label className={lbl}>Data de Nascimento {form.cpfCnpj && !isCNPJ(form.cpfCnpj) ? "*" : ""}</label>
  <input type="date" className={inp} value={form.autoNascimentoSegurado || ""} onChange={e => setF("autoNascimentoSegurado", e.target.value)} />
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
  <p className={`${lbl} mb-3`}>📍 Endereço do segurado</p>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className={lbl}>CEP</label>
      <input className={inp} placeholder="00000-000" value={form.enderecoCep} onChange={e => setF("enderecoCep", maskCEP(e.target.value))} />
    </div>
    <div>
      <label className={lbl}>Logradouro</label>
      <input className={inp} placeholder="Rua, avenida, quadra..." value={form.enderecoLogradouro} onChange={e => setF("enderecoLogradouro", e.target.value)} />
    </div>
    <div>
      <label className={lbl}>Número</label>
      <input className={inp} value={form.enderecoNumero} onChange={e => setF("enderecoNumero", e.target.value)} />
    </div>
    <div>
      <label className={lbl}>Complemento</label>
      <input className={inp} value={form.enderecoComplemento} onChange={e => setF("enderecoComplemento", e.target.value)} />
    </div>
    <div>
      <label className={lbl}>Bairro</label>
      <input className={inp} value={form.enderecoBairro} onChange={e => setF("enderecoBairro", e.target.value)} />
    </div>
    <div>
      <label className={lbl}>Cidade</label>
      <input className={inp} value={form.enderecoCidade} onChange={e => setF("enderecoCidade", e.target.value)} />
    </div>
    <div>
      <label className={lbl}>UF</label>
      <input className={inp} maxLength={2} placeholder="DF" value={form.enderecoUf} onChange={e => setF("enderecoUf", e.target.value.toUpperCase())} />
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
                      <option value="">Selecione</option>
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
<div>
  <label className={lbl}>Vigência início</label>
  <input type="date" className={inp} value={form.vigenciaInicio} onChange={e => setF("vigenciaInicio", e.target.value)} />
</div>
<div>
  <label className={lbl}>Vigência fim (data renovação)</label>
  <input type="date" className={inp} value={form.dataRenovacao} onChange={e => setF("dataRenovacao", e.target.value)} />
</div>
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
                      {CANAIS.map(c => <option key={c}>{c}</option>)}
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
  <label className={lbl}>Combustível</label>
  <input className={inp} placeholder="Flex, Gasolina..." value={form.autoCombustivel} onChange={e => setF("autoCombustivel", e.target.value)} />
</div>
<div className="flex items-center gap-2 mt-1">
  <input type="checkbox" id="imp-zerokm" checked={form.autoZeroKm || false} onChange={e => setF("autoZeroKm", e.target.checked)} className="w-4 h-4 accent-indigo-600" />
  <label htmlFor="imp-zerokm" className="text-sm text-slate-700 cursor-pointer">Veículo Zero KM</label>
</div>
                    <div>
                      <label className={lbl}>Ano fabricação</label>
                      <input className={inp} value={form.autoAnoFab} onChange={e => setF("autoAnoFab", e.target.value)} />
                    </div>
                    <div>
  <label className={lbl}>Ano modelo</label>
  <input className={inp} value={form.autoAnoMod} onChange={e => setF("autoAnoMod", e.target.value)} />
</div>
<div>
  <label className={lbl}>Classe de bônus</label>
  <input className={inp} placeholder="0 a 10" value={form.autoClasseBonus} onChange={e => setF("autoClasseBonus", e.target.value)} />
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
      <input className={inp} placeholder="Ex: 1.481,68" value={form.valor} onChange={e => setF("valor", maskMoeda(e.target.value))} />
    </div>
    <div>
      <label className={lbl}>Prêmio líquido (R$)</label>
      <input className={inp} placeholder="Base da comissão" value={form.premioLiquido} onChange={e => setF("premioLiquido", maskMoeda(e.target.value))} />
    </div>
<div>
  <label className={lbl}>% de comissão</label>
  <input className={inp} placeholder="Ex: 20" inputMode="decimal" value={form.percentualComissao} onChange={e => setF("percentualComissao", e.target.value.replace(/[^0-9,]/g, ""))} />
</div>
<div>
  <label className={lbl}>Forma de pagamento</label>
  <select className={inp} value={form.etiquetaPagamento} onChange={e => setF("etiquetaPagamento", e.target.value)}>
    <option value="">Selecione</option>
    {PAGAMENTOS.map(p => <option key={p}>{p}</option>)}
  </select>
</div>
<div>
  <label className={lbl}>Nº de parcelas</label>
  <input className={inp} value={form.numeroParcelas} onChange={e => setF("numeroParcelas", e.target.value)} />
</div>
<div>
  <label className={lbl}>Valor da parcela (R$)</label>
  <input className={inp} value={form.valorParcela} onChange={e => setF("valorParcela", maskMoeda(e.target.value))} />
</div>
<div>
  <label className={lbl}>Vencimento 1ª parcela</label>
  <input type="date" className={inp} value={form.vencimentoPrimeiraParcela} onChange={e => setF("vencimentoPrimeiraParcela", e.target.value)} />
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
