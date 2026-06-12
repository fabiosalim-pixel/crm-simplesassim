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
- Se houver um número real de apólice → é uma APÓLICE emitida
- Se houver campo "Data de emissão" preenchida → é uma APÓLICE

## PASSO 2 — IDENTIFICAR A CORRETORA E VERIFICAR SE É "SIMPLES ASSIM"

Buscar a seção "DADOS DO CORRETOR", "SEU CORRETOR", "CORRETOR" ou equivalente e extrair o nome da corretora.

Verificar se o nome contém "SIMPLES ASSIM" (ignorar maiúsculas/minúsculas, aceitar variações próximas):
- Se for a corretora "Simples Assim" → minhaCorretora = true
- Qualquer outra corretora → minhaCorretora = false
- Sem seção de corretor → minhaCorretora = false

## PASSO 3 — EXTRAIR SEGURADORA CORRETAMENTE

A seguradora é a EMPRESA QUE EMITIU O DOCUMENTO (cabeçalho/logo/rodapé).

⚠️ ATENÇÃO — ARMADILHA em Renovação Congênere:
Em propostas de "Renovação Congênere", o campo "Seguradora:" nos Dados Gerais mostra a SEGURADORA ANTERIOR. Ignorar esse campo. Usar sempre o cabeçalho/logo.
- Exemplos: "PORTO SEGURO", "HDI SEGUROS", "AZUL SEGUROS", "TOKIO MARINE", "MAPFRE", "ALLIANZ", "YELUM"

## PASSO 4 — EXTRAIR NÚMEROS DE PROPOSTA E APÓLICE

### SE for PROPOSTA:
- numeroProposta: campo "Proposta" nos "Dados da cotação" ou cabeçalho
- numeroApolice: deixar VAZIO "" (mesmo que exista "Apólice: -")

### SE for APÓLICE:
- numeroApolice: campo "Número da apólice:", "Apólice:" ou equivalente
- numeroProposta: campo "Proposta:" dentro de "Dados da sua apólice" ou equivalente

## PASSO 5 — EXTRAIR SEGURADO

Buscar na seção "Dados Gerais", "Dados do Segurado", "DADOS DO(A) SEGURADO(A)" ou equivalente:
- nome: nome completo em MAIÚSCULAS
- cpfCnpj: CPF ou CNPJ com pontuação original (ex: "123.456.789-00")
- dataNascimento: data de nascimento no formato YYYY-MM-DD
- estadoCivil: estado civil. Mapear para: "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"
  → Se o documento disser "casado(a) ou vive em união estável" → usar "Casado(a)"
  → Se não houver campo → deixar vazio ""
- sexo: "Masculino" ou "Feminino"
- email: endereço de e-mail
- telefone: número de telefone (com DDD)

## PASSO 6 — EXTRAIR CONDUTOR PRINCIPAL

Buscar na seção "Questionário de avaliação de risco", "DADOS DO PERFIL", "Condutor principal", "Dados do motorista principal" ou equivalente:
- condutorNome: nome completo em MAIÚSCULAS
- condutorCpf: CPF com pontuação original
- condutorNascimento: data de nascimento no formato YYYY-MM-DD
- condutorEstadoCivil: estado civil. Mapear para: "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"
  → Se o documento disser "casado(a) ou vive em união estável" ou "Casado/Uniao Estavel" → usar "Casado(a)"
  → Se não houver campo → deixar vazio ""

⚠️ O condutor pode ser a MESMA pessoa que o segurado ou DIFERENTE. Preencher sempre.

## PASSO 7 — EXTRAIR DADOS DO VEÍCULO

- placa: placa do veículo (ex: "ABC1D23")
- chassi: número do chassi
- modelo: marca e modelo completo (ex: "FIAT FIORINO FURGAO 1.4 FLEX")
- anoFab: ano de fabricação (ex: "2021")
- anoMod: ano do modelo (ex: "2022")
- zeroKm: true se Zero Km, false caso contrário
- combustivel: "Flex", "Gasolina", "Etanol", "Diesel", "Elétrico", "Híbrido", "GNV"
- cepPernoite: CEP onde o veículo pernoita (somente números com hífen, ex: "71745-608")
  → Pode aparecer como "CEP de pernoite", "Local de risco", "CEP Pernoite"
- tipoUtilizacao: tipo de uso do veículo. Mapear para um dos valores:
  "Particular", "Táxi", "Comercial", "Uber/App", "Mototáxi", "Escolar"
  → Se o documento disser "Particular" → "Particular"
  → Se disser "Não realiza serviço para transportadora" ou similar → "Particular"
  → Se mencionar aplicativo de transporte (Uber, 99, iFood) → "Uber/App"
  → Se não houver campo → "Particular" (padrão)
- condutor1825anos: boolean — true se o segurado CONTRATOU cobertura para condutores de 18 a 25 anos
  → Se o documento disser "Sim" para "Deseja contratar cobertura para condutores 18 a 25 anos" → true
  → Se disser "Não" ou "estou ciente que não haverá cobertura" → false
  → Se não houver campo → false

## PASSO 8 — EXTRAIR VIGÊNCIA E OPERAÇÃO

- vigenciaInicio: início da vigência (YYYY-MM-DD)
- vigenciaFim: fim da vigência (YYYY-MM-DD)
- tipoOperacao: copiar EXATAMENTE o campo "Tipo de Seguro", "Tipo de Operação" ou equivalente.
  Valores aceitos: "Renovação", "Renovação Congênere", "Seguro Novo", "Endosso"
  → "Renovação Tokio", "Renovação de outra seguradora sem sinistro" → usar "Renovação"
  → "Renovação Congênere" → manter exato
  → Seguro novo/primeiro seguro → "Seguro Novo"
- classeBonus: número da classe de bônus (ex: "10", "1")

## PASSO 9 — EXTRAIR FINANCEIRO

- premioLiquido: valor do prêmio sem IOF (sem "R$")
- premioTotal: valor total com IOF (sem "R$")
- iof: valor do IOF (sem "R$")
- formaPagamento: texto da forma de pagamento (ex: "Cartão de Crédito", "Boleto", "Débito em Conta")
- numeroParcelas: número de parcelas como string (ex: "1", "4", "10")
- valorParcela: valor de cada parcela (sem "R$")
- vencimentoPrimeiraParcela: data de vencimento da 1ª parcela (YYYY-MM-DD)

## ESTRUTURA DE RETORNO

Retorne APENAS este JSON válido (sem markdown, sem blocos de código, sem texto antes ou depois):

{
  "segurado": {
    "nome": "",
    "cpfCnpj": "",
    "dataNascimento": "",
    "estadoCivil": "",
    "sexo": "",
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
    "tipoUtilizacao": "",
    "condutor1825anos": false,
    "condutorNome": "",
    "condutorCpf": "",
    "condutorNascimento": "",
    "condutorEstadoCivil": ""
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
- Booleanos (zeroKm, condutor1825anos, minhaCorretora) como true/false sem aspas
- tipoDocumento: "proposta", "apolice" ou "endosso"
- confianca: "alta", "media" ou "baixa"
- veiculo: preencher apenas se for seguro de automóvel/veículo`;

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
