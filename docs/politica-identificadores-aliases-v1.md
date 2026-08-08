# Política de identificadores e aliases v1

**Status:** proposta para Sprint 0
**Documento normativo:** [Especificação editorial v1](especificacao-editorial-v1.md)
**Mapeamento legado:** [Mapeamento preliminar dos campos atuais](mapeamento-campos-legados-v1.md)

Esta política define como O Cancioneiro cria, preserva e substitui
identificadores internos e aliases públicos. O objetivo é permitir revisão em
Git, migração incremental e URLs estáveis sem confundir obra, edição, arquivo e
catálogo público.

## Princípios

1. Identificadores internos não dependem do caminho do arquivo.
2. Identificadores publicados não são reutilizados para outra entidade.
3. Slugs públicos preservam compatibilidade, não identidade musicológica.
4. Renomear arquivo, corrigir título ou substituir MusicXML não deve mudar
   `work.id`.
5. Toda troca de alias público deve deixar rastro no dossiê ou na migração.

## Tipos de identificador

| Identificador | Escopo | Exemplo | Regra |
| --- | --- | --- | --- |
| `work.id` | obra musical | `obra-asa-branca` | identidade editorial estável da composição |
| `publicCatalogId` | catálogo público | `asa-branca` | alias público preservado em `public/catalog.json` |
| `editions[].id` | edição dentro de uma obra | `lead-sheet-v1` | identifica uma realização editorial específica |
| `assets[].id` | arquivo dentro de uma obra | `asset-musicxml-v1` | identifica arquivo ou representação técnica |
| `sources[].id` | fonte dentro de um dossiê | `fonte-catalogo-acervo` | identifica fonte citada localmente no dossiê |
| `curation.decisions[].id` | decisão dentro de uma obra | `decisao-aceitacao-2026-08` | identifica decisão revisável |

## Formato

IDs internos devem:

- usar `kebab-case` ASCII;
- começar com prefixo de tipo quando isso reduzir ambiguidade;
- ser estáveis depois de publicados;
- evitar informação que provavelmente mudará, como tonalidade, caminho ou
  instrumento exportado.

Prefixos recomendados:

- `obra-` para `work.id`;
- `edicao-` para edições;
- `asset-` para assets;
- `fonte-` para fontes locais;
- `evidencia-` para evidências;
- `decisao-` para decisões.

Aliases públicos devem:

- ser curtos e legíveis;
- continuar compatíveis com o catálogo legado sempre que possível;
- ser únicos dentro da projeção pública;
- não substituir `work.id` como chave de relacionamento editorial.

## Criação

Ao criar uma obra:

1. defina `work.id` a partir do título preferencial conhecido;
2. registre autores e títulos alternativos no dossiê, não no ID;
3. defina `publicCatalogId` apenas se a obra deve aparecer no catálogo público
   ou preservar uma URL/slug legado;
4. crie `editions[].id` e `assets[].id` de forma independente;
5. valide duplicidade antes de gravar.

Quando houver colisão, acrescente qualificador editorial estável, como autor ou
contexto, e registre a razão em nota de migração ou decisão.

## Renomeação e substituição

Não renomear `work.id` por:

- correção de capitalização;
- título alternativo preferido;
- mudança de arquivo MusicXML;
- mudança de tonalidade;
- troca de fonte principal.

Renomear `work.id` só é permitido quando a identidade anterior estava errada,
por exemplo quando duas obras distintas foram misturadas. Nesses casos:

- preservar o ID antigo como alias ou nota de migração;
- registrar decisão editorial;
- atualizar referências em teste e dados no mesmo commit;
- nunca reutilizar o ID antigo para outra obra.

Substituir MusicXML cria ou atualiza `assets[]`; não muda `work.id`.

## Remoção

Remover uma obra do catálogo público não apaga automaticamente o dossiê.

- se a obra foi rejeitada, preservar o dossiê com decisão `rejeitada`;
- se direitos bloquearam publicação, preservar metadados permitidos e bloquear
  ações públicas;
- se o arquivo foi substituído, marcar asset antigo como `substituido` quando o
  histórico for relevante.

## Relação com arquivos

O caminho recomendado de dossiê é `data/dossiers/<work.id>.json`, mas o caminho
é convenção operacional, não identidade. Uma mudança de caminho deve preservar
`work.id`.

O caminho de MusicXML em `public/musicxml/` identifica um asset publicado, não a
obra. O mesmo `work.id` pode ter mais de um asset ao longo do tempo.

## Exemplo atual

Na entrada atual de `Asa Branca`:

- `work.id`: `obra-asa-branca`;
- `publicCatalogId`: `asa-branca`;
- `editions[].id`: `edicao-legada`;
- `assets[].id`: `asset-musicxml-legado`;
- `assets[].path`: `/musicxml/asa-branca.musicxml`.

Esse estado preserva compatibilidade com o catálogo público enquanto separa a
obra da edição e do arquivo.
