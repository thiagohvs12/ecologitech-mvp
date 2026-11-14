import { arredondar } from '../comum/numeros';
import type { Coordenada, Id } from '../dominio/tipos';

const RAIO_TERRA_KM = 6371;

export interface Parada {
  readonly id: Id;
  readonly coordenada: Coordenada;
}

const paraRadianos = (graus: number): number => (graus * Math.PI) / 180;

/** Distância de Haversine (km) entre duas coordenadas. */
export const distanciaKm = (a: Coordenada, b: Coordenada): number => {
  const deltaLatitude = paraRadianos(b.latitude - a.latitude);
  const deltaLongitude = paraRadianos(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(paraRadianos(a.latitude)) * Math.cos(paraRadianos(b.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return arredondar(2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h)), 3);
};

const paradaMaisProxima = (origem: Coordenada, paradas: readonly Parada[]): Parada =>
  paradas.reduce((melhor, parada) =>
    distanciaKm(origem, parada.coordenada) < distanciaKm(origem, melhor.coordenada) ? parada : melhor,
  );

/** Heurística do vizinho mais próximo, em recursão pura (sem mutar listas). */
export const planejarRota = (
  origem: Coordenada,
  paradas: readonly Parada[],
  rotaAteAqui: readonly Parada[] = [],
): readonly Parada[] => {
  if (paradas.length === 0) return rotaAteAqui;
  const proxima = paradaMaisProxima(origem, paradas);
  const restantes = paradas.filter((parada) => parada.id !== proxima.id);
  return planejarRota(proxima.coordenada, restantes, [...rotaAteAqui, proxima]);
};

export const distanciaTotalKm = (origem: Coordenada, rota: readonly Parada[]): number =>
  arredondar(
    rota.reduce(
      (acumulado, parada) => ({
        total: acumulado.total + distanciaKm(acumulado.posicao, parada.coordenada),
        posicao: parada.coordenada,
      }),
      { total: 0, posicao: origem },
    ).total,
    3,
  );
