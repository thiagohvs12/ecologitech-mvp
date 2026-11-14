import type { Id } from '../dominio/tipos';
import type { EventoIoT } from '../dominio/modelos';
import {
  ProcessadorDeEventos, type EstatisticasPonto,
} from '../concorrente/ProcessadorDeEventos';
import { AlertaDeEnchimentoListener, PublicadorDeEventos } from '../concorrente/PublicadorDeEventos';
import type { Repositorio } from '../infra/Repositorio';

export class ServicoTelemetria {
  readonly alertas = new AlertaDeEnchimentoListener();
  private readonly processador: ProcessadorDeEventos;

  constructor(eventos: Repositorio<EventoIoT>, limiteDePersistencias?: number) {
    const publicador = new PublicadorDeEventos();
    publicador.inscrever(this.alertas);
    this.processador = new ProcessadorDeEventos((lote) => eventos.salvarVarios(lote), publicador, limiteDePersistencias);
  }

  ingerirLote(lote: readonly EventoIoT[]): Promise<void> {
    return this.processador.ingerirLote(lote);
  }

  get processadorDeEventos(): ProcessadorDeEventos {
    return this.processador;
  }

  estatisticas(): ReadonlyMap<Id, EstatisticasPonto> {
    return this.processador.estatisticas();
  }
}
