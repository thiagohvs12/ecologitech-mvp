/** Limita quantas tarefas assíncronas executam ao mesmo tempo (contrapressão). */
export class Semaphore {
  private disponiveis: number;
  private readonly esperando: Array<() => void> = [];

  constructor(limite: number) {
    if (!Number.isInteger(limite) || limite < 1) throw new RangeError('O limite deve ser um inteiro >= 1');
    this.disponiveis = limite;
  }

  async executar<T>(tarefa: () => Promise<T>): Promise<T> {
    await this.adquirir();
    try {
      return await tarefa();
    } finally {
      this.liberar();
    }
  }

  private adquirir(): Promise<void> {
    if (this.disponiveis > 0) {
      this.disponiveis -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolver) => this.esperando.push(resolver));
  }

  private liberar(): void {
    const proximo = this.esperando.shift();
    if (proximo) proximo();
    else this.disponiveis += 1;
  }
}
