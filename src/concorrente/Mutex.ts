/** Exclusão mútua para seções críticas assíncronas (ordem FIFO garantida pela cadeia de promises). */
export class Mutex {
  private fila: Promise<void> = Promise.resolve();

  async executar<T>(secaoCritica: () => Promise<T> | T): Promise<T> {
    let liberar!: () => void;
    const anterior = this.fila;
    this.fila = new Promise<void>((resolver) => (liberar = resolver));
    await anterior;
    try {
      return await secaoCritica();
    } finally {
      liberar();
    }
  }
}
