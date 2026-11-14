import { MongoClient, ObjectId, type Db } from 'mongodb';
import { EquipamentoFactory } from '../dominio/EquipamentoFactory';
import type { Coordenada } from '../dominio/tipos';
import type { AdaptadorDeObjectId } from './conversorDeIds';
import * as pipelines from './pipelines';
import { RepositorioMongo } from './RepositorioMongo';
import type { Repositorios } from './Repositorio';
import {
  criarSerializadorEquipamento, serializadorCliente, serializadorColeta, serializadorEventoIoT,
  serializadorPonto, serializadorTriagem,
} from './serializadores';

export const adaptadorMongo: AdaptadorDeObjectId = {
  criar: (hexadecimal) => new ObjectId(hexadecimal),
  ehObjectId: (valor) => valor instanceof ObjectId,
  paraHexadecimal: (valor) => (valor as ObjectId).toHexString(),
};

export const NOME_DO_BANCO = 'ecologitech';

export const conectar = async (uri: string): Promise<{ cliente: MongoClient; banco: Db }> => {
  const cliente = new MongoClient(uri);
  await cliente.connect();
  return { cliente, banco: cliente.db(NOME_DO_BANCO) };
};

export const criarRepositoriosMongo = (banco: Db, fabrica: EquipamentoFactory): Repositorios => ({
  clientes: new RepositorioMongo(banco.collection('clientes'), serializadorCliente, adaptadorMongo),
  pontos: new RepositorioMongo(banco.collection('pontosDeColeta'), serializadorPonto, adaptadorMongo),
  equipamentos: new RepositorioMongo(banco.collection('equipamentos'), criarSerializadorEquipamento(fabrica), adaptadorMongo),
  coletas: new RepositorioMongo(banco.collection('coletas'), serializadorColeta, adaptadorMongo),
  triagens: new RepositorioMongo(banco.collection('triagem'), serializadorTriagem, adaptadorMongo),
  eventos: new RepositorioMongo(banco.collection('eventosIot'), serializadorEventoIoT, adaptadorMongo),
});

const executar = (banco: Db, colecao: string, pipeline: pipelines.Pipeline) =>
  banco.collection(colecao).aggregate([...pipeline]).toArray();

/** Executa as 6 rotinas analíticas diretamente no banco e devolve os resultados à aplicação. */
export const executarConsultasAnaliticas = async (banco: Db, referencia: { ano: number; mes: number; origem: Coordenada; desde: Date }) => ({
  co2EvitadoPorCliente: await executar(banco, 'triagem', pipelines.co2EvitadoPorCliente),
  volumeRecicladoPorCategoria: await executar(banco, 'triagem', pipelines.volumeRecicladoPorCategoria(referencia.ano, referencia.mes)),
  tempoMedioPorPonto: await executar(banco, 'coletas', pipelines.tempoMedioPorPonto),
  desempenhoPorDestino: await executar(banco, 'triagem', pipelines.desempenhoPorDestino),
  pontosMaisProximos: await executar(banco, 'pontosDeColeta', pipelines.pontosMaisProximos(referencia.origem, 20000)),
  situacaoDeEnchimento: await executar(banco, 'eventosIot', pipelines.situacaoDeEnchimento(referencia.desde)),
});
