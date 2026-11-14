import type { Cliente, Equipamento, Triagem } from '../dominio/modelos';
import type { Id } from '../dominio/tipos';
import { consolidarPorCliente, type ConsolidadoCliente, type ItemProcessado } from '../funcional/bonificacao';
import type { Repositorio } from '../infra/Repositorio';

export class ServicoBonificacao {
  constructor(
    private readonly clientes: Repositorio<Cliente>,
    private readonly equipamentos: Repositorio<Equipamento>,
    private readonly triagens: Repositorio<Triagem>,
  ) {}

  /** Cálculo puro sobre os dados lidos: não altera nenhum saldo. */
  async apurar(): Promise<readonly ConsolidadoCliente[]> {
    const [triagens, equipamentos] = await Promise.all([this.triagens.listar(), this.equipamentos.listar()]);
    const clientePorEquipamento = new Map<Id, Id>(equipamentos.map((e) => [e.id, e.clienteId]));

    const itens: readonly ItemProcessado[] = triagens.map((triagem) => ({
      clienteId: clientePorEquipamento.get(triagem.equipamentoId)!,
      co2EvitadoKg: triagem.co2EvitadoKg,
      valorPrecificado: triagem.valorPrecificado,
    }));
    return consolidarPorCliente(itens);
  }

  /** Efeito colateral isolado e explícito: credita o saldo de cada cliente. Deve ser chamado uma vez por apuração. */
  async creditar(apuracao: readonly ConsolidadoCliente[]): Promise<void> {
    for (const { clienteId, bonificacao } of apuracao) {
      const cliente = await this.clientes.buscarPorId(clienteId);
      if (cliente) await this.clientes.salvar(cliente.creditarBonificacao(bonificacao));
    }
  }
}
