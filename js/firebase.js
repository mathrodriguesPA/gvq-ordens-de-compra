// Inicialização única do Firebase, compartilhada por todas as páginas.
// Preencher com a configuração do app web do projeto (Console do Firebase →
// Configurações do projeto → Seus apps). Esses valores são públicos por natureza;
// quem protege os dados são as regras em firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

export const configurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const app = configurado ? initializeApp(firebaseConfig) : null;
export const auth = configurado ? getAuth(app) : null;
export const db = configurado ? getFirestore(app) : null;

// O usuário digita só o login (nome.sobrenome); o Firebase Auth exige e-mail.
export const emailDoLogin = login => `${login}@gvq.com.br`;
