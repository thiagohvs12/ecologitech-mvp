import type { Documento } from './serializadores';

/** Abstrai o ObjectId do driver para que a conversão seja testável sem o MongoDB. */
export interface AdaptadorDeObjectId {
  criar(hexadecimal: string): unknown;
  ehObjectId(valor: unknown): boolean;
  paraHexadecimal(valor: unknown): string;
}

const HEXADECIMAL_DE_OBJECT_ID = /^[0-9a-f]{24}$/i;
const CHAVES_QUE_NAO_SAO_REFERENCIAS = new Set(['sensorId']);

const ehChaveDeReferencia = (chave: string): boolean =>
  (chave === 'id' || chave.endsWith('Id')) && !CHAVES_QUE_NAO_SAO_REFERENCIAS.has(chave);

const ehObjetoSimples = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor) && !(valor instanceof Date);

/** Domínio (id string) -> Mongo (_id ObjectId). Converte também as chaves terminadas em "Id". */
export const paraMongo = (valor: unknown, adaptador: AdaptadorDeObjectId, chave = ''): unknown => {
  if (Array.isArray(valor)) return valor.map((item) => paraMongo(item, adaptador, chave));
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map(([c, v]) => [c === 'id' ? '_id' : c, paraMongo(v, adaptador, c)]),
    );
  }
  if (typeof valor === 'string' && ehChaveDeReferencia(chave) && HEXADECIMAL_DE_OBJECT_ID.test(valor)) {
    return adaptador.criar(valor);
  }
  return valor;
};

/** Mongo -> domínio. */
export const deMongo = (valor: unknown, adaptador: AdaptadorDeObjectId): unknown => {
  if (adaptador.ehObjectId(valor)) return adaptador.paraHexadecimal(valor);
  if (Array.isArray(valor)) return valor.map((item) => deMongo(item, adaptador));
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map(([c, v]) => [c === '_id' ? 'id' : c, deMongo(v, adaptador)]),
    );
  }
  return valor;
};

export const documentoParaMongo = (documento: Documento, adaptador: AdaptadorDeObjectId): Documento =>
  paraMongo(documento, adaptador) as Documento;

export const documentoDeMongo = (documento: Documento, adaptador: AdaptadorDeObjectId): Documento =>
  deMongo(documento, adaptador) as Documento;
