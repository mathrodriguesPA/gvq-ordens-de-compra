// GTA Paraguai: lê as marcas a fogo nas fotos do rebanho e monta a folha com os quadrados da GTA.
// A leitura roda na Cloud Function lerMarcas (functions/marcas.js), que chama o Claude; aqui ficam
// o preparo das fotos, a revisão das marcas, o desenho à mão e a impressão.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { escapar, hojeIso, formatarData } from "./util.js";
import { MODELO_GTA, URL_LEITURA } from "./gta-modelo.js";

const $ = id => document.getElementById(id);
const FOTOS_POR_LOTE = 8;          // igual a MAX_FOTOS_POR_LOTE em functions/marcas.js
const LADO_MAXIMO = 1568;          // maior lado que a IA aproveita; acima disso só aumenta o envio
const PATH_VALIDO = /^[MLHVCSQTAZmlhvcsqtaz0-9.,eE\s+-]{1,4000}$/;

const estado = { fotos: [], marcas: [], lendo: false };
let proximaFoto = 1;

// ---------- Acesso ----------
onAuthStateChanged(auth, async user => {
    if (!user) return location.replace('../index.html');
    try {
        const snap = await getDoc(doc(db, 'usuarios', user.email.split('@')[0]));
        if (!snap.exists() || snap.data().ativo === false) return location.replace('ambientes.html');
    } catch (error) {
        console.error(error);
    }
    $('carregando').hidden = true;
    $('conteudo').hidden = false;
});

$('btn-sair').onclick = async () => {
    await signOut(auth).catch(() => {});
    location.href = '../index.html';
};

// ---------- Fotos ----------
async function prepararFoto(arquivo) {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL('image/jpeg', 0.85);
    return { id: proximaFoto++, nome: arquivo.name, url, canvas, tipo: 'image/jpeg', dados: url.split(',')[1], lida: false };
}

async function adicionarArquivos(lista) {
    const erros = [];
    for (const arquivo of lista) {
        if (!arquivo.type.startsWith('image/')) { erros.push(arquivo.name); continue; }
        try { estado.fotos.push(await prepararFoto(arquivo)); }
        catch { erros.push(arquivo.name); }
    }
    $('erro-leitura').textContent = erros.length ? `Não foi possível abrir: ${erros.join(', ')}. Use fotos JPG, PNG ou WEBP.` : '';
    renderFotos();
}

function removerFoto(id) {
    estado.fotos = estado.fotos.filter(f => f.id !== id);
    estado.marcas = estado.marcas
        .map(m => ({ ...m, ocorrencias: m.ocorrencias.filter(o => o.fotoId !== id) }))
        .filter(m => m.manual || m.ocorrencias.length);
    renderFotos();
    renderMarcas();
}

function renderFotos() {
    const pendentes = estado.fotos.filter(f => !f.lida).length;
    $('miniaturas').innerHTML = estado.fotos.map(f => `
        <figure class="gta-mini${f.lida ? ' lida' : ''}">
            <img src="${f.url}" alt="${escapar(f.nome)}">
            <figcaption>${f.lida ? 'Lida' : 'Nova'}</figcaption>
            <button type="button" class="gta-mini-remover" data-remover="${f.id}" title="Remover foto" aria-label="Remover ${escapar(f.nome)}">
                <svg class="icon icon-sm"><use href="../assets/img/icones.svg#fechar"></use></svg>
            </button>
        </figure>`).join('');
    $('miniaturas').querySelectorAll('[data-remover]').forEach(b => b.onclick = () => removerFoto(Number(b.dataset.remover)));
    $('btn-ler').disabled = estado.lendo || !pendentes;
    $('btn-ler').textContent = pendentes ? `Ler marcas (${pendentes} ${pendentes === 1 ? 'foto' : 'fotos'})` : 'Ler marcas';
    $('btn-limpar-fotos').hidden = !estado.fotos.length || estado.lendo;
    if (!estado.lendo) $('progresso').textContent = estado.fotos.length ? `${estado.fotos.length} ${estado.fotos.length === 1 ? 'foto' : 'fotos'}` : '';
}

$('arquivos').onchange = e => { adicionarArquivos([...e.target.files]); e.target.value = ''; };
const soltar = $('soltar');
soltar.addEventListener('dragover', e => { e.preventDefault(); soltar.classList.add('sobre'); });
soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
soltar.addEventListener('drop', e => { e.preventDefault(); soltar.classList.remove('sobre'); adicionarArquivos([...e.dataTransfer.files]); });
$('btn-limpar-fotos').onclick = () => {
    if (!confirm('Remover todas as fotos e as marcas lidas nelas?')) return;
    estado.fotos = [];
    estado.marcas = estado.marcas.filter(m => m.manual).map(m => ({ ...m, ocorrencias: [] }));
    renderFotos();
    renderMarcas();
};

// ---------- Leitura com IA ----------
async function lerLote(lote) {
    const token = await auth.currentUser.getIdToken();
    const resposta = await fetch(URL_LEITURA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            fotos: lote.map(f => ({ tipo: f.tipo, dados: f.dados })),
            conhecidas: estado.marcas.map(m => ({ id: m.id, descricao: m.descricao, local: m.local })),
        }),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.erro || `Erro ${resposta.status} ao ler as marcas.`);
    return corpo;
}

function juntarResultado(lote, resultado) {
    for (const m of resultado.marcas || []) {
        const ocorrencias = m.ocorrencias.map(o => ({ fotoId: lote[o.foto - 1]?.id, caixa: o.caixa })).filter(o => o.fotoId);
        const tracos = (m.tracos || []).filter(d => PATH_VALIDO.test(d));
        const existente = estado.marcas.find(x => x.id === m.id);
        if (existente) {
            existente.ocorrencias.push(...ocorrencias);
            // Fica o desenho da foto mais nítida, a não ser que a pessoa já tenha redesenhado.
            if (!existente.editada && m.confianca > existente.confianca && tracos.length) Object.assign(existente, { tracos, confianca: m.confianca, observacao: m.observacao });
        } else if (tracos.length) {
            estado.marcas.push({ id: m.id, descricao: m.descricao, local: m.local, tracos, confianca: m.confianca, observacao: m.observacao, ocorrencias });
        }
    }
    // Até a pessoa escolher a Dominante, a marca que aparece em mais fotos vem primeiro.
    if (!estado.dominanteEscolhida) {
        const fotos = m => new Set(m.ocorrencias.map(o => o.fotoId)).size;
        estado.marcas.sort((a, b) => fotos(b) - fotos(a));
    }
}

$('btn-ler').onclick = async () => {
    const pendentes = estado.fotos.filter(f => !f.lida);
    if (!pendentes.length) return;
    estado.lendo = true;
    $('erro-leitura').textContent = '';
    renderFotos();
    const lotes = [];
    for (let i = 0; i < pendentes.length; i += FOTOS_POR_LOTE) lotes.push(pendentes.slice(i, i + FOTOS_POR_LOTE));
    try {
        for (const [i, lote] of lotes.entries()) {
            $('progresso').textContent = lotes.length > 1 ? `Lendo lote ${i + 1} de ${lotes.length}... pode levar alguns minutos.` : 'Lendo as marcas... pode levar alguns minutos.';
            const resultado = await lerLote(lote);
            $('aviso-exemplo').hidden = !resultado.exemplo;
            juntarResultado(lote, resultado);
            lote.forEach(f => { f.lida = true; });
            renderMarcas();
        }
    } catch (error) {
        console.error(error);
        $('erro-leitura').textContent = error.message || 'Não foi possível ler as marcas.';
    } finally {
        estado.lendo = false;
        renderFotos();
    }
};

// ---------- Marcas ----------
const svgMarca = (tracos, classe = '') => `<svg class="gta-marca-svg ${classe}" viewBox="0 0 100 100" aria-hidden="true">${
    tracos.filter(d => PATH_VALIDO.test(d)).map(d => `<path d="${escapar(d)}"/>`).join('')}</svg>`;

function recorte(ocorrencia) {
    const foto = estado.fotos.find(f => f.id === ocorrencia?.fotoId);
    if (!foto) return '';
    const [x, y, w, h] = ocorrencia.caixa;
    const folga = 0.25;
    const sx = Math.max(0, (x - w * folga)) * foto.canvas.width, sy = Math.max(0, (y - h * folga)) * foto.canvas.height;
    const sw = Math.min(1, w * (1 + 2 * folga)) * foto.canvas.width, sh = Math.min(1, h * (1 + 2 * folga)) * foto.canvas.height;
    if (sw < 4 || sh < 4) return '';
    const c = document.createElement('canvas');
    const escala = 220 / Math.max(sw, sh);
    c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
    c.getContext('2d').drawImage(foto.canvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
}

function renderMarcas() {
    const lista = $('marcas');
    if (!estado.marcas.length) {
        lista.innerHTML = `<p class="texto-suave gta-vazio">Nenhuma marca ainda. Suba as fotos e clique em <strong>Ler marcas</strong>, ou desenhe uma marca à mão.</p>`;
        renderFolha();
        return;
    }
    lista.innerHTML = estado.marcas.map((m, i) => {
        const fotos = new Set(m.ocorrencias.map(o => o.fotoId)).size;
        const img = recorte(m.ocorrencias[0]);
        const baixa = !m.manual && m.confianca < 0.7;
        return `
        <article class="gta-marca${baixa ? ' duvida' : ''}">
            <div class="gta-marca-visual">
                <div class="gta-marca-desenho">${svgMarca(m.tracos)}<span class="gta-marca-num">${i + 1}</span></div>
                ${img ? `<img class="gta-marca-recorte" src="${img}" alt="Recorte da foto com a marca ${i + 1}">` : ''}
            </div>
            <div class="gta-marca-info">
                <input class="campo" data-campo="descricao" data-id="${escapar(m.id)}" value="${escapar(m.descricao)}" aria-label="Descrição da marca ${i + 1}" placeholder="Descrição">
                <input class="campo" data-campo="local" data-id="${escapar(m.id)}" value="${escapar(m.local)}" aria-label="Local da marca ${i + 1} no animal" placeholder="Local no animal">
                <div class="linha gta-marca-tags">
                    ${i === 0 ? '<span class="tag tag-indigo">Dominante</span>' : ''}
                    ${m.manual ? '<span class="tag tag-indigo">Desenhada à mão</span>' : `<span class="tag">${fotos} ${fotos === 1 ? 'foto' : 'fotos'}</span>`}
                    ${m.manual ? '' : `<span class="tag ${baixa ? 'tag-alerta' : 'tag-verde'}">${baixa ? 'Conferir' : 'Leitura boa'} · ${Math.round(m.confianca * 100)}%</span>`}
                    ${m.editada && !m.manual ? '<span class="tag tag-indigo">Redesenhada</span>' : ''}
                </div>
                ${m.observacao ? `<p class="ajuda">${escapar(m.observacao)}</p>` : ''}
                <div class="linha">
                    ${i > 0 ? `<button type="button" class="btn btn-secundario btn-sm" data-dominante="${escapar(m.id)}">Tornar dominante</button>` : ''}
                    <button type="button" class="btn btn-secundario btn-sm" data-redesenhar="${escapar(m.id)}">Redesenhar</button>
                    <button type="button" class="btn btn-perigo btn-sm" data-excluir="${escapar(m.id)}">Excluir</button>
                </div>
            </div>
        </article>`;
    }).join('');
    lista.querySelectorAll('[data-campo]').forEach(input => input.oninput = () => {
        const m = estado.marcas.find(x => x.id === input.dataset.id);
        if (m) m[input.dataset.campo] = input.value;
    });
    lista.querySelectorAll('[data-excluir]').forEach(b => b.onclick = () => {
        estado.marcas = estado.marcas.filter(m => m.id !== b.dataset.excluir);
        renderMarcas();
    });
    lista.querySelectorAll('[data-dominante]').forEach(b => b.onclick = () => {
        const i = estado.marcas.findIndex(m => m.id === b.dataset.dominante);
        estado.marcas.unshift(...estado.marcas.splice(i, 1));
        estado.dominanteEscolhida = true;
        renderMarcas();
    });
    lista.querySelectorAll('[data-redesenhar]').forEach(b => b.onclick = () => abrirDesenho(estado.marcas.find(m => m.id === b.dataset.redesenhar)));
    renderFolha();
}

// ---------- Desenho à mão ----------
const tela = $('tela-desenho');
const ctx = tela.getContext('2d');
let tracosDesenho = [], tracoAtual = null, marcaEditada = null;

function desenharTela() {
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.save();
    ctx.scale(tela.width / 100, tela.height / 100);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    for (const d of tracosDesenho) ctx.stroke(new Path2D(d));
    if (tracoAtual?.length) {
        ctx.beginPath();
        tracoAtual.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
    }
    ctx.restore();
}

const ponto = e => {
    const r = tela.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) / r.width * 1000) / 10, Math.round((e.clientY - r.top) / r.height * 1000) / 10];
};
tela.addEventListener('pointerdown', e => { tela.setPointerCapture(e.pointerId); tracoAtual = [ponto(e)]; });
tela.addEventListener('pointermove', e => {
    if (!tracoAtual) return;
    const p = ponto(e), u = tracoAtual.at(-1);
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) >= 1) { tracoAtual.push(p); desenharTela(); }
});
const fecharTraco = () => {
    if (!tracoAtual) return;
    if (tracoAtual.length === 1) tracoAtual.push([tracoAtual[0][0] + 0.5, tracoAtual[0][1]]);   // um toque vira um ponto
    tracosDesenho.push(tracoAtual.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '));
    tracoAtual = null;
    desenharTela();
};
tela.addEventListener('pointerup', fecharTraco);
tela.addEventListener('pointercancel', fecharTraco);

function abrirDesenho(marca) {
    marcaEditada = marca || null;
    tracosDesenho = marca ? [...marca.tracos] : [];
    $('dlg-titulo').textContent = marca ? 'Redesenhar marca' : 'Desenhar marca';
    $('d-descricao').value = marca?.descricao || '';
    $('d-local').value = marca?.local || '';
    desenharTela();
    $('dlg-desenho').showModal();
}
$('btn-nova-marca').onclick = () => abrirDesenho(null);
$('d-desfazer').onclick = () => { tracosDesenho.pop(); desenharTela(); };
$('d-limpar').onclick = () => { tracosDesenho = []; desenharTela(); };
$('d-salvar').onclick = () => {
    if (!tracosDesenho.length) return alert('Desenhe a marca antes de salvar.');
    const dados = { tracos: tracosDesenho, descricao: $('d-descricao').value.trim(), local: $('d-local').value.trim() };
    if (marcaEditada) Object.assign(marcaEditada, dados, { editada: true });
    else {
        let n = estado.marcas.length + 1;
        while (estado.marcas.some(m => m.id === `m${n}`)) n++;
        estado.marcas.push({ id: `m${n}`, confianca: 1, observacao: '', ocorrencias: [], manual: true, ...dados });
    }
    $('dlg-desenho').close();
    renderMarcas();
};

// ---------- Folha da GTA ----------
// Rubro 2 da guia: 1 quadrado Dominante + Complementarias em linhas de 3. As 6 primeiras marcas cabem no
// Rubro 2 da GTA de papel; com mais marcas, a folha anexa ganha mais linhas de Complementarias.
const QUADROS_GTA = MODELO_GTA.quadros.length;

function quadro(marca, rotulo) {
    return `<div class="gta-quadro">
        ${rotulo ? `<span class="gta-quadro-num">${rotulo}</span>` : ''}
        ${marca ? svgMarca(marca.tracos) : ''}
        ${marca?.local ? `<span class="gta-quadro-local">${escapar(marca.local)}</span>` : ''}
    </div>`;
}

function renderFolha() {
    const marcas = estado.marcas;
    const sobra = marcas.length - QUADROS_GTA;
    $('sub-gta').textContent = !marcas.length
        ? 'A primeira marca da lista vai no quadrado Dominante; as demais nas Complementarias.'
        : sobra > 0
            ? `${marcas.length} marcas: o Rubro 2 da GTA tem ${QUADROS_GTA} quadrados, então ${sobra} ${sobra === 1 ? 'vai' : 'vão'} só na folha anexa.`
            : `${marcas.length} de ${QUADROS_GTA} quadrados do Rubro 2 preenchidos.`;

    const complementares = marcas.slice(1);
    const linhas = Math.max(2, Math.ceil((complementares.length + 1) / 3));
    // Grade 3 colunas: Dominante ocupa a 1ª célula da 1ª linha; as Complementarias seguem.
    const celulas = [quadro(marcas[0], 'Dominante')];
    for (let i = 0; i < linhas * 3 - 1; i++) celulas.push(quadro(complementares[i], String(i + 2)));

    $('folha').className = 'gta-folha grade';
    $('folha').innerHTML = `
        <div class="gta-folha-cabecalho">
            <strong>GUIA DE TRASLADO Y TRANSFERENCIA DE GANADO</strong>
            <span>Anexo — Rubro 2: Diseño de Marca del Ganado a Trasladar y Transferir (Ley N° 2576)</span>
        </div>
        <div class="gta-folha-dados">
            <span><b>N° de Orden:</b> ${escapar($('f-numero').value)}</span>
            <span><b>Fecha:</b> ${escapar(formatarData($('f-data').value))}</span>
            <span><b>Establecimiento de Origen:</b> ${escapar($('f-origem').value)}</span>
        </div>
        <div class="gta-rubro2-titulos"><span>Dominante</span><span>Complementarias</span></div>
        <div class="gta-folha-grade">${celulas.join('')}</div>`;

    // Só os desenhos, na posição do Rubro 2 da GTA de papel (folha ofício).
    $('folha-sobre').style.setProperty('--largura', `${MODELO_GTA.larguraMm}mm`);
    $('folha-sobre').style.setProperty('--altura', `${MODELO_GTA.alturaMm}mm`);
    $('folha-sobre').innerHTML = MODELO_GTA.quadros.slice(0, marcas.length).map((q, i) =>
        `<div class="gta-quadro-modelo" style="left:${q.x}%;top:${q.y}%;width:${q.w}%;height:${q.h}%">${svgMarca(marcas[i].tracos)}</div>`).join('');
}

['f-numero', 'f-data', 'f-origem'].forEach(id => $(id).addEventListener('input', renderFolha));
$('f-data').value = hojeIso();

// O tamanho da página muda com o modo: A4 para a folha anexa, ofício para imprimir sobre a GTA.
const estiloPagina = document.head.appendChild(document.createElement('style'));
function imprimir(sobreGta) {
    if (!estado.marcas.length && !confirm('Nenhuma marca foi lida ainda. Imprimir mesmo assim?')) return;
    estiloPagina.textContent = sobreGta ? `@page { size: ${MODELO_GTA.larguraMm}mm ${MODELO_GTA.alturaMm}mm; margin: 0; }` : '@page { size: A4; margin: 0; }';
    document.body.classList.toggle('sobre-gta', sobreGta);
    window.print();
    document.body.classList.remove('sobre-gta');
}
$('btn-imprimir').onclick = () => imprimir(false);
$('btn-imprimir-marcas').onclick = () => imprimir(true);

renderFotos();
renderMarcas();
