import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { criarRepositoriosEmMemoria, montarContainer, type Container } from '../src/aplicacao/container';
import { EntidadeNaoEncontradaError, RegraDeNegocioError } from '../src/aplicacao/erros';
import type { ItemSolicitado } from '../src/aplicacao/ServicoColeta';
import { CategoriaInvalidaError, EquipamentoFactory } from '../src/dominio/EquipamentoFactory';
import { Bateria, Cliente, Coleta, Notebook, PontoDeColeta } from '../src/dominio/modelos';
import { PrecificacaoPadrao, PrecificacaoPromocional, PrecificacaoRisco, escolherRegra } from '../src/dominio/precificacao';
import type { Componente } from '../src/dominio/tipos';

const LOCAL = { latitude: -23.42, longitude: -51.93 };
let contador = 0;
const gerarId = () => (++contador).toString(16).padStart(24, '0');
const dataFixa = new Date('2026-10-10T12:00:00Z');

const cliente = (id: string, tipo: 'corporativo' | 'residencial', saldo = 0) => new Cliente({
  id, tipo, nome: id, documento: '0', contato: { email: 'a@b.c', telefone: '1' },
  endereco: { logradouro: 'x', cidade: 'Maringá', uf: 'PR', localizacao: LOCAL }, saldoBonificacao: saldo, criadoEm: dataFixa,
});
const ponto = (id: string, capacidadeKg = 100, status: 'ativo' | 'inativo' = 'ativo') => new PontoDeColeta({ id, nome: id, localizacao: LOCAL, capacidadeKg, status, sensores: [] });
const c = (estado: Componente['estado'], valorEstimado: number, pesoKg: number): Componente => ({ tipo: 'x', estado, valorEstimado, pesoKg });

const notebook: ItemSolicitado = { categoria: 'notebook', fabricante: 'Dell', modelo: 'L', pesoKg: 2, componentes: [c('reaproveitavel', 40, 1), c('sucata', 1, 1)] };
const bateria: ItemSolicitado = { categoria: 'bateria', fabricante: 'G', modelo: 'B', pesoKg: 0.5, componentes: [c('perigoso', 10, 0.4), c('reaproveitavel', 10, 0.1)] };

describe('EquipamentoFactory', () => {
  it('cria a subclasse correta por categoria', () => {
    const f = new EquipamentoFactory();
    const props = { id: '1', fabricante: 'f', modelo: 'm', clienteId: 'c', pesoKg: 1, atributosEspecificos: {}, componentes: [] };
    assert.ok(f.criar('notebook', props) instanceof Notebook);
    assert.ok(f.criar('bateria', props) instanceof Bateria);
    assert.equal(f.criar('bateria', props).nivelRisco(), 'alto');
  });
  it('rejeita categoria desconhecida', () => {
    assert.throws(() => new EquipamentoFactory().criar('geladeira', { id: '1', fabricante: '', modelo: '', clienteId: '', pesoKg: 1, atributosEspecificos: {}, componentes: [] }), CategoriaInvalidaError);
  });
});

describe('Strategy de precificação', () => {
  const comps = [c('reaproveitavel', 100, 1), c('perigoso', 0, 1)];
  it('cada estratégia calcula diferente sobre os mesmos componentes', () => {
    assert.equal(new PrecificacaoPadrao().precificar(comps), 100);
    assert.equal(new PrecificacaoPromocional().precificar(comps), 110);
    assert.equal(new PrecificacaoRisco().precificar(comps), 95);
  });
  it('escolhe a regra conforme risco e perfil do cliente', () => {
    assert.equal(escolherRegra('alto', cliente('a', 'residencial')).nome, 'risco');
    assert.equal(escolherRegra('medio', cliente('a', 'corporativo', 100)).nome, 'promocional');
    assert.equal(escolherRegra('medio', cliente('a', 'corporativo', 99)).nome, 'padrao');
    assert.equal(escolherRegra('baixo', cliente('a', 'residencial', 500)).nome, 'padrao');
  });
});

describe('Serviços (injeção de dependências + repositório em memória)', () => {
  let app: Container;
  beforeEach(async () => {
    app = montarContainer(criarRepositoriosEmMemoria(), { gerarId, agora: () => dataFixa });
    await app.repositorios.clientes.salvarVarios([cliente('cli-corp', 'corporativo', 150), cliente('cli-res', 'residencial')]);
    await app.repositorios.pontos.salvarVarios([ponto('p1'), ponto('p-inativo', 100, 'inativo'), ponto('p-pequeno', 1)]);
  });

  it('registra e processa uma coleta ponta a ponta', async () => {
    const coleta = await app.coletas.registrarColeta({ clienteId: 'cli-corp', pontoDeColetaId: 'p1', itens: [notebook, bateria] });
    assert.equal(coleta.status, 'coletada');
    assert.equal(coleta.pesoTotalKg(), 2.5);

    const triagens = await app.coletas.processarColeta(coleta.id);
    assert.equal(triagens.length, 2);
    assert.deepEqual(triagens.map((t) => t.destino), ['recondicionamento', 'descarte']);
    assert.equal(triagens[0]!.valorPrecificado, 44);
    assert.ok(triagens.every((t) => t.processadoEm.getTime() === dataFixa.getTime()));
    assert.equal((await app.repositorios.coletas.buscarPorId(coleta.id))!.status, 'processada');
    assert.equal((await app.repositorios.triagens.listar()).length, 2);
  });

  it('não permite processar a mesma coleta duas vezes', async () => {
    const coleta = await app.coletas.registrarColeta({ clienteId: 'cli-res', pontoDeColetaId: 'p1', itens: [notebook] });
    await app.coletas.processarColeta(coleta.id);
    await assert.rejects(app.coletas.processarColeta(coleta.id), RegraDeNegocioError);
  });

  it('valida cliente, ponto inativo e capacidade', async () => {
    await assert.rejects(app.coletas.registrarColeta({ clienteId: 'x', pontoDeColetaId: 'p1', itens: [notebook] }), EntidadeNaoEncontradaError);
    await assert.rejects(app.coletas.registrarColeta({ clienteId: 'cli-res', pontoDeColetaId: 'p-inativo', itens: [notebook] }), /inativo/);
    await assert.rejects(app.coletas.registrarColeta({ clienteId: 'cli-res', pontoDeColetaId: 'p-pequeno', itens: [notebook] }), /capacidade/);
  });

  it('apura e credita bonificação sem mutar o cliente anterior', async () => {
    const antes = (await app.repositorios.clientes.buscarPorId('cli-corp'))!;
    const coleta = await app.coletas.registrarColeta({ clienteId: 'cli-corp', pontoDeColetaId: 'p1', itens: [notebook] });
    await app.coletas.processarColeta(coleta.id);
    const apuracao = await app.bonificacao.apurar();
    assert.equal(apuracao.length, 1);
    assert.ok(apuracao[0]!.bonificacao > 0);

    await app.bonificacao.creditar(apuracao);
    const depois = (await app.repositorios.clientes.buscarPorId('cli-corp'))!;
    assert.equal(antes.saldoBonificacao, 150);
    assert.equal(depois.saldoBonificacao, 150 + apuracao[0]!.bonificacao);
  });

  it('planeja rota apenas das coletas agendadas', async () => {
    await app.repositorios.coletas.salvar(new Coleta({ id: 'agendada-1', clienteId: 'cli-res', pontoDeColetaId: 'p1', dataColeta: dataFixa, itens: [], status: 'agendada' }));
    const rota = await app.rotas.planejarColetasAgendadas(LOCAL);
    assert.deepEqual(rota.paradas.map((p) => p.id), ['p1']);
  });
});
