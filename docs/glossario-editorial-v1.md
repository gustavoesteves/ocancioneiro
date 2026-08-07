# Glossário editorial v1

**Status:** proposta para Sprint 0
**Documento normativo:** [Especificação editorial v1](especificacao-editorial-v1.md)
**Vocabulários controlados:** [Vocabulários editoriais v1](vocabularios-editoriais-v1.md)

Este glossário define termos conceituais usados pela equipe editorial e pelo
sistema. Ele não substitui os vocabulários controlados: o glossário explica o
domínio; os vocabulários definem valores persistidos nos dossiês.

## Formato

Cada entrada do glossário deve conter:

- `termo`: nome em português usado em documentação e interface;
- `definição`: sentido adotado pelo Cancioneiro;
- `não é`: contraexemplo ou limite de uso;
- `relacionado a`: entidades, vocabulários ou campos próximos;
- `status`: `ativo`, `proposto`, `depreciado` ou `removido`;
- `nota editorial`: observação opcional sobre ambiguidades ou decisões abertas.

Exemplo:

```md
### Obra musical

- definição: composição identificável independentemente de edição, arquivo,
  tonalidade ou situação jurídica.
- não é: o arquivo MusicXML nem uma gravação específica.
- relacionado a: dossiê, edição musical, fonte, asset.
- status: ativo.
```

## Termos iniciais

### Obra musical

- definição: composição identificável independentemente de edição, arquivo,
  tonalidade publicada ou situação jurídica.
- não é: o arquivo MusicXML, uma gravação, uma edição específica ou uma página
  do catálogo.
- relacionado a: dossiê, autoria, curadoria canônica.
- status: ativo.

### Dossiê editorial

- definição: documento estruturado que reúne identidade da obra, curadoria,
  fontes, evidências, edições, assets e direitos.
- não é: catálogo público nem partitura.
- relacionado a: `data/dossiers/`, catálogo gerado.
- status: ativo.

### Fonte

- definição: objeto consultado para sustentar informação musical, histórica,
  autoral, editorial ou jurídica.
- não é: autoridade absoluta sobre todos os aspectos da obra.
- relacionado a: evidência, uso de fonte, decisão musical.
- status: ativo.

### Evidência

- definição: argumento documentado que sustenta, contradiz ou contextualiza uma
  afirmação editorial.
- não é: pontuação automática nem simples opinião sem fonte.
- relacionado a: fonte, critério editorial, curadoria canônica.
- status: ativo.

### Curadoria canônica

- definição: processo de decidir se uma obra pertence ao repertório de
  referência dentro de um contexto declarado.
- não é: ranking de qualidade, sucesso comercial ou autorização de publicação.
- relacionado a: afirmação canônica, centralidade, alcance, decisão editorial.
- status: ativo.

### Lead sheet

- definição: edição enxuta que preserva melodia, harmonia e forma essenciais
  para estudo, acompanhamento e execução.
- não é: arranjo completo, redução de gravação ou transcrição de performance.
- relacionado a: edição musical, teste de essencialidade, MusicXML.
- status: ativo.

### Identidade executável

- definição: conjunto mínimo de elementos que permite reconhecer e executar a
  composição sem reproduzir um arranjo particular.
- não é: instrumentação, voicing, ornamentação ou convenção de uma gravação
  específica.
- relacionado a: lead sheet, teste de essencialidade, edição musical.
- status: ativo.

### Asset

- definição: arquivo distribuível ou verificável que representa uma edição,
  como MusicXML, PDF, imagem ou áudio.
- não é: a obra musical nem a fonte editorial em si.
- relacionado a: edição musical, checksum, direitos por ação.
- status: ativo.

### Catálogo público

- definição: projeção gerada dos dados editoriais para consumo da interface.
- não é: fonte de verdade nem local de edição manual permanente.
- relacionado a: `public/catalog.json`, gerador, interface.
- status: ativo.

### Decisão editorial

- definição: registro datado e justificado que altera ou confirma estado de
  curadoria, edição, publicação ou revisão.
- não é: comentário informal sem impacto rastreável.
- relacionado a: histórico, revisor, status vigente.
- status: ativo.

### Direitos por ação

- definição: avaliação separada do que pode ser exibido, reproduzido, impresso
  ou distribuído.
- não é: permissão global implícita para todo uso.
- relacionado a: publicação, asset, negação segura.
- status: ativo.

## Revisão

Um termo novo pode entrar no glossário quando:

- resolve ambiguidade real encontrada no piloto;
- possui definição e contraexemplo;
- não duplica termo existente;
- indica se afeta vocabulário controlado, schema ou apenas documentação.
