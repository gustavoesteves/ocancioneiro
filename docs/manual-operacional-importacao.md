# Manual operacional da importacao local

**Escopo:** ferramenta editorial local; nunca GitHub Pages
**Fluxo suportado:** arquivo MusicXML ou captura da partitura ativa no MuseScore
**Ultimo ensaio automatizado:** 2026-08-14

## Requisitos e compatibilidade

| Componente | Requisito ou estado suportado |
| --- | --- |
| Node.js | `>=22.13.0`; ensaio local tambem executado com `25.8.1` |
| npm | versao compativel com o Node instalado; ensaio local com `11.13.0` |
| MuseScore Studio | `4.7.3` validado no macOS; outras versoes 4.x exigem o checklist manual |
| Plugin | `CancioneiroCapture.qml` v1.0.0 |
| Protocolo | `cancioneiro.musescore.capture/1` |
| Navegador | estacao local a partir de `http://localhost:3000/import` |

O seletor manual de MusicXML nao depende do MuseScore, do plugin ou da ponte.
Uma nova versao do MuseScore so entra na lista validada depois de executar o
[checklist manual](instalacao-plugin-musescore.md#checklist-manual-antes-de-considerar-a-s61-c-aceita).

## Instalar

Na raiz do repositorio:

```bash
npm install
```

Depois instale e habilite o plugin seguindo a
[instalacao do plugin](instalacao-plugin-musescore.md#instalar). A ponte nao e
um servico do sistema: ela e iniciada sob demanda com o proprio repositorio.

## Iniciar o ambiente

Use dois terminais na raiz do repositorio.

Terminal 1 — importador local:

```bash
npm run dev
```

Terminal 2 — ponte dedicada:

```bash
npm run bridge:musescore
```

Abra `http://localhost:3000/import/capturar`, abra uma partitura no MuseScore e abra o
plugin **O Cancioneiro — Captura MusicXML**. O estado esperado no plugin e
`pareado`; no importador, ponte e plugin devem aparecer separadamente como
disponiveis.

## As cinco fronteiras do fluxo

1. **Captura:** a ponte recebe um MusicXML temporario e o importador mostra a
   previa. Cancelar aqui nao grava captura, dossie ou asset.
2. **Revisao:** o editor confere melodia, acordes, titulo, compositor, escopo e
   escolhe explicitamente obra e edicao. A origem tecnica do MuseScore nao e
   fonte editorial da musica.
3. **Confirmacao privada:** o XML bruto e o canonico sao selados por SHA-256 em
   `.local/cancioneiro/`. Uma edicao nova continua `em_revisao`.
4. **Validacao editorial e promocao:** curadoria aceita, edicao valida e
   direitos efetivamente permitidos sao gates obrigatorios. A promocao altera
   a arvore fonte local de forma transacional, mas nao faz deploy.
5. **Publicacao:** somente o processo posterior de revisao no Git, verificacao
   com `npm run check` e GitHub Pages publica o asset autorizado.

Confirmar nao valida. Validar nao promove. Promover nao publica na internet.

## Capturar e confirmar

1. Selecione **Capturar do MuseScore** ou escolha um arquivo no seletor manual.
2. Confira a previa e os metadados extraidos.
3. Confirme que o conteudo e uma lead sheet de melodia e acordes, nao um
   arranjo a ser incorporado a partitura.
4. A tela sugere o destino automaticamente pelo identificador do MusicXML. Se
   a obra for inedita, **Nova obra preparada automaticamente** mostra o
   `work.id` candidato e a futura edicao `em_revisao`; se houver correspondencia
   exata, o dossie existente e sugerido. Confirme ou altere essa escolha antes
   de continuar. Multiplas edicoes ambiguas e divergencias de identidade ainda
   exigem decisao humana explicita.
5. Informe o responsavel e selecione **Confirmar captura privada**.
6. Guarde o `captureId`. Se descartar depois, guarde tambem o `trashId` exibido.

Na opcao **Criar nova obra**, o dossie candidato e a captura privada sao
confirmados como uma unica operacao. Se a selagem da captura falhar, o dossie
provisorio e removido. Se ja existir um dossie com o mesmo identificador, a
criacao e bloqueada e a interface orienta a escolher a obra existente. Essa
operacao nao cria asset nem diretorio em `public/musicxml`.

Verifique a integridade sem imprimir XML, autoria privada ou caminhos:

```bash
npm run captures:ops -- verify <captureId>
```

## Promover e verificar

Depois de confirmar a captura privada, a caixa **Promocao publica separada**
mostra tres gates independentes. Se algum estiver pendente:

1. selecione **Abrir revisao editorial**;
2. confirme a revisao musical e identifique o responsavel;
3. registre a decisao curatorial, sua justificativa e um revisor independente
   diferente de quem tomou a decisao;
4. confirme os direitos somente depois de documentar a base verificada e o
   responsavel;
5. feche a aba de revisao, volte a captura que permaneceu aberta e selecione
   **Atualizar gates**;
6. informe o responsavel pela promocao e selecione **Promover versao validada**.

Essa revisao grava autoria, data e o hash da decisao, mas nao cria nem copia um
asset MusicXML publico. A promocao continua separada e informa seu
`transactionId`. Confirmar direitos na interface e um registro operacional;
nao substitui a verificacao juridica indicada pela politica editorial.

Promova somente depois da revisao de fontes, edicao, curadoria e direitos.
Antes de qualquer envio ao GitHub:

```bash
npm run check
```

Para ensaiar todo o mecanismo sem alterar o catalogo real:

```bash
npm run workflow:musescore:check
```

Esse comando cria uma fixture sintetica em diretorio temporario, confirma a
captura, promove, verifica um pacote com um asset, executa rollback, confirma a
preservacao da captura privada e remove o temporario.

## Revisar e publicar pela interface

Depois da promocao local, abra `/import/publicacao`. A estacao e dividida em:

- `/import`: painel e indicadores;
- `/import/capturar`: MuseScore, arquivo manual, previa e confirmacao privada;
- `/import/acervo`: busca, filtros e dossies;
- `/import/revisao`: capturas privadas e pendencias editoriais;
- `/import/publicacao`: verificacao, branch, pull request, merge e deploy.

Na pagina **Publicacao**:

1. **Verificar mudancas** executa a mesma verificacao completa exigida pelo
   deploy e sela o conjunto atual por hash. Qualquer alteracao posterior exige
   nova verificacao.
2. Informe responsavel e titulo e selecione **Preparar versao**. A ferramenta
   cria uma branch `codex/`, inclui todo o lote revisado e grava o commit.
3. **Enviar para revisao** faz o push e abre o pull request. Nenhum deploy ocorre
   nessa etapa.
4. **Atualizar GitHub** acompanha os checks do PR.
5. **Aprovar e publicar** so fica disponivel com os checks aprovados. A acao
   confirma o merge na `main`; o workflow oficial do GitHub Pages executa o
   deploy.

Arquivos `.local/`, ambientes, saidas geradas e caminhos internos sao
bloqueados. A ferramenta exige confirmacao separada antes de preparar, enviar e
publicar. Os comandos deste manual permanecem como fallback de recuperacao e
automacao, nao como requisito do fluxo editorial cotidiano.

## Corrigir metadados de uma edicao existente

Para corrigir genero, nivel, fonte, notas ou tags sem alterar a partitura:

1. abra `/import/acervo` e selecione a obra;
2. abra o dossie completo;
3. escolha **Editar metadados** ou **Editar esta edicao**;
4. selecione a edicao, revise os cinco campos e salve;
5. confira a mudanca no lote em `/import/publicacao`.

A operacao grava diretamente a edicao em `data/dossiers/`, regenera
`public/catalog.json` e nao escreve em `data/editorial.json`. Um fingerprint
impede sobrescrever alteracoes posteriores e a trava compartilhada impede
concorrencia com uma promocao. Se a regeneracao falhar, dossie e catalogo sao
restaurados. Mudancas em melodia, acordes, forma ou no arquivo MusicXML nao
devem usar este editor; nesses casos, faca uma nova captura e promocao.

O antigo caminho de edicao direta em `PUT /api/import` foi aposentado. Ele
responde `410 Gone` e nao processa o corpo nem altera arquivos. Isso impede que
clientes antigos contornem o dossie, a captura privada e a promocao versionada.
O ramo antigo de exclusao publica em `DELETE /api/import` tambem responde
`410 Gone`; o metodo permanece valido somente quando recebe o `captureId` de uma
captura privada, caso em que executa o descarte recuperavel descrito acima.

## Limite de tamanho

O protocolo possui teto rigido de **16 MiB**. A ponte pode trabalhar com um
limite menor por operacao, por exemplo 8 MiB:

```bash
CANCIONEIRO_MUSESCORE_MAX_CAPTURE_BYTES=8388608 npm run bridge:musescore
```

O valor precisa ser um inteiro entre `1` e `16777216`. Aumentar acima de 16 MiB
e recusado na inicializacao. Elevar o teto exige nova decisao de protocolo,
testes de memoria, timeout e payload, e revisao do plugin; nao altere apenas uma
constante. Reinicie a ponte depois de mudar o limite.

## Diagnostico

| Sintoma ou codigo | Acao |
| --- | --- |
| `ponte ausente` | inicie `npm run bridge:musescore`; o seletor manual continua disponivel |
| `PLUGIN_NOT_READY` | abra o plugin e aguarde `pareado` |
| `NO_ACTIVE_SCORE` | abra ou selecione uma partitura no MuseScore |
| `SESSION_EXPIRED` ou `TOKEN_REJECTED` | reinicie o plugin ou a ponte para renovar a sessao |
| `REQUEST_DUPLICATE` | aguarde ou cancele a captura ativa antes de repetir |
| `REQUEST_EXPIRED` | repita a captura; nada foi confirmado |
| `FILE_TOO_LARGE` | reduza a partitura ou, dentro do teto, ajuste o limite da ponte |
| `INVALID_MUSICXML` | exporte novamente e valide se o documento esta completo |
| `PROMOTION_CONFLICT` | nao force; aguarde a operacao ativa ou recupere apenas apos confirmar que ela encerrou |
| `PROMOTION_RIGHTS_BLOCKED` | corrija a decisao editorial; nao contorne o gate |

Nao cole em chamados o XML, tokens ou caminhos temporarios. Registre somente o
codigo, o momento, o estado visivel e os identificadores editoriais necessarios.

## Encerrar, limpar e recuperar

- encerre a ponte com `Ctrl+C`; seu temporario e removido;
- encerre o servidor local separadamente com `Ctrl+C`;
- na proxima inicializacao, a ponte remove temporarios antigos de processos que
  ja nao existem;
- `staging/` privado e limpo pelas operacoes atomicas;
- nao apague manualmente `.local/cancioneiro/transactions`, `trash` ou
  `captures`.

Para recuperar promocoes interrompidas depois de confirmar que nenhuma
promocao esta ativa:

```bash
npm run captures:ops -- recover-promotions
```

Para restaurar um descarte recuperavel:

```bash
npm run captures:ops -- restore <captureId> <trashId>
```

## Rollback

### Retirar a integracao do MuseScore

1. desabilite o plugin no gerenciador do MuseScore;
2. encerre a ponte com `Ctrl+C`;
3. remova `CancioneiroCapture.qml` da pasta pessoal, se necessario;
4. use o seletor manual em `/import/capturar`.

Isso nao remove capturas confirmadas, dossies, decisoes ou assets historicos.

### Reverter uma promocao comprometida

Use o botao **Reverter esta promocao** imediatamente depois da operacao ou:

```bash
npm run captures:ops -- rollback <transactionId> --by <responsavel>
```

O rollback automatico recusa estados que mudaram depois daquela transacao. Ele
restaura dossie e catalogo anteriores, remove apenas o novo asset e preserva a
captura privada e versoes publicas anteriores. Depois rode `npm run check`.

## Evidencias e pendencias humanas

- [ensaio real do fluxo feliz no MuseScore 4.7.3](evidencias/ensaio-captura-musescore-2026-08-13.md);
- [ensaio automatizado completo com fixture sintetica livre](evidencias/ensaio-operacional-s61-2026-08-14.md);
- [retrospectiva e pendencias classificadas](retrospectiva-sprint-06-1.md).

A sprint somente pode ser encerrada formalmente quando outra pessoa reproduzir
este manual e os cenarios manuais restantes, registrando data, versao do
MuseScore, sistema operacional e resultado, sem dados privados.
