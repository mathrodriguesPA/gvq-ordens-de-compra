// Modelo da GTA do Paraguai (Guía de Traslado y Transferencia de Ganado, SENACSA) usado na impressão (pages/gta.html).
// O Rubro 2 ("Diseño de Marca del Ganado a Trasladar y Transferir") tem 1 quadrado para a marca Dominante
// e 5 para as Complementarias, em 2 linhas de 3. Medido na guia escaneada de 14/11/2025 (folha ofício
// 8,5 x 13,5 pol. = 215,9 x 342,9 mm). Posições em % da largura e da altura da folha; a ordem é a de
// preenchimento: Dominante primeiro.
export const MODELO_GTA = {
    larguraMm: 215.9,
    alturaMm: 342.9,
    quadros: [
        { x: 11.9, y: 25.85, w: 17.6, h: 9.4 },   // Dominante
        { x: 29.5, y: 25.85, w: 17.6, h: 9.4 },
        { x: 47.1, y: 25.85, w: 17.4, h: 9.4 },
        { x: 11.9, y: 35.35, w: 17.6, h: 9.3 },
        { x: 29.5, y: 35.35, w: 17.6, h: 9.3 },
        { x: 47.1, y: 35.35, w: 17.4, h: 9.3 },
    ],
};

// Onde a leitura das marcas roda: no servidor local (npm run dev) ou na Cloud Function publicada.
export const URL_LEITURA = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? '/api/ler-marcas'
    : 'https://southamerica-east1-gvq-ordens-de-compra.cloudfunctions.net/lerMarcas';
