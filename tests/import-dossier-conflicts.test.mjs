import assert from "node:assert/strict";
import test from "node:test";
import {
  dossierConflictMessage,
  findDossierImportConflict,
} from "../lib/import-dossier-conflicts.mjs";

function dossier(overrides = {}) {
  return {
    schemaVersion: 1,
    publicCatalogId: "carinhoso",
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
    },
    curation: {
      status: "candidata",
    },
    rights: {
      actions: {
        exibir_metadados: "permitida",
      },
      status: "nao_verificado",
    },
    ...overrides,
  };
}

test("finds conflicts by public catalog id", () => {
  const conflict = findDossierImportConflict(
    [{ dossier: dossier(), filePath: "data/dossiers/obra-carinhoso.json" }],
    "carinhoso",
  );

  assert.deepEqual(conflict, {
    filePath: "data/dossiers/obra-carinhoso.json",
    publicCatalogId: "carinhoso",
    title: "Carinhoso",
    workId: "obra-carinhoso",
  });
});

test("finds conflicts by stable work id when no public alias exists", () => {
  const conflict = findDossierImportConflict(
    [
      {
        dossier: dossier({ publicCatalogId: undefined }),
        filePath: "data/dossiers/obra-carinhoso.json",
      },
    ],
    "carinhoso",
  );

  assert.equal(conflict.workId, "obra-carinhoso");
  assert.equal(conflict.publicCatalogId, null);
});

test("returns no conflict for unrelated dossiers", () => {
  const conflict = findDossierImportConflict(
    [{ dossier: dossier(), filePath: "data/dossiers/obra-carinhoso.json" }],
    "asa-branca",
  );

  assert.equal(conflict, null);
});

test("formats a local import blocker message", () => {
  assert.match(
    dossierConflictMessage({
      title: "Carinhoso",
      workId: "obra-carinhoso",
    }),
    /Vinculacao de MusicXML a dossie existente ainda nao foi migrada/,
  );
});
