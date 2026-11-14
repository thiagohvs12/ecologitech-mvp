import { Mutex } from './Mutex';

export const cederVez = (): Promise<void> => new Promise((resolver) => setImmediate(resolver));

/** Read-modify-write com um `await` no meio: o clássico "lost update" mesmo em Node (single-thread). */
export class ContadorInseguro {
  total = 0;

  async incrementar(): Promise<void> {
    const atual = this.total;
    await cederVez();
    this.total = atual + 1;
  }
}

/** Mesma operação, agora protegida por Mutex: a seção crítica passa a ser atômica. */
export class ContadorSeguro {
  total = 0;
  private readonly mutex = new Mutex();

  incrementar(): Promise<void> {
    return this.mutex.executar(async () => {
      const atual = this.total;
      await cederVez();
      this.total = atual + 1;
    });
  }
}

export interface ResultadoCorrida {
  readonly esperado: number;
  readonly inseguro: number;
  readonly seguro: number;
}

const executarEmParalelo = async (
  contador: { incrementar(): Promise<void> },
  tarefas: number,
  incrementosPorTarefa: number,
): Promise<void> => {
  const tarefa = async (): Promise<void> => {
    for (let i = 0; i < incrementosPorTarefa; i += 1) await contador.incrementar();
  };
  await Promise.all(Array.from({ length: tarefas }, tarefa));
};

export const demonstrarCorridaDeDados = async (tarefas: number, incrementosPorTarefa: number): Promise<ResultadoCorrida> => {
  const inseguro = new ContadorInseguro();
  const seguro = new ContadorSeguro();
  await executarEmParalelo(inseguro, tarefas, incrementosPorTarefa);
  await executarEmParalelo(seguro, tarefas, incrementosPorTarefa);
  return { esperado: tarefas * incrementosPorTarefa, inseguro: inseguro.total, seguro: seguro.total };
};
