import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { chamarConta } from './contas-api.js';

const erro = document.getElementById('erro-senha');
let enviando = false;

if (!auth) location.href = '../index.html';
else onAuthStateChanged(auth, async user => {
    if (enviando) return;
    if (!user) { location.href = '../index.html'; return; }
    try {
        const perfil = await getDoc(doc(db, 'usuarios', user.uid));
        if (!perfil.exists() || !perfil.data().trocaSenhaObrigatoria) location.href = 'app.html';
    } catch { erro.textContent = 'Não foi possível conferir seu acesso. Entre novamente.'; }
});

document.getElementById('form-trocar-senha').addEventListener('submit', async e => {
    e.preventDefault();
    if (enviando) return;
    const atual = document.getElementById('senha-atual').value;
    const nova = document.getElementById('nova-senha').value;
    erro.textContent = '';
    if (nova.length < 8) { erro.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.'; return; }
    if (nova !== document.getElementById('confirmar-senha').value) { erro.textContent = 'As novas senhas precisam ser iguais.'; return; }
    if (nova === atual) { erro.textContent = 'Escolha uma senha diferente da temporária.'; return; }
    enviando = true;
    const botao = document.getElementById('btn-trocar-senha');
    botao.disabled = true;
    try {
        await chamarConta('trocarSenhaInicial', { senhaAtual: atual, novaSenha: nova });
        e.target.reset();
        await signOut(auth);
        alert('Senha alterada. Entre novamente com a nova senha.');
        location.href = '../index.html';
    } catch (error) {
        erro.textContent = error.message;
    } finally {
        enviando = false;
        botao.disabled = false;
    }
});

document.getElementById('sair-troca').onclick = async () => { await signOut(auth); location.href = '../index.html'; };
