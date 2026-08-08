# ADR 0001 — Persistencia editorial inicial

**Status:** aprovado para o piloto
**Data:** 2026-08-07
**Aprovado em:** 2026-08-08
**Contexto:** piloto editorial de Choro

## Decisao

O Cancioneiro adotara, no piloto, **um dossie por obra** como unidade primaria
de persistencia editorial. O formato inicial sera JSON versionado em
`data/dossiers/<work.id>.json`.

Cada dossie podera conter, em um unico documento estruturado:

- identidade da obra;
- autoria e aliases;
- curadoria canonica;
- fontes usadas no dossie;
- evidencias;
- decisoes editoriais;
- edicoes musicais;
- assets vinculados;
- avaliacoes de direitos.

O `public/catalog.json` continuara sendo artefato gerado, nao fonte de verdade.
O modelo atual de `data/editorial.json` e `public/musicxml/` permanece durante a
transicao ate a migracao ser validada.

## Alternativas consideradas

### 1. Arquivos normalizados por entidade

Separaria obras, fontes, evidencias, edicoes, assets e direitos em arquivos ou
pastas independentes.

Vantagens:

- melhor deduplicacao global;
- referencias muitos-para-muitos explicitas;
- crescimento mais organizado quando houver grande volume.

Custos:

- mais dificil revisar uma obra inteira em um unico diff;
- maior risco de referencias quebradas durante edicoes locais;
- operacoes atomicas ficam mais trabalhosas sem ferramenta madura;
- overhead alto antes de provar o modelo editorial.

### 2. Dossie unico por obra

Mantem a maior parte do contexto editorial de uma obra no mesmo arquivo.

Vantagens:

- revisao humana mais simples em Git;
- menor chance de escrita parcial durante o piloto;
- facilita entender a historia editorial de uma obra;
- reduz o custo inicial de criacao de fixtures e revisoes;
- combina melhor com a etapa de pesquisa, que naturalmente trabalha por obra.

Custos:

- fontes repetidas podem aparecer em mais de um dossie;
- consultas globais exigem indexacao ou leitura de varios arquivos;
- deduplicacao de fontes tera de ser tratada depois;
- dossies complexos podem crescer bastante.

### 3. Armazenamento relacional

Usaria banco de dados para representar entidades, relacionamentos e consultas.

Vantagens:

- integridade referencial nativa;
- consultas globais mais fortes;
- melhor para fluxo multiusuario futuro.

Custos:

- aumenta muito a complexidade operacional;
- dificulta revisao editorial por diff;
- exige migracoes e infraestrutura antes de necessidade comprovada;
- torna o projeto menos transparente para contribuicoes simples.

## Consequencias

- O Sprint 1 deve comecar por schemas e fixtures de dossie, nao por banco.
- A extensao inicial dos dossies sera `.json`.
- O layout inicial sera `data/dossiers/<work.id>.json`.
- IDs estaveis nao dependem do caminho do arquivo.
- Aliases publicos podem preservar URLs ou slugs legados.
- Fontes podem ser registradas localmente no dossie no piloto.
- A deduplicacao global de fontes sera uma decisao futura, quando houver volume
  e conflito suficientes.
- O gerador devera projetar os dossies para `public/catalog.json`.
- `/import` devera migrar depois para editar obra, edicao e asset sem apagar o
  dossie.

## Criterios para revisar esta decisao

Reavaliar a decisao se pelo menos um destes sinais aparecer durante ou apos o
piloto:

- fontes repetidas se tornarem impossiveis de auditar;
- dossies ficarem grandes a ponto de prejudicar revisao;
- consultas globais forem indispensaveis para a bancada;
- contribuicoes simultaneas gerarem conflitos frequentes;
- direitos exigirem controles que nao possam ser validados com arquivos;
- o volume de obras tornar a leitura completa dos dossies lenta demais.

## Decisoes adiadas

- formato alternativo aos arquivos JSON, se o piloto demonstrar necessidade;
- subpastas ou outro particionamento de dossies, se o volume justificar;
- formato de indices gerados;
- politica final de deduplicacao de fontes;
- persistencia privada para assets ainda nao publicaveis.
