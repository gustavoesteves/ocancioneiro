# Mapeamento preliminar dos campos atuais

**Status:** proposta para Sprint 0
**Documento normativo:** [Especificação editorial v1](especificacao-editorial-v1.md)
**Decisões Sprint 1:** [Decisões arquiteturais para o Sprint 1](decisoes-arquiteturais-sprint-1.md)

Este documento mapeia o modelo atual para o modelo-alvo de dossiês editoriais.
Ele é preliminar: serve para guiar migração, importador e projeção pública sem
tratar `public/catalog.json` como fonte de verdade.

## Fontes atuais

| Fonte | Papel atual | Futuro |
| --- | --- | --- |
| `public/musicxml/*.musicxml` | arquivo musical publicável e origem técnica de metadados | asset versionado vinculado a uma edição |
| `data/editorial.json` | complemento manual de metadados por `Song.id` | transitório até metadados editoriais morarem em dossiês |
| `public/catalog.json` | catálogo consumido pela interface | artefato gerado a partir dos dossiês |
| `data/dossiers/*.json` | modelo editorial em implantação | fonte de verdade do piloto |

## Campo legado `Song`

| Campo atual | Origem atual | Destino no dossiê | Projeção pública | Observação |
| --- | --- | --- | --- | --- |
| `id` | slug do arquivo, importador ou alias legado | `publicCatalogId` e/ou `editions[].publicCatalogId` | `songs[].id` | não deve virar `work.id`; preserva URL/compatibilidade pública |
| `title` | MusicXML ou importador | `work.preferredTitle` quando identifica a obra; `editions[].title` quando identifica a edição | `songs[].title` | divergências entre título da obra e título da edição devem ser explícitas |
| `composer` | MusicXML `creator` | `work.creators[]` | `songs[].composer` | múltiplos autores devem manter papel autoral; catálogo legado pode achatar para texto |
| `genre` | `data/editorial.json` ou padrão | `editions[].genre` por enquanto | `songs[].genre` | candidato a vocabulário controlado futuro; não define canonicidade |
| `key` | MusicXML | `editions[].encodedKey` | `songs[].key` | tonalidade pertence à edição, não à obra |
| `level` | `data/editorial.json` ou padrão | `editions[].level` por enquanto | `songs[].level` | é metadado editorial/pedagógico, não propriedade da obra |
| `instrumentation` | MusicXML `part-name` ou instrumento | `editions[].instrumentation` | `songs[].instrumentation` | para lead sheet, deve tender a descrever função editorial, não instrumento exportado acidentalmente |
| `source` | `data/editorial.json` | `sources[]` e usos de fonte futuros | `songs[].source` | texto legado deve gerar pendência quando não possuir fonte estruturada |
| `musicxml` | caminho em `public/musicxml/` | `assets[].path` | `songs[].musicxml` quando permitido por direitos | deve depender de permissão `exibir_partitura`/`distribuir_musicxml` |
| `notes` | `data/editorial.json` | `editions[].notes` ou notas de identidade/curadoria, conforme conteúdo | `songs[].notes` | migração deve classificar nota antes de assumir destino definitivo |
| `chords` | extraído do MusicXML | `editions[].chords` | `songs[].chords` | representa a edição publicada, não análise harmônica canônica |
| `tags` | `data/editorial.json` | `editions[].tags` ou metadados de busca futuros | `songs[].tags` | tags livres não substituem vocabulário controlado |
| `sourceHash` | SHA-256 do MusicXML | `assets[].checksum` + `checksumAlgorithm` | `songs[].sourceHash` enquanto contrato legado existir | usado para detectar divergência técnica do arquivo |

## Campos editoriais ainda sem equivalente completo

| Necessidade | Destino-alvo | Estado |
| --- | --- | --- |
| títulos alternativos | `work.alternateTitles[]` | ausente no catálogo legado |
| autoria contestada ou atribuída | `work.creators[]` + notas/evidências | parcialmente suportado por `role` |
| afirmação canônica contextualizada | `curation.canonicalClaims[]` | ausente no catálogo legado |
| histórico de decisões | `curation.decisions[]` | ausente no catálogo legado |
| fontes com localização | `sources[]` + evidências/usos | parcialmente suportado por `sources[]` |
| evidências documentais | `evidence[]` | ausente no catálogo legado |
| decisões musicais localizadas | `editions[].decisions[]` futuro | ainda não modelado no schema atual |
| permissões por ação | `rights.actions` | não projetado completamente no catálogo legado |
| substituição de assets | `assets[].replaces` | suportado no validador, sem interface completa |

## Regras de migração

1. A migração deve preservar `Song.id` como alias público, não como identidade
   interna da obra.
2. Toda informação inferida do MusicXML deve ser tratada como metadado técnico
   da edição até haver fonte editorial estruturada.
3. Campos herdados que não se encaixem claramente devem entrar em
   `migration.pending`.
4. `public/catalog.json` pode continuar existindo para compatibilidade, mas deve
   ser regenerável.
5. Uma obra pode existir no dossiê sem `assets[]` publicável e, portanto, sem
   partitura no catálogo público.
6. Direitos bloqueiam por ação: permitir metadados não implica permitir
   partitura, playback, impressão ou download.

## Exemplo atual

`Asa Branca` demonstra o estado intermediário:

- `publicCatalogId`: preserva `asa-branca`;
- `work.id`: usa `obra-asa-branca`;
- `editions[].id`: usa `edicao-legada`;
- `assets[].path`: aponta para `/musicxml/asa-branca.musicxml`;
- `migration.pending`: registra revisão humana pendente de curadoria, fonte e
  direitos.

Esse exemplo é válido para compatibilidade, mas ainda não representa a forma
editorial final do piloto.
