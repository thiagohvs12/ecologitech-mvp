import type { EventoIoT } from '../dominio/modelos';

/** Observer Pattern: quem quiser reagir a eventos IoT implementa esta interface. */
export interface EventoIoTListener {
  aoReceber(evento: EventoIoT): Promise<void> | void;
}

export class PublicadorDeEventos {
  private readonly ouvintes: EventoIoTListener[] = [];

  inscrever(ouvinte: EventoIoTListener): void {
    this.ouvintes.push(ouvinte);
  }

  async publicar(evento: EventoIoT): Promise<void> {
    await Promise.all(this.ouvintes.map((ouvinte) => ouvinte.aoReceber(evento)));
  }
}

export const NIVEL_CRITICO_ENCHIMENTO = 90;

export interface AlertaEnchimento {
  readonly pontoDeColetaId: string;
  readonly nivel: number;
}

export class AlertaDeEnchimentoListener implements EventoIoTListener {
  private readonly alertas: AlertaEnchimento[] = [];

  aoReceber(evento: EventoIoT): void {
    if (evento.tipo === 'nivelEnchimento' && evento.valor >= NIVEL_CRITICO_ENCHIMENTO) {
      this.alertas.push({ pontoDeColetaId: evento.pontoDeColetaId, nivel: evento.valor });
    }
  }

  obterAlertas(): readonly AlertaEnchimento[] {
    return [...this.alertas];
  }
}
