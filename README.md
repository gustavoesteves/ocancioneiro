# O Cancioneiro

O Cancioneiro e um acervo navegavel de partituras em MusicXML. A ideia e manter
as obras como arquivos-fonte versionados, exibir as partituras no browser e
oferecer busca, filtros, download, impressao/PDF e playback simples.

## O Que Existe Hoje

- Catalogo carregado de `public/catalog.json`.
- Partituras em `public/musicxml/`.
- Renderizacao online com OpenSheetMusicDisplay.
- Busca por titulo, compositor, genero, tom, instrumentacao e tags.
- Extracao de cifras/acordes a partir de `<harmony>` no MusicXML.
- Filtros por nivel e genero.
- Download do MusicXML original.
- Impressao pelo navegador, incluindo salvar como PDF.
- Playback simples no navegador a partir do MusicXML.

## Linha Editorial

O Cancioneiro segue a logica de um songbook/lead sheet, inspirado no uso
pratico de livros como o Real Book, mas voltado ao repertorio brasileiro.

Principio interno:

> O Cancioneiro nao documenta hits. Documenta repertorio.

Fama nao basta. Uma musica pode ter vendido milhoes e ainda assim nao ser
canonica musicalmente para a proposta do Cancioneiro. O contrario tambem
acontece: `Doce de Coco`, de Jacob do Bandolim, provavelmente e menos conhecida
do publico geral do que muitos sucessos radiofonicos brasileiros, mas para quem
toca Choro ela funciona quase como vocabulario basico.

Por isso, a entrada de uma obra deve ser avaliada por criterios musicais,
historicos e praticos, nao por popularidade isolada:

| Criterio | Pergunta |
| --- | --- |
| Permanencia | Continua sendo tocada depois de sua epoca? |
| Circulacao | Musicos de diferentes geracoes conhecem ou tocam? |
| Linguagem | Tornou-se referencia de uma linguagem brasileira? |
| Influencia | Gerou descendencia musical? |
| Regravacao | Foi reinterpretada de maneira relevante muitas vezes? |
| Valor instrumental | Funciona como repertorio de execucao, estudo ou improvisacao? |
| Valor historico | E impossivel contar a historia da musica brasileira sem ela? |
| Representatividade | E uma referencia fundamental de determinada tradicao brasileira? |

A politica detalhada esta em
[`docs/especificacao-editorial-v1.md`](docs/especificacao-editorial-v1.md). O
plano de implementacao e validacao pelo piloto de Choro esta em
[`docs/sprints/piloto-choro.md`](docs/sprints/piloto-choro.md).

O formato padrao de uma obra deve ser:

- melodia principal em uma pauta;
- cifras/acordes acima da melodia;
- forma e marcacoes essenciais quando ajudarem a tocar a musica;
- MusicXML limpo, legivel e facil de revisar.

O objetivo nao e publicar partituras completas, arranjos fechados ou reducoes
orquestrais. Isso deixaria o acervo mais lento de produzir e menos flexivel para
quem quer estudar, acompanhar, improvisar ou montar seu proprio arranjo.

Elementos alem de melodia, harmonia e forma basica so entram quando pertencem a
identidade executavel da composicao, possuem fonte e passam por decisao
editorial documentada. Convencoes de performance e elementos de arranjos podem
ser registrados fora da partitura, mas nao integram automaticamente o lead
sheet canonico.

## Como Rodar

Requisitos:

- Node.js `>=22.13.0`

Instale as dependencias:

```bash
npm install
```

Rode o app localmente:

```bash
npm run dev
```

Depois abra:

```text
http://localhost:3000/
```

Para checar se a versao compila:

```bash
npm run build
```

Para executar a verificacao completa usada no deploy:

```bash
npm run check
```

Para gerar a versao estatica usada pelo GitHub Pages:

```bash
npm run build:pages
```

## Como Adicionar Uma Obra

Se estiver rodando localmente, voce pode abrir `/import` para preparar a entrada
de uma nova peca pelo browser. A tela le um arquivo MusicXML local, mostra a
previa da partitura, extrai metadados e gera a sugestao de entrada para
`data/editorial.json`.

Em ambiente local, a tela tambem pode gravar a importacao no repositorio: ela
salva o MusicXML em `public/musicxml/<id>.musicxml`, atualiza
`data/editorial.json` e regenera `public/catalog.json`. Essa gravacao usa a API
local `/api/import`; no GitHub Pages ela nao deve ser considerada uma
funcionalidade publica.

1. Exporte ou salve a partitura em MusicXML.
2. Confira se ela segue a linha editorial do acervo:
   - melodia principal;
   - cifras/acordes em `<harmony>`;
   - titulo e compositor preenchidos quando possivel;
   - sem arranjo completo quando a melodia+cifra for suficiente.
3. Coloque o arquivo em `public/musicxml/`.
4. Rode:

```bash
npm run catalog:generate
```

O script varre `public/musicxml/`, le os arquivos `.musicxml` e `.xml`, e
combina os dados extraidos com `data/editorial.json`. A saida final e
`public/catalog.json`.

Ao final, o comando mostra pendencias editoriais. Se uma peca nova ainda nao
tiver entrada em `data/editorial.json`, o terminal imprime um snippet JSON que
pode ser usado como ponto de partida dentro de `songs`.

Para validar que o catalogo versionado esta sincronizado sem modifica-lo:

```bash
npm run catalog:check
```

## Dossies Editoriais

Os dossies estruturados vivem em `data/dossiers/`. Eles registram identidade da
obra, decisoes de curadoria, fontes, evidencias, edicoes, assets e direitos. O
JSON e a fonte editorial versionada; relatorios derivados devem ser gerados pelo
script para evitar divergencia.

Para validar os dossies:

```bash
npm run dossiers:check
```

Para gerar uma versao em Markdown, legivel no GitHub e adequada para revisao
humana:

```bash
npm run dossiers:review
```

Esse comando grava arquivos em `outputs/dossiers-review/`, pasta ignorada pelo
Git. Cada relatorio inclui pendencias, afirmacoes canonicas, decisoes, fontes,
evidencias com localizadores, edicoes, assets e permissao por acao. Use essa
saida para revisar o conteudo editorial sem abrir o codigo da aplicacao; quando
a revisao gerar mudancas, edite o JSON correspondente em `data/dossiers/` e
rode novamente `npm run dossiers:check`.

Decisoes editoriais podem ser seladas com `recordHash`, um SHA-256 calculado a
partir do proprio registro da decisao. Quando o campo existe, o validador acusa
qualquer alteracao silenciosa no conteudo da decisao. Mudancas de entendimento
devem entrar como nova decisao, preservando o historico.

## O Que O Script Detecta

O script tenta extrair automaticamente:

- `title`: de `<work-title>` ou `<movement-title>`.
- `composer`: de `<creator type="composer">`.
- `key`: de `<fifths>` e `<mode>`.
- `instrumentation`: de `<part-name>`.
- `chords`: de elementos `<harmony>`.
- `musicxml`: caminho publico do arquivo.
- `id`: baseado no caminho relativo do arquivo.

Campos editoriais ficam em `data/editorial.json`:

- `genre`
- `level`
- `source`
- `notes`
- `tags`

O `public/catalog.json` e um artefato gerado. Evite edita-lo manualmente. Para
alterar genero, nivel, fonte, notas ou tags, edite `data/editorial.json` e rode
`npm run catalog:generate`.

O manifesto editorial tambem e validado. Campos desconhecidos, tags vazias ou
valores obrigatorios vazios fazem o comando falhar. Entradas editoriais sem
MusicXML correspondente geram aviso no terminal, o que ajuda a encontrar ids
antigos depois de renomear ou remover arquivos.

Quando uma musica ja existe no catalogo, o script atualiza os campos derivados
do MusicXML e aplica os campos editoriais do manifesto. Durante migracoes, se um
id ainda nao existir no manifesto, o gerador consegue reaproveitar metadados
editoriais do catalogo existente. Uma assinatura SHA-256 interna (`sourceHash`)
mantem a identidade quando um arquivo sem alteracoes e movido ou renomeado.
IDs, caminhos e tipos tambem sao validados antes de o catalogo ser substituido
atomicamente.

## Exemplo De Entrada Editorial

```json
{
  "songs": {
    "estudo-de-abertura": {
      "genre": "Estudo",
      "level": "Inicial",
      "source": "Exemplo original",
      "notes": "Pequena peca de exemplo para validar o fluxo MusicXML.",
      "tags": ["musicxml", "exemplo", "melodia"]
    }
  }
}
```

## Exemplo De Entrada No Catalogo

```json
{
  "id": "estudo-de-abertura",
  "title": "Estudo de abertura",
  "composer": "O Cancioneiro",
  "genre": "Estudo",
  "key": "C maior",
  "level": "Inicial",
  "instrumentation": "Melodia",
  "source": "Exemplo original",
  "musicxml": "/musicxml/estudo-de-abertura.musicxml",
  "notes": "Pequena peca de exemplo para validar o fluxo MusicXML.",
  "chords": ["C", "G7"],
  "tags": ["musicxml", "exemplo", "melodia"]
}
```

## Fluxo Recomendado

Para uma nova peca:

```bash
cp minha-musica.musicxml public/musicxml/
npm run catalog:generate
npm run dev
```

Se preferir fazer manualmente depois:

1. copie o snippet sugerido pelo gerador para `data/editorial.json`, dentro de
   `songs`;
2. preencha `genre`, `level`, `source`, `notes` e `tags`;
3. rode `npm run catalog:generate` novamente;
4. abra o app e confira partitura, cifras, busca e playback;
5. rode `npm run check` antes de publicar.

O `public/catalog.json` deve mudar como resultado do gerador. Ele continua sendo
artefato gerado; revise o diff, mas prefira alterar metadados editoriais em
`data/editorial.json`.

## Estrutura Principal

```text
app/
  components/
    CancioneiroApp.tsx
    ScoreViewer.tsx
data/
  editorial.json
public/
  catalog.json
  musicxml/
scripts/
  generate-catalog.mjs
```

## Publicacao No GitHub Pages

O projeto inclui o workflow `.github/workflows/pages.yml`.

Quando houver push no branch `main`, o GitHub Actions:

1. instala as dependencias;
2. roda `npm run check`;
3. publica a pasta `github-pages` no GitHub Pages.

Em pull requests, o mesmo workflow roda a validacao, mas nao publica.

No GitHub, configure Pages para usar **GitHub Actions** como fonte de deploy.

## Observacoes Sobre Playback

O playback atual e propositalmente simples. A rotina compartilhada em
`lib/playback.mjs` le notas, pausas, duracoes, acordes escritos na pauta,
mudancas de andamento, `backup` e `forward` do MusicXML. A interface usa esses
eventos para gerar som com Web Audio no browser.

Isso ja serve para conferir a melodia, acordes basicos e entradas com multiplas
vozes simples. Ainda nao e uma interpretacao musical completa: nao aplica
articulacoes, dinamicas, swing, pedais, instrumentos reais, repeticoes
complexas, ornamentos ou acompanhamento a partir das cifras (`<harmony>`).

Os casos principais do parser ficam cobertos por `tests/playback.test.mjs`.
Quando o acervo real revelar novos limites, adicione primeiro um teste pequeno
com o trecho MusicXML minimo e depois ajuste `lib/playback.mjs`.

Uma versao mais musical pode vir depois com uma pipeline MusicXML para MIDI,
SoundFont, cursor seguindo a partitura, controle de andamento e metronomo.
