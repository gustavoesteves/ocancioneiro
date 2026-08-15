# Operacao das capturas privadas

**Escopo:** importador local; nunca GitHub Pages
**Area local:** `.local/cancioneiro/`
**Estado inicial:** `em_revisao`

## Principio

Confirmar uma importacao nao publica a partitura. O importador preserva o
MusicXML bruto e uma representacao canonica em uma area local ignorada pelo
Git. O dossie recebe somente a edicao editorial escolhida; nenhum caminho da
maquina ou da area privada e registrado nele.

O MuseScore e `musescore_export` descrevem a proveniencia tecnica da captura.
Eles nao substituem a fonte documental da melodia e dos acordes, que continua
registrada separadamente no dossie.

## Estrutura local

```text
.local/cancioneiro/
├── captures/<captureId>/
│   ├── raw.musicxml
│   ├── canonical.musicxml
│   └── record.json
├── staging/
└── trash/<trashId>/
```

- `raw.musicxml` conserva exatamente o texto confirmado;
- `canonical.musicxml` normaliza BOM, finais de linha e espacos estruturais;
- `record.json` sela os dois SHA-256, identidade editorial, metadados
  declarados, horario e proveniencia tecnica;
- `staging/` recebe a escrita antes da renomeacao atomica;
- `trash/` preserva descartes recuperaveis.

Os nomes registrados dentro de `record.json` sao relativos ao proprio registro.
O caminho absoluto, o usuario da maquina, o temporario da ponte e tokens nunca
entram no registro, no dossie ou na resposta da API.

## Confirmar

1. capture do MuseScore ou selecione um MusicXML manualmente;
2. revise a previa, metadados e alertas de escopo;
3. escolha explicitamente um `work.id`;
4. escolha uma edicao existente ou a opcao para criar uma edicao importada;
5. confirme divergencias de identidade, quando houver;
6. selecione **Confirmar captura privada**.

O responsavel pela confirmacao e obrigatorio e fica no registro privado como
`confirmedBy`; ele nunca e inferido do usuario da maquina.

Uma edicao criada nessa operacao nasce em `em_revisao`, sem asset publico. A
confirmacao nunca cria caminho sob `/musicxml/`, nunca muda direitos e nunca
torna a edicao `valida`.

Repetir o mesmo `captureId`, hash e vinculacao devolve o registro existente.
Reutilizar um `captureId` para outro conteudo, obra ou edicao falha com conflito.
Um hash informado pela ponte que nao corresponda ao XML bruto tambem interrompe
a operacao.

## Descartar e recuperar

Antes da confirmacao, cancelar apenas elimina a previa; a ponte ja removeu seu
temporario. Depois da confirmacao, **Descartar captura de forma recuperavel**
move o diretorio inteiro para `trash/` e cria um recibo `discard.json`. Nenhum
arquivo e apagado e nenhum asset publico e alterado.

A rotina de recuperacao exige `captureId` e `trashId`, recusa caminhos
arbitrarios e restaura o registro para `captures/`:

```bash
npm run captures:ops -- restore <captureId> <trashId>
```

Para conferir os hashes registrados sem exibir o XML, caminhos ou autoria
privada:

```bash
npm run captures:ops -- verify <captureId>
```

Nao mova manualmente arquivos entre essas pastas.

## Garantias de publicacao

- `/.local/` esta no `.gitignore`;
- o gerador do catalogo le `data/dossiers/` e assets autorizados de `public/`,
  nao a area privada;
- o empacotador do GitHub Pages inclui somente MusicXML explicitamente
  autorizado pelo catalogo;
- o pacote publico rejeita rota, API e marcadores do importador local.

A promocao para `public/musicxml/` e uma operacao separada e governada por
edicao valida e direitos efetivos. Consulte a
[operacao de promocao](operacao-promocao-musicxml.md).
