# Ensaio visual da Sprint 6.3 — 2026-08-15

## Ambiente

- aplicacao local em `http://localhost:3000`;
- viewport desktop: 1280 x 720;
- viewport celular: 390 x 844;
- dados locais: 1 musica publica, 2 dossies e nenhuma captura privada pendente;
- nenhuma acao de Git, GitHub, promocao ou deploy foi executada.

## Rotas verificadas

- `/import`;
- `/import/capturar`;
- `/import/acervo`;
- `/import/revisao`;
- `/import/publicacao`;
- `/import/obras/obra-asa-branca`;
- `/import/obras/obra-carinhoso`.

## Comportamentos confirmados

- navegacao entre as areas e indicador da rota ativa;
- busca por `carinhoso`, selecao e abertura do dossie;
- captura sem listagem do acervo antes de receber MusicXML;
- estado pareado da ponte e botao de captura disponivel;
- fila vazia de capturas com pendencia editorial de Carinhoso;
- publicacao aberta por padrao, com preparacao bloqueada antes da verificacao;
- ausencia de erros no console durante o percurso;
- ausencia de elementos ou controles fora do viewport celular.

## Problemas encontrados e corrigidos

1. O item **Publicacao** ficava fora da area inicialmente visivel do menu em
   390 px. O menu agora quebra em duas linhas no celular e permanece em uma
   linha a partir do breakpoint `sm`.
2. A pagina `/import/obras/[workId]` nao indicava sua area de origem. O item
   **Acervo** agora permanece ativo durante a consulta de um dossie.
