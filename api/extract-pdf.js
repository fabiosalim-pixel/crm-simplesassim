export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const PROMPT = `Você é um especialista em extração de dados de propostas e apólices de seguros brasileiros.

## PASSO 1 — IDENTIFICAR O TIPO DE DOCUMENTO

Leia o título principal do documento (geralmente no topo da primeira página):
- Se contiver "Apólice" (ex: "Apólice Porto Seguro Auto", "Apólice de Seguro") → tipoDocumento = "apolice"
- Se contiver "Proposta de Seguro" ou "Proposta" sem número de apólice emitido → tipoDocumento = "proposta"
- Se contiver "Endosso" → tipoDocumento = "endosso"

CONFIRMAÇÃO ADICIONAL:
- Se o campo "Apólice" ou "Número da apólice" contiver apenas "-" ou estiver vazio → é uma PROPOSTA (ainda não emitida)
- Se houver um número real de apólice (ex: "0531 11 13640340") → é uma APÓLICE emitida
- Se houver campo "Data de emissão" preenchida e "Código C.I." → é uma APÓLICE

## PASSO 2 — IDENTIFICAR A CORRETORA E VERIFICAR SE É "SIMPLES ASSIM"

Buscar a seção "DADOS DO CORRETOR" ou equivalente e extrair o nome da corretora.

Em seguida, verificar se o nome da corretora é "Simples Assim Corretora de Seguros Inteligentes LTDA" ou variações próximas:
- Considerar match se o nome contiver "SIMPLES ASSIM" (ignorar maiúsculas/minúsculas)
- Aceitar pequenas variações de digitação (ex: "SIMPLES ASI", "SIMPL ASSIM", "SIMPLES ASIM")
- Se for a corretora "Simples Assim" → minhaCorretora = true
- Se for qualquer outra corretora → minhaCorretora = false
- Se não houver seção de corretor no documento → minhaCorretora = false

## PASSO 3 — EXTRAIR SEGURADORA CORRETAMENTE

A seguradora é a EMPRESA QUE EMITIU O DOCUMENTO (visível no cabeçalho/logo/rodapé).

⚠️ ATENÇÃO — ARMADILHA COMUM em Renovação Congênere:
Em propostas de "Renovação Congênere", pode existir um campo "Seguradora:" dentro dos Dados Gerais que mostra a SEGURADORA ANTERIOR (ex: "Alfa Seguradora S/A"). Esse campo NÃO é a seguradora do documento — é a seguradora de onde o cliente está saindo.
- A seguradora CORRETA é sempre a do cabeçalho/logo (quem emitiu o documento).
- Exemplos: "PORTO SEGURO", "HDI SEGUROS", "AZUL SEGUROS", "TOKIO MARINE", "MAPFRE", "ALLIANZ", "YELUM"

## PASSO 4 — EXTRAIR NÚMEROS DE PROPOSTA E APÓLICE

### SE for PROPOSTA:
- numeroProposta: buscar no campo "Proposta" dentro de "Dados da cotação" ou no cabeçalho do documento
  → Formato Porto Seguro: "32566J-5880731828-0-1" ou número simples
- numeroApolice: deixar VAZIO "" — a apólice ainda não foi emitida
  → Mesmo que exista um campo "Apólice: -" no documento, retornar ""

### SE for APÓLICE:
- numeroApolice: buscar no campo "Número da apólice:", "Apólice:" ou "Apólice" (ex: "0531 11 13640340", "31.09.2025.0897882")
  → Retornar o número como encontrado no documento
- numeroProposta: buscar no campo "Proposta:" dentro de "Dados da sua apólice" ou seção equivalente
  → Esta é a proposta que ORIGINOU a apólice

## PASSO 5 — EXTRAIR SEGURADO

Buscar na seção "Dados Gerais", "Dados do Segurado", "DADOS DO(A) SEGURADO(A)" ou "Dados cadastrais":
- nome: nome completo em maiúsculas
- cpfCnpj: CPF ou CNPJ com pontuação original
- dataNascimento: data de nascimento no formato YYYY-MM-DD
- sexo, profissao, email, telefone: se disponíveis

## PASSO 6 — EXTRAIR CONDUTOR PRINCIPAL

Buscar na seção "Questionário de avaliação de risco", "Condutor principal", "Dados do motorista principal", "DADOS DO PERFIL" ou equivalente:
- condutorNome: nome completo em maiúsculas
- condutorCpf: CPF com pontuação original
- condutorNascimento: data de nascimento no formato YYYY-MM-DD

⚠️ ATENÇÃO: O condutor pode ser a MESMA pessoa que o segurado ou uma PESSOA DIFERENTE.
- Se o condutor for o mesmo segurado, preencher os campos mesmo assim (repetindo os dados)
- Se não houver seção de condutor separada, usar os dados do segurado

## PASSO 7 — EXTRAIR VIGÊNCIA E OPERAÇÃO

- vigenciaInicio e vigenciaFim: buscar no campo "Vigência", "Vigência do Seguro" ou "Período de vigência" (formato YYYY-MM-DD)
- tipoOperacao: copiar EXATAMENTE o valor do campo "Tipo de Operação" ou equivalente.
  Valores aceitos: "Renovação", "Renovação Congênere", "Seguro Novo", "Endosso"
  → Se o documento mostrar "Renovação Congênere" → retornar "Renovação Congênere" (não abreviar)
  → Se não houver campo, inferir: apólice nova = "Seguro Novo", renovação = "Renovação"

## PASSO 8 — EXTRAIR FINANCEIRO

- premioLiquido: valor do prêmio sem IOF
- premioTotal: valor total com IOF
- iof: valor do IOF
- formaPagamento: texto da forma de pagamento (ex: "À vista - Boleto", "Cartão de Crédito 10x")
- numeroParcelas: número de parcelas como string (ex: "1", "3", "10")
- valorParcela: valor de cada parcela
- vencimentoPrimeiraParcela: data de vencimento da 1ª parcela (YYYY-MM-DD) — extrair da tabela de parcelamento, coluna "Vencimento" da primeira linha

## ESTRUTURA DE RETORNO

Retorne APENAS este JSON válido (sem markdown, sem blocos de código, sem texto antes ou depois):

{
  "segurado": {
    "nome": "",
    "cpfCnpj": "",
    "dataNascimento": "",
    "sexo": "",
    "profissao": "",
    "email": "",
    "telefone": ""
  },
  "apolice": {
    "seguradora": "",
    "numeroProposta": "",
    "numeroApolice": "",
    "vigenciaInicio": "",
    "vigenciaFim": "",
    "tipoOperacao": "",
    "classeBonus": "",
    "dataEmissao": ""
  },
  "veiculo": {
    "placa": "",
    "chassi": "",
    "modelo": "",
    "anoFab": "",
    "anoMod": "",
    "zeroKm": false,
    "combustivel": "",
    "cepPernoite": "",
    "condutorNome": "",
    "condutorCpf": "",
    "condutorNascimento": ""
  },
  "financeiro": {
    "premioLiquido": "",
    "premioTotal": "",
    "iof": "",
    "formaPagamento": "",
    "numeroParcelas": "",
    "valorParcela": "",
    "vencimentoPrimeiraParcela": ""
  },
  "corretor": "",
  "minhaCorretora": false,
  "tipoDocumento": "",
  "confianca": ""
}

## REGRAS FINAIS
- Retorne SOMENTE o JSON, sem nenhum texto antes ou depois
- Datas SEMPRE no formato YYYY-MM-DD
- CPF/CNPJ com a pontuação original do documento (ex: "697.734.081-91")
- Valores monetários como string com formatação brasileira (ex: "1.481,68") — sem "R$"
- Se um campo não existir no documento, deixar string vazia ""
- tipoDocumento: "proposta", "apolice" ou "endosso"
- minhaCorretora: boolean true ou false (não string)
- corretor: nome da corretora como aparece no documento
- confianca: "alta", "media" ou "baixa" — avalie a qualidade geral da extração
- veiculo: preencher apenas se for seguro de automóvel/veículo; caso contrário deixar todos os campos com string vazia`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pdfBase64 } = req.body || {};

  if (!pdfBase64) {
    return res.status(400).json({ error: "pdfBase64 é obrigatório" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada" });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(500).json({ error: "Erro na API Anthropic", details: errText });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text?.trim() || "";

    // Remove possible markdown wrapper
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(200).json({ success: false, error: "Falha ao interpretar resposta da IA", raw: rawText });
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
