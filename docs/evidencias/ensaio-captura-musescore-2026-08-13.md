# Evidencia de ensaio real — captura MuseScore

**Data local:** 2026-08-13
**Ambiente:** macOS, MuseScore Studio 4.7.3 build 260608135
**Escopo:** plugin real, ponte local, exportacao temporaria e previa no importador;
sem persistencia editorial da partitura usada no ensaio

## Resultado confirmado

1. `CancioneiroCapture.qml` foi instalado na pasta pessoal de plugins.
2. O plugin abriu no MuseScore real e apresentou o estado `pareado`.
3. A ponte registrou `plugin_paired` sem token, caminho ou XML.
4. Uma requisicao real foi enviada para a partitura ativa.
5. O plugin exportou um documento MusicXML completo com 19.035 bytes.
6. A ponte validou o documento, gerou `captureId` e calculou SHA-256 com 64
   caracteres hexadecimais.
7. O valor do hash, a identidade efemera e o XML nao foram versionados neste
   relatorio para nao registrar uma impressao digital da partitura de teste.
8. Depois da entrega, nenhum arquivo de captura permaneceu no temporario da
   ponte e nenhum `.musicxml` ou `.xml` novo apareceu no `git status`.
9. Depois de recarregar o importador e acionar **Capturar partitura ativa**, o
   editor confirmou que previa e informacoes apresentadas estavam corretas.

Eventos redigidos observados:

```text
plugin_paired
capture_requested
capture_ready (byteLength: 19035)
```

## Invariantes demonstrados

- transporte exclusivamente em `127.0.0.1`;
- plugin e ponte negociaram `cancioneiro.musescore.capture/1`;
- exportacao real sem operacao de mutacao da partitura;
- SHA-256 calculado pela ponte, nao confiado ao plugin;
- nenhum XML, token ou caminho local em log operacional;
- captura tecnica nao alterou repositorio, catalogo, dossie ou pacote publico.
- o fluxo feliz plugin → ponte → importador foi confirmado pelo editor.

## Itens ainda pendentes no ensaio manual

- confirmar visualmente o nome da partitura ativa no plugin;
- executar o caso `ponte ausente` e recuperar por reconexao;
- executar `NO_ACTIVE_SCORE` sem partitura aberta;
- reiniciar a ponte com o plugin aberto e confirmar renovacao de sessao;
- trocar de partitura e confirmar a identidade antes da proxima captura;
- encerrar plugin e ponte e confirmar a limpeza final.
