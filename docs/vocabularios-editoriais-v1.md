# Vocabulários editoriais v1

**Status:** proposta para Sprint 1B
**Documento normativo:** [Especificação editorial v1](especificacao-editorial-v1.md)

Este documento define os vocabulários controlados iniciais usados pelo piloto
editorial. Tags livres podem continuar existindo para busca e anotação, mas não
substituem estes valores quando houver decisão editorial, direitos ou projeção
pública envolvidos.

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

### Força da evidência

- `forte`;
- `moderada`;
- `fraca`.

A força é sempre contextual e exige justificativa.

### Testemunho de repertório

- `roda_ou_comunidade_de_pratica`;
- `curriculo_ou_material_pedagogico`;
- `songbook_especializado`;
- `gravacoes_multigeracionais`;
- `programa_festival_ou_concurso`;
- `depoimento_qualificado`.

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
