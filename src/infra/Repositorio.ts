import type { Cliente, Coleta, Equipamento, EventoIoT, PontoDeColeta, Triagem } from '../dominio/modelos';
import type { Id } from '../dominio/tipos';

export type Filtro = Readonly<Record<string, unknown>>;

/** Repository Pattern: o domínio depende desta abstração, nunca do driver de banco. */
export interface Repositorio<T extends { readonly id: Id }> {
  salvar(entidade: T): Promise<void>;
  salvarVarios(entidades: readonly T[]): Promise<void>;
  buscarPorId(id: Id): Promise<T | undefined>;
  listar(filtro?: Filtro): Promise<readonly T[]>;
}

export interface Repositorios {
  readonly clientes: Repositorio<Cliente>;
  readonly pontos: Repositorio<PontoDeColeta>;
  readonly equipamentos: Repositorio<Equipamento>;
  readonly coletas: Repositorio<Coleta>;
  readonly triagens: Repositorio<Triagem>;
  readonly eventos: Repositorio<EventoIoT>;
}
