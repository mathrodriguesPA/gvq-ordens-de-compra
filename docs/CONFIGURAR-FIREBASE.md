# Configurar o Firebase

Ordem dos passos para colocar o sistema no ar. Os passos marcados com **(console)** são feitos em https://console.firebase.google.com.

## 1. Criar o projeto (console)

1. **Adicionar projeto** → nome sugerido: `gvq-ordens-de-compra`. O Google Analytics pode ficar desligado.
2. Em **Configurações do projeto → Seus apps**, adicionar um app **Web** (ícone `</>`). Não precisa marcar o Firebase Hosting, porque o site fica no GitHub Pages.
3. Copiar o objeto `firebaseConfig` mostrado e colar em [`js/firebase.js`](../js/firebase.js).

## 2. Login (console)

1. **Authentication → Começar → Método de login → E-mail/senha → Ativar**. Deixar "Link de e-mail" desligado.
2. **Authentication → Configurações → Domínios autorizados → Adicionar domínio:** `wiziackmatheeus-sys.github.io`.

## 3. Banco de dados (console)

1. **Firestore Database → Criar banco de dados** → local `southamerica-east1 (São Paulo)` → modo de produção.
2. Publicar as regras pela linha de comando, na pasta do projeto:

   ```sh
   firebase use --add          # escolher o projeto criado
   firebase deploy --only firestore:rules
   ```

3. Criar o contador de OCs: coleção `config`, documento `contador`, campo `proxima` (number) = `1652`.

## 4. Funções de contas (plano Blaze)

Criar usuários e redefinir senhas exige Cloud Functions, que só rodam no plano **Blaze** (cobrança por uso; neste volume deve ficar perto de zero). Em **Uso e faturamento → Detalhes e configurações → Modificar plano**, mudar para Blaze. Vale também criar um alerta de orçamento baixo, por exemplo R$ 10.

```sh
npm ci --prefix functions
firebase deploy --only functions
```

O CLI pede `AUTH_WEB_API_KEY`: é o mesmo `apiKey` colado em `js/firebase.js`.

## 5. Primeiro analista (console)

O primeiro analista é criado à mão, porque ainda não há quem crie pelo site.

1. **Authentication → Usuários → Adicionar usuário**: e-mail `matheus.souza@gvq.com.br` e uma senha temporária de pelo menos 6 caracteres. Copiar o **UID** gerado.
2. **Firestore → Iniciar coleção** `usuarios` → ID do documento = o UID copiado, com os campos:

   | Campo | Tipo | Valor |
   |---|---|---|
   | nome | string | Matheus Souza |
   | login | string | matheus.souza |
   | perfil | string | analista |
   | ativo | boolean | true |
   | trocaSenhaObrigatoria | boolean | true |

3. Entrar no site com `matheus.souza` e a senha temporária. O sistema pede a troca para uma senha de pelo menos 8 caracteres.
4. Os demais usuários, como `matheus.silveira` (solicitante), são criados pela aba **Usuários**. O site mostra uma senha temporária para entregar à pessoa.

## 6. Cadastros

Na aba **Cadastros**, colar as 70 fazendas de destino (uma por linha) e as origens. Raças e responsáveis já vêm preenchidos e podem ser editados.

## 7. OCs da planilha

As 552 OCs da planilha original entram por um script de importação, a ser feito com a planilha em mãos. A planilha não vai para o repositório, que é público.
