// EcoLogitech - 04: Replica Set e Sharding (comandos de referência).
// NÃO executar em instância standalone. Rode cada bloco no ambiente indicado.
//
// ---------------------------------------------------------------------------------------------
// A) REPLICA SET (alta disponibilidade) - 3 nós, 1 primário + 2 secundários
// ---------------------------------------------------------------------------------------------
// mongosh --host mongo1:27017
// rs.initiate({
//   _id: 'rsEcoLogitech',
//   members: [
//     { _id: 0, host: 'mongo1:27017', priority: 2 },
//     { _id: 1, host: 'mongo2:27017', priority: 1 },
//     { _id: 2, host: 'mongo3:27017', priority: 1 },
//   ],
// });
// rs.status();   // verificar PRIMARY/SECONDARY
//
// Conexão da aplicação (escrita segura + leitura analítica nos secundários):
//   mongodb://mongo1,mongo2,mongo3/ecologitech?replicaSet=rsEcoLogitech&w=majority&readPreference=secondaryPreferred
//   - w=majority: a escrita só é confirmada quando a maioria dos nós a replicou (tolera queda de 1 nó).
//   - Relatórios (aggregation) podem usar readPreference=secondaryPreferred para aliviar o primário.
//
// ---------------------------------------------------------------------------------------------
// B) SHARDING (escala horizontal) - executar no mongos de um cluster shardado
// ---------------------------------------------------------------------------------------------
// sh.enableSharding('ecologitech');
//
// triagem: alto volume de escrita no processamento em lote.
//   Chave HASHED em coletaId: cardinalidade alta (uma por coleta) e distribuição uniforme entre shards;
//   consultas por coletaId (índice coletaId+destino) são direcionadas a um único shard.
// sh.shardCollection('ecologitech.triagem', { coletaId: 'hashed' });
//
// eventosIot: telemetria contínua (maior volume do sistema).
//   Chave composta {pontoDeColetaId, timestamp}: consultas "últimas leituras do ponto X" vão a poucos shards,
//   e o timestamp como 2º campo evita que todas as escritas recentes caiam no mesmo chunk (o 1º campo varia por ponto).
// sh.shardCollection('ecologitech.eventosIot', { pontoDeColetaId: 1, timestamp: 1 });
//
// Coleções pequenas e muito lidas (clientes, pontosDeColeta) permanecem não shardadas no shard primário;
// equipamentos e coletas só precisam ser shardadas quando o volume justificar (ex.: chave hashed em _id).
//
// Observabilidade:  sh.status();  db.triagem.getShardDistribution();
