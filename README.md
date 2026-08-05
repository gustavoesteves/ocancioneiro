# O Cancioneiro

Acervo navegavel de partituras em MusicXML, renderizadas no browser com
OpenSheetMusicDisplay.

## Rodando localmente

```bash
npm install
npm run dev
```

Depois abra `http://localhost:3000/`.

## Adicionando musicas

1. Coloque o arquivo `.musicxml` em `public/musicxml/`.
2. Registre a musica em `public/catalog.json`.
3. Use caminhos absolutos a partir de `public`, por exemplo:

```json
{
  "id": "minha-musica",
  "title": "Minha musica",
  "composer": "Compositor",
  "genre": "Cancao",
  "key": "D menor",
  "level": "Intermediario",
  "instrumentation": "Melodia e cifra",
  "source": "Acervo",
  "musicxml": "/musicxml/minha-musica.musicxml",
  "notes": "Observacoes de estudo ou edicao.",
  "tags": ["cancao", "brasil", "violao"]
}
```

## Estado atual

- Catalogo lido de `public/catalog.json`.
- Partituras renderizadas no browser via MusicXML.
- Busca por titulo, compositor, genero, tom, instrumentacao e tags.
- Filtros por nivel e genero.
- Download do MusicXML original.
- Impressao pelo navegador, incluindo salvar como PDF.

Audio/MIDI deve entrar como uma camada separada. O OpenSheetMusicDisplay resolve
exibicao muito bem; reproducao confiavel no browser deve usar uma biblioteca ou
pipeline dedicado para converter MusicXML em MIDI/audio.
