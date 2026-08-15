# Operacao de promocao do MusicXML

**Escopo:** ferramenta local
**Entrada:** captura privada confirmada
**Saida:** versao publica governada e catalogo consistente

## Separacao das operacoes

O fluxo possui tres fronteiras independentes:

1. **capturar:** plugin e ponte entregam uma previa temporaria;
2. **confirmar:** o editor vincula obra e edicao e sela a captura privada;
3. **promover:** outra operacao valida curadoria, edicao e direitos antes de
   criar uma versao publica.

Falhar ou cancelar uma etapa nao executa a seguinte. A identidade de quem
confirmou e de quem promoveu e informada explicitamente; o sistema nunca usa o
nome de usuario da maquina como autoria editorial.

## Gates obrigatorios

Uma promocao so comeca quando:

- o registro privado e os hashes bruto e canonico conferem;
- `work.id` e `edition.id` ainda correspondem ao dossie;
- a curadoria vigente esta `aceita`;
- a edicao esta `valida`;
- `exibir_metadados`, `exibir_partitura`, `reproduzir_playback`, `imprimir` e
  `distribuir_musicxml` estao efetivamente `permitida`;
- o identificador publico nao conflita com obra ou edicao existente;
- o MusicXML passa por validacao estrutural, checksum e consistencia de
  metadados com a edicao;
- o catalogo completo preparado permanece valido.

A permissao e conferida novamente imediatamente antes das escritas editoriais.
Se ela for retirada durante a operacao, a promocao e cancelada e a retirada e
preservada.

## Versionamento

Cada conteudo recebe um asset e caminho derivados do SHA-256 canonico:

```text
/musicxml/<publicId>/asset-musicxml-<publicId>-<hash12>.musicxml
```

Substituir uma versao:

- cria outro arquivo, sem sobrescrever o anterior;
- marca o asset anterior como `substituido`;
- liga `replacedByAssetId` e `replacesAssetId` reciprocamente;
- atualiza o catalogo somente para a nova versao vigente.

Repetir a mesma captura ou o mesmo hash nao cria outro asset. Se a captura ja
for historica, a operacao informa isso sem reativa-la ou gerar nova versao.

## Transacao recuperavel

Antes de escrever em `public/`, o importador prepara em
`.local/cancioneiro/transactions/`:

- backups do dossie e catalogo vigentes;
- proximo dossie e proximo catalogo;
- MusicXML canonico a promover;
- diario com captura, asset, responsavel, hashes e fase atual.

Uma trava global serializa mudancas que afetam o catalogo. As fases sao:

```text
prepared → asset_written → dossier_written → catalog_written → committed
```

Uma falha antes de `committed` restaura os arquivos anteriores e remove apenas
o novo asset. Alteracoes externas desconhecidas nao sao silenciosamente
sobrescritas durante a recuperacao.

## Recuperacao e rollback

Uma interrupcao abrupta deixa o diario privado. Com o servidor local ativo, a
rotina de recuperacao pode ser executada por:

```bash
npm run captures:ops -- recover-promotions
```

Ela restaura transacoes sem estado final e libera a trava abandonada.

Logo depois de uma promocao feita na interface, **Reverter esta promocao** usa
o `transactionId` para restaurar dossie e catalogo anteriores e retirar o novo
asset da arvore publica. O rollback falha de forma segura quando outra versao
posterior ja ocupa o estado vigente.

Capturas privadas e assets publicos historicos anteriores nao sao apagados.
Esses assets historicos podem permanecer na arvore fonte `public/`, mas o
estagio de empacotamento copia somente os caminhos vigentes e autorizados pelo
catalogo. O verificador do pacote final continua rejeitando qualquer MusicXML
historico, bloqueado ou sem autorizacao que chegue ao artefato de deploy.

O mesmo rollback pode ser acionado no terminal com o identificador devolvido
pela promocao:

```bash
npm run captures:ops -- rollback <transactionId> --by <responsavel>
```

## Publicacao

A promocao altera a arvore fonte local, mas nao executa deploy. Antes de enviar
ao GitHub, rode `npm run check`. O build do Pages volta a inspecionar direitos,
catalogo, pacote e ausencia da ferramenta local.
