import { arredondar } from '../comum/numeros';
import type { Id } from '../dominio/tipos';

export interface FaixaBonificacao {
  readonly minimoCo2Kg: number;
  readonly taxa: number;
}

/** Ordenadas de forma crescente por minimoCo2Kg. */
export const FAIXAS: readonly FaixaBonificacao[] = Object.freeze([
  { minimoCo2Kg: 0, taxa: 0.02 },
  { minimoCo2Kg: 50, taxa: 0.05 },
  { minimoCo2Kg: 200, taxa: 0.08 },
]);

export interface ItemProcessado {
  readonly clienteId: Id;
  readonly co2EvitadoKg: number;
  readonly valorPrecificado: number;
}

export interface ConsolidadoCliente {
  readonly clienteId: Id;
  readonly co2EvitadoKg: number;
  readonly valorPrecificado: number;
  readonly bonificacao: number;
}

export const taxaDaFaixa = (co2EvitadoKg: number, faixas: readonly FaixaBonificacao[] = FAIXAS): number =>
  faixas
    .filter((faixa) => co2EvitadoKg >= faixa.minimoCo2Kg)
    .reduce((_, faixa) => faixa.taxa, 0);

export const calcularBonificacao = (co2EvitadoKg: number, valorPrecificado: number): number =>
  arredondar(valorPrecificado * taxaDaFaixa(co2EvitadoKg), 2);

/** Reduce imutável: cada passo devolve um novo acumulador (sem alterar o anterior). */
export const consolidarPorCliente = (itens: readonly ItemProcessado[]): readonly ConsolidadoCliente[] => {
  const porCliente = itens.reduce<Readonly<Record<Id, Omit<ConsolidadoCliente, 'bonificacao'>>>>(
    (acumulado, item) => {
      const atual = acumulado[item.clienteId] ?? { clienteId: item.clienteId, co2EvitadoKg: 0, valorPrecificado: 0 };
      return {
        ...acumulado,
        [item.clienteId]: {
          clienteId: item.clienteId,
          co2EvitadoKg: arredondar(atual.co2EvitadoKg + item.co2EvitadoKg),
          valorPrecificado: arredondar(atual.valorPrecificado + item.valorPrecificado, 2),
        },
      };
    },
    {},
  );

  return Object.values(porCliente).map((consolidado) => ({
    ...consolidado,
    bonificacao: calcularBonificacao(consolidado.co2EvitadoKg, consolidado.valorPrecificado),
  }));
};
