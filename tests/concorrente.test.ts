import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gerarIdHexadecimal } from '../src/comum/identificadores';
import { demonstrarCorridaDeDados } from '../src/concorrente/contadores';
import { Mutex } from '../src/concorrente/Mutex';
import { ProcessadorDeEventos } from '../src/concorrente/ProcessadorDeEventos';
import { AlertaDeEnchimentoListener, PublicadorDeEventos } from '../src/concorrente/PublicadorDeEventos';
import { Semaphore } from '../src/concorrente/Semaphore';
import { simularRecebimentoMassivo } from '../src/concorrente/simulacao';
import { EventoIoT } from '../src/dominio/modelos';

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('corrida de dados', () => {
  it('sem exclusão mútua há perda de atualizações; com Mutex o total é exato', async () => {
    const resultado = await demonstrarCorridaDeDados(12, 25);
    assert.ok(resultado.inseguro < resultado.esperado, `esperava perdas, obteve ${resultado.inseguro}`);
    assert.equal(resultado.seguro, resultado.esperado);
  });
});

describe('Mutex', () => {
  it('executa seções críticas uma de cada vez e em ordem', async () => {
    const mutex = new Mutex();
    const ordem: string[] = [];
    const tarefa = (nome: string, atraso: number) => mutex.executar(async () => {
      ordem.push(`inicio-${nome}`); await pausa(atraso); ordem.push(`fim-${nome}`);
    });
    await Promise.all([tarefa('a', 10), tarefa('b', 1), tarefa('c', 1)]);
    assert.deepEqual(ordem, ['inicio-a', 'fim-a', 'inicio-b', 'fim-b', 'inicio-c', 'fim-c']);
  });

  it('libera o lock mesmo quando a seção crítica lança erro', async () => {
    const mutex = new Mutex();
    await assert.rejects(mutex.executar(() => { throw new Error('falha'); }), /falha/);
    assert.equal(await mutex.executar(() => 'ok'), 'ok');
  });
});

describe('Semaphore', () => {
  it('nunca excede o limite de tarefas simultâneas', async () => {
    const semaforo = new Semaphore(3);
    let ativas = 0; let maximo = 0;
    await Promise.all(Array.from({ length: 20 }, () => semaforo.executar(async () => {
      ativas += 1; maximo = Math.max(maximo, ativas); await pausa(2); ativas -= 1;
    })));
    assert.equal(maximo, 3);
  });
  it('rejeita limite inválido', () => assert.throws(() => new Semaphore(0), RangeError));
});

describe('ingestão massiva de eventos IoT', () => {
  const evento = (pontoDeColetaId: string, valor: number, tipo: 'nivelEnchimento' | 'temperatura' = 'nivelEnchimento') =>
    new EventoIoT({ id: gerarIdHexadecimal(), pontoDeColetaId, sensorId: 'S', tipo, valor, timestamp: new Date() });

  it('12 pontos simultâneos: nenhum evento perdido nem duplicado', async () => {
    const persistidos: string[] = [];
    const processador = new ProcessadorDeEventos(async (lote) => { await pausa(1); persistidos.push(...lote.map((e) => e.id)); }, new PublicadorDeEventos(), 4);
    const pontos = Array.from({ length: 12 }, () => gerarIdHexadecimal());
    const resultado = await simularRecebimentoMassivo({ pontos, eventosPorPonto: 40, tamanhoDoLote: 10, semente: 7, gerarId: gerarIdHexadecimal, agora: () => new Date() }, processador);
    assert.equal(resultado.processado, 480);
    assert.equal(persistidos.length, 480);
    assert.equal(new Set(persistidos).size, 480);
    for (const estatistica of processador.estatisticas().values()) assert.equal(estatistica.totalEventos, 40);
  });

  it('respeita o limite de persistências simultâneas', async () => {
    let ativas = 0; let maximo = 0;
    const processador = new ProcessadorDeEventos(async () => { ativas += 1; maximo = Math.max(maximo, ativas); await pausa(3); ativas -= 1; }, new PublicadorDeEventos(), 2);
    await Promise.all(Array.from({ length: 10 }, (_, i) => processador.ingerirLote([evento(`p${i}`, 1)])));
    assert.ok(maximo <= 2);
  });

  it('é determinística com a mesma semente', async () => {
    const rodar = async () => {
      const processador = new ProcessadorDeEventos(async () => {}, new PublicadorDeEventos());
      await simularRecebimentoMassivo({ pontos: ['a', 'b', 'c'], eventosPorPonto: 20, tamanhoDoLote: 5, semente: 99, gerarId: gerarIdHexadecimal, agora: () => new Date(0) }, processador);
      return [...processador.estatisticas()].map(([id, e]) => [id, e.somaValores]);
    };
    assert.deepEqual(await rodar(), await rodar());
  });

  it('Observer: alerta quando o enchimento é crítico', async () => {
    const publicador = new PublicadorDeEventos();
    const alertas = new AlertaDeEnchimentoListener();
    publicador.inscrever(alertas);
    const processador = new ProcessadorDeEventos(async () => {}, publicador);
    await processador.ingerirLote([evento('p1', 95), evento('p1', 50), evento('p2', 99, 'temperatura')]);
    assert.deepEqual(alertas.obterAlertas().map((a) => a.nivel), [95]);
  });
});
