# Sprint 6.1 — Captura segura do MuseScore

**Status:** em aceite humano — S6.1-A a S6.1-G concluidas; S6.1-H implementada, revisao independente pendente
**Pre-requisito:** gate minimo de direitos e exclusao de assets bloqueados da Sprint 6
**Decisao arquitetural:** [ADR 0002 — Captura de MusicXML do MuseScore por ponte local](../adr/0002-captura-musescore-ponte-local.md)
**Origem tecnica avaliada:** Find Chord, projeto local licenciado sob MIT
**Contrato v1:** [Contrato de captura MuseScore v1](../contrato-captura-musescore-v1.md)
**Operacao da ponte:** [Operacao da ponte local do MuseScore](../operacao-ponte-musescore.md)
**Instalacao do plugin:** [Instalacao do plugin de captura](../instalacao-plugin-musescore.md)
**Capturas privadas:** [Operacao das capturas privadas](../operacao-capturas-privadas.md)
**Promocao:** [Operacao de promocao do MusicXML](../operacao-promocao-musicxml.md)
**Manual completo:** [Manual operacional da importacao local](../manual-operacional-importacao.md)
**Ensaio real:** [Evidencia de captura no MuseScore em 2026-08-13](../evidencias/ensaio-captura-musescore-2026-08-13.md)
**Ensaio operacional:** [Evidencia automatizada de 2026-08-14](../evidencias/ensaio-operacional-s61-2026-08-14.md)
**Retrospectiva:** [Decisao e pendencias classificadas](../retrospectiva-sprint-06-1.md)

## Objetivo

Permitir que um editor capture o MusicXML da partitura ativa no MuseScore e o
leve ao fluxo editorial do Cancioneiro com previa, proveniencia, revisao e
promocao segura, sem gravacao publica automatica.

## Resultado esperado

Ao final da sprint, o editor consegue:

1. iniciar a ponte local do Cancioneiro;
2. abrir uma partitura no MuseScore com o plugin instalado;
3. selecionar `Capturar do MuseScore` no importador;
4. confirmar visualmente qual partitura foi recebida;
5. comparar os metadados com um dossie existente;
6. salvar uma captura privada vinculada a obra e edicao;
7. revisar e promover o asset por uma operacao separada;
8. verificar que uma captura bloqueada nunca entra no build publico.

O seletor manual de MusicXML permanece como fallback equivalente.

## Fora de escopo

- inserir ou alterar cifras no MuseScore;
- sincronizacao continua da partitura;
- importar arranjos como lead sheets sem decisao editorial;
- inferir automaticamente obra ou edicao apenas pelo titulo;
- validar direitos automaticamente;
- expor a ponte no site publico;
- compartilhar o processo em rede local;
- substituir o MusicXML bruto por snapshot analitico;
- suportar outros editores de notacao nesta sprint.

## Dependencias e porta de entrada

A implementacao so comeca quando estes itens da Sprint 6 estiverem demonstrados
por teste:

- asset bloqueado fica ausente do pacote publicado;
- URL manual de asset bloqueado nao resolve;
- `nao_avaliada` falha fechada;
- metadados podem permanecer publicos sem entregar a partitura;
- a ferramenta de escrita local nao funciona na distribuicao publica;
- existe procedimento de retirada e rollback sem perda de historico.

Se a porta de entrada nao estiver satisfeita, a sprint pode desenvolver apenas
o protocolo e a ponte isolada; nao deve conecta-los a persistencia ou
publicacao.

## Pacotes de trabalho

### S6.1-A — Contrato de captura v1

**Objetivo:** definir mensagens e invariantes antes de implementar transporte.

Tarefas:

- [x] definir envelope versionado `cancioneiro.musescore.capture/1`;
- [x] definir mensagens `SESSION_OPEN`, `CAPTURE_REQUEST`, `CAPTURE_READY`,
  `CAPTURE_FAILED` e `STATUS`;
- [x] definir schemas runtime para cada payload;
- [x] separar `sessionId`, `pluginSessionId`, `requestId` e `captureId`;
- [x] definir timeout, tamanho maximo e codigos de erro estaveis;
- [x] definir politica para resposta atrasada e requisicao duplicada;
- [x] documentar compatibilidade e negociacao de versao;
- [x] criar fixtures validas e invalidas do protocolo.

Aceite:

- mensagem desconhecida e rejeitada sem efeito colateral;
- payload incompleto falha com codigo acionavel;
- resposta de outro `requestId` nao atualiza a captura corrente;
- contrato nao contem operacoes de mutacao da partitura.

### S6.1-B — Ponte local dedicada

**Objetivo:** transportar o XML bruto com fronteira local segura.

Tarefas:

- [x] criar processo local separado do servidor web do Cancioneiro;
- [x] escutar somente em loopback e permitir porta configuravel ou efemera;
- [x] gerar tokens distintos para navegador e plugin;
- [x] implementar allowlist exata das origens locais do importador;
- [x] criar diretorio e nome de arquivo temporarios imprevisiveis;
- [x] validar caminho real, arquivo regular, extensao e tamanho em bytes;
- [x] rejeitar links simbolicos e caminhos alternativos;
- [x] validar que o conteudo e MusicXML completo antes de entrega-lo;
- [x] calcular SHA-256 do XML bruto;
- [x] limpar temporarios no encerramento e ao iniciar apos falha anterior;
- [x] limitar fila, expirar requisicoes e registrar metricas sem dados sensiveis;
- [x] fornecer status separado para ponte, plugin e captura ativa.

Aceite:

- a ponte nao aceita conexao por interface de rede externa;
- origem publica do site e rejeitada;
- token incorreto, caminho diferente ou arquivo grande sao rejeitados;
- a resposta inclui o XML exato e seu SHA-256;
- reinicio nao reaproveita tokens nem sessao anterior;
- nenhum XML ou caminho local aparece nos logs operacionais.

### S6.1-C — Plugin do MuseScore

**Objetivo:** exportar a partitura ativa sob demanda, sem editar seu conteudo.

Tarefas:

- [x] criar plugin identificado como componente do Cancioneiro;
- [x] parear com a ponte e renovar sessao apos reinicio;
- [x] mostrar estados `ponte ausente`, `pareado`, `exportando`, `enviado` e
  `falhou`;
- [x] recusar captura quando nao houver partitura ativa;
- [x] exportar MusicXML para o unico caminho fornecido pela sessao;
- [x] devolver o `requestId` recebido;
- [x] impedir duas exportacoes concorrentes da mesma requisicao;
- [x] encerrar corretamente requisicao quando a exportacao falhar;
- [x] documentar instalacao, atualizacao e remocao do plugin.

Implementacao concluida. Os criterios de aceite permanecem pendentes ate o
[checklist manual](../instalacao-plugin-musescore.md#checklist-manual-antes-de-considerar-a-s61-c-aceita)
ser executado no MuseScore real.

Aceite:

- o plugin nao contem escrita no repositorio nem URL publica;
- trocar de partitura antes da confirmacao fica visivel ao editor;
- erro de exportacao chega ao importador, sem timeout silencioso;
- nenhuma funcao altera notas, cifras, layout ou metadados da partitura.

### S6.1-D — Entrada no importador

**Objetivo:** unificar captura do MuseScore e selecao manual na mesma revisao.

Tarefas:

- [x] adicionar acao `Capturar do MuseScore` apenas em ambiente local;
- [x] mostrar status independente da ponte e do plugin;
- [x] exibir titulo, compositor, numero de partes e hash da captura;
- [x] carregar o XML recebido na previa existente;
- [x] executar as mesmas validacoes aplicadas ao arquivo manual;
- [x] exigir escolha explicita de dossie e edicao;
- [x] comparar metadados e destacar divergencias antes de salvar;
- [x] alertar quando a partitura parece conter arranjo alem de melodia e cifras;
- [x] permitir cancelar sem criar arquivo, dossie ou asset;
- [x] manter o seletor manual funcional quando a ponte estiver ausente.

Aceite:

- os dois modos de entrada produzem o mesmo modelo de pre-importacao;
- captura nao confirmada nao altera o repositorio;
- divergencia de identidade exige confirmacao explicita;
- falha da ponte nao impede importacao manual;
- respostas antigas nao substituem a previa atual.

### S6.1-E — Persistencia privada e proveniencia

**Objetivo:** preservar a captura sem expo-la no repositorio ou no build.

Tarefas:

- [x] definir area privada fora de `public/` e ignorada pelo Git;
- [x] criar registro imutavel de captura com os campos da ADR 0002;
- [x] preservar XML bruto antes de alterar metadados de exibicao;
- [x] calcular separadamente hash bruto e hash canonico;
- [x] vincular captura a `work.id` e `edition.id`, sem inferi-los pelo arquivo;
- [x] registrar `musescore_export` como proveniencia tecnica, nao como fonte;
- [x] criar edicao importada em `em_revisao` quando ela ainda nao existir;
- [x] impedir que asset privado receba caminho sob `/musicxml/`;
- [x] oferecer cancelamento sem persistencia e descarte recuperavel apos confirmacao;
- [x] ocultar caminhos locais em dossies, respostas e relatorios publicos.

Aceite:

- `git status` nao inclui XML privado apos uma captura;
- build e catalogo ignoram completamente a area privada;
- XML bruto pode ser verificado pelo hash registrado;
- captura nao cria edicao `valida` por omissao;
- dossie nao registra nome de usuario ou caminho da maquina.

### S6.1-F — Confirmacao, idempotencia e promocao

**Objetivo:** evitar estado parcial, sobrescrita e publicacao acidental.

Tarefas:

- [x] separar endpoints ou comandos de `capture`, `confirm` e `promote`;
- [x] tratar `captureId` e SHA-256 repetidos de forma idempotente;
- [x] preparar dossie, asset e catalogo em transacao de arquivos recuperavel;
- [x] validar tudo antes de mover o asset para a arvore publica;
- [x] exigir edicao valida e permissoes efetivas na promocao;
- [x] versionar substituicao sem apagar o asset anterior;
- [x] manter o catalogo anterior quando qualquer etapa falhar;
- [x] criar rotina de recuperacao de transacao interrompida;
- [x] impedir promocoes concorrentes que possam divergir o catalogo;
- [x] registrar separadamente quem confirmou e quem promoveu cada versao.

Aceite:

- falha entre escrita do XML e atualizacao do dossie nao deixa asset publico;
- repetir a mesma captura nao cria nova versao;
- substituir por conteudo diferente cria nova versao e encadeia historico;
- permissao retirada durante a operacao cancela a promocao;
- uma promocao concorrente perde de forma segura e informa conflito;
- rollback restaura catalogo e asset vigentes anteriores.

### S6.1-G — Testes e observabilidade

**Objetivo:** provar o fluxo sem depender de automacao grafica do MuseScore no
CI.

Tarefas:

- [x] iniciar a ponte em porta efemera durante testes;
- [x] implementar plugin simulado que exporta fixtures MusicXML;
- [x] testar token, origem, path traversal, symlink, limite e timeout;
- [x] testar correlacao, resposta atrasada, duplicacao e troca de sessao;
- [x] testar XML invalido, arquivo vazio e partitura acima do limite;
- [x] testar divergencia de titulo, compositor e obra escolhida;
- [x] testar hash bruto diferente do canonico;
- [x] testar falhas injetadas em cada etapa da promocao;
- [x] inspecionar pacote final para ausencia de capturas privadas e bloqueadas;
- [x] manter teste manual curto com MuseScore em ambiente suportado;
- [x] registrar logs estruturados redigidos e codigos de erro estaveis.

Aceite:

- suite automatica cobre o fluxo feliz e cada fronteira de seguranca;
- testes de transporte nao exigem MuseScore instalado;
- checklist manual confirma uma versao suportada do MuseScore;
- nenhum teste deixa processo, porta ou arquivo temporario apos concluir.

### S6.1-H — Operacao e entrega

**Objetivo:** tornar o fluxo repetivel por outro editor.

Tarefas:

- [x] documentar requisitos e versoes suportadas;
- [x] documentar instalacao da ponte e do plugin;
- [x] documentar inicio, diagnostico e encerramento;
- [x] explicar diferenca entre captura, revisao, validacao e publicacao;
- [x] documentar limite de tamanho e como ajusta-lo com seguranca;
- [x] documentar limpeza e recuperacao de temporarios;
- [x] criar procedimento de rollback da integracao;
- [x] executar ensaio completo com fixture sem restricao de direitos;
- [ ] revisar a documentacao com uma pessoa que nao implementou o fluxo.

O item restante e deliberadamente humano e esta classificado como P2 na
[retrospectiva](../retrospectiva-sprint-06-1.md). Ele bloqueia o encerramento
formal, sem esconder o estado ja demonstrado pela suite automatizada.

Aceite:

- outro editor conclui a captura seguindo somente a documentacao;
- problemas comuns produzem diagnostico acionavel;
- remover plugin e ponte devolve o sistema ao seletor manual;
- rollback nao remove dossies, decisoes ou assets historicos.

## Ordem de implementacao

```text
porta de entrada da Sprint 6
          |
          v
S6.1-A contrato
     |            \
     v             v
S6.1-B ponte    S6.1-C plugin
     \             /
      v           v
       S6.1-D importador
              |
              v
       S6.1-E persistencia privada
              |
              v
       S6.1-F promocao atomica
              |
              v
       S6.1-G testes
              |
              v
       S6.1-H operacao
```

O contrato deve vir primeiro. Ponte e plugin podem avancar em paralelo depois
dele. Persistencia e promocao nao devem ser conectadas antes da demonstracao do
gate de direitos.

## Matriz minima de testes

| Caso | Resultado obrigatorio |
| --- | --- |
| ponte ausente | importador explica e mantem selecao manual |
| plugin ausente | ponte online, captura desabilitada com motivo |
| nenhuma partitura ativa | falha explicita, sem arquivo criado |
| origem publica | conexao rejeitada |
| token incorreto | operacao rejeitada sem revelar token esperado |
| caminho diferente do autorizado | captura rejeitada |
| link simbolico | captura rejeitada |
| XML invalido | captura nao confirmavel |
| resposta antiga | previa atual permanece intacta |
| mesma captura repetida | nenhum asset duplicado |
| metadados divergentes | confirmacao explicita obrigatoria |
| edicao em revisao | promocao bloqueada |
| direitos nao avaliados | promocao bloqueada |
| asset permitido | promocao atomica e catalogo consistente |
| falha durante promocao | pacote publico anterior preservado |
| retirada posterior | asset ausente do proximo pacote, historico preservado |

## Criterios de aceite da sprint

- captura real funciona em uma versao documentada do MuseScore;
- o XML bruto recebido e verificavel por SHA-256;
- nenhuma captura escreve diretamente em `public/`;
- obra e edicao sao escolhidas explicitamente;
- captura tecnica nao torna edicao valida;
- direitos continuam deny-by-default;
- substituicao e historica, idempotente e recuperavel;
- falhas nao deixam catalogo, dossie e asset em estados divergentes;
- site publicado nao acessa a ponte nem contem capturas privadas;
- suite automatica e checklist manual passam;
- seletor de arquivo continua funcionando sem a ponte.

## Definicao de pronto

A sprint so pode ser encerrada quando:

- todos os criterios de aceite possuem evidencia de teste;
- contratos e fixtures estao versionados;
- documentacao operacional foi reproduzida por outra pessoa;
- nenhum token, caminho local ou XML privado aparece em logs versionados;
- o pacote de publicacao foi inspecionado;
- rollback foi ensaiado;
- pendencias remanescentes estao classificadas por severidade e responsavel;
- a retrospectiva decide se a ponte deve continuar dedicada ou virar componente
  compartilhado com o Find Chord.

## Rollback

O rollback funcional consiste em:

1. desabilitar a acao `Capturar do MuseScore`;
2. encerrar e remover a ponte e o plugin;
3. manter o seletor manual de arquivo;
4. preservar capturas confirmadas e todo o historico editorial;
5. retirar do pacote apenas assets cuja promocao deva ser revertida;
6. regenerar e verificar catalogo e build com o gate de direitos.

Nenhum rollback deve apagar obra, edicao, decisao ou versao historica.
