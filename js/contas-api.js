import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { app } from './firebase.js';
const funcoes = app ? getFunctions(app, 'southamerica-east1') : null;
export async function chamarConta(nome, dados) {
    if (!funcoes) throw new Error('Sistema ainda não configurado.');
    try { return (await httpsCallable(funcoes, nome)(dados)).data; }
    catch (error) {
        if (['functions/not-found','functions/unavailable','functions/internal'].includes(error.code)) {
            throw new Error('Serviço de contas indisponível. Confira a publicação das funções no Firebase ou tente novamente.');
        }
        throw error;
    }
}
