import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, configurado, emailDoLogin } from "./firebase.js";

const form = document.getElementById('form-login');
const erro = document.getElementById('erro-login');
const btn = document.getElementById('btn-entrar');

if (!configurado) {
    erro.textContent = 'Sistema ainda não configurado: falta preencher js/firebase.js com os dados do projeto Firebase.';
    btn.disabled = true;
}

let autenticando = false;
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (autenticando || !configurado) return;
    autenticando = true;
    erro.textContent = '';
    btn.textContent = 'Entrando...';
    btn.disabled = true;

    const login = document.getElementById('login_usuario').value.toLowerCase().trim();
    const senha = document.getElementById('login_senha').value;

    try {
        const { user } = await signInWithEmailAndPassword(auth, emailDoLogin(login), senha);
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const perfil = snap.exists() ? snap.data() : null;
        if (!perfil || !['solicitante', 'analista'].includes(perfil.perfil)) {
            await signOut(auth);
            erro.textContent = 'Usuário sem perfil cadastrado. Fale com o analista.';
            return;
        }
        if (perfil.ativo === false) {
            await signOut(auth);
            erro.textContent = 'Este acesso está desativado. Fale com o analista.';
            return;
        }
        location.href = perfil.trocaSenhaObrigatoria ? 'pages/trocar-senha.html' : 'pages/app.html';
    } catch (error) {
        const mensagens = {
            'auth/invalid-credential': 'Usuário ou senha incorretos.',
            'auth/invalid-email': 'Usuário ou senha incorretos.',
            'auth/user-disabled': 'Este acesso está desativado. Fale com o analista.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
            'auth/network-request-failed': 'Falha de conexão. Confira a internet e tente novamente.'
        };
        erro.textContent = mensagens[error.code] || 'Não foi possível entrar. Tente novamente.';
    } finally {
        autenticando = false;
        btn.textContent = 'Entrar';
        btn.disabled = !configurado;
    }
});
