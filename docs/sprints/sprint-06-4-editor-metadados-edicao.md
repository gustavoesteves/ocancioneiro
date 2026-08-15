# Sprint 6.4 — Editor de metadados da edicao

## Objetivo

Permitir correcoes catalograficas em edicoes existentes sem confundir a mudanca
com uma nova importacao musical.

## Fronteira funcional

O editor pode alterar somente:

- genero;
- nivel;
- fonte editorial;
- notas editoriais;
- tags.

Titulo, autoria, tom, acordes, instrumentacao, estado da edicao, direitos,
curadoria, assets e MusicXML ficam fora desta operacao.

## Fluxo

```text
Acervo -> dossie -> editar metadados -> salvar dossie
                                      -> regenerar catalogo
                                      -> revisar lote
```

## Seguranca e consistencia

- [x] API restrita a host e origem locais;
- [x] `workId` resolvido pelo indice validado de dossies, sem caminho fornecido pelo cliente;
- [x] fingerprint do arquivo impede sobrescrita de uma versao mais nova;
- [x] trava compartilhada com a promocao serializa escritas em dossie e catalogo;
- [x] escrita atomica do dossie;
- [x] rollback de dossie e catalogo quando a regeneracao falha;
- [x] nenhuma escrita em `data/editorial.json`;
- [x] nenhum acesso de escrita ao MusicXML;
- [x] atualizacao legada por `PUT /api/import` aposentada com `410 Gone`;
- [x] exclusao publica legada por `DELETE /api/import` aposentada com `410 Gone`;
- [x] `DELETE /api/import` preservado somente para descarte privado recuperavel;
- [x] tela de captura sem atalho oculto para editar ou excluir assets publicos;
- [x] tags vazias, excessivas ou duplicadas sao normalizadas ou rejeitadas.

## Criterios de aceite

- [x] Asa Branca abre com `edicao-legada` selecionada;
- [x] uma alteracao de genero aparece na projecao do catalogo;
- [x] o MusicXML permanece byte a byte identico;
- [x] o estado musical e os acordes da edicao permanecem inalterados;
- [x] uma tentativa com fingerprint antigo recebe conflito;
- [x] falha de regeneracao restaura os dois arquivos;
- [x] ensaio visual do formulario em desktop e celular;
- [x] verificacao completa do repositorio e pacote publico.

O ensaio foi registrado em
[`docs/evidencias/ensaio-editor-metadados-s64-2026-08-15.md`](../evidencias/ensaio-editor-metadados-s64-2026-08-15.md).
