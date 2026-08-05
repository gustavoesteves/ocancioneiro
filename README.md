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

## Como Adicionar Uma Obra

1. Exporte ou salve a partitura em MusicXML.
2. Coloque o arquivo em `public/musicxml/`.
3. Rode:

```bash
npm run catalog:generate
```

O script varre `public/musicxml/`, le os arquivos `.musicxml` e `.xml`, e
atualiza `public/catalog.json`.

## O Que O Script Detecta

O script tenta extrair automaticamente:

- `title`: de `<work-title>` ou `<movement-title>`.
- `composer`: de `<creator type="composer">`.
- `key`: de `<fifths>` e `<mode>`.
- `instrumentation`: de `<part-name>`.
- `musicxml`: caminho publico do arquivo.
- `id`: baseado no nome do arquivo.

Campos editoriais continuam sob nosso controle:

- `genre`
- `level`
- `source`
- `notes`
- `tags`

Quando uma musica ja existe no catalogo, o script preserva esses campos em vez
de sobrescrever tudo.

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

Depois revise `public/catalog.json` para preencher os campos editoriais que o
MusicXML nao sabe informar bem, como genero, nivel, notas pedagogicas e tags.

## Estrutura Principal

```text
app/
  components/
    CancioneiroApp.tsx
    ScoreViewer.tsx
public/
  catalog.json
  musicxml/
scripts/
  generate-catalog.mjs
```

## Observacoes Sobre Playback

O playback atual e propositalmente simples. Ele le notas, pausas, duracoes,
acordes simples e tempo basico do MusicXML, entao gera som com Web Audio no
browser.

Isso ja serve para conferir a melodia e validar a experiencia. Uma versao mais
musical pode vir depois com MIDI real, SoundFont, cursor seguindo a partitura,
controle de andamento e metronomo.
