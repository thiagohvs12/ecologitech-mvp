import type { Id } from '../dominio/tipos';
import type { Filtro, Repositorio } from './Repositorio';

export class RepositorioMemoria<T extends { readonly id: Id }> implements Repositorio<T> {
  private readonly itens = new Map<Id, T>();

  async salvar(entidade: T): Promise<void> {
    this.itens.set(entidade.id, entidade);
  }

  async salvarVarios(entidades: readonly T[]): Promise<void> {
    entidades.forEach((entidade) => this.itens.set(entidade.id, entidade));
  }

  async buscarPorId(id: Id): Promise<T | undefined> {
    return this.itens.get(id);
  }

  async listar(filtro: Filtro = {}): Promise<readonly T[]> {
    const condicoes = Object.entries(filtro);
    return [...this.itens.values()].filter((item) =>
      condicoes.every(([campo, valor]) => (item as unknown as Record<string, unknown>)[campo] === valor),
    );
  }
}
