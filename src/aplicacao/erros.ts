export class EntidadeNaoEncontradaError extends Error {
  constructor(entidade: string, id: string) {
    super(`${entidade} não encontrado(a): ${id}`);
    this.name = 'EntidadeNaoEncontradaError';
  }
}

export class RegraDeNegocioError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'RegraDeNegocioError';
  }
}
