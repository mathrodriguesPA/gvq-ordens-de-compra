// Carga inicial a partir dos arquivos do sistema antigo (pasta dados-iniciais do
// gvq-ordens-de-compra.zip): ocs-planilha.json e cadastros.json. Os arquivos ficam
// fora do repositório, que é público; o analista escolhe os dois no computador.
import { lerNumero } from './util.js';

const STATUS = ['Pendente', 'Aberto', 'Finalizado', 'Cancelado'];
const TIPOS = ['Compra', 'Transferência', 'Trading'];
const textoOuVazio = v => (v == null ? '' : String(v).trim());

// Na planilha, a coluna de observação de cada origem costuma trazer o R$/@ ("350").
function precoDaObs(obs) {
    const n = lerNumero(String(obs ?? '').replace(/^R\$\s*/i, '').replace(/\/@$/, ''));
    return Number.isFinite(n) && n > 0 && n < 10000 ? n : null;
}

export function converterOc(o) {
    const origens = (o.linhas || []).map(l => {
        const preco = precoDaObs(l.obs);
        return {
            origem: textoOuVazio(l.origem),
            quantidade: Number.isInteger(l.qtd) && l.qtd > 0 ? l.qtd : null,
            sequencia: textoOuVazio(l.sequencia),
            preco,
            obs: preco == null ? textoOuVazio(l.obs) : ''
        };
    });
    const soma = origens.reduce((t, l) => t + (l.quantidade || 0), 0);
    return {
        id: String(o.id).replace(/\//g, '-'),
        dados: {
            fonte: 'planilha',
            numero: Number(o.numeroBase),
            rotulo: textoOuVazio(o.numero),
            status: STATUS.includes(o.status) ? o.status : 'Finalizado',
            tipo: TIPOS.includes(o.operacao) ? o.operacao : '',
            sexo: textoOuVazio(o.sexo),
            raca: '',
            quantidade: Number.isInteger(o.qtdTotal) ? o.qtdTotal : (soma || null),
            origens,
            destino: textoOuVazio(o.destino),
            proprietario: textoOuVazio(o.proprietario),
            dataPrevista: /^\d{4}-\d{2}-\d{2}$/.test(o.data || '') ? o.data : '',
            trava: ['Sim', 'Não'].includes(o.trava) ? o.trava : '',
            alerta: textoOuVazio(o.alerta)
        }
    };
}

// Cadastros do sistema antigo → listas deste: "destinos" são as fazendas de destino;
// "fazendas" (outras fazendas e confinamentos) e "fornecedores" viram outras origens.
export function converterCadastros(c) {
    const unicos = l => [...new Set((l || []).map(textoOuVazio).filter(Boolean))];
    return {
        fazendas: unicos(c.destinos),
        origens: unicos([...(c.fazendas || []), ...(c.fornecedores || [])]),
        racas: unicos(c.racas),
        responsaveis: unicos(c.responsaveis)
    };
}

export async function lerArquivosPlanilha(arquivos) {
    const resultado = { ocs: null, cadastros: null, erros: [] };
    for (const arquivo of arquivos) {
        try {
            const conteudo = JSON.parse(await arquivo.text());
            if (Array.isArray(conteudo) && conteudo.every(o => o && o.id != null && o.numeroBase != null)) resultado.ocs = conteudo.map(converterOc);
            else if (conteudo && Array.isArray(conteudo.destinos)) resultado.cadastros = converterCadastros(conteudo);
            else resultado.erros.push(`${arquivo.name}: formato não reconhecido`);
        } catch {
            resultado.erros.push(`${arquivo.name}: não é um arquivo JSON válido`);
        }
    }
    return resultado;
}
