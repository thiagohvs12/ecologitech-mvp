import { arredondar, somar } from '../comum/numeros';
import type { Componente } from '../dominio/tipos';

export const CUSTO_MANUSEIO_PERIGOSO = 5;

export interface ValorComponente {
  readonly tipo: string;
  readonly valorEstimado: number;
  readonly aproveitavel: boolean;
}

interface ComComponentes {
  readonly componentes: readonly Componente[];
}

/** f: Equipamento -> ValorComponente[] (map) */
export const mapComponentesParaValor = ({ componentes }: ComComponentes): readonly ValorComponente[] =>
  componentes.map(({ tipo, valorEstimado, estado }) => ({
    tipo,
    valorEstimado,
    aproveitavel: estado === 'reaproveitavel',
  }));

/** g: ValorComponente -> Boolean (filter) */
export const ehAproveitavel = (componente: ValorComponente): boolean => componente.aproveitavel;

/** total = reduce(filter(map(equipamentos))) */
export const somarValorAproveitavel = (equipamentos: readonly ComComponentes[]): number =>
  arredondar(
    equipamentos
      .flatMap(mapComponentesParaValor)
      .filter(ehAproveitavel)
      .map((componente) => componente.valorEstimado)
      .reduce(somar, 0),
    2,
  );

export const aplicarFator = (valor: number, fator: number): number => arredondar(valor * fator, 2);

export const contarPerigosos = (componentes: readonly Componente[]): number =>
  componentes.filter((componente) => componente.estado === 'perigoso').length;

export const descontarManuseio = (valor: number, componentes: readonly Componente[]): number =>
  arredondar(Math.max(0, valor - contarPerigosos(componentes) * CUSTO_MANUSEIO_PERIGOSO), 2);
