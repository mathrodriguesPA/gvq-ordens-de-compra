# GVQ — Ordens de Compra

Sistema do Grupo Vilela de Queiroz para solicitar e emitir Ordens de Compra (OC) de compra, transferência e trading de gado entre as fazendas.

- **Site:** páginas estáticas publicadas pelo GitHub Pages (`index.html`, `pages/`, `js/`, `css/`).
- **Banco e login:** Firebase (Authentication + Firestore). As permissões ficam em [`firestore.rules`](firestore.rules).
- **Contas:** criar usuário, redefinir senha e trocar a senha temporária passam pelas Cloud Functions em [`functions/`](functions/), como no GVQ Sistema Integrado.

## Perfis

| Perfil | Abas |
|---|---|
| Solicitante | Nova solicitação, Minhas solicitações |
| Analista | Todas: Nova solicitação, Minhas solicitações, Análise, Ordens de compra, Cadastros, Usuários |

O login é só o usuário (`nome.sobrenome`). Por baixo, o Firebase usa o e-mail interno `nome.sobrenome@gvq.com.br`, que ninguém precisa conhecer.

## Fluxo

1. O solicitante envia o pedido, que fica **Aguardando análise**.
2. O analista gera a OC (número automático, próximo livre, com uma ou mais origens), pede ajuste ou recusa com motivo. A trava é escolhida pelo analista, obrigatoriamente, antes de gerar.
3. Toda OC nasce **Pendente** → **Aberto** (viabilidade aprovada) → **Finalizado**, ou **Cancelado**.

## Dados no Firestore

| Coleção | Conteúdo |
|---|---|
| `usuarios/{uid}` | nome, login, perfil, ativo, trocaSenhaObrigatoria |
| `solicitacoes/{id}` | pedido do formulário, status (`aguardando`, `ajuste`, `recusada`, `gerada`), ocNumero |
| `ocs/{numero}` | OC com `origens: [{ origem, quantidade, sequencia, preco }]`, trava e status |
| `config/contador` | `proxima`: número da próxima OC |
| `listas/{fazendas, origens, racas, responsaveis}` | `itens`: listas editadas na aba Cadastros |

## Configuração

Passo a passo em [docs/CONFIGURAR-FIREBASE.md](docs/CONFIGURAR-FIREBASE.md).

## Rodar localmente

```sh
npm run dev
```

Abre em http://localhost:5500 com recarga automática.
