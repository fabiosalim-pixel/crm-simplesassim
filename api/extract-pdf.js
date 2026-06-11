export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const PROMPT = `Você é um especialista em extração de dados de propostas e apólices de seguros brasileiros.

Extraia os dados deste documento e retorne APENAS um JSON válido (sem markdown, sem blocos de código, sem nenhum texto antes ou depois) com esta estrutura exata:

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
    "classeBonus": ""
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
    "valorParcela": ""
  },
  "tipoDocumento": "",
  "confianca": ""
}

Regras obrigatórias:
- Retorne SOMENTE o JSON, sem nenhum texto antes ou depois
- Datas no formato YYYY-MM-DD
- CPF/CNPJ com a pontuação original do documento (ex: "697.734.081-91")
- Valores monetários como string com formatação brasileira (ex: "1.481,68")
- Se um campo não existir no documento, deixar string vazia ""
- tipoOperacao: interprete o sentido do documento, não copie literal. Valores possíveis: "Renovação", "Seguro Novo", "Endosso"
- tipoDocumento: "proposta", "apolice" ou "endosso"
- confianca: "alta", "media" ou "baixa" — avalie a qualidade geral da extração
- veiculo: preencher apenas se for seguro de automóvel/veículo; caso contrário deixar todos os campos com string vazia
- Para seguradora: use o nome comercial completo (ex: "HDI SEGUROS", "PORTO SEGURO", "AZUL SEGUROS")`;

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
