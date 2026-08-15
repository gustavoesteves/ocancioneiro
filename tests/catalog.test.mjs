import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogValidationError,
  filterSongs,
  parseCatalog,
  resolveActiveSong,
} from "../lib/catalog.mjs";

function song(overrides = {}) {
  return {
    id: "estudo",
    title: "Estudo",
    composer: "Compositor",
    genre: "Estudo",
    key: "C maior",
    level: "Inicial",
    instrumentation: "Piano",
    source: "Acervo",
    musicxml: "/musicxml/estudo.musicxml",
    notes: "",
    chords: ["C", "G7"],
    tags: ["piano"],
    ...overrides,
  };
}

function publicSong(overrides = {}) {
  return {
    ...song(),
    availability: {
      status: "disponivel",
      reason: "Partitura disponivel.",
      actions: {
        exibir_partitura: true,
        reproduzir_playback: true,
        imprimir: true,
        baixar_pdf: false,
        distribuir_musicxml: true,
      },
    },
    ...overrides,
  };
}

test("validates catalog shape, unique ids and safe MusicXML paths", () => {
  assert.deepEqual(
    parseCatalog({ songs: [song()] }, { allowLegacy: true }).songs[0].tags,
    ["piano"],
  );

  assert.throws(
    () => parseCatalog({ songs: [song({ tags: "piano" })] }, { allowLegacy: true }),
    CatalogValidationError,
  );
  assert.throws(
    () =>
      parseCatalog(
        { songs: [song({ chords: ["C", ""] })] },
        { allowLegacy: true },
      ),
    CatalogValidationError,
  );
  assert.throws(
    () =>
      parseCatalog(
        {
          songs: [
            song(),
            song({ musicxml: "/musicxml/outro.musicxml" }),
          ],
        },
        { allowLegacy: true },
      ),
    /id duplicado/,
  );
  assert.throws(
    () =>
      parseCatalog(
        { songs: [song({ musicxml: "/musicxml/../segredo.xml" })] },
        { allowLegacy: true },
      ),
    /caminho seguro/,
  );
});

test("keeps the active song inside the filtered result", () => {
  const songs = [
    song({ id: "cancao", title: "Cancao", genre: "Cancao" }),
    song(),
  ];
  const filtered = filterSongs(songs, "Estudo", "Todos", "Todos");

  assert.deepEqual(filtered.map((entry) => entry.id), ["estudo"]);
  assert.equal(resolveActiveSong(filtered, "cancao")?.id, "estudo");
  assert.equal(resolveActiveSong([], "cancao"), null);
});

test("accepts metadata-only works without exposing a MusicXML URL", () => {
  const metadataOnly = publicSong({
    id: "carinhoso",
    musicxml: undefined,
    availability: {
      status: "sem_edicao",
      reason: "Partitura ainda nao disponivel.",
      actions: {
        exibir_partitura: false,
        reproduzir_playback: false,
        imprimir: false,
        baixar_pdf: false,
        distribuir_musicxml: false,
      },
    },
  });

  const parsed = parseCatalog({ schemaVersion: 2, songs: [metadataOnly] });
  assert.equal(parsed.songs[0].musicxml, undefined);
});

test("rejects static delivery when MusicXML distribution is blocked", () => {
  assert.throws(
    () =>
      parseCatalog({
        schemaVersion: 2,
        songs: [
          publicSong({
            availability: {
              status: "bloqueada",
              reason: "Distribuicao bloqueada.",
              actions: {
                exibir_partitura: true,
                reproduzir_playback: false,
                imprimir: true,
                baixar_pdf: false,
                distribuir_musicxml: false,
              },
            },
          }),
        ],
      }),
    /entrega MusicXML ao navegador sem permitir sua distribuicao/,
  );
});
