export const normalizarTexto = valor => String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const compararNomes = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base', numeric: true });

// Login no formato primeironome.ultimonome, sem acentos (mesmo padrão do Sistema Integrado).
export function sugerirLogin(nome) {
    const partes = normalizarTexto(nome).replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (partes.length < 2) return '';
    const login = `${partes[0]}.${partes.at(-1)}`;
    return login.length <= 60 ? login : '';
}

export function contemTermos(conteudo, busca) {
    const texto = normalizarTexto(conteudo);
    return normalizarTexto(busca).split(/\s+/).filter(Boolean).every(t => texto.includes(t));
}

export const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function formatarData(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : String(iso);
}
export const hojeIso = () => new Date().toLocaleDateString('sv-SE');
export const formatarNumero = n => n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('pt-BR');
export const formatarPreco = n => n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function lerNumero(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return null;
    const n = Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
    return Number.isFinite(n) ? n : NaN;
}
