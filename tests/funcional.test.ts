import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Componente } from '../src/dominio/tipos';
import { consolidarPorCliente, calcularBonificacao, taxaDaFaixa } from '../src/funcional/bonificacao';
import { calcularCo2Evitado } from '../src/funcional/impacto';
import { pipe } from '../src/funcional/pipeline';
import { descontarManuseio, somarValorAproveitavel } from '../src/funcional/precificacao';
import { distanciaKm, distanciaTotalKm, planejarRota } from '../src/funcional/rotas';
import { classificarDestino } from '../src/funcional/triagem';

const comp = (estado: Componente['estado'], valorEstimado: number, pesoKg: number): Componente => ({ tipo: 'x', estado, valorEstimado, pesoKg });

describe('precificação (map -> filter -> reduce)', () => {
  it('soma apenas componentes reaproveitáveis', () => {
    const equipamento = { componentes: [comp('reaproveitavel', 45, 0.1), comp('sucata', 2, 1), comp('reaproveitavel', 30, 0.4)] };
    assert.equal(somarValorAproveitavel([equipamento]), 75);
  });

  it('não altera a entrada (imutabilidade)', () => {
    const componentes = Object.freeze([Object.freeze(comp('reaproveitavel', 10, 1))]);
    const antes = JSON.stringify(componentes);
    somarValorAproveitavel([{ componentes }]);
    assert.equal(JSON.stringify(componentes), antes);
  });

  it('é determinística (função pura)', () => {
    const entrada = [{ componentes: [comp('reaproveitavel', 12.5, 1)] }];
    assert.equal(somarValorAproveitavel(entrada), somarValorAproveitavel(entrada));
  });

  it('desconta custo de manuseio de perigosos sem ficar negativo', () => {
    assert.equal(descontarManuseio(12, [comp('perigoso', 0, 1)]), 7);
    assert.equal(descontarManuseio(3, [comp('perigoso', 0, 1)]), 0);
  });

  it('lista vazia resulta em zero', () => assert.equal(somarValorAproveitavel([]), 0));
});

describe('triagem (classificarDestino)', () => {
  it('maioria reaproveitável -> recondicionamento', () => {
    assert.equal(classificarDestino([comp('reaproveitavel', 1, 6), comp('sucata', 1, 4)], 'medio'), 'recondicionamento');
  });
  it('maioria sucata -> reciclagem', () => {
    assert.equal(classificarDestino([comp('reaproveitavel', 1, 1), comp('sucata', 1, 9)], 'medio'), 'reciclagem');
  });
  it('maioria perigosa -> descarte', () => {
    assert.equal(classificarDestino([comp('perigoso', 1, 6), comp('sucata', 1, 4)], 'baixo'), 'descarte');
  });
  it('risco alto aceita menos material perigoso antes de descartar', () => {
    const componentes = [comp('perigoso', 1, 3), comp('reaproveitavel', 1, 7)];
    assert.equal(classificarDestino(componentes, 'medio'), 'recondicionamento');
    assert.equal(classificarDestino(componentes, 'alto'), 'descarte');
  });
  it('sem componentes -> reciclagem (caso limite)', () => assert.equal(classificarDestino([], 'baixo'), 'reciclagem'));
});

describe('impacto ambiental', () => {
  it('recondicionar evita mais CO2 que reciclar o mesmo peso', () => {
    assert.ok(calcularCo2Evitado('notebook', 'recondicionamento', 2) > calcularCo2Evitado('notebook', 'reciclagem', 2));
  });
  it('peso zero evita zero', () => assert.equal(calcularCo2Evitado('monitor', 'reciclagem', 0), 0));
});

describe('bonificação', () => {
  it('seleciona a faixa correta nas fronteiras', () => {
    assert.equal(taxaDaFaixa(0), 0.02);
    assert.equal(taxaDaFaixa(49.999), 0.02);
    assert.equal(taxaDaFaixa(50), 0.05);
    assert.equal(taxaDaFaixa(200), 0.08);
  });
  it('calcula a bonificação pelo valor', () => assert.equal(calcularBonificacao(60, 100), 5));
  it('consolida por cliente sem mutar a entrada', () => {
    const itens = Object.freeze([
      Object.freeze({ clienteId: 'a', co2EvitadoKg: 30, valorPrecificado: 100 }),
      Object.freeze({ clienteId: 'b', co2EvitadoKg: 10, valorPrecificado: 10 }),
      Object.freeze({ clienteId: 'a', co2EvitadoKg: 30, valorPrecificado: 50 }),
    ]);
    const resultado = consolidarPorCliente(itens);
    const a = resultado.find((r) => r.clienteId === 'a')!;
    assert.deepEqual([a.co2EvitadoKg, a.valorPrecificado, a.bonificacao], [60, 150, 7.5]);
    assert.equal(resultado.length, 2);
  });
});

describe('rotas', () => {
  const base = { latitude: 0, longitude: 0 };
  const paradas = [
    { id: 'longe', coordenada: { latitude: 0, longitude: 3 } },
    { id: 'perto', coordenada: { latitude: 0, longitude: 1 } },
    { id: 'meio', coordenada: { latitude: 0, longitude: 2 } },
  ];
  it('ordena pelo vizinho mais próximo', () => {
    assert.deepEqual(planejarRota(base, paradas).map((p) => p.id), ['perto', 'meio', 'longe']);
  });
  it('não altera a lista original', () => {
    const copia = JSON.stringify(paradas);
    planejarRota(base, paradas);
    assert.equal(JSON.stringify(paradas), copia);
  });
  it('distância de um grau no equador é ~111 km', () => {
    assert.ok(Math.abs(distanciaKm(base, { latitude: 0, longitude: 1 }) - 111.19) < 0.5);
  });
  it('distância total soma os trechos', () => {
    const rota = planejarRota(base, paradas);
    assert.ok(Math.abs(distanciaTotalKm(base, rota) - distanciaKm(base, paradas[0]!.coordenada)) < 0.01);
  });
  it('sem paradas devolve rota vazia', () => assert.deepEqual(planejarRota(base, []), []));
});

describe('pipe', () => {
  it('compõe da esquerda para a direita', () => {
    assert.equal(pipe<number>((x) => x + 1, (x) => x * 2)(3), 8);
  });
});
