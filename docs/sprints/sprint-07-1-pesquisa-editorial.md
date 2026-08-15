# Sprint 7.1 — Pesquisa editorial estruturada

**Status:** primeira fatia implementada; preenchimento editorial e gate obrigatorio pendentes

## Objetivo

Retirar fontes, evidencias e afirmacoes canonicas do JSON manual e oferecer um
fluxo local rastreavel por obra, sem misturar pesquisa com captura musical,
direitos ou publicacao.

## Fluxo inicial

```text
Acervo -> dossie -> Registrar pesquisa
                   -> fonte reencontravel
                   -> evidencia avaliada e localizada
                   -> afirmacao canonica ligada a evidencia
```

Cada envio cria os tres registros juntos. A fonte recebe identificador estavel;
a evidencia referencia essa fonte; a afirmacao canonica referencia a evidencia
e, quando existe, a decisao curatorial vigente.

## Entrega implementada

- [x] rota local `/import/obras/[workId]/pesquisa`;
- [x] API restrita a host e origem locais;
- [x] vocabularios controlados fornecidos pelo dominio;
- [x] URLs limitadas a HTTP e HTTPS;
- [x] fingerprint para impedir sobrescrita concorrente;
- [x] trava compartilhada com outras escritas editoriais;
- [x] escrita atomica do dossie;
- [x] registro aditivo sem alteracao de MusicXML, direitos ou catalogo publico;
- [x] fonte, evidencia e afirmacao criadas como conjunto ligado;
- [x] historico aditivo para correcao ou substituicao de fonte/evidencia;
- [x] testes de contrato, seguranca e concorrencia otimista.

## Decisoes de seguranca editorial

A primeira fatia nao permite apagar registros. Remocao ou correcao de pesquisa
ja ligada a uma decisao precisara de historico explicito, em vez de mutacao
silenciosa. O sistema tambem nao busca, resume nem classifica fontes
automaticamente; o conteudo e a avaliacao permanecem responsabilidade do
editor pesquisador.

## Proximas fatias

- [x] reutilizar uma fonte existente em novas evidencias sem duplica-la;
- [x] registrar substituicao ou correcao de fonte/evidencia preservando historico;
- exibir cobertura e contradicoes na fila de revisao;
- exigir pesquisa minima antes de uma nova aceitacao curatorial;
- preencher e revisar fontes reais de `Asa Branca` e `Atraente`;
- demonstrar o fluxo com editor independente.

O gate obrigatorio so sera ativado depois que a interface conseguir satisfaze-lo
sem edicao manual de arquivos.

## Atualizacao 2026-08-15

A primeira fatia da Sprint 7.1 foi publicada no `main` ate o commit `1d0c2d0`,
incluindo pesquisa editorial estruturada e reuso de fonte existente. O
`npm run check` passou com 215 testes, e o GitHub Pages publicou com sucesso no
run `31904010055`.

Na rodada seguinte, o dossie passou a aceitar `researchEvents` para registrar
correcao ou substituicao de fonte/evidencia sem alterar nem apagar o registro
original. A API local usa `PATCH` com o mesmo fingerprint e a mesma trava de
escrita editorial, e a tela de pesquisa ganhou um bloco de historico.

Pendencia operacional: o deploy avisou que `actions/deploy-pages@v4` ainda
referencia Node.js 20 e foi forcado pelo GitHub Actions a rodar em Node.js 24.
Vale abrir uma manutencao curta para atualizar a action/workflow antes que o
aviso vire falha.
