import assert from "node:assert/strict";
import test from "node:test";
import {
  EditionMetadataError,
  updateEditionMetadata,
} from "../lib/editorial-edition-metadata.mjs";

function dossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autor", role: "composer" }],
      id: "obra-teste",
      preferredTitle: "Obra teste",
    },
    curation: { status: "candidata" },
    editions: [
      {
        chords: ["C", "G7"],
        encodedKey: "C maior",
        genre: "Nao classificado",
        id: "edicao-a",
        instrumentation: "Lead sheet",
        level: "Nao classificado",
        notes: "",
        source: "Acervo",
        status: "valida",
        tags: [],
        title: "Obra teste",
      },
    ],
    assets: [
      {
        checksum: "a".repeat(64),
        checksumAlgorithm: "sha256",
        editionId: "edicao-a",
        generatedAt: "2026-08-15",
        generatedBy: "fixture",
        id: "asset-teste-aaaaaaaaaaaa",
        path: "/musicxml/fixture.musicxml",
        status: "valido",
        type: "musicxml",
      },
    ],
    rights: {
      actions: { exibir_metadados: "permitida" },
      status: "nao_verificado",
    },
  };
}

test("edita somente os metadados catalograficos da edicao", () => {
  const original = dossier();
  const result = updateEditionMetadata(original, {
    editionId: "edicao-a",
    genre: "Baiao",
    level: "Intermediario",
    notes: "Revisado.",
    source: "Fonte editorial",
    tags: ["nordeste", "Baiao", "baiao"],
  });

  assert.equal(result.changed, true);
  assert.equal(result.edition.genre, "Baiao");
  assert.deepEqual(result.edition.tags, ["nordeste", "Baiao"]);
  assert.deepEqual(result.dossier.assets, original.assets);
  assert.deepEqual(result.dossier.editions[0].chords, ["C", "G7"]);
  assert.equal(result.dossier.editions[0].encodedKey, "C maior");
  assert.equal(result.dossier.editions[0].status, "valida");
});

test("nao cria uma nova edicao e rejeita metadados incompletos", () => {
  const original = dossier();
  assert.throws(
    () =>
      updateEditionMetadata(original, {
        editionId: "edicao-inexistente",
        genre: "Baiao",
        level: "Intermediario",
        notes: "",
        source: "Fonte",
        tags: [],
      }),
    (error) => error instanceof EditionMetadataError && error.code === "EDITION_NOT_FOUND",
  );
  assert.throws(
    () =>
      updateEditionMetadata(original, {
        editionId: "edicao-a",
        genre: "",
        level: "Intermediario",
        notes: "",
        source: "Fonte",
        tags: [],
      }),
    (error) =>
      error instanceof EditionMetadataError &&
      error.code === "INVALID_EDITION_METADATA",
  );
  assert.equal(original.editions.length, 1);
});
