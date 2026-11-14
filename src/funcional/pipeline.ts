/** Composição da esquerda para a direita: pipe(f, g, h)(x) === h(g(f(x))). */
export const pipe =
  <T>(...funcoes: ReadonlyArray<(entrada: T) => T>) =>
  (entrada: T): T =>
    funcoes.reduce((acumulado, funcao) => funcao(acumulado), entrada);
