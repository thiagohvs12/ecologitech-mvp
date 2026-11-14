import type { Collection, Document } from 'mongodb';
import type { Id } from '../dominio/tipos';
import {
  documentoDeMongo, documentoParaMongo, paraMongo, type AdaptadorDeObjectId,
} from './conversorDeIds';
import type { Filtro, Repositorio } from './Repositorio';
import type { Serializador } from './serializadores';

export class RepositorioMongo<T extends { readonly id: Id }> implements Repositorio<T> {
  constructor(
    private readonly colecao: Collection<Document>,
    private readonly serializador: Serializador<T>,
    private readonly objectId: AdaptadorDeObjectId,
  ) {}

  async salvar(entidade: T): Promise<void> {
    const documento = this.paraDocumento(entidade);
    await this.colecao.replaceOne({ _id: documento._id }, documento, { upsert: true });
  }

  async salvarVarios(entidades: readonly T[]): Promise<void> {
    if (entidades.length === 0) return;
    const operacoes = entidades.map((entidade) => {
      const documento = this.paraDocumento(entidade);
      return { replaceOne: { filter: { _id: documento._id }, replacement: documento, upsert: true } };
    });
    await this.colecao.bulkWrite(operacoes, { ordered: false });
  }

  async buscarPorId(id: Id): Promise<T | undefined> {
    const documento = await this.colecao.findOne({ _id: this.objectId.criar(id) } as Document);
    return documento ? this.deDocumento(documento) : undefined;
  }

  async listar(filtro: Filtro = {}): Promise<readonly T[]> {
    const filtroMongo = paraMongo(filtro, this.objectId) as Document;
    const documentos = await this.colecao.find(filtroMongo).toArray();
    return documentos.map((documento) => this.deDocumento(documento));
  }

  private paraDocumento(entidade: T): Document {
    return documentoParaMongo(this.serializador.extrair(entidade), this.objectId);
  }

  private deDocumento(documento: Document): T {
    return this.serializador.hidratar(documentoDeMongo(documento, this.objectId));
  }
}
