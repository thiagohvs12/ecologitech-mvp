import subprocess, html

def classe(nome, atributos=(), metodos=(), estereotipo=None, abstrata=False, cor="#FFFFFF"):
    t = f'<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" BGCOLOR="{cor}">'
    cab = ''
    if estereotipo:
        cab += f'<FONT POINT-SIZE="9">«{estereotipo}»</FONT><BR/>'
    nm = f'<I>{html.escape(nome)}</I>' if abstrata else f'<B>{html.escape(nome)}</B>'
    t += f'<TR><TD ALIGN="CENTER">{cab}{nm}</TD></TR>'
    t += '<HR/>'
    t += '<TR><TD ALIGN="LEFT" BALIGN="LEFT">' + ('<BR/>'.join(html.escape(a) for a in atributos) if atributos else ' ') + '</TD></TR>'
    t += '<HR/>'
    t += '<TR><TD ALIGN="LEFT" BALIGN="LEFT">' + ('<BR/>'.join(html.escape(m) for m in metodos) if metodos else ' ') + '</TD></TR>'
    return t + '</TABLE>>'

def dot(nome, nos, arestas, extra="", rankdir='BT', nodesep=0.35, ranksep=0.7):
    s = ['digraph G {', f'graph [rankdir={rankdir}, nodesep={nodesep}, ranksep={ranksep}, fontname="Liberation Sans", pad=0.15];',
         'node [shape=plaintext, fontname="Liberation Sans", fontsize=10];', 'edge [fontname="Liberation Sans", fontsize=9];', extra]
    for k, v in nos.items(): s.append(f'{k} [label={v}];')
    s += arestas
    s.append('}')
    open(f'{nome}.dot', 'w').write('\n'.join(s))
    subprocess.run(['dot', '-Tpng', '-Gdpi=200', f'{nome}.dot', '-o', f'{nome}.png'], check=True)

HERDA = 'arrowhead=empty'
REAL = 'arrowhead=empty, style=dashed'
DEP = 'arrowhead=vee, style=dashed'
ASSOC = 'arrowhead=none'
AGREG = 'arrowhead=none, arrowtail=odiamond, dir=back'
COMP = 'arrowhead=none, arrowtail=diamond, dir=back'


# ---------- Fig 1: entidades do domínio ----------
nos = {
 'Cliente': classe('Cliente', ['id: Id','tipo: TipoCliente','nome, documento: string','endereco: Endereco','saldoBonificacao: number'], ['creditarBonificacao(valor): Cliente']),
 'Ponto': classe('PontoDeColeta', ['id: Id','nome: string','localizacao: Coordenada','capacidadeKg: number','status: StatusPonto','sensores: Sensor[]'], ['estaAtivo(): boolean','comportaCarga(kg): boolean']),
 'Coleta': classe('Coleta', ['id: Id','dataColeta: Date','itens: ItemColeta[]','status: StatusColeta'], ['comStatus(status): Coleta','pesoTotalKg(): number']),
 'Evento': classe('EventoIoT', ['id: Id','sensorId: string','tipo: TipoSensor','valor: number','timestamp: Date']),
 'Equip': classe('Equipamento', ['id: Id','fabricante, modelo: string','pesoKg: number','atributosEspecificos: Record','componentes: Componente[]'], ['categoria(): Categoria','nivelRisco(): NivelRisco'], estereotipo='abstract', abstrata=True),
 'Triagem': classe('Triagem', ['id: Id','destino: DestinoTriagem','pesoKg: number','co2EvitadoKg: number','valorPrecificado: number','processadoEm: Date']),
}
arestas = [
 'Coleta -> Cliente [%s, headlabel="1", taillabel="0..*", label="  solicitada por"];' % ASSOC,
 'Coleta -> Ponto [%s, headlabel="1", taillabel="0..*", label="  recebida em"];' % ASSOC,
 'Evento -> Ponto [%s, headlabel="1", taillabel="0..*", label="  emitido por"];' % ASSOC,
 'Equip -> Cliente [%s, headlabel="1", taillabel="0..*", label="  pertence a"];' % ASSOC,
 'Equip -> Coleta [arrowhead=odiamond, headlabel="1", taillabel="1..*", label="  itens"];',
 'Triagem -> Coleta [%s, headlabel="1", taillabel="0..*", label="  resulta de"];' % ASSOC,
 'Triagem -> Equip [%s, headlabel="1", taillabel="0..1", label="  classifica"];' % ASSOC,
 '{rank=same; Equip; Triagem}',
]
dot('fig1_dominio', nos, arestas)

# ---------- Fig 2: hierarquia de Equipamento + Factory ----------
nos = {
 'Equip': classe('Equipamento', ['id, fabricante, modelo','clienteId, pesoKg','atributosEspecificos','componentes: Componente[]'], ['categoria(): Categoria','nivelRisco(): NivelRisco'], estereotipo='abstract', abstrata=True),
 'Notebook': classe('Notebook', [], ['nivelRisco() = medio']),
 'Placa': classe('PlacaMae', [], ['nivelRisco() = baixo']),
 'Bateria': classe('Bateria', [], ['nivelRisco() = alto']),
 'Monitor': classe('Monitor', [], ['nivelRisco() = medio']),
 'Generico': classe('EquipamentoGenerico', [], ['nivelRisco() = baixo']),
 'Fabrica': classe('EquipamentoFactory', [], ['criar(categoria, props): Equipamento'], estereotipo='Factory'),
}
arestas = [f'{n} -> Equip [{HERDA}];' for n in ['Notebook','Placa','Bateria','Monitor','Generico']] + ['Fabrica -> Equip [%s, label="«create»"];' % DEP]
dot('fig2_equipamento', nos, arestas, rankdir='LR', nodesep=0.12, ranksep=0.9)

# ---------- Fig 3: Strategy de precificação ----------
nos = {
 'Regra': classe('RegraDePrecificacao', ['nome: string'], ['precificar(componentes): number'], estereotipo='interface / Strategy', cor='#F3F6FB'),
 'Padrao': classe('PrecificacaoPadrao', [], ['precificar(): soma dos aproveitáveis']),
 'Promo': classe('PrecificacaoPromocional', [], ['precificar(): soma × 1,10']),
 'Risco': classe('PrecificacaoRisco', [], ['precificar(): soma − custo de manuseio']),
}
arestas = [f'{n} -> Regra [{REAL}];' for n in ['Padrao','Promo','Risco']]
dot('fig3_strategy', nos, arestas, rankdir='LR', nodesep=0.15, ranksep=0.9)

# ---------- Fig 4: serviços e persistência ----------
nos = {
 'SColeta': classe('ServicoColeta', [], ['registrarColeta(solicitacao)','processarColeta(id)']),
 'STriagem': classe('ServicoTriagem', [], ['triar(coleta, equip., cliente)']),
 'SBonif': classe('ServicoBonificacao', [], ['apurar()','creditar(apuracao)']),
 'SRotas': classe('ServicoRotas', [], ['planejarColetasAgendadas(base)']),
 'Repo': classe('Repositorio<T>', [], ['salvar(e)','salvarVarios(es)','buscarPorId(id)','listar(filtro)'], estereotipo='interface / Repository', cor='#F3F6FB'),
 'RMem': classe('RepositorioMemoria<T>', [], ['testes e demonstração']),
 'RMongo': classe('RepositorioMongo<T>', ['colecao: Collection','serializador: Serializador<T>']),
 'Regra': classe('RegraDePrecificacao', [], ['precificar(componentes)'], estereotipo='interface / Strategy', cor='#F3F6FB'),
 'Fab': classe('EquipamentoFactory', [], ['criar(categoria, props)'], estereotipo='Factory'),
}
arestas = [
 'SColeta -> STriagem [%s, label="usa"];' % DEP, 'SColeta -> Fab [%s];' % DEP,
 'SColeta -> Repo [%s];' % DEP, 'SBonif -> Repo [%s];' % DEP, 'SRotas -> Repo [%s];' % DEP,
 'STriagem -> Regra [%s];' % DEP,
 'RMem -> Repo [%s];' % REAL, 'RMongo -> Repo [%s];' % REAL,
]
dot('fig4_servicos', nos, arestas, rankdir='LR', nodesep=0.12, ranksep=0.8)

# ---------- Fig 5: concorrência e Observer ----------
nos = {
 'STelem': classe('ServicoTelemetria', ['alertas: AlertaListener'], ['ingerirLote(lote)']),
 'Proc': classe('ProcessadorDeEventos', ['semaforo: Semaphore','mutex: Mutex'], ['ingerirLote(lote)','estatisticas()']),
 'Mutex': classe('Mutex', [], ['executar(secaoCritica)']),
 'Sema': classe('Semaphore', ['limite: number'], ['executar(tarefa)']),
 'Pub': classe('PublicadorDeEventos', [], ['inscrever(ouvinte)','publicar(evento)'], estereotipo='Subject'),
 'Listener': classe('EventoIoTListener', [], ['aoReceber(evento)'], estereotipo='interface / Observer', cor='#F3F6FB'),
 'Alerta': classe('AlertaDeEnchimentoListener', ['alertas: Alerta[]'], ['aoReceber(evento)','obterAlertas()']),
}
arestas = [
 'STelem -> Proc [%s, label="1"];' % COMP,
 'Proc -> Sema [%s, label="1"];' % COMP, 'Proc -> Mutex [%s, label="1"];' % COMP,
 'Proc -> Pub [arrowhead=vee, label="usa"];',
 'Pub -> Listener [arrowhead=vee, headlabel="0..*"];',
 'Alerta -> Listener [%s];' % REAL,
]
dot('fig5_concorrencia', nos, arestas, rankdir='BT', nodesep=0.15, ranksep=0.55)
print('ok')
