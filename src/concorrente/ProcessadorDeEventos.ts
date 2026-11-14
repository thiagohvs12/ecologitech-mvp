import { arredondar } from '../comum/numeros';
import type { EventoIoT } from '../dominio/modelos';
import type { Id } from '../dominio/tipos';
import { Mutex } from './Mutex';
import type { PublicadorDeEventos } from './PublicadorDeEventos';
import { Semaphore } from './Semaphore';

export type Persistir = (lote: readonly EventoIoT[]) => Promise<void>;

export interface EstatisticasPonto {
  readonly totalEventos: number;
  readonly somaValores: number;
  readonly mediaValores: number;
}

export const LIMITE_PADRAO_DE_PERSISTENCIAS_SIMULTANEAS = 4;

/**
 * Recebe lotes de vários pontos de coleta ao mesmo tempo.
 *  - Semaphore: no máximo N persistências simultâneas (protege o banco).
 *  - Mutex: a atualização das estatísticas compartilhadas é uma seção crítica.
 */
export class ProcessadorDeEventos {
  private readonly semaforoDePersistencia: Semaphore;
  private readonly mutexDeEstatisticas = new Mutex();
  private readonly acumulado = new Map<Id, { totalEventos: number; somaValores: number }>();

  constructor(
    private readonly persistir: Persistir,
    private readonly publicador: PublicadorDeEventos,
    limiteDePersistencias = LIMITE_PADRAO_DE_PERSISTENCIAS_SIMULTANEAS,
  ) {
    this.semaforoDePersistencia = new Semaphore(limiteDePersistencias);
  }

  async ingerirLote(lote: readonly EventoIoT[]): Promise<void> {
    if (lote.length === 0) return;
    await this.semaforoDePersistencia.executar(() => this.persistir(lote));
    await this.mutexDeEstatisticas.executar(() => this.somarAoAcumulado(lote));
    await Promise.all(lote.map((evento) => this.publicador.publicar(evento)));
  }

  /** Cópia imutável do estado atual. */
  estatisticas(): ReadonlyMap<Id, EstatisticasPonto> {
    return new Map(
      [...this.acumulado].map(([pontoId, { totalEventos, somaValores }]) => [
        pontoId,
        { totalEventos, somaValores, mediaValores: arredondar(somaValores / totalEventos, 2) },
      ]),
    );
  }

  totalProcessado(): number {
    return [...this.acumulado.values()].reduce((total, ponto) => total + ponto.totalEventos, 0);
  }

  private somarAoAcumulado(lote: readonly EventoIoT[]): void {
    for (const evento of lote) {
      const atual = this.acumulado.get(evento.pontoDeColetaId) ?? { totalEventos: 0, somaValores: 0 };
      this.acumulado.set(evento.pontoDeColetaId, {
        totalEventos: atual.totalEventos + 1,
        somaValores: atual.somaValores + evento.valor,
      });
    }
  }
}
