// EcoLogitech - 01: coleções, validação de esquema ($jsonSchema) e índices.
// Execução:  mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" 01_criar_colecoes.js
// ATENÇÃO: recria as coleções (apaga os dados existentes do banco "ecologitech").

const bd = db.getSiblingDB('ecologitech');

const objectId = { bsonType: 'objectId' };
const dataHora = { bsonType: 'date' };
const numeroNaoNegativo = { bsonType: 'number', minimum: 0 };

const pontoGeoJson = {
  bsonType: 'object',
  required: ['type', 'coordinates'],
  properties: {
    type: { enum: ['Point'] },
    coordinates: { bsonType: 'array', minItems: 2, maxItems: 2, items: { bsonType: 'number' } },
  },
};

const esquemas = {
  clientes: {
    bsonType: 'object',
    required: ['tipo', 'nome', 'documento', 'endereco', 'saldoBonificacao', 'criadoEm'],
    properties: {
      tipo: { enum: ['corporativo', 'residencial'] },
      nome: { bsonType: 'string', minLength: 1 },
      documento: { bsonType: 'string', minLength: 1 },
      contato: {
        bsonType: 'object',
        properties: { email: { bsonType: 'string' }, telefone: { bsonType: 'string' } },
      },
      endereco: {
        bsonType: 'object',
        required: ['logradouro', 'cidade', 'uf', 'localizacao'],
        properties: {
          logradouro: { bsonType: 'string' },
          cidade: { bsonType: 'string' },
          uf: { bsonType: 'string', minLength: 2, maxLength: 2 },
          localizacao: pontoGeoJson,
        },
      },
      saldoBonificacao: numeroNaoNegativo,
      criadoEm: dataHora,
    },
  },

  pontosDeColeta: {
    bsonType: 'object',
    required: ['nome', 'localizacao', 'capacidadeKg', 'status', 'sensores'],
    properties: {
      nome: { bsonType: 'string', minLength: 1 },
      localizacao: pontoGeoJson,
      capacidadeKg: { bsonType: 'number', minimum: 1 },
      status: { enum: ['ativo', 'inativo'] },
      sensores: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['sensorId', 'tipo'],
          properties: { sensorId: { bsonType: 'string' }, tipo: { enum: ['nivelEnchimento', 'temperatura', 'peso'] } },
        },
      },
    },
  },

  // Esquema dinâmico: "atributosEspecificos" aceita qualquer campo (varia por categoria).
  equipamentos: {
    bsonType: 'object',
    required: ['categoria', 'fabricante', 'modelo', 'clienteId', 'pesoKg', 'atributosEspecificos', 'componentes'],
    properties: {
      categoria: { enum: ['notebook', 'placaMae', 'bateria', 'monitor', 'outro'] },
      fabricante: { bsonType: 'string', minLength: 1 },
      modelo: { bsonType: 'string', minLength: 1 },
      clienteId: objectId,
      pesoKg: numeroNaoNegativo,
      atributosEspecificos: { bsonType: 'object' },
      componentes: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['tipo', 'estado', 'valorEstimado', 'pesoKg'],
          properties: {
            tipo: { bsonType: 'string' },
            estado: { enum: ['reaproveitavel', 'sucata', 'perigoso'] },
            valorEstimado: numeroNaoNegativo,
            pesoKg: numeroNaoNegativo,
          },
        },
      },
    },
  },

  coletas: {
    bsonType: 'object',
    required: ['clienteId', 'pontoDeColetaId', 'dataColeta', 'itens', 'status'],
    properties: {
      clienteId: objectId,
      pontoDeColetaId: objectId,
      dataColeta: dataHora,
      itens: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['equipamentoId', 'pesoKg'],
          properties: { equipamentoId: objectId, pesoKg: numeroNaoNegativo },
        },
      },
      status: { enum: ['agendada', 'coletada', 'processada'] },
    },
  },

  // pontoDeColetaId e pesoKg são copiados da coleta/equipamento no momento da triagem
  // (referência estendida): evitam $lookup nas consultas mais frequentes e dão uma shard key válida.
  triagem: {
    bsonType: 'object',
    required: ['coletaId', 'equipamentoId', 'pontoDeColetaId', 'destino', 'pesoKg', 'co2EvitadoKg', 'valorPrecificado', 'processadoEm'],
    properties: {
      coletaId: objectId,
      equipamentoId: objectId,
      pontoDeColetaId: objectId,
      destino: { enum: ['reciclagem', 'recondicionamento', 'descarte'] },
      pesoKg: numeroNaoNegativo,
      co2EvitadoKg: numeroNaoNegativo,
      valorPrecificado: numeroNaoNegativo,
      processadoEm: dataHora,
    },
  },

  eventosIot: {
    bsonType: 'object',
    required: ['pontoDeColetaId', 'sensorId', 'tipo', 'valor', 'timestamp'],
    properties: {
      pontoDeColetaId: objectId,
      sensorId: { bsonType: 'string' },
      tipo: { enum: ['nivelEnchimento', 'temperatura', 'peso'] },
      valor: { bsonType: 'number' },
      timestamp: dataHora,
    },
  },
};

for (const [nome, esquema] of Object.entries(esquemas)) {
  bd.getCollection(nome).drop();
  bd.createCollection(nome, {
    validator: { $jsonSchema: esquema },
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

// ---------------------------------- Índices ----------------------------------
bd.getCollection('clientes').createIndex({ documento: 1 }, { unique: true, name: 'idx_clientes_documento' });
bd.getCollection('clientes').createIndex({ 'endereco.localizacao': '2dsphere' }, { name: 'idx_clientes_geo' });

bd.getCollection('pontosDeColeta').createIndex({ localizacao: '2dsphere' }, { name: 'idx_pontos_geo' });

bd.getCollection('equipamentos').createIndex({ clienteId: 1 }, { name: 'idx_equip_cliente' });
bd.getCollection('equipamentos').createIndex(
  { fabricante: 'text', modelo: 'text' },
  { name: 'idx_equip_texto', default_language: 'portuguese' },
);

// O composto cobre também consultas só por pontoDeColetaId (prefixo): não há índice simples redundante.
bd.getCollection('coletas').createIndex({ pontoDeColetaId: 1, dataColeta: 1 }, { name: 'idx_coletas_ponto_data' });
bd.getCollection('coletas').createIndex({ clienteId: 1 }, { name: 'idx_coletas_cliente' });

bd.getCollection('triagem').createIndex({ coletaId: 1, destino: 1 }, { name: 'idx_triagem_coleta_destino' });
bd.getCollection('triagem').createIndex({ destino: 1, processadoEm: 1 }, { name: 'idx_triagem_destino_data' });
bd.getCollection('triagem').createIndex({ equipamentoId: 1 }, { name: 'idx_triagem_equipamento' });

bd.getCollection('eventosIot').createIndex({ pontoDeColetaId: 1, timestamp: -1 }, { name: 'idx_eventos_ponto_tempo' });
// Retenção opcional da telemetria bruta (90 dias):
// bd.getCollection('eventosIot').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000, name: 'ttl_eventos' });

print('Coleções criadas: ' + Object.keys(esquemas).join(', '));
