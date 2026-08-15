# Contrato de captura MuseScore v1

**Identificador:** `cancioneiro.musescore.capture/1`
**Status:** implementado para validacao; transporte ainda nao conectado
**Implementacao normativa:** `lib/musescore-capture-protocol.mjs`

## Escopo

Este contrato transporta apenas o resultado da exportacao MusicXML da
partitura ativa. Ele nao possui mensagem para inserir cifras, alterar notas,
layout, metadados ou qualquer outro conteudo no MuseScore.

O contrato separa quatro identidades:

| Campo | Ciclo de vida |
| --- | --- |
| `sessionId` | sessao efemera criada pela ponte |
| `pluginSessionId` | pareamento de uma instancia do plugin |
| `requestId` | uma tentativa de captura |
| `captureId` | resultado imutavel de uma captura concluida |

Titulo, caminho, hash ou nome da partitura nao substituem esses
identificadores.

## Envelope

Toda mensagem contem exatamente:

```json
{
  "protocol": "cancioneiro.musescore.capture/1",
  "messageType": "CAPTURE_REQUEST",
  "messageId": "identificador_opaco_1234",
  "sentAt": "2026-08-13T12:00:01.000Z",
  "payload": {}
}
```

- identificadores sao opacos, possuem entre 16 e 128 caracteres e nao devem
  conter caminho, usuario ou titulo da obra;
- instantes usam UTC em ISO 8601;
- campos desconhecidos sao rejeitados;
- o validador nunca inclui o valor recebido na mensagem de erro.

## Mensagens

### `SESSION_OPEN`

Enviada pelo plugin ao abrir ou renovar o pareamento. Informa `sessionId`,
`pluginSessionId`, versoes do plugin e MuseScore e `supportedProtocols`.

O protocolo selecionado deve estar tanto no envelope quanto na lista declarada.
A ponte da v1 aceita apenas `cancioneiro.musescore.capture/1`. Uma versao futura
nao pode ser tratada silenciosamente como v1.

### `CAPTURE_REQUEST`

Enviada pela ponte ao plugin. Contem as identidades da sessao, `requestId`,
`requestedAt`, `expiresAt`, o unico `destinationPath` autorizado e `maxBytes`.

O caminho e um dado operacional sensivel: pode circular nesse canal local, mas
nao deve aparecer em logs, dossies, catalogo ou respostas publicas.

### `CAPTURE_READY`

Enviada pelo plugin depois de exportar. Correlaciona sessao, plugin e requisicao
e informa `exportedAt`. A ponte confere caminho real, tipo de arquivo, tamanho e
documento, calcula o SHA-256 do XML bruto e gera o `captureId` antes de entregar
a captura ao importador. Tamanho, hash e identidade da captura nunca sao
confiados ao plugin.

### `CAPTURE_FAILED`

Encerra explicitamente uma requisicao que falhou. O erro contem codigo estavel,
mensagem curta sem dados sensiveis e `retryable`.

Codigos v1:

- `BRIDGE_UNAVAILABLE`, `SESSION_EXPIRED`, `PLUGIN_NOT_READY`;
- `NO_ACTIVE_SCORE`, `EXPORT_FAILED`;
- `FILE_NOT_FOUND`, `PATH_MISMATCH`, `SYMLINK_REJECTED`, `FILE_TOO_LARGE`,
  `INVALID_MUSICXML`;
- `REQUEST_EXPIRED`, `REQUEST_DUPLICATE`, `REQUEST_STALE`;
- `INTERNAL_ERROR`.

### `STATUS`

Informa separadamente `bridgeState`, `pluginState` e `captureState`. Quando
existir captura ativa, inclui o `requestId`; caso contrario, usa `null`. Status
nao confirma captura nem autoriza persistencia.

## Limites v1

| Limite | Valor padrao |
| --- | --- |
| Tempo de uma requisicao | 30 segundos |
| Tamanho maximo do MusicXML | 16 MiB |
| Requisicoes simultaneas | 1 |

O processo da ponte pode permitir um limite menor. Aumentar o limite maximo do
protocolo exige revisao de memoria, disco, timeout e testes.

## Correlacao, atraso e duplicacao

Uma resposta so pode atualizar a captura corrente quando `sessionId`,
`pluginSessionId` e `requestId` forem iguais aos da requisicao ativa.

- resposta de sessao anterior: descartar como `REQUEST_STALE`;
- resposta posterior a `expiresAt`: encerrar como `REQUEST_EXPIRED`;
- repeticao de `CAPTURE_READY` para um `requestId` ja concluido: devolver o
  mesmo `captureId` e hash, sem reler ou criar nova captura;
- nova requisicao enquanto outra esta ativa: rejeitar como
  `REQUEST_DUPLICATE`.

O ledger de idempotencia pertence a ponte. O importador tambem deve manter a
correlacao antes de trocar sua previa.

## Falhas de validacao do envelope

O validador runtime usa estes codigos locais:

| Codigo | Significado |
| --- | --- |
| `MALFORMED_MESSAGE` | valor recebido nao e objeto JSON |
| `INVALID_ENVELOPE` | campos do envelope divergem do contrato |
| `UNSUPPORTED_PROTOCOL` | versao nao suportada |
| `UNKNOWN_MESSAGE_TYPE` | mensagem fora da allowlist |
| `INVALID_PAYLOAD` | payload incompleto ou invalido |

Mensagem rejeitada nao altera sessao, fila, captura ou previa. O transporte deve
validar antes de executar qualquer efeito colateral.

## Compatibilidade

Mudancas que adicionem campos, mensagens ou semantica exigem novo identificador
de protocolo. Correcoes que apenas endurecam a rejeicao de dados ja invalidos
podem manter a v1. A negociacao falha fechada quando plugin e ponte nao possuem
uma versao em comum.

Fixtures validas e invalidas estao em
`tests/fixtures/musescore-protocol/`. Elas sao exemplos executaveis do contrato,
nao dados de uma partitura real.
