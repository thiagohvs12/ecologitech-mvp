// EcoLogitech - 02: população de dados de teste (determinística: mesma semente => mesmos dados).
// Gera 12 clientes, 10 pontos de coleta, 60 equipamentos, 30 coletas, 52 triagens e 60 eventos IoT (224 documentos).
// Execução:  mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" 02_popular.js

const bd = db.getSiblingDB('ecologitech');

/* ------------------------- utilitários determinísticos ------------------------- */
function mulberry32(semente) {
  let estado = semente >>> 0;
  return function () {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sortear = mulberry32(2026);
const inteiro = (min, max) => min + Math.floor(sortear() * (max - min + 1));
const decimal = (min, max, casas) => Number((min + sortear() * (max - min)).toFixed(casas));
const escolher = (lista) => lista[Math.floor(sortear() * lista.length)];
const chance = (probabilidade) => sortear() < probabilidade;
const arredondar = (valor, casas) => Math.round(valor * 10 ** casas) / 10 ** casas;
const zeros = (n, tamanho) => String(n).padStart(tamanho, '0');
const geoJson = (latitude, longitude) => ({ type: 'Point', coordinates: [longitude, latitude] });

const HORA_MS = 3600 * 1000;
const INICIO = Date.UTC(2026, 8, 15, 8, 0, 0); // 15/09/2026 08:00 UTC
const BASE = { latitude: -23.4205, longitude: -51.9331 }; // Maringá - PR

/* ----------------- regras de negócio (espelham o código TypeScript) ----------------- */
const FATOR_CO2_POR_KG = { notebook: 12, placaMae: 25, bateria: 8, monitor: 10, outro: 5 };
const MULTIPLICADOR_DESTINO = { reciclagem: 1, recondicionamento: 1.5, descarte: 0.1 };
const RISCO = { notebook: 'medio', placaMae: 'baixo', bateria: 'alto', monitor: 'medio', outro: 'baixo' };
const LIMITE_DESCARTE = 0.5;
const LIMITE_RECONDICIONAMENTO = 0.5;
const CUSTO_MANUSEIO_PERIGOSO = 5;
const FATOR_PROMOCIONAL = 1.1;
const SALDO_MINIMO_PROMOCAO = 100;

const pesoDoEstado = (componentes, estado) =>
  componentes.filter((c) => c.estado === estado).reduce((total, c) => total + c.pesoKg, 0);
const pesoTotal = (componentes) => componentes.reduce((total, c) => total + c.pesoKg, 0);

function classificarDestino(componentes, risco) {
  const total = pesoTotal(componentes);
  const proporcao = (estado) => (total === 0 ? 0 : arredondar(pesoDoEstado(componentes, estado) / total, 4));
  const limiteDescarte = risco === 'alto' ? LIMITE_DESCARTE / 2 : LIMITE_DESCARTE;
  if (proporcao('perigoso') >= limiteDescarte) return 'descarte';
  if (proporcao('reaproveitavel') >= LIMITE_RECONDICIONAMENTO) return 'recondicionamento';
  return 'reciclagem';
}

function precificar(componentes, risco, cliente) {
  const base = arredondar(componentes.filter((c) => c.estado === 'reaproveitavel').reduce((t, c) => t + c.valorEstimado, 0), 2);
  if (risco === 'alto') {
    const perigosos = componentes.filter((c) => c.estado === 'perigoso').length;
    return arredondar(Math.max(0, base - perigosos * CUSTO_MANUSEIO_PERIGOSO), 2);
  }
  if (cliente.tipo === 'corporativo' && cliente.saldoBonificacao >= SALDO_MINIMO_PROMOCAO) {
    return arredondar(base * FATOR_PROMOCIONAL, 2);
  }
  return base;
}

/* --------------------------------- clientes (12) --------------------------------- */
const nomesCorporativos = ['Acme Tecnologia', 'Beta Sistemas', 'Gama Informática', 'Delta Contábil', 'Ômega Telecom', 'Sigma Educacional'];
const nomesResidenciais = ['Maria Souza', 'João Pereira', 'Ana Lima', 'Carlos Ribeiro', 'Paula Mendes', 'Rafael Costa'];

const clientes = Array.from({ length: 12 }, (_, i) => {
  const corporativo = i % 2 === 0;
  const nome = corporativo ? nomesCorporativos[i / 2] : nomesResidenciais[(i - 1) / 2];
  return {
    _id: new ObjectId(),
    tipo: corporativo ? 'corporativo' : 'residencial',
    nome,
    documento: corporativo ? `00.000.${zeros(i, 3)}/0001-00` : `000.000.${zeros(i, 3)}-00`, // fictícios
    contato: { email: `contato${i + 1}@exemplo.test`, telefone: `(44) 9${zeros(1000 + i, 4)}-${zeros(2000 + i, 4)}` },
    endereco: {
      logradouro: `Rua Exemplo, ${100 + i * 17}`,
      cidade: 'Maringá',
      uf: 'PR',
      localizacao: geoJson(BASE.latitude + decimal(-0.06, 0.06, 5), BASE.longitude + decimal(-0.06, 0.06, 5)),
    },
    saldoBonificacao: corporativo ? inteiro(0, 300) : inteiro(0, 80),
    criadoEm: new Date(INICIO - inteiro(30, 400) * 24 * HORA_MS),
  };
});

/* ------------------------------ pontos de coleta (10) ------------------------------ */
const pontos = Array.from({ length: 10 }, (_, i) => ({
  _id: new ObjectId(),
  nome: `Ponto ${zeros(i + 1, 2)}`,
  localizacao: geoJson(BASE.latitude + decimal(-0.05, 0.05, 5), BASE.longitude + decimal(-0.05, 0.05, 5)),
  capacidadeKg: escolher([500, 800, 1000, 1500, 2000]),
  status: i === 9 ? 'inativo' : 'ativo',
  sensores: [
    { sensorId: `S-P${zeros(i + 1, 2)}-NIV`, tipo: 'nivelEnchimento' },
    { sensorId: `S-P${zeros(i + 1, 2)}-TMP`, tipo: 'temperatura' },
  ],
}));
const pontosAtivos = pontos.filter((p) => p.status === 'ativo');

/* -------------------------- equipamentos (60) e coletas (30) -------------------------- */
const CATEGORIAS = ['notebook', 'placaMae', 'bateria', 'monitor', 'outro'];
const FABRICANTES = ['Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Samsung', 'LG', 'Positivo'];

function criarEquipamento(indice, clienteId) {
  const categoria = CATEGORIAS[indice % CATEGORIAS.length];
  const fabricante = escolher(FABRICANTES);
  const base = { _id: new ObjectId(), categoria, fabricante, clienteId };
  switch (categoria) {
    case 'notebook':
      return { ...base, modelo: `Modelo N-${inteiro(100, 999)}`, pesoKg: decimal(1.2, 2.1, 2),
        atributosEspecificos: { ramGb: escolher([4, 8, 16]), armazenamentoGb: escolher([256, 512]), telaPolegadas: escolher([13, 14, 15.6]) },
        componentes: [
          { tipo: 'processador', estado: chance(0.85) ? 'reaproveitavel' : 'sucata', valorEstimado: decimal(30, 60, 2), pesoKg: 0.1 },
          { tipo: 'placa', estado: chance(0.8) ? 'reaproveitavel' : 'sucata', valorEstimado: decimal(20, 40, 2), pesoKg: decimal(0.6, 1.0, 2) },
          { tipo: 'carcaca', estado: 'sucata', valorEstimado: 2, pesoKg: decimal(0.5, 1.0, 2) },
        ] };
    case 'placaMae':
      return { ...base, modelo: `Modelo P-${inteiro(100, 999)}`, pesoKg: decimal(0.5, 1.1, 2),
        atributosEspecificos: { socket: escolher(['AM4', 'LGA1200', 'LGA1700']), formato: escolher(['ATX', 'mATX', 'ITX']) },
        componentes: [
          { tipo: 'chipset', estado: chance(0.6) ? 'reaproveitavel' : 'sucata', valorEstimado: decimal(15, 35, 2), pesoKg: 0.05 },
          { tipo: 'circuito', estado: 'sucata', valorEstimado: 3, pesoKg: decimal(0.4, 0.9, 2) },
        ] };
    case 'bateria':
      return { ...base, modelo: `Modelo B-${inteiro(100, 999)}`, pesoKg: decimal(0.2, 0.5, 2),
        atributosEspecificos: { quimica: 'Li-ion', capacidadeMah: escolher([3000, 4000, 5000, 6000]), risco: 'alto' },
        componentes: [
          { tipo: 'celula', estado: chance(0.25) ? 'reaproveitavel' : 'perigoso', valorEstimado: decimal(8, 14, 2), pesoKg: decimal(0.15, 0.4, 2) },
          { tipo: 'involucro', estado: 'sucata', valorEstimado: 1, pesoKg: 0.05 },
        ] };
    case 'monitor':
      return { ...base, modelo: `Modelo M-${inteiro(100, 999)}`, pesoKg: decimal(2.5, 5, 2),
        atributosEspecificos: { telaPolegadas: escolher([19, 22, 24, 27]), resolucao: escolher(['1366x768', '1920x1080']) },
        componentes: [
          { tipo: 'painel', estado: 'sucata', valorEstimado: 8, pesoKg: decimal(1.5, 2.5, 2) },
          { tipo: 'fonte', estado: chance(0.6) ? 'reaproveitavel' : 'sucata', valorEstimado: decimal(10, 20, 2), pesoKg: 0.5 },
          { tipo: 'carcaca', estado: 'sucata', valorEstimado: 1, pesoKg: decimal(0.5, 1.2, 2) },
        ] };
    default:
      return { ...base, modelo: `Modelo O-${inteiro(100, 999)}`, pesoKg: decimal(0.3, 1.5, 2),
        atributosEspecificos: { descricao: escolher(['roteador', 'impressora', 'switch', 'teclado']) },
        componentes: [
          { tipo: 'modulo', estado: chance(0.5) ? 'reaproveitavel' : 'sucata', valorEstimado: decimal(5, 25, 2), pesoKg: decimal(0.1, 0.5, 2) },
          { tipo: 'carcaca', estado: 'sucata', valorEstimado: 1, pesoKg: decimal(0.2, 1, 2) },
        ] };
  }
}

const equipamentos = [];
const coletas = [];
const triagens = [];

for (let j = 0; j < 30; j += 1) {
  const cliente = clientes[j % clientes.length];
  const ponto = pontosAtivos[j % pontosAtivos.length];
  const dataColeta = new Date(INICIO + j * 36 * HORA_MS + inteiro(0, 6) * HORA_MS); // uma coleta a cada ~1,5 dia
  const status = j < 26 ? 'processada' : j < 28 ? 'coletada' : 'agendada';

  const doLote = [criarEquipamento(2 * j, cliente._id), criarEquipamento(2 * j + 1, cliente._id)];
  equipamentos.push(...doLote);

  const coleta = {
    _id: new ObjectId(),
    clienteId: cliente._id,
    pontoDeColetaId: ponto._id,
    dataColeta,
    itens: doLote.map((e) => ({ equipamentoId: e._id, pesoKg: e.pesoKg })),
    status,
  };
  coletas.push(coleta);

  if (status !== 'processada') continue;
  for (const equipamento of doLote) {
    const risco = RISCO[equipamento.categoria];
    const destino = classificarDestino(equipamento.componentes, risco);
    triagens.push({
      _id: new ObjectId(),
      coletaId: coleta._id,
      equipamentoId: equipamento._id,
      pontoDeColetaId: ponto._id,
      destino,
      pesoKg: equipamento.pesoKg,
      co2EvitadoKg: arredondar(equipamento.pesoKg * FATOR_CO2_POR_KG[equipamento.categoria] * MULTIPLICADOR_DESTINO[destino], 3),
      valorPrecificado: precificar(equipamento.componentes, risco, cliente),
      processadoEm: new Date(dataColeta.getTime() + inteiro(2, 30) * HORA_MS),
    });
  }
}

/* ------------------------------ eventos IoT (60) ------------------------------ */
const INICIO_TELEMETRIA = Date.UTC(2026, 9, 28, 0, 0, 0); // 28/10/2026
const eventos = pontos.flatMap((ponto, i) =>
  Array.from({ length: 6 }, (_, k) => {
    const nivel = k % 2 === 0;
    return {
      _id: new ObjectId(),
      pontoDeColetaId: ponto._id,
      sensorId: `S-P${zeros(i + 1, 2)}-${nivel ? 'NIV' : 'TMP'}`,
      tipo: nivel ? 'nivelEnchimento' : 'temperatura',
      valor: nivel ? inteiro(20, 98) : inteiro(20, 60),
      timestamp: new Date(INICIO_TELEMETRIA + k * 6 * HORA_MS + i * 60000),
    };
  }),
);

/* ---------------------------------- inserção ---------------------------------- */
const colecoes = { clientes, pontosDeColeta: pontos, equipamentos, coletas, triagem: triagens, eventosIot: eventos };
let total = 0;
for (const [nome, documentos] of Object.entries(colecoes)) {
  bd.getCollection(nome).deleteMany({});
  bd.getCollection(nome).insertMany(documentos);
  total += documentos.length;
  print(`${nome}: ${documentos.length} documentos`);
}
print(`Total: ${total} documentos inseridos.`);
