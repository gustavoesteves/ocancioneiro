# Procedimento de retirada emergencial

**Status:** operacional para Sprint 6
**Escopo:** asset MusicXML publicado pelo Cancioneiro
**Plano:** [Sprint 6 — Validacao, direitos e publicacao](sprints/piloto-choro.md#sprint-6-validação-direitos-e-publicação)

## Objetivo

Retirar uma partitura do pacote publico sem apagar obra, edicao, decisoes ou o
historico do asset. A prioridade e interromper a entrega do arquivo; a analise
editorial ou juridica pode continuar depois em ambiente privado.

## Quando usar

Execute o procedimento quando houver:

- pedido de titular ou representante;
- permissao expirada, revogada ou contestada;
- MusicXML atribuido a obra ou edicao incorreta;
- exposicao acidental de material ainda em revisao;
- erro de publicacao que exija indisponibilidade imediata.

Nao espere conclusao juridica para retirar preventivamente. No modelo
deny-by-default, incerteza bloqueia a entrega publica.

## Resultado esperado

Depois da retirada:

- metadados continuam no catalogo somente se `exibir_metadados` estiver
  explicitamente permitido;
- a entrada publica nao contem URL do MusicXML;
- playback, impressao e download ficam indisponiveis;
- o arquivo nao existe em `public/musicxml/`, `dist/client/musicxml/` nem
  `github-pages/musicxml/`;
- o dossie preserva o asset com estado `bloqueado` e motivo interno;
- o Git preserva a versao anteriormente publicada.

## Procedimento

### 1. Identificar o alvo

Confirme no dossie:

- `work.id`;
- `edition.id`;
- `asset.id`;
- `asset.path`;
- checksum SHA-256;
- publicacao e deploy atualmente vigentes.

Nao retire por titulo ou nome de arquivo sem conferir os IDs.

### 2. Bloquear no dossie

No asset afetado:

- altere `status` para `bloqueado`;
- registre `archivedAt`, `archivedBy` e `archiveReason`;
- preserve `path`, checksum, algoritmo, gerador e relacoes de substituicao.

Nas permissoes por acao, marque como `bloqueada` ou retire a permissao
positiva de:

- `exibir_partitura`;
- `reproduzir_playback`;
- `imprimir`;
- `baixar_pdf`;
- `distribuir_musicxml`.

Mantenha `exibir_metadados: permitida` apenas quando a obra puder continuar
publicamente identificada. Nao inclua parecer, contato, alegacao ou documento
juridico em campos que chegam ao catalogo publico.

### 3. Retirar o arquivo da arvore publica

Mova o arquivo para uma area local ignorada pelo Git, por exemplo
`work/withdrawn/<asset.id>/`, ou remova a copia de trabalho quando uma copia
privada controlada ja existir. O arquivo nao pode permanecer sob `public/`.

A retirada do arquivo versionado aparece como exclusao no Git; isso e esperado.
O conteudo continua recuperavel pelo historico. Nao use reescrita destrutiva de
historico como parte deste procedimento.

### 4. Regenerar e validar

Execute:

```bash
npm run catalog:generate
npm run check
```

A validacao deve provar que:

- o catalogo omitiu a URL;
- o arquivo bloqueado nao esta na fonte publica;
- os dois builds omitem o asset;
- uma URL manual para o caminho antigo nao existe no novo pacote;
- as demais obras continuam consistentes.

Se a verificacao falhar, nao publique. Corrija dossie, arquivo ou permissoes e
repita o processo.

### 5. Publicar a retirada

Revise o diff, submeta a mudanca pelo fluxo normal e acompanhe o deploy. Depois
da conclusao:

- abra o catalogo publicado e confirme o estado de indisponibilidade;
- tente diretamente a URL antiga do MusicXML e confirme resposta de ausencia;
- confira que busca e selecao da obra continuam funcionando quando metadados
  forem permitidos;
- registre data, responsavel e resultado da verificacao em canal interno.

Se houver cache externo, solicite invalidacao do caminho antigo. Nao restaure a
permissao apenas para corrigir cache.

## Falha ou rollback

Se o deploy da retirada falhar, mantenha o asset bloqueado no dossie e o
arquivo fora de `public/`. Corrija o pipeline e publique novamente; nao reverta
para uma versao que reexponha o arquivo.

Uma restauracao futura exige nova confirmacao de direitos, revisao do asset e
execucao completa do gate. Ela deve criar evento auditavel; nao basta recolocar
o arquivo no caminho antigo.

## Evidencia minima

Registre internamente:

- obra, edicao e asset retirados;
- motivo resumido e nao sensivel;
- pessoa responsavel;
- horario do bloqueio e do deploy;
- commit ou revisao correspondente;
- resultado do acesso direto ao caminho antigo;
- eventual invalidacao de cache;
- decisao posterior de manter bloqueio ou iniciar restauracao.

## Ensaio

Antes de usar em caso real, ensaie com uma fixture sem restricao juridica:

1. publique a fixture em ambiente controlado;
2. bloqueie direitos e asset;
3. mova o arquivo para fora de `public/`;
4. execute a verificacao completa;
5. confirme ausencia por URL direta;
6. restaure por uma nova operacao auditavel.

O ensaio nao deve usar uma obra protegida nem dados juridicos reais.
