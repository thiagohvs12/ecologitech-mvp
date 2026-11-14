import { gerarIdHexadecimal, relogioDoSistema, type GeradorDeId, type Relogio } from '../comum/identificadores';
import { EquipamentoFactory } from '../dominio/EquipamentoFactory';
import { Cliente, Coleta, Equipamento, EventoIoT, PontoDeColeta, Triagem } from '../dominio/modelos';
import type { Repositorios } from '../infra/Repositorio';
import { RepositorioMemoria } from '../infra/RepositorioMemoria';
import { ServicoBonificacao } from './ServicoBonificacao';
import { ServicoColeta } from './ServicoColeta';
import { ServicoRotas } from './ServicoRotas';
import { ServicoTelemetria } from './ServicoTelemetria';
import { ServicoTriagem } from './ServicoTriagem';

export interface Container {
  readonly repositorios: Repositorios;
  readonly coletas: ServicoColeta;
  readonly bonificacao: ServicoBonificacao;
  readonly rotas: ServicoRotas;
  readonly telemetria: ServicoTelemetria;
}

export const criarRepositoriosEmMemoria = (): Repositorios => ({
  clientes: new RepositorioMemoria<Cliente>(),
  pontos: new RepositorioMemoria<PontoDeColeta>(),
  equipamentos: new RepositorioMemoria<Equipamento>(),
  coletas: new RepositorioMemoria<Coleta>(),
  triagens: new RepositorioMemoria<Triagem>(),
  eventos: new RepositorioMemoria<EventoIoT>(),
});

export interface OpcoesDoContainer {
  readonly gerarId?: GeradorDeId;
  readonly agora?: Relogio;
  readonly fabrica?: EquipamentoFactory;
}

/** Composition root: único lugar que conhece as implementações concretas. */
export const montarContainer = (repositorios: Repositorios, opcoes: OpcoesDoContainer = {}): Container => {
  const gerarId = opcoes.gerarId ?? gerarIdHexadecimal;
  const agora = opcoes.agora ?? relogioDoSistema;
  const fabrica = opcoes.fabrica ?? new EquipamentoFactory();
  const servicoTriagem = new ServicoTriagem(gerarId, agora);

  return {
    repositorios,
    coletas: new ServicoColeta({ ...repositorios, servicoTriagem, fabrica, gerarId, agora }),
    bonificacao: new ServicoBonificacao(repositorios.clientes, repositorios.equipamentos, repositorios.triagens),
    rotas: new ServicoRotas(repositorios.coletas, repositorios.pontos),
    telemetria: new ServicoTelemetria(repositorios.eventos),
  };
};
