# EcoLogitech MVP — logística reversa de e-waste (NoSQL + multiparadigma)

AEP – Atividade de Estudos Programados (Unicesumar, Engenharia de Software, 6º semestre) — **2ª entrega**.

MVP em **TypeScript (Node.js ≥ 20)** com **MongoDB 7**, combinando três paradigmas:

| Paradigma | Onde está | O que faz |
|---|---|---|
| **Funcional** | `src/funcional/` | Triagem, precificação, CO₂ evitado, bonificação e rotas como **funções puras** (`map`/`filter`/`reduce`, recursão, imutabilidade) |
| **Concorrente/Assíncrono** | `src/concorrente/` | Recebimento simultâneo de eventos IoT de 10+ pontos (`async/await`, `Mutex`, `Semaphore`, Observer) |
| **Orientado a Objetos** | `src/dominio/`, `src/aplicacao/`, `src/infra/` | Entidades, Factory, Strategy, Repository, Observer e injeção de dependências por construtor |

## Pré-requisitos
Node.js 20+, npm, Docker (para o MongoDB) e `mongosh` (ou use `docker compose exec mongo mongosh`).

## Passo a passo

```bash
npm install

# 1) Testes automatizados (47 casos, não precisam de banco)
npm test

# 2) Demonstração em memória (módulos funcional, concorrente e POO)
npm run demo

# 3) Banco de dados
docker compose up -d
mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" mongo/01_criar_colecoes.js
mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" mongo/02_popular.js     # 224 documentos
mongosh "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true" mongo/03_consultas.js   # 6 pipelines

# 4) Aplicação integrada ao MongoDB (serviços gravando no banco + pipelines devolvidas à aplicação)
npm run demo:mongo
```

Variável opcional: `MONGODB_URI` (padrão `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true`).

## Estrutura

```
mongo/        01 coleções + $jsonSchema + índices | 02 população | 03 pipelines | 04 replica set/sharding
src/
  dominio/    entidades, EquipamentoFactory, estratégias de precificação (Strategy)
  funcional/  funções puras (triagem, precificação, impacto, bonificação, rotas, pipe)
  concorrente/ Mutex, Semaphore, ProcessadorDeEventos, Observer, simulação e demo de corrida de dados
  aplicacao/  serviços (injeção por construtor) e composition root (container.ts)
  infra/      Repositorio (interface), memória, MongoDB, serializadores, conversão de ObjectId, pipelines
tests/        47 testes (node:test)
docs/diagramas/  diagramas de classes UML (PNG, gerados com Graphviz)
```

## Observações
- Os fatores de CO₂ e os valores são **ilustrativos** (domínio fictício), não dados oficiais.
- A `ServicoBonificacao.creditar` deve ser chamada **uma vez** por apuração (MVP sem controle de idempotência).
- Os dados de `02_popular.js` são determinísticos (semente fixa) e os documentos/CPF/CNPJ são fictícios.
