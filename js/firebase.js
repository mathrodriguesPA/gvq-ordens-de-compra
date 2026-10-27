// Inicialização única do Firebase, compartilhada por todas as páginas.
// Preencher com a configuração do app web do projeto (Console do Firebase →
// Configurações do projeto → Seus apps). Esses valores são públicos por natureza;
// quem protege os dados são as regras em firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDJ14wOLOqEjgdFwadfgFY8Qkpr-xbFY4c",
    authDomain: "gvq-ordens-de-compra.firebaseapp.com",
    projectId: "gvq-ordens-de-compra",
    storageBucket: "gvq-ordens-de-compra.firebasestorage.app",
    messagingSenderId: "688772374465",
    appId: "1:688772374465:web:c85feda3999add19585940"
};

export const configurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const app = configurado ? initializeApp(firebaseConfig) : null;
export const auth = configurado ? getAuth(app) : null;
export const db = configurado ? getFirestore(app) : null;

// O usuário digita só o login (nome.sobrenome); o Firebase Auth exige e-mail.
export const emailDoLogin = login => `${login}@gvq.com.br`;
