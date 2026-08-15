# Sprint 6.2 — Estacao editorial local e publicacao assistida

## Objetivo

Transformar `/import` em uma superficie local capaz de operar um acervo com
centenas de obras e conduzir revisao, versionamento, pull request e publicacao
sem exigir uso cotidiano do terminal.

## Fronteiras

- a ferramenta permanece acessivel apenas por loopback;
- capturas privadas continuam em `.local/cancioneiro/`;
- promover altera a arvore fonte, mas nao publica;
- preparar cria branch e commit locais;
- enviar cria o pull request, mas nao faz deploy;
- publicar faz merge apenas depois dos checks aprovados;
- o GitHub Pages continua sendo o unico mecanismo oficial de deploy;
- `/import` e suas APIs continuam ausentes do pacote publico.

## Entrega A — acervo escalavel

- [x] unificar catalogo e dossies em uma lista por obra;
- [x] buscar por titulo, compositor e identificadores;
- [x] filtrar publicadas, em revisao, bloqueadas e sem MusicXML;
- [x] limitar a primeira renderizacao a 30 obras;
- [x] carregar mais registros sob demanda;
- [x] manter a escolha de asset e de dossie como acoes distintas;
- [x] validar o modelo com fixture de 250 obras.

## Entrega B — revisao local

- [x] listar mudancas por categoria;
- [x] bloquear `.local/`, ambientes, saidas geradas e caminhos internos;
- [x] executar `npm run check` pela interface;
- [x] selar por hash o HEAD, diff rastreado e conteudo nao rastreado;
- [x] invalidar a verificacao quando qualquer conteudo mudar;
- [x] impedir preparacao parcial do lote.

## Entrega C — versionamento e GitHub

- [x] criar branch `codex/` quando o operador parte da `main`;
- [x] criar commit com responsavel editorial explicito;
- [x] usar chamadas sem shell e argumentos fechados;
- [x] fazer push somente apos confirmacao;
- [x] criar ou reutilizar pull request para `main`;
- [x] consultar checks e ultima execucao do Pages;
- [x] habilitar merge somente quando os checks terminarem com sucesso;
- [x] manter branch, commit, PR e responsavel no registro privado local.

## Estados visiveis

```text
mudancas locais
  -> verificadas
  -> versao preparada
  -> em revisao no GitHub
  -> checks aprovados
  -> merge confirmado
  -> deploy do Pages
```

Cada seta e uma operacao separada. Falhar em uma etapa nao executa a seguinte.

## Seguranca e recuperacao

- a API rejeita hosts e origens nao locais;
- nenhum texto do formulario e interpolado em shell;
- uma trava privada impede operacoes concorrentes;
- a verificacao e vinculada ao conteudo exato do lote;
- mudancas posteriores invalidam o selo;
- push e merge dependem da autenticacao existente do GitHub CLI;
- tokens nao sao lidos, armazenados ou devolvidos pela aplicacao;
- o terminal permanece disponivel para recuperacao excepcional.

## Criterios de aceite

- [x] busca acentuada e nao acentuada encontra a mesma obra;
- [x] fixture com 250 dossies nao renderiza todos de uma vez;
- [x] arquivo `.env` bloqueia a preparacao;
- [x] alteracao posterior invalida a verificacao;
- [x] commit so ocorre depois de verificacao atual;
- [x] PR nao publica;
- [x] merge depende de checks remotos aprovados;
- [ ] ensaio manual de push, PR e merge em branch de teste;
- [ ] confirmacao visual do deploy publicado.
