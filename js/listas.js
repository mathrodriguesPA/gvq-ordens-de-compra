// Opções fixas do formulário e valores iniciais dos cadastros.
// Raças, responsáveis, fazendas e origens podem ser editados na aba Cadastros
// (documentos listas/{nome} no Firestore); estes valores valem até lá.
export const TIPOS = ['Compra', 'Transferência', 'Trading'];
export const SEXOS = ['Machos', 'Fêmeas'];
export const PROPRIETARIOS = ['Grupo', 'Núcleo IQ'];
export const TRAVAS = ['Sim', 'Não'];
export const STATUS_OC = ['Pendente', 'Aberto', 'Finalizado', 'Cancelado'];

export const LISTAS_PADRAO = {
    racas: ['Aberdeen Angus', 'Anelorado', 'Cruzado', 'Nelore', 'Raças Europeias', 'Wagyu'],
    responsaveis: ['Alexsandro', 'Cristiano Fernandes', 'Leonaldo Gonçalves', 'Luan', 'Marcos Alexandre', 'Ragson Rodrigues', 'Rodrigo Fonseca', 'Select Sires'],
    fazendas: [],
    origens: []
};

export const NOMES_LISTAS = {
    fazendas: 'Fazendas de destino',
    origens: 'Origens',
    racas: 'Raças',
    responsaveis: 'Responsáveis'
};

export const SITUACOES = {
    aguardando: { texto: 'Aguardando análise', classe: 'tag-indigo' },
    ajuste: { texto: 'Ajuste solicitado', classe: 'tag-alerta' },
    recusada: { texto: 'Recusada', classe: 'tag-perigo' },
    gerada: { texto: 'OC gerada', classe: 'tag-verde' }
};

export const CLASSE_STATUS_OC = { Pendente: 'tag-alerta', Aberto: 'tag-indigo', Finalizado: 'tag-verde', Cancelado: 'tag-perigo' };
