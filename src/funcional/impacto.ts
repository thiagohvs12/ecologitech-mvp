import { arredondar } from '../comum/numeros';
import type { CategoriaEquipamento, DestinoTriagem } from '../dominio/tipos';

/** Fatores ILUSTRATIVOS (kg de CO2e evitado por kg processado) — substituir por fonte oficial em produção. */
export const FATOR_CO2_POR_KG: Readonly<Record<CategoriaEquipamento, number>> = Object.freeze({
  notebook: 12,
  placaMae: 25,
  bateria: 8,
  monitor: 10,
  outro: 5,
});

export const MULTIPLICADOR_DESTINO: Readonly<Record<DestinoTriagem, number>> = Object.freeze({
  reciclagem: 1,
  recondicionamento: 1.5,
  descarte: 0.1,
});

export const calcularCo2Evitado = (
  categoria: CategoriaEquipamento,
  destino: DestinoTriagem,
  pesoKg: number,
): number => arredondar(pesoKg * FATOR_CO2_POR_KG[categoria] * MULTIPLICADOR_DESTINO[destino], 3);
