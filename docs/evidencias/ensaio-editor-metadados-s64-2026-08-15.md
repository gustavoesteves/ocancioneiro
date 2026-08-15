# Ensaio do editor de metadados — 2026-08-15

## Escopo

- dossie real aberto: `obra-asa-branca`;
- edicao selecionada: `edicao-legada`;
- viewport normal e celular de 390 x 844;
- nenhuma alteracao foi salva no acervo real durante o ensaio visual.

## Confirmacoes

- o dossie oferece **Editar metadados** e **Editar esta edicao**;
- a pagina abre com Asa Branca e a edicao valida selecionada;
- genero, nivel e fonte atuais sao carregados do dossie;
- o item **Acervo** permanece ativo na navegacao;
- todos os controles permanecem dentro do viewport celular;
- nenhum erro foi registrado no console.

## Ensaios automatizados em diretorio temporario

- alteracao de genero projetada no catalogo;
- MusicXML comparado byte a byte antes e depois;
- acordes, tom, estado da edicao e assets preservados;
- fingerprint antigo rejeitado com conflito;
- falha forcada na geracao restaura dossie e catalogo;
- `data/editorial.json` nao e criado.

## Confirmacao apos uso editorial

- a edicao `edicao-legada` e a projecao publica registram o genero `Baião`;
- o caminho MusicXML vigente permaneceu
  `/musicxml/asa-branca/asset-musicxml-asa-branca-8bec03e44904.musicxml`;
- a tela de captura foi ensaiada com o MusicXML vigente sem salvar: oferece
  apenas destino privado e nao exibe **Abrir asset**, **Salvar edicao**,
  **Excluir musica** nem referencias a `data/editorial.json`;
- o contrato legado `PUT /api/import` responde `410 Gone` sem processar o corpo;
- a exclusao publica legada tambem responde `410 Gone`, enquanto o descarte
  privado por `captureId` continua recuperavel;
- a verificacao completa passou com 187 testes e os dois builds.
