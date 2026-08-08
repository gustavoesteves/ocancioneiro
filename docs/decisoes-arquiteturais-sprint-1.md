# Decisões arquiteturais para o Sprint 1

**Status:** registro de preparação para Sprint 1
**ADR base:** [ADR 0001 — Persistencia editorial inicial](adr/0001-persistencia-editorial.md)
**Plano:** [Plano de desenvolvimento — piloto editorial de Choro](sprints/piloto-choro.md)
**Identificadores:** [Política de identificadores e aliases v1](politica-identificadores-aliases-v1.md)

Este documento registra as decisões arquiteturais que precisam estar explícitas
antes de alterar schemas, migrações, importador ou projeção pública no Sprint 1.
Ele não substitui ADRs: quando uma decisão se tornar estrutural ou difícil de
reverter, deve virar ADR própria.

## Decisões já aceitas para o piloto

### D1 — Persistência editorial

- decisão: um dossiê por obra em `data/dossiers/`;
- fundamento: ADR 0001;
- impacto no Sprint 1: schemas, fixtures, validação e migração devem partir do
  dossiê de obra, não de banco de dados nem de arquivos normalizados por
  entidade;
- revisão: somente se os critérios de revisão da ADR 0001 forem atingidos.

### D2 — Catálogo público como artefato gerado

- decisão: `public/catalog.json` permanece artefato gerado;
- impacto no Sprint 1: nenhum fluxo novo deve editar o catálogo público como
  fonte de verdade;
- dependência: projeção dos dossiês para o contrato legado enquanto a interface
  principal não migrar.

### D3 — Compatibilidade incremental

- decisão: `data/editorial.json`, `public/musicxml/` e o contrato `Song`
  continuam funcionando durante a transição;
- impacto no Sprint 1: migrações precisam ser repetíveis e preservar o sistema
  navegável a cada commit;
- saída esperada: relatório humano para qualquer campo herdado sem equivalência
  editorial completa.

## Decisões que o Sprint 1 deve fechar

### A1 — Extensão e formato físico dos dossiês

- estado: pendente;
- opção preferida atual: JSON versionado, por já estar implementado e coberto
  por testes;
- alternativas: YAML ou JSON com comentários não são adotados sem necessidade
  comprovada;
- critério de aceite: diffs continuam revisáveis e validação automática aponta
  erros localizados;
- saída esperada: confirmar `.json` como formato do piloto ou abrir ADR de
  mudança antes de criar novos schemas.

### A2 — Layout estável de pastas

- estado: pendente;
- opção preferida atual: `data/dossiers/<workId>.json`;
- critérios:
  - o caminho não define identidade;
  - renomear arquivo não altera `work.id`;
  - subpastas só entram se volume ou revisão humana exigirem;
- saída esperada: regra documentada para criação, renomeação e localização dos
  dossiês.

### A3 — Política de identificadores e aliases públicos

- estado: registrada para o piloto;
- escopo: `work.id`, `edition.id`, `asset.id`, `publicCatalogId` e aliases de
  URLs legadas;
- critérios:
  - IDs internos são estáveis e não dependem de caminho;
  - aliases públicos preservam compatibilidade quando título ou arquivo mudam;
  - IDs removidos não são reutilizados;
- saída esperada: política normativa antes de ampliar o acervo;
- referência: [Política de identificadores e aliases v1](politica-identificadores-aliases-v1.md).

### A4 — Relação entre importador local e dossiê

- estado: pendente;
- escopo: `/import` e `/api/import`;
- critérios:
  - importar MusicXML não deve duplicar obra existente;
  - substituir asset deve preservar histórico;
  - exclusão local não deve apagar silenciosamente identidade ou decisões;
  - conflitos devem ser bloqueantes e legíveis;
- saída esperada: contrato de escrita do importador antes de migrar a UI.

### A5 — Projeção pública governada por direitos

- estado: pendente;
- escopo: quais dados entram no catálogo público quando direitos por ação não
  estiverem liberados;
- critérios:
  - metadados podem ser permitidos sem partitura;
  - partitura, playback, impressão e download dependem de permissões próprias;
  - `nao_avaliada` se comporta como bloqueio público;
- saída esperada: regra de projeção para obras sem MusicXML publicável.

### A6 — Índices gerados

- estado: pendente;
- escopo: índices auxiliares para busca, publicação ou revisão;
- decisão provisória: não criar índice persistido até existir necessidade real;
- critérios para revisar:
  - lentidão perceptível ao carregar dossiês;
  - necessidade de consulta global pela bancada;
  - divergência frequente entre dossiês e catálogo projetado;
- saída esperada: manter leitura direta dos dossiês no piloto, salvo novo ADR.

## Decisões fora do Sprint 1

- banco de dados multiusuário;
- deduplicação global de fontes;
- persistência privada para assets não publicáveis;
- workflow colaborativo com permissões por pessoa;
- interface editorial completa separada do importador local.

## Porta de saída

Antes de iniciar Sprint 1B/1C, este registro deve permitir responder:

1. onde cada entidade editorial vive;
2. qual arquivo é fonte de verdade;
3. qual artefato é gerado;
4. como manter compatibilidade com o sistema atual;
5. quais decisões exigem ADR própria antes de implementação.
