import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImportLibraryEntries,
  filterImportLibraryEntries,
} from "../app/import-library-model.ts";

function song(index) {
  return {
    composer: index % 2 === 0 ? "Pixinguinha" : "Chiquinha Gonzaga",
    id: `obra-${String(index).padStart(3, "0")}`,
    musicxml: `/musicxml/obra-${index}.musicxml`,
    title: index === 42 ? "Carinhoso" : `Obra ${String(index).padStart(3, "0")}`,
  };
}

function dossier(index) {
  const id = `obra-${String(index).padStart(3, "0")}`;
  return {
    assetCount: index < 200 ? 1 : 0,
    creators: [{ name: index % 2 === 0 ? "Pixinguinha" : "Chiquinha Gonzaga", role: "composer" }],
    editionCount: 1,
    projectionIssues: index % 20 === 0 ? ["direito publico bloqueado"] : [],
    publicCatalogId: index < 200 ? id : null,
    publicable: index < 200 && index % 20 !== 0,
    status: index < 200 ? "aceita" : "candidata",
    title: index === 42 ? "Carinhoso" : `Obra ${String(index).padStart(3, "0")}`,
    workId: `work-${id}`,
  };
}

test("unifica e pesquisa um acervo com centenas de obras", () => {
  const songs = Array.from({ length: 200 }, (_, index) => song(index));
  const dossiers = Array.from({ length: 250 }, (_, index) => dossier(index));
  const entries = buildImportLibraryEntries(songs, dossiers);

  assert.equal(entries.length, 250);
  assert.equal(
    filterImportLibraryEntries(entries, { filter: "all", query: "carinhoso" })[0]
      .song.id,
    "obra-042",
  );
  assert.equal(
    filterImportLibraryEntries(entries, { filter: "all", query: "chiquinha" })
      .length,
    125,
  );
  assert.equal(
    filterImportLibraryEntries(entries, { filter: "no_asset", query: "" }).length,
    50,
  );
  assert.equal(
    filterImportLibraryEntries(entries, { filter: "blocked", query: "" }).length,
    13,
  );
});

test("normaliza acentos durante a busca", () => {
  const entries = buildImportLibraryEntries(
    [{ composer: "João", id: "cancao", title: "Canção" }],
    [],
  );
  assert.equal(
    filterImportLibraryEntries(entries, { filter: "all", query: "cancao joao" })
      .length,
    1,
  );
});
