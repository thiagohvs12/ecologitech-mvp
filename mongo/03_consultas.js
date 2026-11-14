// EcoLogitech - 03: consultas analíticas com Aggregation Framework (6 rotinas).
// Execução:  mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" 03_consultas.js
// Para ver o plano de execução de qualquer uma:  bd.triagem.explain('executionStats').aggregate(pipeline)

const bd = db.getSiblingDB('ecologitech');

function rotina(titulo, colecao, pipeline) {
  print('\n=== ' + titulo + ' ===');
  bd.getCollection(colecao).aggregate(pipeline).forEach((documento) => printjson(documento));
}

// 1) Total de CO2 evitado (e valor) por cliente.
const co2EvitadoPorCliente = [
  { $lookup: { from: 'coletas', localField: 'coletaId', foreignField: '_id', as: 'coleta' } },
  { $unwind: '$coleta' },
  { $group: { _id: '$coleta.clienteId', co2EvitadoKg: { $sum: '$co2EvitadoKg' }, valorTotal: { $sum: '$valorPrecificado' }, equipamentosTriados: { $sum: 1 } } },
  { $lookup: { from: 'clientes', localField: '_id', foreignField: '_id', as: 'cliente' } },
  { $unwind: '$cliente' },
  { $project: { _id: 0, clienteId: '$_id', nome: '$cliente.nome', tipo: '$cliente.tipo',
      co2EvitadoKg: { $round: ['$co2EvitadoKg', 2] }, valorTotal: { $round: ['$valorTotal', 2] }, equipamentosTriados: 1 } },
  { $sort: { co2EvitadoKg: -1 } },
];

// 2) Volume de material reciclado por categoria em um mês (parâmetros: ano e mês).
const ANO = 2026;
const MES = 10;
const volumeRecicladoPorCategoria = [
  { $match: { destino: 'reciclagem', processadoEm: { $gte: new Date(Date.UTC(ANO, MES - 1, 1)), $lt: new Date(Date.UTC(ANO, MES, 1)) } } },
  { $lookup: { from: 'equipamentos', localField: 'equipamentoId', foreignField: '_id', as: 'equipamento' } },
  { $unwind: '$equipamento' },
  { $group: { _id: '$equipamento.categoria', volumeKg: { $sum: '$pesoKg' }, itens: { $sum: 1 } } },
  { $project: { _id: 0, categoria: '$_id', volumeKg: { $round: ['$volumeKg', 2] }, itens: 1 } },
  { $sort: { volumeKg: -1 } },
];

// 3) Tempo médio de processamento (coleta -> fim da triagem), por ponto de coleta.
const tempoMedioPorPonto = [
  { $match: { status: 'processada' } },
  { $lookup: { from: 'triagem', localField: '_id', foreignField: 'coletaId', as: 'triagens' } },
  { $match: { 'triagens.0': { $exists: true } } },
  { $addFields: { concluidaEm: { $max: '$triagens.processadoEm' } } },
  { $addFields: { horas: { $divide: [{ $subtract: ['$concluidaEm', '$dataColeta'] }, 3600000] } } },
  { $group: { _id: '$pontoDeColetaId', tempoMedioHoras: { $avg: '$horas' }, coletas: { $sum: 1 } } },
  { $lookup: { from: 'pontosDeColeta', localField: '_id', foreignField: '_id', as: 'ponto' } },
  { $unwind: '$ponto' },
  { $project: { _id: 0, pontoDeColetaId: '$_id', ponto: '$ponto.nome', coletas: 1, tempoMedioHoras: { $round: ['$tempoMedioHoras', 2] } } },
  { $sort: { tempoMedioHoras: 1 } },
];

// 4) Desempenho por destino + totais gerais em uma única passada ($facet).
const desempenhoPorDestino = [
  { $facet: {
      porDestino: [
        { $group: { _id: '$destino', itens: { $sum: 1 }, pesoKg: { $sum: '$pesoKg' }, co2EvitadoKg: { $sum: '$co2EvitadoKg' }, valor: { $sum: '$valorPrecificado' } } },
        { $sort: { itens: -1 } },
      ],
      totais: [
        { $group: { _id: null, itens: { $sum: 1 }, co2EvitadoKg: { $sum: '$co2EvitadoKg' }, valor: { $sum: '$valorPrecificado' } } },
      ],
  } },
];

// 5) Pontos de coleta ativos mais próximos de uma coordenada (índice 2dsphere) — base do motor de rotas.
const ORIGEM = { type: 'Point', coordinates: [-51.9331, -23.4205] }; // [longitude, latitude]
const pontosMaisProximos = [
  { $geoNear: { near: ORIGEM, distanceField: 'distanciaMetros', maxDistance: 20000, query: { status: 'ativo' }, spherical: true } },
  { $project: { _id: 0, nome: 1, capacidadeKg: 1, distanciaMetros: { $round: ['$distanciaMetros', 0] } } },
  { $limit: 5 },
];

// 6) Situação de enchimento por ponto a partir da telemetria IoT.
const DESDE = new Date('2026-10-01T00:00:00Z');
const situacaoDeEnchimento = [
  { $match: { tipo: 'nivelEnchimento', timestamp: { $gte: DESDE } } },
  { $group: { _id: '$pontoDeColetaId', mediaNivel: { $avg: '$valor' }, maxNivel: { $max: '$valor' }, leituras: { $sum: 1 }, ultimaLeitura: { $max: '$timestamp' } } },
  { $lookup: { from: 'pontosDeColeta', localField: '_id', foreignField: '_id', as: 'ponto' } },
  { $unwind: '$ponto' },
  { $project: { _id: 0, ponto: '$ponto.nome', leituras: 1, mediaNivel: { $round: ['$mediaNivel', 1] }, maxNivel: 1, ultimaLeitura: 1,
      situacao: { $switch: { branches: [ { case: { $gte: ['$maxNivel', 90] }, then: 'critico' }, { case: { $gte: ['$maxNivel', 70] }, then: 'atencao' } ], default: 'normal' } } } },
  { $sort: { maxNivel: -1 } },
];

rotina('1) CO2 evitado por cliente', 'triagem', co2EvitadoPorCliente);
rotina('2) Volume reciclado por categoria (' + ANO + '-' + MES + ')', 'triagem', volumeRecicladoPorCategoria);
rotina('3) Tempo médio de processamento por ponto de coleta', 'coletas', tempoMedioPorPonto);
rotina('4) Desempenho por destino e totais', 'triagem', desempenhoPorDestino);
rotina('5) Pontos ativos mais próximos (<= 20 km)', 'pontosDeColeta', pontosMaisProximos);
rotina('6) Situação de enchimento (telemetria IoT)', 'eventosIot', situacaoDeEnchimento);
