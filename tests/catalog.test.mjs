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
    tags: ["piano"],
    ...overrides,
  };
}

test("validates catalog shape, unique ids and safe MusicXML paths", () => {
  assert.deepEqual(parseCatalog({ songs: [song()] }).songs[0].tags, ["piano"]);

  assert.throws(
    () => parseCatalog({ songs: [song({ tags: "piano" })] }),
    CatalogValidationError,
  );
  assert.throws(
    () =>
      parseCatalog({
        songs: [
          song(),
          song({ musicxml: "/musicxml/outro.musicxml" }),
        ],
      }),
    /id duplicado/,
  );
  assert.throws(
    () =>
      parseCatalog({
        songs: [song({ musicxml: "/musicxml/../segredo.xml" })],
      }),
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
