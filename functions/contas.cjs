// Contas de usuário: criar, redefinir senha e trocar a senha temporária.
// Mesmo desenho do GVQ Sistema Integrado, com os perfis deste sistema.
const { randomInt, randomUUID } = require('node:crypto');
const PERFIS = ['solicitante', 'analista'];
const SENHA_MINIMA = 8;

// Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I).
function gerarSenhaTemporaria() {
    const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 10 }, () => alfabeto[randomInt(alfabeto.length)]).join('');
}

function criarServicoContas({ auth, db, FieldValue, erro, verificarSenha }) {
    const falhar = (codigo, mensagem) => { throw erro(codigo, mensagem); };
    const texto = valor => typeof valor === 'string' ? valor.trim() : '';
    const email = login => `${login}@gvq.com.br`;
    async function perfil(uid) {
        const snap = await db.doc(`usuarios/${uid}`).get();
        if (!snap.exists) falhar('not-found', 'Conta não encontrada.');
        return snap.data();
    }
    async function exigirAnalista(uid) {
        if (!uid) falhar('unauthenticated', 'Entre na sua conta.');
        const u = await perfil(uid);
        if (u.perfil !== 'analista' || u.ativo === false || u.trocaSenhaObrigatoria) falhar('permission-denied', 'Somente analistas gerenciam contas.');
    }
    async function comTrava(uid, acao) {
        const ref = db.doc(`operacoesContas/${uid}`), operacao = randomUUID();
        await db.runTransaction(async t => {
            const snap = await t.get(ref);
            if (snap.exists && snap.data().expiraEm > Date.now()) falhar('aborted', 'Já há uma alteração de senha em andamento. Tente novamente.');
            t.set(ref, { operacao, expiraEm: Date.now() + 180000 });
        });
        try { return await acao(); }
        finally {
            await db.runTransaction(async t => {
                const snap = await t.get(ref);
                if (snap.data()?.operacao === operacao) t.delete(ref);
            });
        }
    }
    async function registrar(tipo, alvoUid, atorUid) {
        await db.collection('auditoriaContas').add({ tipo, alvoUid, atorUid, quando: FieldValue.serverTimestamp() });
    }

    async function criarConta(uid, dados = {}) {
        await exigirAnalista(uid);
        const nome = texto(dados.nome), login = texto(dados.login).toLowerCase(), tipo = dados.perfil;
        if (nome.length < 3 || nome.length > 100 || !/^[a-z0-9][a-z0-9._-]{2,59}$/.test(login) || !PERFIS.includes(tipo)) {
            falhar('invalid-argument', 'Informe nome, usuário válido e perfil válido.');
        }
        const senhaTemporaria = gerarSenhaTemporaria();
        let criado;
        try {
            criado = await auth.createUser({ email: email(login), password: senhaTemporaria, displayName: nome, disabled: true });
            await db.doc(`usuarios/${criado.uid}`).create({
                nome, login, perfil: tipo, ativo: true, trocaSenhaObrigatoria: true,
                criadoPor: uid, criadoEm: FieldValue.serverTimestamp(), senhaTemporariaEm: FieldValue.serverTimestamp()
            });
            await registrar('criacao', criado.uid, uid);
            await auth.updateUser(criado.uid, { disabled: false });
            return { uid: criado.uid, login, senhaTemporaria };
        } catch (error) {
            if (criado) {
                // A conta nova permanece desabilitada caso a limpeza de uma falha não conclua.
                await auth.updateUser(criado.uid, { disabled: true }).catch(() => {});
                await db.doc(`usuarios/${criado.uid}`).delete().catch(() => {});
                await auth.deleteUser(criado.uid).catch(() => {});
            }
            if (error.code === 'auth/email-already-exists') falhar('already-exists', 'Este usuário já existe. Se for a mesma pessoa, use Redefinir senha.');
            throw error;
        }
    }

    async function redefinirSenha(uid, dados = {}) {
        await exigirAnalista(uid);
        const alvoUid = texto(dados.uid);
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(alvoUid)) falhar('invalid-argument', 'Conta inválida.');
        if (alvoUid === uid) falhar('failed-precondition', 'Outro analista deve redefinir a sua senha.');
        return comTrava(alvoUid, async () => {
            const alvo = await perfil(alvoUid);
            if (!PERFIS.includes(alvo.perfil)) falhar('permission-denied', 'Perfil não gerenciado por este recurso.');
            await auth.getUser(alvoUid);
            const senhaTemporaria = gerarSenhaTemporaria();
            // Primeiro bloqueia o acesso; falhas posteriores mantêm a conta bloqueada.
            await db.doc(`usuarios/${alvoUid}`).update({ trocaSenhaObrigatoria: true, senhaTemporariaEm: FieldValue.serverTimestamp(), senhaRedefinidaPor: uid, sessaoRevogadaEm: Math.floor(Date.now() / 1000) });
            await auth.updateUser(alvoUid, { password: senhaTemporaria });
            await auth.revokeRefreshTokens(alvoUid);
            await registrar('redefinicao', alvoUid, uid);
            return { uid: alvoUid, login: alvo.login, senhaTemporaria };
        });
    }

    async function trocarSenhaInicial(uid, dados = {}) {
        if (!uid) falhar('unauthenticated', 'Entre novamente com a senha temporária.');
        const atual = typeof dados.senhaAtual === 'string' ? dados.senhaAtual : '';
        const nova = typeof dados.novaSenha === 'string' ? dados.novaSenha : '';
        if (!atual || atual.length > 128 || nova.length < SENHA_MINIMA || nova.length > 128 || nova === atual) {
            falhar('invalid-argument', `A nova senha deve ter entre ${SENHA_MINIMA} e 128 caracteres e ser diferente da atual.`);
        }
        return comTrava(uid, async () => {
            const u = await perfil(uid);
            if (u.trocaSenhaObrigatoria !== true) falhar('failed-precondition', 'Não há troca de senha pendente.');
            const conta = await auth.getUser(uid);
            // Conhecer um token antigo não basta: exige a senha temporária atual no Auth.
            const comprovadoUid = await verificarSenha(conta.email, atual);
            if (comprovadoUid !== uid) falhar('permission-denied', 'Senha temporária incorreta.');
            await auth.updateUser(uid, { password: nova });
            await auth.revokeRefreshTokens(uid);
            await registrar('troca_pelo_usuario', uid, uid);
            await db.doc(`usuarios/${uid}`).update({ trocaSenhaObrigatoria: false, sessaoRevogadaEm: Math.floor(Date.now() / 1000), senhaAlteradaEm: FieldValue.serverTimestamp() });
            // auth_time tem precisão de segundos. O próximo login deve ocorrer após o corte.
            await new Promise(resolve => setTimeout(resolve, 1100));
            return { sucesso: true };
        });
    }

    return { criarConta, redefinirSenha, trocarSenhaInicial };
}
module.exports = { criarServicoContas, gerarSenhaTemporaria };
