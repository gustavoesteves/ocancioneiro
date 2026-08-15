# Sprint 6.3 — Interface editorial multipagina

## Objetivo

Separar responsabilidades da estacao editorial local para que captura, consulta,
revisao e publicacao continuem compreensiveis com centenas de obras.

## Rotas e responsabilidades

| Rota | Responsabilidade | Nao faz |
| --- | --- | --- |
| `/import` | indicadores e proximas acoes | editar ou publicar |
| `/import/capturar` | receber, visualizar, vincular e confirmar MusicXML privado | listar todo o acervo antes de uma captura |
| `/import/acervo` | buscar obras, filtrar estados e consultar dossies | gravar captura ou executar Git |
| `/import/revisao` | listar capturas privadas e pendencias editoriais | expor XML bruto, caminhos ou responsaveis privados |
| `/import/publicacao` | verificar o lote, criar branch/PR e autorizar merge | promover captura implicitamente |
| `/import/obras/[workId]` | mostrar o resumo completo de uma obra | alterar o dossie |

O shell compartilhado identifica explicitamente que toda a estacao e local. As
rotas e APIs continuam excluidas do artefato do GitHub Pages.

## Entregas

- [x] navegacao compartilhada e estado ativo;
- [x] painel com contagens de acervo, revisao e lote local;
- [x] captura focada, com seletor de destino exibido somente apos receber XML;
- [x] acervo paginado por blocos de 30 e detalhe lateral;
- [x] pagina de dossie por `workId`;
- [x] fila de capturas privadas sem conteudo ou caminhos sensiveis;
- [x] isolamento da publicacao em pagina propria;
- [x] API de revisao restrita a host e origem locais;
- [x] teste de integridade e minimizacao da listagem privada;
- [x] ensaio visual manual em larguras desktop e celular;

O ensaio foi registrado em
[`docs/evidencias/ensaio-visual-s63-2026-08-15.md`](../evidencias/ensaio-visual-s63-2026-08-15.md).

## Criterios de aceite

- abrir `/import` nao inicializa a previa de partitura nem mostra 200 obras;
- a lista completa fica em `/import/acervo` e renderiza no maximo 30 por bloco;
- a captura so pede um destino depois que existe um MusicXML valido;
- a fila continua disponivel se uma captura local estiver corrompida, mas omite
  o registro inseguro e sinaliza a falha;
- nenhuma resposta de revisao inclui XML, caminho do filesystem ou
  `confirmedBy`;
- commit, push, merge e deploy continuam exigindo acoes separadas;
- `npm run check` e a verificacao do pacote publico permanecem verdes.
