# GTA Paraguai: leitura das marcas com IA

Terceiro cartão da escolha de ambiente ([`pages/gta.html`](../pages/gta.html), [`js/gta.js`](../js/gta.js)). Usa o mesmo login e o mesmo cadastro do Ordens de Compra: quem tem acesso ativo lá entra aqui.

## Como funciona

1. A pessoa sobe as fotos do rebanho. O navegador reduz cada uma para no máximo 1568 px (o que a IA aproveita) antes de enviar.
2. **Ler marcas** manda as fotos em lotes de 8 para a Cloud Function `lerMarcas` ([`functions/index.js`](../functions/index.js)). Ela confere o login e o cadastro e chama o Claude Opus 5.5 ([`functions/marcas.js`](../functions/marcas.js)), que devolve cada marca a fogo redesenhada como traços SVG, o local no animal, as fotos onde aparece e a confiança da leitura. A cada lote seguem as marcas já encontradas, para a mesma marca não virar duas.
3. Cada marca aparece com o desenho e o recorte da foto. Leitura abaixo de 70% fica amarela para conferir. Dá para corrigir a descrição, redesenhar à mão ou excluir, e também desenhar uma marca que a IA não achou.
4. As marcas preenchem o Rubro 2 da GTA, na ordem da lista (veja abaixo).

Se o Claude recusar a análise, a função usa o modelo reserva automático da Anthropic (`fallbacks: "default"`) na mesma chamada.

## Modelo da GTA

O modelo é a **Guía de Traslado y Transferencia de Ganado** do SENACSA, **Rubro 2 – Diseño de Marca del Ganado a Trasladar y Transferir (Ley N° 2576)**: 1 quadrado para a marca **Dominante** e 5 para as **Complementarias**, em 2 linhas de 3.

- A primeira marca da lista vai no quadrado Dominante. Até a pessoa escolher (botão **Tornar dominante**), vem primeiro a marca que aparece em mais fotos.
- **Imprimir folha anexa** (A4): reproduz o Rubro 2 com N° de Orden, data e estabelecimento. Com mais de 6 marcas, ganha mais linhas de Complementarias.
- **Imprimir sobre a GTA** (ofício, 215,9 x 342,9 mm): só os desenhos, na posição dos 6 quadrados do Rubro 2, para imprimir direto na guia de papel. Imprimir em escala 100%, sem margens. Marcas além da 6ª ficam só na folha anexa.

As posições foram medidas na guia escaneada de 14/11/2025 e ficam em `MODELO_GTA.quadros` ([`js/gta-modelo.js`](../js/gta-modelo.js)), em % da folha. Se a impressão sair deslocada na guia de papel, ajustar `x` e `y` ali. A guia escaneada não vai para o repositório porque tem dados reais de proprietário e comprador.

## Publicar a função

A Cloud Function precisa do plano **Blaze** (pago por uso) no projeto `gvq-ordens-de-compra`. O site continua no GitHub Pages.

```sh
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

A URL publicada fica em `URL_LEITURA` ([`js/gta-modelo.js`](../js/gta-modelo.js)). O CORS da função aceita `localhost` e `https://wiziackmatheeus-sys.github.io`.

Custo: cada lote de 8 fotos é uma chamada ao Claude Opus 5.5 ($4 por milhão de tokens de entrada, $20 de saída). Uma foto de 1568 px tem cerca de 1.600 tokens.

## Testar localmente

`npm run dev` atende `/api/ler-marcas` sem publicar a função (precisa de `npm install` em `functions/`). Com `ANTHROPIC_API_KEY` definida no terminal, lê as fotos de verdade; sem ela, devolve duas marcas de exemplo e a página avisa.
