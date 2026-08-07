import assert from "node:assert/strict";
import test from "node:test";
import {
  migrateCatalogToDossiers,
  migrateSongToDossier,
} from "../lib/catalog-dossier-migration.mjs";
import { legacyCatalogFromDossiers } from "../lib/dossier-catalog-projection.mjs";

function song(overrides = {}) {
  return {
    id: "asa-branca",
    title: "Asa branca",
    composer: "Luiz Gonzaga",
    genre: "Baiao",
    key: "C maior",
    level: "Inicial",
    instrumentation: "Melodia e cifras",
    source: "Acervo legado",
    musicxml: "/musicxml/asa-branca.musicxml",
    notes: "Nota legada.",
    chords: ["C", "F", "G7"],
    tags: ["baiao"],
    sourceHash: "a".repeat(64),
    ...overrides,
  };
}

test("migrates a legacy catalog entry to a valid editorial dossier", () => {
  const dossier = migrateSongToDossier(song());

  assert.equal(dossier.publicCatalogId, "asa-branca");
  assert.equal(dossier.work.id, "obra-asa-branca");
  assert.deepEqual(dossier.work.creators, [
    { name: "Luiz Gonzaga", role: "composer" },
  ]);
  assert.equal(dossier.editions[0].publicCatalogId, "asa-branca");
  assert.equal(dossier.assets[0].checksum, "a".repeat(64));
  assert.equal(dossier.assets[0].status, "valido");
  assert.equal(dossier.sources[0].reference, "Acervo legado");
});

test("round-trips publicable migrated dossiers back to the legacy catalog", () => {
  const catalog = { songs: [song()] };
  const { dossiers } = migrateCatalogToDossiers(catalog);
  const projected = legacyCatalogFromDossiers(dossiers);

  assert.deepEqual(projected, catalog);
});

test("is deterministic for repeated migrations with the same inputs", () => {
  const catalog = { songs: [song()] };

  assert.deepEqual(
    migrateCatalogToDossiers(catalog),
    migrateCatalogToDossiers(catalog),
  );
});

test("keeps the public alias stable even when the work id is derived", () => {
  const dossier = migrateSongToDossier(song({ id: "subpasta-peca" }));

  assert.equal(dossier.publicCatalogId, "subpasta-peca");
  assert.equal(dossier.work.id, "obra-subpasta-peca");
  assert.equal(dossier.editions[0].publicCatalogId, "subpasta-peca");
});

test("reports legacy source and notes as pending editorial review", () => {
  const { report } = migrateCatalogToDossiers({ songs: [song()] });

  assert.deepEqual(report, [
    {
      id: "asa-branca",
      title: "Asa branca",
      pending: [
        "curadoria canonica precisa de revisao humana",
        "direitos herdados da publicacao legada precisam de confirmacao",
        "fonte legada precisa de estruturacao",
        "nota legada precisa de classificacao editorial",
      ],
    },
  ]);
});

test("handles empty legacy fields without inventing source or checksum", () => {
  const dossier = migrateSongToDossier(
    song({
      notes: "",
      source: "Nao informado",
      sourceHash: undefined,
    }),
  );

  assert.equal(dossier.sources[0].reference, "Nao informado");
  assert.equal(dossier.assets[0].status, "pendente");
  assert.equal(dossier.assets[0].checksum, undefined);
  assert.ok(dossier.migration.pending.includes("asset sem sourceHash legado"));
});

test("uses an unknown creator when composer is not informed", () => {
  const dossier = migrateSongToDossier(song({ composer: "Nao informado" }));

  assert.deepEqual(dossier.work.creators, [
    { name: "Autoria nao informada", role: "unknown" },
  ]);
});
