import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { documentoDeMongo, documentoParaMongo, type AdaptadorDeObjectId } from '../src/infra/conversorDeIds';
import { co2EvitadoPorCliente, pontosMaisProximos, volumeRecicladoPorCategoria } from '../src/infra/pipelines';
import { Coleta, Cliente } from '../src/dominio/modelos';
import { deGeoJson, paraGeoJson, serializadorCliente, serializadorColeta } from '../src/infra/serializadores';

class FakeObjectId { constructor(readonly hex: string) {} }
const adaptador: AdaptadorDeObjectId = {
  criar: (hex) => new FakeObjectId(hex),
  ehObjectId: (v) => v instanceof FakeObjectId,
  paraHexadecimal: (v) => (v as FakeObjectId).hex,
};
const ID = 'a'.repeat(24);
const OUTRO = 'b'.repeat(24);

describe('conversão de ids (domínio <-> Mongo)', () => {
  it('id vira _id e chaves *Id viram ObjectId, inclusive dentro de arrays', () => {
    const doc = documentoParaMongo({ id: ID, clienteId: OUTRO, itens: [{ equipamentoId: ID, pesoKg: 1 }], nome: ID }, adaptador);
    assert.ok(doc._id instanceof FakeObjectId);
    assert.ok(doc.clienteId instanceof FakeObjectId);
    assert.ok(doc.itens[0].equipamentoId instanceof FakeObjectId);
    assert.equal(doc.nome, ID);
  });
  it('sensorId permanece texto', () => {
    assert.equal(documentoParaMongo({ sensorId: ID }, adaptador).sensorId, ID);
  });
  it('ida e volta preserva o documento', () => {
    const original = { id: ID, clienteId: OUTRO, data: new Date('2026-10-01'), itens: [{ equipamentoId: ID, pesoKg: 2 }] };
    assert.deepEqual(documentoDeMongo(documentoParaMongo(original, adaptador), adaptador), original);
  });
});

describe('serializadores', () => {
  it('GeoJSON usa [longitude, latitude]', () => {
    const ponto = paraGeoJson({ latitude: -23.4, longitude: -51.9 });
    assert.deepEqual(ponto.coordinates, [-51.9, -23.4]);
    assert.deepEqual(deGeoJson(ponto), { latitude: -23.4, longitude: -51.9 });
  });
  it('cliente e coleta sobrevivem a extrair -> hidratar', () => {
    const cliente = new Cliente({ id: ID, tipo: 'corporativo', nome: 'N', documento: 'D', contato: { email: 'e', telefone: 't' }, endereco: { logradouro: 'l', cidade: 'c', uf: 'PR', localizacao: { latitude: 1, longitude: 2 } }, saldoBonificacao: 3, criadoEm: new Date(0) });
    assert.deepEqual({ ...serializadorCliente.hidratar(serializadorCliente.extrair(cliente)) }, { ...cliente });
    const coleta = new Coleta({ id: ID, clienteId: OUTRO, pontoDeColetaId: OUTRO, dataColeta: new Date(0), itens: [{ equipamentoId: ID, pesoKg: 1 }], status: 'coletada' });
    assert.deepEqual({ ...serializadorColeta.hidratar(serializadorColeta.extrair(coleta)) }, { ...coleta });
  });
});

describe('pipelines de agregação (estrutura)', () => {
  it('pipeline 1 agrupa por cliente da coleta e ordena por CO2 decrescente', () => {
    const grupo = co2EvitadoPorCliente.find((estagio) => '$group' in estagio) as any;
    assert.equal(grupo.$group._id, '$coleta.clienteId');
    assert.deepEqual(co2EvitadoPorCliente.at(-1), { $sort: { co2EvitadoKg: -1 } });
  });
  it('pipeline 2 delimita o mês em UTC', () => {
    const { $match } = volumeRecicladoPorCategoria(2026, 12)[0] as any;
    assert.equal($match.processadoEm.$gte.toISOString(), '2026-12-01T00:00:00.000Z');
    assert.equal($match.processadoEm.$lt.toISOString(), '2027-01-01T00:00:00.000Z');
  });
  it('$geoNear é o primeiro estágio e usa [lon, lat]', () => {
    const [primeiro] = pontosMaisProximos({ latitude: 10, longitude: 20 }, 1000) as any[];
    assert.deepEqual(primeiro.$geoNear.near.coordinates, [20, 10]);
  });
});
