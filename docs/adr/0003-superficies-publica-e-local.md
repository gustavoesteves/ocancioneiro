# ADR 0003 — Separacao entre biblioteca publica e ferramenta local

**Status:** aprovado
**Data:** 2026-08-13

## Contexto

O Cancioneiro possui duas superficies com objetivos e riscos diferentes. A
biblioteca e o produto publicado para consulta. A ferramenta de importacao e
um ambiente editorial que recebe arquivos, conversa com servicos locais e pode
alterar dados do acervo.

Tratar as duas superficies como se fossem uma unica aplicacao publicavel
exporia rotas sem utilidade publica e aumentaria o risco de distribuir codigo
de escrita, caminhos locais ou integracoes editoriais.

## Decisao

O repositorio mantem duas superficies, mas apenas uma delas e publicavel:

| Capacidade | Biblioteca publica | Ferramenta local |
| --- | --- | --- |
| Catalogo, busca e visualizacao | Sim | Sim |
| Partitura e download | Conforme direitos e disponibilidade | Sim, para revisao autorizada |
| Rota `/import` | Nao | Sim |
| API `/api/import` | Nao | Sim |
| Escrita de dossiers e assets | Nao | Sim |
| Ponte com MuseScore | Nao | Sim |

### Biblioteca publica

- entrada: `app/github-pages-entry.tsx`;
- comando de producao: `npm run build:pages`;
- artefato: `github-pages/`;
- hospedagem oficial: GitHub Pages;
- responsabilidades: leitura do catalogo, navegacao, visualizacao, playback,
  impressao e download somente quando a politica de direitos permitir.

O ponto de entrada publico importa a biblioteca diretamente. Ele nao passa
pelo roteador que conhece a ferramenta de importacao.

### Ferramenta local

- entrada da aplicacao completa: `AppRouter`;
- comando de desenvolvimento: `npm run dev`;
- biblioteca local: `http://localhost:3000/`;
- importador local: `http://localhost:3000/import`;
- API editorial: `http://localhost:3000/api/import`.

O desenvolvimento local executa a aplicacao no runtime Node para que a API
editorial possa acessar, apos validar a raiz do projeto, `data/`, `public/` e a
area privada ignorada pelo Git. O plugin Cloudflare permanece ativo no comando
de build, mas nao no servidor de desenvolvimento. Dentro do runtime Workers o
filesystem e um bundle virtual somente de leitura e a API local falha fechada;
ele nao pode ser usado como substituto da ferramenta editorial da maquina.

`npm run build` valida a aplicacao que inclui a superficie local, mas seu
resultado nao e o artefato oficial de publicacao.

## Invariantes de seguranca e empacotamento

1. O pacote do GitHub Pages nao contem `import/index.html`.
2. JavaScript e HTML publicos nao contem a interface do importador nem
   referencias a `/api/import`, a ponte MuseScore ou seu protocolo.
3. Assets so entram no pacote publico depois da projecao editorial e da
   verificacao de direitos.
4. A API de importacao permanece restrita a hosts locais, como defesa adicional
   para o ambiente de desenvolvimento.
5. Qualquer violacao desses limites interrompe o build de Pages.
6. A superficie local nao deve ser publicada em outro provedor sem uma nova
   decisao arquitetural e uma revisao especifica de autenticacao, autorizacao,
   persistencia e segredos.
7. Respostas da API local nao incluem caminhos absolutos da maquina.

## Consequencias

- a biblioteca continua sendo uma aplicacao estatica e de somente leitura;
- o fluxo editorial pode evoluir sem aumentar a superficie publica;
- alteracoes no importador nao sao disponibilizadas automaticamente no deploy;
- os dois ambientes compartilham modelos e componentes quando isso nao rompe o
  limite de empacotamento;
- o gate de publicacao precisa testar a ausencia de rotas e marcadores locais,
  alem de validar os assets autorizados.

## Alternativas consideradas

### Publicar a tela de importacao sem a API

Rejeitada. A tela ficaria inutil no ambiente publico e ainda revelaria detalhes
do fluxo editorial.

### Manter um unico bundle e bloquear em tempo de execucao

Rejeitada. Uma verificacao de URL esconderia a tela, mas o codigo local ainda
seria distribuido no bundle publico.

### Separar imediatamente em dois repositorios

Adiada. O limite de entrada e de artefato atende a fase atual com menor custo.
Essa opcao deve ser reconsiderada se os ciclos de release, dependencias ou
permissoes das duas superficies divergirem de forma relevante.

## Criterios de revisao

Esta decisao deve ser revista antes de qualquer importacao remota, colaboracao
multiusuario, persistencia em nuvem, autenticacao editorial ou hospedagem da
ferramenta local.
