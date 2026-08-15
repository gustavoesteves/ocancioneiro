# Retrospectiva e pendencias da Sprint 6.1

**Data:** 2026-08-14
**Estado:** implementacao automatizada concluida; aceite humano pendente

## Decisao sobre a ponte

A ponte permanece **dedicada ao Cancioneiro na versao 1**. Embora o Find Chord
tenha fornecido experiencia e referencias uteis, compartilhar agora o processo
adicionaria acoplamento entre dois ciclos de release e duas superficies de
mutacao diferentes. No Cancioneiro, captura, identidade editorial, direitos,
persistencia privada e promocao transacional formam uma fronteira propria.

A decisao deve ser reavaliada somente depois de duas versoes estaveis do
protocolo ou quando existir um segundo consumidor real do mesmo transporte. A
extracao futura deve preservar: bind exclusivo em loopback, tokens separados,
nenhuma escrita no repositorio pelo plugin e contrato versionado independente
das regras editoriais.

## Resultados

- captura real e SHA-256 validados no MuseScore Studio 4.7.3;
- fallback manual preservado;
- persistencia privada separada de `public/` e ignorada pelo Git;
- promocao idempotente, serializada, recuperavel e governada por direitos;
- pacote publico inspecionado contra ferramenta local e assets bloqueados;
- ensaio automatizado completo cobre promocao, pacote e rollback;
- comandos operacionais nao exibem XML, caminhos locais ou autoria privada.

## Pendencias classificadas

| Severidade | Pendencia | Responsavel | Condicao de encerramento |
| --- | --- | --- | --- |
| P2 | Outra pessoa ainda nao reproduziu o manual completo | editor convidado | registrar execucao independente bem-sucedida |
| P2 | Cenarios visuais de partitura ativa, troca de partitura e ausencia de partitura continuam sem evidencia manual | editor operador | completar o checklist do plugin no MuseScore 4.7.3 |
| P3 | Encerramento conjunto de plugin e ponte ainda precisa de evidencia manual de ausencia de processo/temporario | editor operador | registrar verificacao depois do fechamento |
| P3 | Compatibilidade com outras versoes 4.x do MuseScore nao foi declarada | manutencao tecnica | executar checklist antes de adicionar cada versao suportada |

Nenhuma dessas pendencias autoriza publicacao automatica. P2 bloqueia o
encerramento formal da sprint, mas nao invalida os gates automatizados ja
demonstrados.

## Proximo passo recomendado

Entregar este [manual operacional](manual-operacional-importacao.md) a um
editor que nao participou da implementacao. A pessoa deve executar o fluxo sem
orientacao paralela, anotar apenas duvidas e codigos redigidos, e completar o
checklist manual. Ajustes descobertos nessa revisao devem entrar como tarefa
curta de documentacao ou defeito reproduzivel, conforme o resultado.
