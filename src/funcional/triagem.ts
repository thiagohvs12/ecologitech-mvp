import { arredondar, somar } from '../comum/numeros';
import type { Componente, DestinoTriagem, EstadoComponente, NivelRisco } from '../dominio/tipos';

export const LIMITE_DESCARTE = 0.5;
export const LIMITE_RECONDICIONAMENTO = 0.5;

const pesoPorEstado = (componentes: readonly Componente[], estado: EstadoComponente): number =>
  componentes
    .filter((componente) => componente.estado === estado)
    .map((componente) => componente.pesoKg)
    .reduce(somar, 0);

const pesoTotal = (componentes: readonly Componente[]): number =>
  componentes.map((componente) => componente.pesoKg).reduce(somar, 0);

export const proporcaoPorEstado = (componentes: readonly Componente[], estado: EstadoComponente): number => {
  const total = pesoTotal(componentes);
  return total === 0 ? 0 : arredondar(pesoPorEstado(componentes, estado) / total, 4);
};

/**
 * Função pura: mesma entrada, mesma saída, nenhum estado externo.
 * Risco alto rebaixa o limite de descarte seguro (baterias exigem destinação controlada).
 */
export const classificarDestino = (
  componentes: readonly Componente[],
  risco: NivelRisco,
): DestinoTriagem => {
  const limiteDescarte = risco === 'alto' ? LIMITE_DESCARTE / 2 : LIMITE_DESCARTE;
  if (proporcaoPorEstado(componentes, 'perigoso') >= limiteDescarte) return 'descarte';
  if (proporcaoPorEstado(componentes, 'reaproveitavel') >= LIMITE_RECONDICIONAMENTO) return 'recondicionamento';
  return 'reciclagem';
};
