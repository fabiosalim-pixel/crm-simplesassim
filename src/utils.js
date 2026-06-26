// ── Funções utilitárias puras (sem JSX, sem hooks, sem Supabase) ──

export const genId = () => crypto.randomUUID();

export const daysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d + "T12:00:00") - new Date()) / 86400000);
};

export const isTransmitidaExpirada = (card) => {
  if (card.status !== "transmitida" || card.arquivado) return false;
  // criadoEm or dataRenovacao — use updated_at proxy via transmitidaEm if available, else skip
  if (!card.transmitidaEm) return false;
  const dias = Math.ceil((new Date() - new Date(card.transmitidaEm)) / 86400000);
  return dias >= 5;
};

export const isApoliceAlerta = (card) => {
  if (card.status !== "transmitida") return false;
  if (card.etiquetaSituacao === "Seguro Novo") return false;
  if (card.apoliceAnexada) return false;
  if (!card.criadoEm) return false;
  const dias = Math.floor((Date.now() - new Date(card.criadoEm)) / 86400000);
  return dias >= 7;
};

export const isVistoriaAlerta = (card) => {
  if (card.status !== "vistoria") return false;
  if (!card.criadoEm) return false;
  const dias = Math.floor((Date.now() - new Date(card.criadoEm)) / 86400000);
  return dias >= 5;
};

export const isBoletoAlerta = (card) => {
  if (card.status !== "boleto") return false;
  if (!card.dataAlerta) return false;
  return new Date(card.dataAlerta + "T23:59:59") <= new Date();
};

export const fmt = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const fmtBRL = (v) =>
  v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

export const maskCpfCnpj = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) =>
      [a, b, c].filter(Boolean).join(".") + (e ? "-" + e : ""));
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, e, f) =>
    [a, b, c].filter(Boolean).join(".").replace(/^(\d{2})\./, "$1.") + (e ? "/" + e : "") + (f ? "-" + f : ""))
    .replace(/^(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
};

export const isCNPJ = (v) => (v || "").replace(/\D/g, "").length > 11;

// Formata centavos digitados em moeda BR: "158300" -> "1.583,00"
export const maskMoeda = (v) => {
  const dig = String(v).replace(/\D/g, "");
  if (!dig) return "";
  const n = (parseInt(dig, 10) / 100);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Converte "1.583,00" -> 1583.00 (numero) — aceita vírgula OU ponto como decimal
export const moedaParaNumero = (s) => {
  if (s === null || s === undefined || s === "") return null;
  let str = String(s).trim().replace(/[^\d.,-]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const sepPos = Math.max(lastComma, lastDot);
  let n;
  if (sepPos === -1) {
    n = parseFloat(str);
  } else {
    const intPart = str.slice(0, sepPos).replace(/[.,]/g, "");
    const decPart = str.slice(sepPos + 1).replace(/[.,]/g, "");
    n = parseFloat(intPart + "." + decPart);
  }
  return isNaN(n) ? null : n;
};
// Numero do banco -> "1.583,00" para exibir no input
export const numeroParaMoeda = (v) => {
  if (v === null || v === undefined || v === "") return "";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Consulta ViaCEP (gratuito, sem chave). Retorna {logradouro, bairro, cidade, uf} ou null.
export async function buscaCEP(cep) {
  const limpo = String(cep || "").replace(/\D/g, "");
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      uf: data.uf || "",
    };
  } catch {
    return null;
  }
}
export const maskCEP = (v) => String(v || "").replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})/, "$1-$2");

export const maskPhone = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
};
