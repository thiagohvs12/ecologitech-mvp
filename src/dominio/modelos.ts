import { arredondar } from '../comum/numeros';
import type {
  CategoriaEquipamento, Componente, Contato, Coordenada, DestinoTriagem, Endereco, Id,
  ItemColeta, NivelRisco, Sensor, StatusColeta, StatusPonto, TipoCliente, TipoSensor,
} from './tipos';

/* ------------------------------ Cliente ------------------------------ */

export interface ClienteProps {
  readonly id: Id;
  readonly tipo: TipoCliente;
  readonly nome: string;
  readonly documento: string;
  readonly contato: Contato;
  readonly endereco: Endereco;
  readonly saldoBonificacao: number;
  readonly criadoEm: Date;
}

export class Cliente implements ClienteProps {
  declare readonly id: Id;
  declare readonly tipo: TipoCliente;
  declare readonly nome: string;
  declare readonly documento: string;
  declare readonly contato: Contato;
  declare readonly endereco: Endereco;
  declare readonly saldoBonificacao: number;
  declare readonly criadoEm: Date;

  constructor(props: ClienteProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  /** Imutável: devolve um novo Cliente com o saldo atualizado. */
  creditarBonificacao(valor: number): Cliente {
    return new Cliente({ ...this, saldoBonificacao: arredondar(this.saldoBonificacao + valor, 2) });
  }

  get localizacao(): Coordenada {
    return this.endereco.localizacao;
  }
}

/* --------------------------- Ponto de coleta -------------------------- */

export interface PontoDeColetaProps {
  readonly id: Id;
  readonly nome: string;
  readonly localizacao: Coordenada;
  readonly capacidadeKg: number;
  readonly status: StatusPonto;
  readonly sensores: readonly Sensor[];
}

export class PontoDeColeta implements PontoDeColetaProps {
  declare readonly id: Id;
  declare readonly nome: string;
  declare readonly localizacao: Coordenada;
  declare readonly capacidadeKg: number;
  declare readonly status: StatusPonto;
  declare readonly sensores: readonly Sensor[];

  constructor(props: PontoDeColetaProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  estaAtivo(): boolean {
    return this.status === 'ativo';
  }

  comportaCarga(pesoKg: number): boolean {
    return pesoKg <= this.capacidadeKg;
  }
}

/* ----------------------------- Equipamento ---------------------------- */

export interface EquipamentoProps {
  readonly id: Id;
  readonly fabricante: string;
  readonly modelo: string;
  readonly clienteId: Id;
  readonly pesoKg: number;
  readonly atributosEspecificos: Readonly<Record<string, unknown>>;
  readonly componentes: readonly Componente[];
}

export abstract class Equipamento implements EquipamentoProps {
  declare readonly id: Id;
  declare readonly fabricante: string;
  declare readonly modelo: string;
  declare readonly clienteId: Id;
  declare readonly pesoKg: number;
  declare readonly atributosEspecificos: Readonly<Record<string, unknown>>;
  declare readonly componentes: readonly Componente[];

  protected constructor(props: EquipamentoProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  abstract get categoria(): CategoriaEquipamento;

  /** Polimorfismo: cada categoria declara o próprio risco de manuseio. */
  abstract nivelRisco(): NivelRisco;
}

export class Notebook extends Equipamento {
  constructor(props: EquipamentoProps) { super(props); }
  get categoria(): CategoriaEquipamento { return 'notebook'; }
  nivelRisco(): NivelRisco { return 'medio'; }
}

export class PlacaMae extends Equipamento {
  constructor(props: EquipamentoProps) { super(props); }
  get categoria(): CategoriaEquipamento { return 'placaMae'; }
  nivelRisco(): NivelRisco { return 'baixo'; }
}

export class Bateria extends Equipamento {
  constructor(props: EquipamentoProps) { super(props); }
  get categoria(): CategoriaEquipamento { return 'bateria'; }
  nivelRisco(): NivelRisco { return 'alto'; }
}

export class Monitor extends Equipamento {
  constructor(props: EquipamentoProps) { super(props); }
  get categoria(): CategoriaEquipamento { return 'monitor'; }
  nivelRisco(): NivelRisco { return 'medio'; }
}

export class EquipamentoGenerico extends Equipamento {
  constructor(props: EquipamentoProps) { super(props); }
  get categoria(): CategoriaEquipamento { return 'outro'; }
  nivelRisco(): NivelRisco { return 'baixo'; }
}

/* -------------------------------- Coleta ------------------------------ */

export interface ColetaProps {
  readonly id: Id;
  readonly clienteId: Id;
  readonly pontoDeColetaId: Id;
  readonly dataColeta: Date;
  readonly itens: readonly ItemColeta[];
  readonly status: StatusColeta;
}

export class Coleta implements ColetaProps {
  declare readonly id: Id;
  declare readonly clienteId: Id;
  declare readonly pontoDeColetaId: Id;
  declare readonly dataColeta: Date;
  declare readonly itens: readonly ItemColeta[];
  declare readonly status: StatusColeta;

  constructor(props: ColetaProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  comStatus(status: StatusColeta): Coleta {
    return new Coleta({ ...this, status });
  }

  pesoTotalKg(): number {
    return arredondar(this.itens.reduce((total, item) => total + item.pesoKg, 0), 3);
  }
}

/* ------------------------------- Triagem ------------------------------ */

export interface TriagemProps {
  readonly id: Id;
  readonly coletaId: Id;
  readonly equipamentoId: Id;
  readonly pontoDeColetaId: Id;
  readonly destino: DestinoTriagem;
  readonly pesoKg: number;
  readonly co2EvitadoKg: number;
  readonly valorPrecificado: number;
  readonly processadoEm: Date;
}

export class Triagem implements TriagemProps {
  declare readonly id: Id;
  declare readonly coletaId: Id;
  declare readonly equipamentoId: Id;
  declare readonly pontoDeColetaId: Id;
  declare readonly destino: DestinoTriagem;
  declare readonly pesoKg: number;
  declare readonly co2EvitadoKg: number;
  declare readonly valorPrecificado: number;
  declare readonly processadoEm: Date;

  constructor(props: TriagemProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }
}

/* ------------------------------ Evento IoT ---------------------------- */

export interface EventoIoTProps {
  readonly id: Id;
  readonly pontoDeColetaId: Id;
  readonly sensorId: string;
  readonly tipo: TipoSensor;
  readonly valor: number;
  readonly timestamp: Date;
}

export class EventoIoT implements EventoIoTProps {
  declare readonly id: Id;
  declare readonly pontoDeColetaId: Id;
  declare readonly sensorId: string;
  declare readonly tipo: TipoSensor;
  declare readonly valor: number;
  declare readonly timestamp: Date;

  constructor(props: EventoIoTProps) {
    Object.assign(this, props);
    Object.freeze(this);
  }
}
