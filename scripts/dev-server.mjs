// Servidor de desenvolvimento com recarga automática (sem dependências).
// Uso: node scripts/dev-server.mjs [porta]   (padrão: 5500)
// - Serve os arquivos estáticos da raiz do projeto.
// - Ao salvar um .css, troca o estilo na página sem recarregar; qualquer outro arquivo recarrega a página.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 5500);

const TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

// Script injetado em toda página HTML: escuta o servidor e recarrega/atualiza o CSS.
const CLIENTE = `<script>(() => {
    const es = new EventSource('/__reload');
    es.onmessage = (e) => {
        if (e.data !== 'css') return location.reload();
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
            const url = new URL(link.href);
            if (url.origin !== location.origin) return;
            url.searchParams.set('v', Date.now());
            link.href = url.href;
        });
    };
})();</script>`;

const clientes = new Set();

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/__reload') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(': conectado\n\n');
        clientes.add(res);
        req.on('close', () => clientes.delete(res));
        return;
    }

    let arquivo = path.join(ROOT, decodeURIComponent(url.pathname));
    if (arquivo !== ROOT && !arquivo.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end();
        return;
    }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');

    fs.readFile(arquivo, (err, dados) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 - arquivo não encontrado');
            return;
        }
        const ext = path.extname(arquivo).toLowerCase();
        res.setHeader('Content-Type', TIPOS[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        // Navegadores headless (screenshots automáticos) não recebem a recarga: a conexão aberta os impediria de terminar.
        const headless = /Headless/i.test(req.headers['user-agent'] || '');
        if (ext === '.html' && !headless) dados = dados.toString().replace(/<\/body>/i, () => CLIENTE + '</body>');
        res.end(dados);
    });
});

// Junta alterações próximas: se só mudou CSS, atualiza o estilo; senão recarrega.
let pendente = null;
let timer;
fs.watch(ROOT, { recursive: true }, (_evento, nome) => {
    if (!nome || nome.startsWith('.git') || nome.includes('node_modules')) return;
    const tipo = nome.endsWith('.css') ? 'css' : 'reload';
    pendente = pendente === 'reload' || tipo === 'reload' ? 'reload' : 'css';
    clearTimeout(timer);
    timer = setTimeout(() => {
        for (const c of clientes) c.write(`data: ${pendente}\n\n`);
        console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${nome} → ${pendente}`);
        pendente = null;
    }, 120);
});

server.listen(PORT, () => console.log(`GVQ dev server: http://localhost:${PORT}  (recarga automática ativa)`));
