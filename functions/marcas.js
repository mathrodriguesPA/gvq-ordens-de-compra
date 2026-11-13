// Leitura das marcas a fogo nas fotos do gado, com o Claude (visão).
// Usado pela Cloud Function (functions/index.js) e pelo servidor local (scripts/dev-server.mjs).
// Recebe as fotos de um lote e as marcas já encontradas nos lotes anteriores (para reaproveitar o mesmo id
// quando a marca se repete) e devolve cada marca redesenhada como traços SVG num quadro de 100 x 100.
import Anthropic from "@anthropic-ai/sdk";

export const MODELO = "claude-opus-5-5";
export const MAX_FOTOS_POR_LOTE = 8;

const SISTEMA = `Você analisa fotos de bovinos para preencher a GTA (guía de traslado) do Paraguai, onde cada marca a fogo que o rebanho tem no couro precisa ser desenhada num quadrado.

Para cada foto:
- Encontre todas as marcas a fogo (marcas de propriedade, letras, números, símbolos, marcas de ano ou de vacina feitas a ferro quente) visíveis no couro.
- Ignore brincos, tatuagens de orelha, tinta, sujeira, cicatrizes que não sejam marca e sombras.
- Se a mesma marca aparece em várias fotos, ela é uma marca só: use o mesmo id. Se ela já estiver na lista de marcas conhecidas, use o id dela.

Para cada marca, redesenhe o formato como ele seria feito com o ferro, visto de frente e sem a distorção do couro:
- "tracos" é uma lista de atributos d de <path> SVG num quadro de 0 a 100 nos dois eixos, desenhados como linha (sem preenchimento), com a marca centralizada e ocupando de 10 a 90.
- Use só os comandos M, L, H, V, C, S, Q, T, A e Z, com números absolutos.
- Reproduza a forma fielmente (proporções, ângulos, pontas, círculos); não invente detalhes que a foto não mostra.

"caixa" de cada ocorrência é o retângulo da marca na foto, em frações de 0 a 1: [x, y, largura, altura], a partir do canto superior esquerdo.
"confianca" vai de 0 a 1. Use valor baixo quando a marca estiver borrada, parcial ou com pelo cobrindo, e explique em "observacao".
Escreva descrições curtas em português.`;

const SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["marcas", "fotosSemMarca"],
    properties: {
        marcas: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "descricao", "local", "tracos", "confianca", "observacao", "ocorrencias"],
                properties: {
                    id: { type: "string", description: "Id curto: reaproveite o de uma marca conhecida; para marca nova use m + número" },
                    descricao: { type: "string", description: "Ex.: letra R com meia-lua embaixo" },
                    local: { type: "string", description: "Onde fica no animal, ex.: anca esquerda, paleta direita, face" },
                    tracos: { type: "array", items: { type: "string" } },
                    confianca: { type: "number" },
                    observacao: { type: "string" },
                    ocorrencias: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["foto", "caixa"],
                            properties: {
                                foto: { type: "integer", description: "Número da foto no lote, a partir de 1" },
                                caixa: { type: "array", items: { type: "number" } },
                            },
                        },
                    },
                },
            },
        },
        fotosSemMarca: { type: "array", items: { type: "integer" }, description: "Fotos do lote onde nenhuma marca ficou visível" },
    },
};

const TIPOS_IMAGEM = new Set(["image/jpeg", "image/png", "image/webp"]);
const PATH_VALIDO = /^[MLHVCSQTAZmlhvcsqtaz0-9.,eE\s+-]{1,4000}$/;

export function validarEntrada(corpo) {
    const fotos = Array.isArray(corpo?.fotos) ? corpo.fotos : [];
    if (!fotos.length) throw new ErroEntrada("Envie pelo menos uma foto.");
    if (fotos.length > MAX_FOTOS_POR_LOTE) throw new ErroEntrada(`Envie no máximo ${MAX_FOTOS_POR_LOTE} fotos por vez.`);
    for (const f of fotos) {
        if (!TIPOS_IMAGEM.has(f?.tipo) || typeof f?.dados !== "string" || !f.dados) throw new ErroEntrada("Foto em formato inválido.");
    }
    const conhecidas = (Array.isArray(corpo?.conhecidas) ? corpo.conhecidas : []).slice(0, 60).map(m => ({
        id: String(m?.id ?? "").slice(0, 20),
        descricao: String(m?.descricao ?? "").slice(0, 200),
        local: String(m?.local ?? "").slice(0, 100),
    }));
    return { fotos, conhecidas };
}

export class ErroEntrada extends Error {}

export async function lerMarcas({ fotos, conhecidas }, apiKey) {
    const client = new Anthropic({ apiKey });

    const conteudo = [];
    fotos.forEach((f, i) => {
        conteudo.push({ type: "text", text: `Foto ${i + 1}:` });
        conteudo.push({ type: "image", source: { type: "base64", media_type: f.tipo, data: f.dados } });
    });
    conteudo.push({
        type: "text",
        text: (conhecidas.length
            ? `Marcas conhecidas (encontradas em lotes anteriores do mesmo rebanho):\n${JSON.stringify(conhecidas)}\n\n`
            : "Ainda não há marcas conhecidas deste rebanho.\n\n")
            + `Marcas novas recebem ids a partir de m${conhecidas.length + 1}, sem repetir os ids conhecidos.\n`
            + `Analise as ${fotos.length} fotos e devolva as marcas a fogo encontradas.`,
    });

    // Streaming: a resposta traz os desenhos de todas as marcas e pode ser longa.
    const stream = client.beta.messages.stream({
        model: MODELO,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",   // se o Claude Opus 5.5 recusar, outro modelo responde na mesma chamada
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
        system: SISTEMA,
        messages: [{ role: "user", content: conteudo }],
    });
    const resposta = await stream.finalMessage();

    if (resposta.stop_reason === "refusal") throw new Error("A IA recusou analisar estas fotos.");
    if (resposta.stop_reason === "max_tokens") throw new Error("A resposta da IA ficou longa demais. Envie menos fotos por vez.");
    const texto = resposta.content.filter(b => b.type === "text").map(b => b.text).join("");
    const dados = JSON.parse(texto);
    return limparResultado(dados, fotos.length);
}

// Não confia no formato devolvido: só passa traços SVG com comandos de caminho e caixas dentro da foto.
function limparResultado(dados, totalFotos) {
    const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
    const marcas = (dados.marcas || []).map(m => ({
        id: String(m.id || "").slice(0, 20),
        descricao: String(m.descricao || "").slice(0, 200),
        local: String(m.local || "").slice(0, 100),
        tracos: (m.tracos || []).map(String).filter(d => PATH_VALIDO.test(d)).slice(0, 40),
        confianca: num(m.confianca, 0, 1),
        observacao: String(m.observacao || "").slice(0, 300),
        ocorrencias: (m.ocorrencias || [])
            .filter(o => Number.isInteger(o.foto) && o.foto >= 1 && o.foto <= totalFotos)
            .map(o => ({ foto: o.foto, caixa: [0, 1, 2, 3].map(i => num(o.caixa?.[i], 0, 1)) })),
    })).filter(m => m.id && m.tracos.length);
    const fotosSemMarca = (dados.fotosSemMarca || []).filter(n => Number.isInteger(n) && n >= 1 && n <= totalFotos);
    return { marcas, fotosSemMarca };
}

// Resposta de exemplo para testar a tela sem chave da API (só no servidor local).
export function exemplo(totalFotos) {
    return {
        marcas: [
            { id: "m1", descricao: "Letra R com meia-lua embaixo", local: "anca esquerda", confianca: 0.92, observacao: "",
              tracos: ["M35 20 V70", "M35 20 H55 C70 20 70 45 55 45 H35", "M50 45 L68 70", "M25 80 Q50 95 75 80"],
              ocorrencias: Array.from({ length: totalFotos }, (_, i) => ({ foto: i + 1, caixa: [0.55, 0.35, 0.18, 0.2] })) },
            { id: "m2", descricao: "Número 6 (marca de ano)", local: "paleta esquerda", confianca: 0.61, observacao: "Exemplo: marca parcialmente coberta pelo pelo.",
              tracos: ["M62 22 C40 22 32 45 32 62 C32 78 42 85 52 85 C64 85 70 76 70 66 C70 55 62 48 52 48 C42 48 34 55 32 62"],
              ocorrencias: [{ foto: 1, caixa: [0.3, 0.4, 0.1, 0.12] }] },
        ],
        fotosSemMarca: [],
    };
}
