import { EquipamentoFactory } from '../dominio/EquipamentoFactory';
import {
  Cliente, Coleta, Equipamento, EventoIoT, PontoDeColeta, Triagem,
} from '../dominio/modelos';
import type { Componente, Coordenada, ItemColeta, Sensor } from '../dominio/tipos';

export type Documento = Record<string, any>;

export interface Serializador<T> {
  extrair(entidade: T): Documento;
  hidratar(documento: Documento): T;
}

/** GeoJSON usa [longitude, latitude]; o domínio usa { latitude, longitude }. */
export const paraGeoJson = ({ latitude, longitude }: Coordenada) => ({
  type: 'Point' as const,
  coordinates: [longitude, latitude],
});

export const deGeoJson = (ponto: { coordinates: readonly number[] }): Coordenada => ({
  latitude: ponto.coordinates[1]!,
  longitude: ponto.coordinates[0]!,
});

export const serializadorCliente: Serializador<Cliente> = {
  extrair: (c) => ({
    id: c.id, tipo: c.tipo, nome: c.nome, documento: c.documento, contato: c.contato,
    endereco: { ...c.endereco, localizacao: paraGeoJson(c.endereco.localizacao) },
    saldoBonificacao: c.saldoBonificacao, criadoEm: c.criadoEm,
  }),
  hidratar: (d) => new Cliente({
    id: d.id, tipo: d.tipo, nome: d.nome, documento: d.documento, contato: d.contato,
    endereco: { ...d.endereco, localizacao: deGeoJson(d.endereco.localizacao) },
    saldoBonificacao: d.saldoBonificacao, criadoEm: d.criadoEm,
  }),
};

export const serializadorPonto: Serializador<PontoDeColeta> = {
  extrair: (p) => ({
    id: p.id, nome: p.nome, localizacao: paraGeoJson(p.localizacao),
    capacidadeKg: p.capacidadeKg, status: p.status, sensores: p.sensores,
  }),
  hidratar: (d) => new PontoDeColeta({
    id: d.id, nome: d.nome, localizacao: deGeoJson(d.localizacao),
    capacidadeKg: d.capacidadeKg, status: d.status, sensores: d.sensores as Sensor[],
  }),
};

export const criarSerializadorEquipamento = (fabrica: EquipamentoFactory): Serializador<Equipamento> => ({
  extrair: (e) => ({
    id: e.id, categoria: e.categoria, fabricante: e.fabricante, modelo: e.modelo, clienteId: e.clienteId,
    pesoKg: e.pesoKg, atributosEspecificos: e.atributosEspecificos, componentes: e.componentes,
  }),
  hidratar: (d) => fabrica.criar(d.categoria, {
    id: d.id, fabricante: d.fabricante, modelo: d.modelo, clienteId: d.clienteId, pesoKg: d.pesoKg,
    atributosEspecificos: d.atributosEspecificos, componentes: d.componentes as Componente[],
  }),
});

export const serializadorColeta: Serializador<Coleta> = {
  extrair: (c) => ({
    id: c.id, clienteId: c.clienteId, pontoDeColetaId: c.pontoDeColetaId, dataColeta: c.dataColeta,
    itens: c.itens, status: c.status,
  }),
  hidratar: (d) => new Coleta({
    id: d.id, clienteId: d.clienteId, pontoDeColetaId: d.pontoDeColetaId, dataColeta: d.dataColeta,
    itens: d.itens as ItemColeta[], status: d.status,
  }),
};

export const serializadorTriagem: Serializador<Triagem> = {
  extrair: (t) => ({ ...t }),
  hidratar: (d) => new Triagem({
    id: d.id, coletaId: d.coletaId, equipamentoId: d.equipamentoId, pontoDeColetaId: d.pontoDeColetaId,
    destino: d.destino, pesoKg: d.pesoKg, co2EvitadoKg: d.co2EvitadoKg,
    valorPrecificado: d.valorPrecificado, processadoEm: d.processadoEm,
  }),
};

export const serializadorEventoIoT: Serializador<EventoIoT> = {
  extrair: (e) => ({ ...e }),
  hidratar: (d) => new EventoIoT({
    id: d.id, pontoDeColetaId: d.pontoDeColetaId, sensorId: d.sensorId, tipo: d.tipo,
    valor: d.valor, timestamp: d.timestamp,
  }),
};
