export type Id = string;

export type CategoriaEquipamento = 'notebook' | 'placaMae' | 'bateria' | 'monitor' | 'outro';
export type EstadoComponente = 'reaproveitavel' | 'sucata' | 'perigoso';
export type DestinoTriagem = 'reciclagem' | 'recondicionamento' | 'descarte';
export type StatusColeta = 'agendada' | 'coletada' | 'processada';
export type StatusPonto = 'ativo' | 'inativo';
export type NivelRisco = 'baixo' | 'medio' | 'alto';
export type TipoCliente = 'corporativo' | 'residencial';
export type TipoSensor = 'nivelEnchimento' | 'temperatura' | 'peso';

export interface Coordenada {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Componente {
  readonly tipo: string;
  readonly estado: EstadoComponente;
  readonly valorEstimado: number;
  readonly pesoKg: number;
}

export interface Endereco {
  readonly logradouro: string;
  readonly cidade: string;
  readonly uf: string;
  readonly localizacao: Coordenada;
}

export interface Contato {
  readonly email: string;
  readonly telefone: string;
}

export interface Sensor {
  readonly sensorId: string;
  readonly tipo: TipoSensor;
}

export interface ItemColeta {
  readonly equipamentoId: Id;
  readonly pesoKg: number;
}
