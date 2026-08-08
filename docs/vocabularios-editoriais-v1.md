# Vocabulários editoriais v1

**Status:** proposta para Sprint 1B
**Documento normativo:** [Especificação editorial v1](especificacao-editorial-v1.md)
**Glossário:** [Glossário editorial v1](glossario-editorial-v1.md)

Este documento define os vocabulários controlados iniciais usados pelo piloto
editorial. Tags livres podem continuar existindo para busca e anotação, mas não
substituem estes valores quando houver decisão editorial, direitos ou projeção
pública envolvidos.

## Formato versionado

Cada vocabulário controlado é identificado por:

- `vocabularyId`: identificador estável do conjunto, em `snake_case`;
- `schemaVersion`: versão do formato usado para descrever os termos;
- `terms`: lista ordenada de termos disponíveis;
- `status`: estágio editorial do vocabulário.

Cada termo deve possuir:

- `id`: valor persistido nos dossiês e validado pelo sistema;
- `label`: forma legível exibida em documentação ou interface editorial;
- `definition`: regra curta de uso;
- `counterexample`: situação que parece semelhante, mas não deve usar o termo;
- `status`: `ativo`, `proposto`, `depreciado` ou `removido`;
- `replaces`: termos anteriores, quando houver migração;
- `notes`: observações editoriais opcionais.

Exemplo de termo:

```json
{
  "id": "nuclear",
  "label": "Nuclear",
  "definition": "Ausência difícil de justificar dentro do contexto declarado.",
  "counterexample": "Não indica ranking artístico nem sucesso comercial.",
  "status": "ativo"
}
```

Regras de versionamento:

- `id` não deve ser renomeado depois de publicado; use `depreciado` e
  `replaces` quando houver substituição;
- `label`, `definition`, `counterexample` e `notes` podem ser refinados sem
  migração quando não alterarem o significado operacional;
- valores `proposto` podem aparecer na documentação, mas não devem ser usados
  em dossiês publicados antes de aprovação;
- valores `removido` permanecem documentados quando forem necessários para
  interpretar histórico;
- toda mudança que afete validação de dados deve ter nota de migração.

## Curadoria

### Estado de curadoria

- `candidata`: obra incluída na fila de investigação.
- `em_pesquisa`: levantamento documental em andamento.
- `em_revisao`: dossiê submetido à bancada editorial.
- `aceita`: obra pertence ao cânone em pelo menos um contexto documentado.
- `rejeitada`: obra não atende ao recorte, com justificativa preservada.
- `inconclusiva`: evidências atuais não permitem conclusão.

Contraexemplo: `publicada` não é estado de curadoria; publicação depende de
edição, asset e direitos.

### Papel autoral

- `composer`;
- `lyricist`;
- `arranger`;
- `editor`;
- `translator`;
- `attributed`;
- `unknown`.

Contraexemplo: papéis editoriais do projeto, como pesquisador ou revisor, não
são papéis autorais da obra.

### Centralidade

- `nuclear`: ausência difícil de justificar dentro do contexto.
- `consolidada`: presença recorrente e claramente reconhecível no contexto.
- `contextual`: necessária para compreender linguagem, história ou prática
  específica, ainda que a circulação seja menor.

Contraexemplo: centralidade não mede qualidade artística nem ranking.

### Alcance

- `nacional`: circulação ou reconhecimento em escala nacional.
- `regional`: centralidade ligada a uma região ou circuito regional.
- `comunidade`: centralidade em comunidade de prática, como roda, escola,
  tradição instrumental ou repertório pedagógico.

Contraexemplo: `comunidade` não é inferior a `nacional`; alcance não é
hierarquia.

### Papéis editoriais

- `historico`;
- `formador_de_linguagem`;
- `repertorio_de_execucao`;
- `pedagogico`;
- `instrumental`;
- `vocal`;
- `influencia`;
- `representatividade`.

## Evidências

### Critérios editoriais

- `permanencia`;
- `circulacao`;
- `formacao_de_linguagem`;
- `influencia`;
- `regravacao_relevante`;
- `valor_instrumental_ou_pedagogico`;
- `valor_historico`;
- `representatividade`.

### Direção da evidência

- `sustenta`: reforça a afirmação editorial.
- `contradiz`: enfraquece ou limita a afirmação editorial.
- `contextualiza`: não decide, mas qualifica o escopo da afirmação.

Evidências `sustenta` e `contradiz` podem coexistir no mesmo dossiê e no mesmo
critério. Isso não é erro de validação; o relatório de revisão deve apontar a
contradição para decisão humana.

### Força da evidência

- `forte`;
- `moderada`;
- `fraca`.

A força é sempre contextual e exige justificativa própria em
`evidence[].strengthJustification`. A justificativa geral da evidência explica
a afirmação; a justificativa de força explica por que ela foi classificada como
`forte`, `moderada` ou `fraca`.

Uma evidência pode ser registrada sem `sources[]` apenas como rascunho de
pesquisa. Nesse caso, o validador carrega o dossiê, mas o relatório de revisão
deve apontar a lacuna como `evidencia sem fonte`. Ela não pode sustentar
decisão editorial enquanto permanecer assim.

### Testemunho de repertório

- `roda_ou_comunidade_de_pratica`;
- `curriculo_ou_material_pedagogico`;
- `songbook_especializado`;
- `gravacoes_multigeracionais`;
- `programa_festival_ou_concurso`;
- `depoimento_qualificado`.

### Tipo de localizador de evidência

- `pagina`: página, fólio ou intervalo paginado.
- `faixa`: faixa de gravação, lado de disco ou número de matriz quando
  aplicável.
- `compasso`: compasso, intervalo de compassos ou ponto musical localizado.
- `item_acervo`: código, chamada, tombo ou identificador persistente de acervo.
- `url`: endereço consultável quando a URL identifica o item exato.

Contraexemplo: uma URL genérica do acervo ou o nome de um livro não bastam como
localizador; devem aparecer como fonte, não como localização da evidência.

## Fontes

### Tipo de fonte

- `manuscrito`;
- `edicao_publicada`;
- `gravacao`;
- `catalogo_ou_acervo`;
- `songbook`;
- `curriculo_ou_material_didatico`;
- `programa`;
- `entrevista_ou_depoimento`;
- `estudo_ou_artigo`;
- `fonte_digital`.

### Uso de fonte

- `melodia`;
- `harmonia`;
- `forma`;
- `atribuicao`;
- `data`;
- `circulacao`;
- `direitos`;
- `contexto_historico`;
- `pratica_de_performance`.

### Identificador persistente de fonte

`sources[].persistentId` registra um identificador conferível do item citado,
como número de catálogo, tombo, chamada, matriz, DOI, handle ou ID estável de
acervo digital.

Regras:

- deve identificar o item, não apenas a instituição;
- deve ser único dentro do dossiê;
- pode coexistir com `sources[].url`, que registra o endereço de consulta;
- não deve ser inventado quando a fonte só possui referência bibliográfica
  textual.

Contraexemplo: `https://ims.com.br` não é identificador persistente do item;
uma página específica de fonograma, catálogo ou programa pode fornecer ou
funcionar como identificador quando for estável e conferível.

## Edição musical

### Estado de edição

- `inexistente`;
- `em_transcricao`;
- `em_revisao`;
- `valida`;
- `substituida`.

### Tipo de decisão musical

- `transcricao`;
- `normalizacao`;
- `reducao`;
- `inferencia`;
- `emenda_editorial`.

### Confiança localizada

- `alta`;
- `media`;
- `baixa`.

## Assets

### Tipo de asset

- `musicxml`;
- `pdf`;
- `imagem`;
- `audio`;
- `outro`.

### Estado de asset

- `pendente`;
- `valido`;
- `inconsistente`;
- `substituido`;
- `bloqueado`.

## Direitos

### Estado de avaliação

- `nao_verificado`;
- `em_analise`;
- `liberado`;
- `restrito`;
- `bloqueado`.

### Ação pública

- `exibir_metadados`;
- `exibir_partitura`;
- `reproduzir_playback`;
- `imprimir`;
- `baixar_pdf`;
- `distribuir_musicxml`.

### Permissão por ação

- `nao_avaliada`;
- `permitida`;
- `restrita`;
- `bloqueada`.

`nao_avaliada` deve ser tratada como `bloqueada` em qualquer operação pública.

## Linguagens e tradições iniciais

Este vocabulário deve crescer por revisão editorial, não por autocomplete livre.
Valores iniciais para o piloto:

### Linguagens

- `choro`;
- `maxixe`;
- `polca_brasileira`;
- `valsa_brasileira`;
- `samba`;
- `baiao`;
- `frevo`;
- `bossa_nova`;
- `samba_jazz`;
- `musica_instrumental_brasileira`.

### Tradições

- `roda_de_choro`;
- `choro_carioca`;
- `repertorio_de_regional`;
- `samba_carioca`;
- `forro_pe_de_serra`;
- `frevo_pernambucano`;
- `clube_da_esquina`.

## Revisão do vocabulário

Um valor novo pode ser adicionado quando:

- resolve caso real do piloto;
- possui definição e contraexemplo;
- não duplica valor existente;
- tem impacto de migração documentado se já houver dados publicados.
