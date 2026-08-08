# Campos ainda abertos para o Sprint 1B

**Status:** controle de lacunas para Sprint 1B
**Vocabulários:** [Vocabulários editoriais v1](vocabularios-editoriais-v1.md)
**Mapeamento legado:** [Mapeamento preliminar dos campos atuais](mapeamento-campos-legados-v1.md)

Este documento lista campos ou conceitos que ainda não devem virar schema
definitivo sem caso real, definição e teste. A regra é simples: lacuna conhecida
entra aqui ou em `migration.pending`; não entra como campo genérico de escape.

## Regra para campos novos

Um campo novo só entra no dossiê quando:

- resolve uma necessidade observada no piloto;
- possui definição editorial clara;
- tem contraexemplo ou limite de uso;
- indica se pertence à obra, curadoria, fonte, evidência, edição, asset ou
  direitos;
- possui validação ou plano explícito de validação;
- não duplica campo existente com outro nome.

## Lacunas abertas

| Lacuna | Entidade provável | Estado | Critério para promover |
| --- | --- | --- | --- |
| localização precisa de decisão musical | edição | aberta | surgir revisão que cite compasso, fonte ou trecho específico |
| uso estruturado de fonte por edição | edição/fonte | aberta | distinguir fonte de melodia, harmonia, forma ou atribuição em caso real |
| autoria contestada com múltiplas hipóteses | obra/evidência | aberta | haver obra piloto com disputa de autoria documentada |
| letras e versões cantadas | obra/edição | aberta | decidir quando letra afeta identidade da obra ou apenas edição vocal |
| títulos alternativos com escopo | obra | aberta | diferenciar alias histórico, título popular, tradução ou erro catalográfico |
| contexto de linguagem e tradição por obra | curadoria | aberta | validar vocabulários de linguagem/tradição contra casos do piloto |
| direitos por território ou período | direitos | aberta | aparecer caso em que permissão varie por território, data ou tipo de uso |
| notas editoriais classificadas | obra/curadoria/edição | aberta | migrar notas legadas sem misturar identidade, fonte, revisão e comentário |
| nível pedagógico controlado | edição | aberta | definir se `level` permanece simples ou vira vocabulário versionado |
| gênero legado | edição/busca | aberta | decidir se `genre` será busca livre, vocabulário musical ou projeção pública |
| tags livres | busca | aberta | definir quando tag é aceitável e quando deve virar vocabulário controlado |
| índice público sem partitura | projeção | aberta | publicar obra com metadados liberados e asset bloqueado |

## Campos transitórios aceitos

Estes campos podem permanecer enquanto houver compatibilidade com o catálogo
legado, mas não devem orientar o modelo editorial final:

- `data/editorial.json.songs.*.genre`;
- `data/editorial.json.songs.*.level`;
- `data/editorial.json.songs.*.source`;
- `data/editorial.json.songs.*.notes`;
- `data/editorial.json.songs.*.tags`;
- `public/catalog.json.songs[].sourceHash`;
- `public/catalog.json.songs[].instrumentation` quando vier de exportação
  automática do MusicXML.

## Bloqueios explícitos

Não criar campos como:

- `misc`;
- `extra`;
- `metadata`;
- `raw`;
- `custom`;
- `notes2`;
- `todo`.

Se a informação ainda não tem lugar, registrar em `migration.pending` com texto
humano ou neste documento como lacuna.
