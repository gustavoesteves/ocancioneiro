# Ficha de candidatura do piloto de Choro v1

**Status:** proposta para Sprint 2
**Sprint:** [Piloto Choro](sprints/piloto-choro.md)
**Vocabulários:** [Vocabulários editoriais v1](vocabularios-editoriais-v1.md)
**Política de IDs:** [Política de identificadores e aliases v1](politica-identificadores-aliases-v1.md)

Esta ficha registra por que uma obra entra na amostra controlada do piloto. Ela
não decide canonicidade, não autoriza publicação e não depende de MusicXML
disponível.

## Princípios

- a candidatura testa o modelo editorial, não consagra a obra;
- toda hipótese deve permanecer marcada como hipótese;
- autoria incerta deve ser registrada sem escolher uma versão por conveniência;
- falta de partitura publicável não exclui candidatura;
- direitos afetam publicação, não relevância musicológica;
- cada obra deve declarar qual lacuna ou caso do piloto ajuda a cobrir.

## Campos obrigatórios

| Campo | Regra |
| --- | --- |
| `candidateId` | identificador local da candidatura, estável dentro do Sprint 2 |
| `workId` | ID estável da obra, quando já puder ser atribuído |
| `preferredTitle` | título preferencial usado para pesquisa inicial |
| `alternateTitles` | títulos alternativos, grafias ou traduções conhecidos |
| `creators` | autores e papéis declarados como hipótese, atribuição ou desconhecido |
| `candidateReason` | por que a obra deve testar o piloto |
| `canonicalHypothesis` | hipótese de contexto, centralidade e alcance |
| `coverageCases` | casos técnicos, editoriais, jurídicos ou históricos cobertos |
| `sourcesToLocate` | fontes a buscar ou conferir |
| `initialRights` | avaliação inicial de direitos e ações bloqueadas por padrão |
| `musicXmlStatus` | estado do MusicXML: ausente, existente, bloqueado ou a revisar |
| `reserveStatus` | candidata principal, reserva ou substituta de outra obra |
| `openQuestions` | dúvidas que impedem decisão editorial |

## Vocabulários esperados

Usar os valores já definidos nos vocabulários editoriais sempre que possível:

- `centrality`: `nuclear`, `consolidada`, `contextual`;
- `reach`: `nacional`, `regional`, `comunidade`;
- `creator.role`: `composer`, `lyricist`, `arranger`, `editor`,
  `translator`, `attributed`, `unknown`;
- `rights.status`: `nao_verificado`, `em_analise`, `liberado`, `restrito`,
  `bloqueado`;
- `musicXmlStatus`: `ausente`, `existente_a_revisar`,
  `existente_bloqueado`, `nao_necessario_para_candidatura`.

Valores fora desses conjuntos devem entrar em observação textual, não como
campo novo.

## Modelo copiável

```md
### Título da obra

- candidateId:
- workId:
- preferredTitle:
- alternateTitles:
- creators:
  - name:
    role:
    note:
- candidateReason:
- canonicalHypothesis:
  - context:
  - centrality:
  - reach:
  - justification:
- coverageCases:
  - 
- sourcesToLocate:
  - type:
    title:
    expectedUse:
    locatorHint:
- initialRights:
  - status:
  - blockedActions:
  - notes:
- musicXmlStatus:
- reserveStatus:
- openQuestions:
  - 
```

## Checklist de revisão

Antes de promover uma candidatura para a amostra do Sprint 2:

- o objetivo de teste está explícito;
- hipótese não aparece como decisão aceita;
- autoria controversa, quando houver, está marcada como tal;
- ausência de MusicXML não bloqueou a candidatura;
- direitos estão em bloqueio seguro quando não avaliados;
- pelo menos uma fonte a localizar foi registrada;
- a obra ajuda a cobrir algum caso da matriz de seleção;
- lacunas e substitutos possíveis estão visíveis.
