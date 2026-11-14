import type { Cliente } from './modelos';
import type { Componente, NivelRisco } from './tipos';
import { aplicarFator, descontarManuseio, somarValorAproveitavel } from '../funcional/precificacao';

/** Strategy Pattern: a política muda sem alterar quem a utiliza. O cálculo em si é puro (módulo funcional). */
export interface RegraDePrecificacao {
  readonly nome: string;
  precificar(componentes: readonly Componente[]): number;
}

export const FATOR_PROMOCIONAL = 1.1;
export const SALDO_MINIMO_PROMOCAO = 100;

export class PrecificacaoPadrao implements RegraDePrecificacao {
  readonly nome = 'padrao';
  precificar(componentes: readonly Componente[]): number {
    return somarValorAproveitavel([{ componentes }]);
  }
}

export class PrecificacaoPromocional implements RegraDePrecificacao {
  readonly nome = 'promocional';
  precificar(componentes: readonly Componente[]): number {
    return aplicarFator(somarValorAproveitavel([{ componentes }]), FATOR_PROMOCIONAL);
  }
}

export class PrecificacaoRisco implements RegraDePrecificacao {
  readonly nome = 'risco';
  precificar(componentes: readonly Componente[]): number {
    return descontarManuseio(somarValorAproveitavel([{ componentes }]), componentes);
  }
}

export const escolherRegra = (risco: NivelRisco, cliente: Cliente): RegraDePrecificacao => {
  if (risco === 'alto') return new PrecificacaoRisco();
  if (cliente.tipo === 'corporativo' && cliente.saldoBonificacao >= SALDO_MINIMO_PROMOCAO) {
    return new PrecificacaoPromocional();
  }
  return new PrecificacaoPadrao();
};
