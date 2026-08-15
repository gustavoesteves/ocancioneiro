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
- [x] testes de contrato, seguranca e concorrencia otimista.

## Decisoes de seguranca editorial

A primeira fatia nao permite apagar registros. Remocao ou correcao de pesquisa
ja ligada a uma decisao precisara de historico explicito, em vez de mutacao
silenciosa. O sistema tambem nao busca, resume nem classifica fontes
automaticamente; o conteudo e a avaliacao permanecem responsabilidade do
editor pesquisador.

## Proximas fatias

- reutilizar uma fonte existente em novas evidencias sem duplica-la;
- registrar substituicao ou correcao de fonte/evidencia preservando historico;
- exibir cobertura e contradicoes na fila de revisao;
- exigir pesquisa minima antes de uma nova aceitacao curatorial;
- preencher e revisar fontes reais de `Asa Branca` e `Atraente`;
- demonstrar o fluxo com editor independente.

O gate obrigatorio so sera ativado depois que a interface conseguir satisfaze-lo
sem edicao manual de arquivos.
