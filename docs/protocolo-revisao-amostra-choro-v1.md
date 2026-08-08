# Protocolo de revisão da amostra de Choro v1

**Status:** pronto para uso no Sprint 2
**Amostra:** [Amostra-semente de candidatos do piloto de Choro v1](amostra-candidatos-choro-v1.md)
**Ficha:** [Ficha de candidatura do piloto de Choro v1](ficha-candidatura-choro-v1.md)

Este protocolo orienta a revisão da amostra-semente por uma pessoa conhecedora
da prática de Choro. A revisão não decide canonicidade final; ela verifica se a
amostra é útil, plural e honesta para testar o método editorial.

## Perfil da pessoa revisora

A pessoa revisora deve ter pelo menos uma destas experiências:

- atuação prática em roda, regional, ensino ou pesquisa de Choro;
- familiaridade com repertório instrumental e cantado;
- experiência com fontes, songbooks, acervos, gravações ou edição musical;
- conhecimento de tradições regionais ou comunidades de prática fora do eixo
  mais documentado.

Conflitos de interesse não impedem a revisão, mas devem ser declarados quando
afetarem a avaliação de uma obra, autor, fonte ou instituição.

## Perguntas principais

1. A amostra contém obras suficientes para testar o método sem parecer cânone
   definitivo?
2. Há ausências que tornam o piloto enviesado demais?
3. Há obras candidatas que deveriam virar reserva?
4. Há reservas que deveriam entrar na lista principal?
5. Alguma autoria, título ou papel está perigosamente afirmado como fato?
6. Alguma obra depende demais de memória de repertório e pouco de fonte
   localizável?
7. A amostra cobre prática de roda, repertório pedagógico, fontes impressas,
   gravações históricas e casos com direitos incertos?
8. A lista está concentrada demais em um período, região, instrumento ou grupo
   de autores?

## Escala de revisão

Usar uma das seguintes recomendações para cada candidatura comentada:

| Valor | Uso |
| --- | --- |
| `manter` | a obra ajuda claramente a testar o piloto |
| `manter_com_alerta` | a obra é útil, mas precisa de nota, fonte ou ajuste |
| `mover_para_reserva` | a obra é boa, mas menos urgente que outra |
| `promover_da_reserva` | a reserva cobre lacuna importante da lista principal |
| `substituir` | a obra atrapalha a cobertura ou duplica outro caso |
| `pesquisar_antes` | falta informação mínima para decidir sua posição |

## Ata-modelo

```md
# Revisão da amostra de Choro

- data:
- pessoa revisora:
- vínculo com Choro:
- conflitos declarados:
- versão revisada: amostra-candidatos-choro-v1.md

## Impressão geral

-

## Recomendações por candidatura

| candidateId | recomendação | comentário | ação sugerida |
| --- | --- | --- | --- |
|  |  |  |  |

## Lacunas percebidas

-

## Obras sugeridas

| título | autor provável | motivo | substituiria |
| --- | --- | --- | --- |
|  |  |  |  |

## Decisão da equipe

-
```

## Como registrar o resultado

Depois da revisão:

- salvar a ata em `docs/revisoes/`;
- atualizar a amostra-semente apenas com mudanças aceitas pela equipe;
- manter comentários controversos na ata, sem apagá-los;
- não transformar recomendação da pessoa revisora em decisão canônica;
- registrar novas lacunas no documento da amostra ou no dossiê da obra;
- se uma candidatura sair da lista principal, preservar seu `candidateId` na
  ata para auditoria.

## Critério para encerrar o Sprint 2

O Sprint 2 pode ser encerrado quando:

- a revisão externa ou comunitária estiver registrada; ou
- a equipe registrar que a revisão não foi possível neste ciclo e listar quais
  riscos permanecem abertos.

Nos dois casos, a amostra deve continuar rotulada como piloto, não cânone
aprovado.
