import {
  Bateria, Equipamento, EquipamentoGenerico, Monitor, Notebook, PlacaMae,
  type EquipamentoProps,
} from './modelos';
import type { CategoriaEquipamento } from './tipos';

type Construtor = new (props: EquipamentoProps) => Equipamento;

const CONSTRUTORES: Readonly<Record<CategoriaEquipamento, Construtor>> = Object.freeze({
  notebook: Notebook,
  placaMae: PlacaMae,
  bateria: Bateria,
  monitor: Monitor,
  outro: EquipamentoGenerico,
});

export class CategoriaInvalidaError extends Error {
  constructor(categoria: string) {
    super(`Categoria de equipamento desconhecida: ${categoria}`);
    this.name = 'CategoriaInvalidaError';
  }
}

/** Factory Pattern: escolhe a subclasse correta em tempo de execução. */
export class EquipamentoFactory {
  criar(categoria: string, props: EquipamentoProps): Equipamento {
    const construtor = CONSTRUTORES[categoria as CategoriaEquipamento];
    if (!construtor) throw new CategoriaInvalidaError(categoria);
    return new construtor(props);
  }
}
