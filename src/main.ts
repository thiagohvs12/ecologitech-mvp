import { gerarIdHexadecimal } from './comum/identificadores';
import { demonstrarCorridaDeDados } from './concorrente/contadores';
import { simularRecebimentoMassivo } from './concorrente/simulacao';
import { Cliente, Coleta, PontoDeColeta } from './dominio/modelos';
import type { Componente, Coordenada, Id } from './dominio/tipos';
import { criarRepositoriosEmMemoria, montarContainer, type Container } from './aplicacao/container';
import type { SolicitacaoColeta } from './aplicacao/ServicoColeta';
import { EquipamentoFactory } from './dominio/EquipamentoFactory';

const BASE_DE_OPERACOES: Coordenada = { latitude: -23.4205, longitude: -51.9331 };
const URI_PADRAO = 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true';
const QUANTIDADE_DE_PONTOS = 12;
const EVENTOS_POR_PONTO = 50;
const TAMANHO_DO_LOTE = 10;
const SEMENTE_DA_SIMULACAO = 2026;

interface CenarioCriado {
  readonly pontos: readonly PontoDeColeta[];
  readonly clientes: readonly Cliente[];
}

const titulo = (texto: string): void => console.log(`\n=== ${texto} ===`);

const componentes = (...itens: Array<[string, Componente['estado'], number, number]>): Componente[] =>
  itens.map(([tipo, estado, valorEstimado, pesoKg]) => ({ tipo, estado, valorEstimado, pesoKg }));

const criarPontos = (): PontoDeColeta[] =>
  Array.from({ length: QUANTIDADE_DE_PONTOS }, (_, i) => new PontoDeColeta({
    id: gerarIdHexadecimal(),
    nome: `Demo ${String(i + 1).padStart(2, '0')}`,
    localizacao: {
      latitude: BASE_DE_OPERACOES.latitude + (i - 6) * 0.008,
      longitude: BASE_DE_OPERACOES.longitude + (((i * 7) % 12) - 6) * 0.006,
    },
    capacidadeKg: 1000,
    status: 'ativo',
    sensores: [{ sensorId: `S-DEMO-${i + 1}-NIV`, tipo: 'nivelEnchimento' }],
  }));

const criarCliente = (nome: string, tipo: 'corporativo' | 'residencial', saldo: number): Cliente => {
  const id = gerarIdHexadecimal();
  return new Cliente({
    id, tipo, nome,
    documento: `DEMO-${id.slice(-10)}`,
    contato: { email: `${id.slice(-6)}@exemplo.test`, telefone: '(44) 0000-0000' },
    endereco: { logradouro: 'Rua Exemplo, 100', cidade: 'Maringá', uf: 'PR', localizacao: BASE_DE_OPERACOES },
    saldoBonificacao: saldo,
    criadoEm: new Date(),
  });
};

const solicitacaoDeExemplo = (clienteId: Id, pontoDeColetaId: Id): SolicitacaoColeta => ({
  clienteId,
  pontoDeColetaId,
  itens: [
    { categoria: 'notebook', fabricante: 'Dell', modelo: 'Latitude 5420', pesoKg: 1.8,
      atributosEspecificos: { ramGb: 8, armazenamentoGb: 256 },
      componentes: componentes(['processador', 'reaproveitavel', 45, 0.4], ['placa', 'reaproveitavel', 30, 0.6], ['carcaca', 'sucata', 2, 0.8]) },
    { categoria: 'bateria', fabricante: 'Genérica', modelo: 'Li-ion 5000mAh', pesoKg: 0.3,
      atributosEspecificos: { quimica: 'Li-ion', capacidadeMah: 5000, risco: 'alto' },
      componentes: componentes(['celula', 'perigoso', 12, 0.25], ['involucro', 'sucata', 1, 0.05]) },
    { categoria: 'monitor', fabricante: 'LG', modelo: '22MK400', pesoKg: 3.2,
      atributosEspecificos: { telaPolegadas: 22 },
      componentes: componentes(['painel', 'sucata', 8, 2.0], ['fonte', 'reaproveitavel', 15, 0.5], ['carcaca', 'sucata', 1, 0.7]) },
  ],
});

const demonstrarDominio = async (app: Container): Promise<CenarioCriado> => {
  const pontos = criarPontos();
  const clientes = [criarCliente('Acme Demo', 'corporativo', 150), criarCliente('Maria Demo', 'residencial', 0)];
  await app.repositorios.pontos.salvarVarios(pontos);
  await app.repositorios.clientes.salvarVarios(clientes);

  titulo('1) POO + Injeção: registrar e processar coletas (triagem funcional + Strategy de preço)');
  for (const cliente of clientes) {
    const coleta = await app.coletas.registrarColeta(solicitacaoDeExemplo(cliente.id, pontos[0]!.id));
    const triagens = await app.coletas.processarColeta(coleta.id);
    console.log(`Cliente ${cliente.nome} (${cliente.tipo}):`);
    console.table(triagens.map(({ equipamentoId, destino, pesoKg, co2EvitadoKg, valorPrecificado }) =>
      ({ equipamento: equipamentoId.slice(-6), destino, pesoKg, co2EvitadoKg, valorPrecificado })));
  }

  titulo('2) Funcional: bonificação por cliente (map -> filter -> reduce, sem efeitos colaterais)');
  const idsDaDemonstracao = new Set(clientes.map((cliente) => cliente.id));
  const apuracao = (await app.bonificacao.apurar()).filter((consolidado) => idsDaDemonstracao.has(consolidado.clienteId));
  console.table(apuracao.map((c) => ({ cliente: c.clienteId.slice(-6), co2EvitadoKg: c.co2EvitadoKg, valorPrecificado: c.valorPrecificado, bonificacao: c.bonificacao })));
  await app.bonificacao.creditar(apuracao);

  titulo('3) Funcional: rota de coleta (vizinho mais próximo, recursão pura)');
  const agendadas = pontos.slice(0, 6).map((ponto) => new Coleta({
    id: gerarIdHexadecimal(), clienteId: clientes[0]!.id, pontoDeColetaId: ponto.id, dataColeta: new Date(), itens: [], status: 'agendada',
  }));
  await app.repositorios.coletas.salvarVarios(agendadas);
  const rota = await app.rotas.planejarColetasAgendadas(BASE_DE_OPERACOES);
  const nomes = new Map((await app.repositorios.pontos.listar()).map((ponto) => [ponto.id, ponto.nome]));
  console.log(`Distância total: ${rota.distanciaTotalKm} km | ordem:`, rota.paradas.map((parada) => nomes.get(parada.id)).join(' -> '));

  return { pontos, clientes };
};

const demonstrarConcorrencia = async (app: Container, pontoIds: readonly Id[]): Promise<void> => {
  titulo(`4) Concorrente/Assíncrono: ${pontoIds.length} pontos enviando ${EVENTOS_POR_PONTO} eventos IoT ao mesmo tempo`);
  const inicio = Date.now();
  const resultado = await simularRecebimentoMassivo({
    pontos: pontoIds, eventosPorPonto: EVENTOS_POR_PONTO, tamanhoDoLote: TAMANHO_DO_LOTE, semente: SEMENTE_DA_SIMULACAO,
    gerarId: gerarIdHexadecimal, agora: () => new Date(),
  }, app.telemetria.processadorDeEventos);
  console.log(`Esperado: ${resultado.esperado} | Processado: ${resultado.processado} | Perdas: ${resultado.esperado - resultado.processado} | ${Date.now() - inicio} ms`);
  console.log(`Alertas de enchimento crítico (>= 90%): ${app.telemetria.alertas.obterAlertas().length}`);

  titulo('5) Corrida de dados: sem Mutex x com Mutex');
  const corrida = await demonstrarCorridaDeDados(pontoIds.length, EVENTOS_POR_PONTO);
  console.table([{ esperado: corrida.esperado, 'sem Mutex': corrida.inseguro, 'com Mutex': corrida.seguro }]);
};

const principal = async (): Promise<void> => {
  const usarMongo = process.argv.includes('--mongo');
  const fabrica = new EquipamentoFactory();

  if (!usarMongo) {
    const app = montarContainer(criarRepositoriosEmMemoria(), { fabrica });
    const cenario = await demonstrarDominio(app);
    await demonstrarConcorrencia(app, cenario.pontos.map((ponto) => ponto.id));
    console.log('\n(Persistência em memória. Para usar o MongoDB: `npm run demo:mongo`, após rodar os scripts da pasta mongo/)');
    return;
  }

  const { conectar, criarRepositoriosMongo, executarConsultasAnaliticas } = await import('./infra/mongo.js');
  const { cliente, banco } = await conectar(process.env.MONGODB_URI ?? URI_PADRAO);
  try {
    const app = montarContainer(criarRepositoriosMongo(banco, fabrica), { fabrica });
    const cenario = await demonstrarDominio(app);
    await demonstrarConcorrencia(app, cenario.pontos.map((ponto) => ponto.id));

    titulo('6) NoSQL: aggregation pipelines executadas no MongoDB e devolvidas à aplicação');
    const resultados = await executarConsultasAnaliticas(banco, {
      ano: 2026, mes: 10, origem: BASE_DE_OPERACOES, desde: new Date('2026-10-01T00:00:00Z'),
    });
    for (const [nome, dados] of Object.entries(resultados)) {
      console.log(`\n-- ${nome}`);
      console.log(JSON.stringify(dados, null, 2));
    }
  } finally {
    await cliente.close();
  }
};

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
