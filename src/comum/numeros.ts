export const arredondar = (valor: number, casas = 3): number => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

export const somar = (acumulado: number, valor: number): number => acumulado + valor;
