# O Cancioneiro

O Cancioneiro e um acervo navegavel de partituras em MusicXML. A ideia e manter
as obras como arquivos-fonte versionados, exibir as partituras no browser e
oferecer busca, filtros, download, impressao/PDF e playback simples.

## O Que Existe Hoje

- Catalogo carregado de `public/catalog.json`.
- Partituras em `public/musicxml/`.
- Renderizacao online com OpenSheetMusicDisplay.
- Busca por titulo, compositor, genero, tom, instrumentacao e tags.
- Filtros por nivel e genero.
- Download do MusicXML original.
- Impressao pelo navegador, incluindo salvar como PDF.
- Playback simples no navegador a partir do MusicXML.

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

1. Exporte ou salve a partitura em MusicXML.
2. Coloque o arquivo em `public/musicxml/`.
3. Rode:

```bash
npm run catalog:generate
```

O script varre `public/musicxml/`, le os arquivos `.musicxml` e `.xml`, e
combina os dados extraidos com `data/editorial.json`. A saida final e
`public/catalog.json`.

Para validar que o catalogo versionado esta sincronizado sem modifica-lo:

```bash
npm run catalog:check
```

## O Que O Script Detecta

O script tenta extrair automaticamente:

- `title`: de `<work-title>` ou `<movement-title>`.
- `composer`: de `<creator type="composer">`.
- `key`: de `<fifths>` e `<mode>`.
- `instrumentation`: de `<part-name>`.
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

Depois revise `data/editorial.json` para preencher os campos editoriais que o
MusicXML nao sabe informar bem, como genero, nivel, notas pedagogicas e tags, e
rode `npm run catalog:generate` novamente.

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

O playback atual e propositalmente simples. Ele le notas, pausas, duracoes,
acordes simples e tempo basico do MusicXML, entao gera som com Web Audio no
browser.

Isso ja serve para conferir a melodia e validar a experiencia. Uma versao mais
musical pode vir depois com MIDI real, SoundFont, cursor seguindo a partitura,
controle de andamento e metronomo.
