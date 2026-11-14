import type { Coordenada } from '../dominio/tipos';

export type Pipeline = ReadonlyArray<Record<string, unknown>>;

/** Pipeline 1 (coleção `triagem`): total de CO2 evitado por cliente. */
export const co2EvitadoPorCliente: Pipeline = [
  { $lookup: { from: 'coletas', localField: 'coletaId', foreignField: '_id', as: 'coleta' } },
  { $unwind: '$coleta' },
  {
    $group: {
      _id: '$coleta.clienteId',
      co2EvitadoKg: { $sum: '$co2EvitadoKg' },
      valorTotal: { $sum: '$valorPrecificado' },
      equipamentosTriados: { $sum: 1 },
    },
  },
  { $lookup: { from: 'clientes', localField: '_id', foreignField: '_id', as: 'cliente' } },
  { $unwind: '$cliente' },
  {
    $project: {
      _id: 0,
      clienteId: '$_id',
      nome: '$cliente.nome',
      tipo: '$cliente.tipo',
      co2EvitadoKg: { $round: ['$co2EvitadoKg', 2] },
      valorTotal: { $round: ['$valorTotal', 2] },
      equipamentosTriados: 1,
    },
  },
  { $sort: { co2EvitadoKg: -1 } },
];

/** Pipeline 2 (coleção `triagem`): volume reciclado por categoria em um mês. */
export const volumeRecicladoPorCategoria = (ano: number, mes: number): Pipeline => [
  {
    $match: {
      destino: 'reciclagem',
      processadoEm: { $gte: new Date(Date.UTC(ano, mes - 1, 1)), $lt: new Date(Date.UTC(ano, mes, 1)) },
    },
  },
  { $lookup: { from: 'equipamentos', localField: 'equipamentoId', foreignField: '_id', as: 'equipamento' } },
  { $unwind: '$equipamento' },
  { $group: { _id: '$equipamento.categoria', volumeKg: { $sum: '$pesoKg' }, itens: { $sum: 1 } } },
  { $project: { _id: 0, categoria: '$_id', volumeKg: { $round: ['$volumeKg', 2] }, itens: 1 } },
  { $sort: { volumeKg: -1 } },
];

/** Pipeline 3 (coleção `coletas`): tempo médio entre coleta e fim da triagem, por ponto de coleta. */
export const tempoMedioPorPonto: Pipeline = [
  { $match: { status: 'processada' } },
  { $lookup: { from: 'triagem', localField: '_id', foreignField: 'coletaId', as: 'triagens' } },
  { $match: { 'triagens.0': { $exists: true } } },
  { $addFields: { concluidaEm: { $max: '$triagens.processadoEm' } } },
  { $addFields: { horas: { $divide: [{ $subtract: ['$concluidaEm', '$dataColeta'] }, 3600000] } } },
  { $group: { _id: '$pontoDeColetaId', tempoMedioHoras: { $avg: '$horas' }, coletas: { $sum: 1 } } },
  { $lookup: { from: 'pontosDeColeta', localField: '_id', foreignField: '_id', as: 'ponto' } },
  { $unwind: '$ponto' },
  {
    $project: {
      _id: 0,
      pontoDeColetaId: '$_id',
      ponto: '$ponto.nome',
      coletas: 1,
      tempoMedioHoras: { $round: ['$tempoMedioHoras', 2] },
    },
  },
  { $sort: { tempoMedioHoras: 1 } },
];

/** Pipeline 4 (coleção `triagem`): desempenho por destino e totais gerais, em uma única passada ($facet). */
export const desempenhoPorDestino: Pipeline = [
  {
    $facet: {
      porDestino: [
        {
          $group: {
            _id: '$destino',
            itens: { $sum: 1 },
            pesoKg: { $sum: '$pesoKg' },
            co2EvitadoKg: { $sum: '$co2EvitadoKg' },
            valor: { $sum: '$valorPrecificado' },
          },
        },
        { $sort: { itens: -1 } },
      ],
      totais: [
        {
          $group: {
            _id: null,
            itens: { $sum: 1 },
            co2EvitadoKg: { $sum: '$co2EvitadoKg' },
            valor: { $sum: '$valorPrecificado' },
          },
        },
      ],
    },
  },
];

/** Pipeline 5 (coleção `pontosDeColeta`): pontos ativos mais próximos de uma coordenada (índice 2dsphere). */
export const pontosMaisProximos = (origem: Coordenada, raioMetros: number, limite = 5): Pipeline => [
  {
    $geoNear: {
      near: { type: 'Point', coordinates: [origem.longitude, origem.latitude] },
      distanceField: 'distanciaMetros',
      maxDistance: raioMetros,
      query: { status: 'ativo' },
      spherical: true,
    },
  },
  { $project: { _id: 0, nome: 1, capacidadeKg: 1, distanciaMetros: { $round: ['$distanciaMetros', 0] } } },
  { $limit: limite },
];

/** Pipeline 6 (coleção `eventosIot`): situação de enchimento por ponto desde uma data. */
export const situacaoDeEnchimento = (desde: Date): Pipeline => [
  { $match: { tipo: 'nivelEnchimento', timestamp: { $gte: desde } } },
  {
    $group: {
      _id: '$pontoDeColetaId',
      mediaNivel: { $avg: '$valor' },
      maxNivel: { $max: '$valor' },
      leituras: { $sum: 1 },
      ultimaLeitura: { $max: '$timestamp' },
    },
  },
  { $lookup: { from: 'pontosDeColeta', localField: '_id', foreignField: '_id', as: 'ponto' } },
  { $unwind: '$ponto' },
  {
    $project: {
      _id: 0,
      ponto: '$ponto.nome',
      leituras: 1,
      mediaNivel: { $round: ['$mediaNivel', 1] },
      maxNivel: 1,
      ultimaLeitura: 1,
      situacao: {
        $switch: {
          branches: [
            { case: { $gte: ['$maxNivel', 90] }, then: 'critico' },
            { case: { $gte: ['$maxNivel', 70] }, then: 'atencao' },
          ],
          default: 'normal',
        },
      },
    },
  },
  { $sort: { maxNivel: -1 } },
];
