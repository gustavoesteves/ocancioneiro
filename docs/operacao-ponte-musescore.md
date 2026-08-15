# Operacao da ponte local do MuseScore

**Status:** ponte implementada e testada; fluxo feliz do plugin ensaiado no MuseScore real
**Contrato:** [Contrato de captura MuseScore v1](contrato-captura-musescore-v1.md)
**Plugin:** [Instalacao do plugin de captura](instalacao-plugin-musescore.md)

## Responsabilidade

A ponte e um processo local separado do Cancioneiro. Ela recebe um pedido do
importador, fornece ao plugin um unico caminho temporario e so devolve o
MusicXML depois de validar arquivo, tamanho, documento e SHA-256.

Ela nao grava em `public/`, nao altera dossies e nao publica catalogo. Encerrar
a ponte mantem o seletor manual do importador como fallback.

## Iniciar e encerrar

Em outro terminal, na raiz do repositorio:

```bash
npm run bridge:musescore
```

A ponte escuta por padrao em `127.0.0.1:47631`. `Ctrl+C` encerra o processo e
remove seu diretorio temporario. Um encerramento abrupto e recuperado na proxima
inicializacao quando o processo proprietario nao existe mais.

O plugin esta em `plugins/CancioneiroCapture.qml`. Sua instalacao na pasta
pessoal do MuseScore permanece uma operacao manual e explicita. O fluxo feliz
foi ensaiado no MuseScore Studio 4.7.3; os cenarios de recuperacao continuam no
checklist manual.

## Configuracao

Variaveis opcionais:

| Variavel | Uso |
| --- | --- |
| `CANCIONEIRO_MUSESCORE_BRIDGE_PORT` | porta local; o padrao e `47631` |
| `CANCIONEIRO_IMPORT_ORIGINS` | origens HTTP locais separadas por virgula |
| `CANCIONEIRO_MUSESCORE_MAX_CAPTURE_BYTES` | limite inteiro por captura, de 1 byte a 16 MiB |

Somente `localhost`, `127.0.0.1` e `::1` sao aceitos como origens. Configurar
uma origem publica interrompe a inicializacao. O endereco de bind nao e
configuravel: permanece `127.0.0.1`.

## Limites e estados

- uma captura ativa por vez;
- timeout de 30 segundos;
- MusicXML de ate 16 MiB;
- tokens distintos e efemeros para navegador e plugin;
- sessoes e tokens novos a cada reinicio;
- no maximo duas capturas concluidas mantidas em memoria para entrega local.

O status distingue ponte, plugin e captura. XML, tokens e caminhos locais nao
sao escritos nos logs operacionais.

O teto de 16 MiB pertence ao protocolo. A variavel de ambiente pode somente
reduzi-lo; valores maiores ou fracionarios impedem a inicializacao. Consulte o
[manual operacional](manual-operacional-importacao.md#limite-de-tamanho) antes
de alterar esse limite.

## Endpoints locais v1

| Endpoint | Papel |
| --- | --- |
| `GET /api/v1/session` | abre sessao para o importador local |
| `GET /api/v1/status` | informa estados separados |
| `POST /api/v1/captures` | cria pedido de captura |
| `GET /api/v1/captures/:requestId` | consulta resultado validado |
| `GET /api/v1/plugin-session` | abre ou recupera sessao do plugin |
| `GET /api/v1/plugin/events` | entrega pedido pendente ao plugin |
| `POST /api/v1/plugin/messages` | recebe mensagens validadas do plugin |

Esses endpoints sao contrato operacional interno. Clientes devem usar os
headers de sessao fornecidos pela ponte e nunca persistir tokens.

## Diagnostico seguro

- `ORIGIN_REJECTED`: origem nao esta na allowlist local;
- `TOKEN_REJECTED` ou `SESSION_EXPIRED`: reinicie o pareamento;
- `PLUGIN_NOT_READY`: abra o plugin e aguarde o estado pareado;
- `REQUEST_DUPLICATE`: ja existe uma captura ativa;
- `REQUEST_EXPIRED`: repita a captura;
- `SYMLINK_REJECTED`, `PATH_MISMATCH` ou `FILE_TOO_LARGE`: a exportacao nao
  respeitou o arquivo temporario autorizado;
- `INVALID_MUSICXML`: a exportacao nao produziu um documento completo.

Nao copie tokens, XML ou caminhos temporarios para relatorios. Os codigos e os
eventos redigidos da ponte sao suficientes para o diagnostico inicial.
