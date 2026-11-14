import type { GeradorDeId, Relogio } from '../comum/identificadores';
import { escolherRegra } from '../dominio/precificacao';
import { Triagem, type Cliente, type Coleta, type Equipamento } from '../dominio/modelos';
import { classificarDestino } from '../funcional/triagem';
import { calcularCo2Evitado } from '../funcional/impacto';

/** Orquestra: regra pura de classificação + Strategy de preço + cálculo de impacto. */
export class ServicoTriagem {
  constructor(
    private readonly gerarId: GeradorDeId,
    private readonly agora: Relogio,
  ) {}

  triar(coleta: Coleta, equipamento: Equipamento, cliente: Cliente): Triagem {
    const risco = equipamento.nivelRisco();
    const destino = classificarDestino(equipamento.componentes, risco);
    const regra = escolherRegra(risco, cliente);

    return new Triagem({
      id: this.gerarId(),
      coletaId: coleta.id,
      equipamentoId: equipamento.id,
      pontoDeColetaId: coleta.pontoDeColetaId,
      destino,
      pesoKg: equipamento.pesoKg,
      co2EvitadoKg: calcularCo2Evitado(equipamento.categoria, destino, equipamento.pesoKg),
      valorPrecificado: regra.precificar(equipamento.componentes),
      processadoEm: this.agora(),
    });
  }
}
