import type { GeradorDeId, Relogio } from '../comum/identificadores';
import { EquipamentoFactory } from '../dominio/EquipamentoFactory';
import { Coleta, type Cliente, type Equipamento, type PontoDeColeta, type Triagem } from '../dominio/modelos';
import type { Componente, Id } from '../dominio/tipos';
import type { Repositorio } from '../infra/Repositorio';
import { EntidadeNaoEncontradaError, RegraDeNegocioError } from './erros';
import type { ServicoTriagem } from './ServicoTriagem';

export interface ItemSolicitado {
  readonly categoria: string;
  readonly fabricante: string;
  readonly modelo: string;
  readonly pesoKg: number;
  readonly atributosEspecificos?: Readonly<Record<string, unknown>>;
  readonly componentes: readonly Componente[];
}

export interface SolicitacaoColeta {
  readonly clienteId: Id;
  readonly pontoDeColetaId: Id;
  readonly itens: readonly ItemSolicitado[];
}

export interface Dependencias {
  readonly clientes: Repositorio<Cliente>;
  readonly pontos: Repositorio<PontoDeColeta>;
  readonly equipamentos: Repositorio<Equipamento>;
  readonly coletas: Repositorio<Coleta>;
  readonly triagens: Repositorio<Triagem>;
  readonly servicoTriagem: ServicoTriagem;
  readonly fabrica: EquipamentoFactory;
  readonly gerarId: GeradorDeId;
  readonly agora: Relogio;
}

/** Camada de serviço: recebe todas as dependências por injeção (construtor). */
export class ServicoColeta {
  constructor(private readonly deps: Dependencias) {}

  async registrarColeta(solicitacao: SolicitacaoColeta): Promise<Coleta> {
    const cliente = await this.exigir(this.deps.clientes, solicitacao.clienteId, 'Cliente');
    const ponto = await this.exigir(this.deps.pontos, solicitacao.pontoDeColetaId, 'Ponto de coleta');

    const equipamentos = solicitacao.itens.map((item) => this.criarEquipamento(item, cliente.id));
    const pesoTotal = equipamentos.reduce((total, equipamento) => total + equipamento.pesoKg, 0);
    this.validarPonto(ponto, pesoTotal);

    const coleta = new Coleta({
      id: this.deps.gerarId(),
      clienteId: cliente.id,
      pontoDeColetaId: ponto.id,
      dataColeta: this.deps.agora(),
      itens: equipamentos.map(({ id, pesoKg }) => ({ equipamentoId: id, pesoKg })),
      status: 'coletada',
    });

    await this.deps.equipamentos.salvarVarios(equipamentos);
    await this.deps.coletas.salvar(coleta);
    return coleta;
  }

  async processarColeta(coletaId: Id): Promise<readonly Triagem[]> {
    const coleta = await this.exigir(this.deps.coletas, coletaId, 'Coleta');
    if (coleta.status === 'processada') throw new RegraDeNegocioError(`Coleta ${coleta.id} já foi processada`);
    const cliente = await this.exigir(this.deps.clientes, coleta.clienteId, 'Cliente');

    const triagens = await Promise.all(
      coleta.itens.map(async ({ equipamentoId }) => {
        const equipamento = await this.exigir(this.deps.equipamentos, equipamentoId, 'Equipamento');
        return this.deps.servicoTriagem.triar(coleta, equipamento, cliente);
      }),
    );

    await this.deps.triagens.salvarVarios(triagens);
    await this.deps.coletas.salvar(coleta.comStatus('processada'));
    return triagens;
  }

  private criarEquipamento(item: ItemSolicitado, clienteId: Id): Equipamento {
    return this.deps.fabrica.criar(item.categoria, {
      id: this.deps.gerarId(),
      fabricante: item.fabricante,
      modelo: item.modelo,
      clienteId,
      pesoKg: item.pesoKg,
      atributosEspecificos: item.atributosEspecificos ?? {},
      componentes: item.componentes,
    });
  }

  private validarPonto(ponto: PontoDeColeta, pesoTotalKg: number): void {
    if (!ponto.estaAtivo()) throw new RegraDeNegocioError(`Ponto de coleta ${ponto.nome} está inativo`);
    if (!ponto.comportaCarga(pesoTotalKg)) {
      throw new RegraDeNegocioError(`Carga de ${pesoTotalKg} kg excede a capacidade de ${ponto.nome}`);
    }
  }

  private async exigir<T extends { readonly id: Id }>(repositorio: Repositorio<T>, id: Id, nome: string): Promise<T> {
    const encontrado = await repositorio.buscarPorId(id);
    if (!encontrado) throw new EntidadeNaoEncontradaError(nome, id);
    return encontrado;
  }
}
