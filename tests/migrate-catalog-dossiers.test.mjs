import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyMigrationPlan,
  main,
  migrationPlan,
} from "../scripts/migrate-catalog-dossiers.mjs";

function catalog() {
  return {
    songs: [
      {
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
      },
    ],
  };
}

async function writeCatalogFixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-migrate-"),
  );
  const catalogPath = path.join(directory, "catalog.json");
  const dossierDirectory = path.join(directory, "dossiers");
  await fs.writeFile(catalogPath, `${JSON.stringify(catalog(), null, 2)}\n`);

  return { catalogPath, dossierDirectory };
}

test("plans migration without writing dossier files", async () => {
  const { catalogPath, dossierDirectory } = await writeCatalogFixture();
  const plan = await migrationPlan({ catalogPath, dossierDirectory });

  assert.equal(plan.files.length, 1);
  assert.equal(plan.files[0].action, "create");
  assert.equal(plan.files[0].id, "asa-branca");
  await assert.rejects(
    () => fs.access(path.join(dossierDirectory, "obra-asa-branca.json")),
    /ENOENT/,
  );
});

test("writes migration atomically and becomes unchanged on the second plan", async () => {
  const { catalogPath, dossierDirectory } = await writeCatalogFixture();
  const firstPlan = await migrationPlan({ catalogPath, dossierDirectory });

  await applyMigrationPlan(firstPlan);

  const dossierPath = path.join(dossierDirectory, "obra-asa-branca.json");
  const dossier = JSON.parse(await fs.readFile(dossierPath, "utf8"));
  assert.equal(dossier.publicCatalogId, "asa-branca");

  const secondPlan = await migrationPlan({ catalogPath, dossierDirectory });
  assert.equal(secondPlan.files[0].action, "unchanged");
});

test("check mode rejects pending migrations", async () => {
  const { catalogPath, dossierDirectory } = await writeCatalogFixture();

  await assert.rejects(
    () => main(["--check", "--catalog", catalogPath, "--out", dossierDirectory]),
    /Migracao de dossies pendente/,
  );
});

test("write mode creates the expected dossier", async () => {
  const { catalogPath, dossierDirectory } = await writeCatalogFixture();

  await main(["--write", "--catalog", catalogPath, "--out", dossierDirectory]);

  const dossier = JSON.parse(
    await fs.readFile(path.join(dossierDirectory, "obra-asa-branca.json"), "utf8"),
  );
  assert.equal(dossier.work.preferredTitle, "Asa branca");
});
