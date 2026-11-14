import type { Coleta, PontoDeColeta } from '../dominio/modelos';
import type { Coordenada } from '../dominio/tipos';
import { distanciaTotalKm, planejarRota, type Parada } from '../funcional/rotas';
import type { Repositorio } from '../infra/Repositorio';

export interface RotaPlanejada {
  readonly paradas: readonly Parada[];
  readonly distanciaTotalKm: number;
}

export class ServicoRotas {
  constructor(
    private readonly coletas: Repositorio<Coleta>,
    private readonly pontos: Repositorio<PontoDeColeta>,
  ) {}

  async planejarColetasAgendadas(base: Coordenada): Promise<RotaPlanejada> {
    const agendadas = await this.coletas.listar({ status: 'agendada' });
    const idsDosPontos = [...new Set(agendadas.map((coleta) => coleta.pontoDeColetaId))];
    const pontos = await Promise.all(idsDosPontos.map((id) => this.pontos.buscarPorId(id)));

    const paradas: readonly Parada[] = pontos
      .filter((ponto): ponto is PontoDeColeta => ponto !== undefined)
      .map((ponto) => ({ id: ponto.id, coordenada: ponto.localizacao }));

    const rota = planejarRota(base, paradas);
    return { paradas: rota, distanciaTotalKm: distanciaTotalKm(base, rota) };
  }
}
