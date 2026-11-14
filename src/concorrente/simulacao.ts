import { criarGeradorAleatorio } from '../comum/aleatorio';
import type { GeradorDeId } from '../comum/identificadores';
import { EventoIoT } from '../dominio/modelos';
import type { Id, TipoSensor } from '../dominio/tipos';
import type { ProcessadorDeEventos } from './ProcessadorDeEventos';

export interface ConfiguracaoSimulacao {
  readonly pontos: readonly Id[];
  readonly eventosPorPonto: number;
  readonly tamanhoDoLote: number;
  readonly semente: number;
  readonly gerarId: GeradorDeId;
  readonly agora: () => Date;
}

const TIPOS_DE_SENSOR: readonly TipoSensor[] = ['nivelEnchimento', 'temperatura'];
const ATRASO_MAXIMO_ENTRE_LOTES_MS = 3;

const dormir = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

const dividirEmLotes = <T>(itens: readonly T[], tamanho: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, indice) =>
    itens.slice(indice * tamanho, (indice + 1) * tamanho),
  );

const gerarEventosDoPonto = (
  pontoId: Id,
  configuracao: ConfiguracaoSimulacao,
  sortear: () => number,
): readonly EventoIoT[] =>
  Array.from({ length: configuracao.eventosPorPonto }, (_, indice) => {
    const tipo = TIPOS_DE_SENSOR[indice % TIPOS_DE_SENSOR.length]!;
    const valor = tipo === 'nivelEnchimento' ? Math.floor(sortear() * 100) : 20 + Math.floor(sortear() * 40);
    return new EventoIoT({
      id: configuracao.gerarId(),
      pontoDeColetaId: pontoId,
      sensorId: `S-${pontoId.slice(-4)}-${tipo === 'nivelEnchimento' ? 'NIV' : 'TMP'}`,
      tipo,
      valor,
      timestamp: configuracao.agora(),
    });
  });

/** Cada ponto de coleta é uma tarefa assíncrona independente; todas disparam ao mesmo tempo. */
const simularPonto = async (
  pontoId: Id,
  configuracao: ConfiguracaoSimulacao,
  processador: ProcessadorDeEventos,
  sortear: () => number,
): Promise<void> => {
  const lotes = dividirEmLotes(gerarEventosDoPonto(pontoId, configuracao, sortear), configuracao.tamanhoDoLote);
  for (const lote of lotes) {
    await dormir(Math.floor(sortear() * ATRASO_MAXIMO_ENTRE_LOTES_MS));
    await processador.ingerirLote(lote);
  }
};

export const simularRecebimentoMassivo = async (
  configuracao: ConfiguracaoSimulacao,
  processador: ProcessadorDeEventos,
): Promise<{ readonly esperado: number; readonly processado: number }> => {
  const sortear = criarGeradorAleatorio(configuracao.semente);
  await Promise.all(configuracao.pontos.map((pontoId) => simularPonto(pontoId, configuracao, processador, sortear)));
  return {
    esperado: configuracao.pontos.length * configuracao.eventosPorPonto,
    processado: processador.totalProcessado(),
  };
};
