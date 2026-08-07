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

  return { catalogPath, dossierDirectory, projectRoot: directory };
}

async function writeProjectFixture(catalogOverride = {}) {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-migrate-project-"),
  );
  const catalogPath = path.join(projectRoot, "public", "catalog.json");
  const dossierDirectory = path.join(projectRoot, "data", "dossiers");
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(
    catalogPath,
    `${JSON.stringify({ songs: [songWithOverride(catalogOverride)] }, null, 2)}\n`,
  );

  return { catalogPath, dossierDirectory, projectRoot };
}

function songWithOverride(overrides = {}) {
  return {
    ...catalog().songs[0],
    ...overrides,
  };
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
  const { catalogPath, dossierDirectory, projectRoot } =
    await writeCatalogFixture();

  await assert.rejects(
    () =>
      main([
        "--check",
        "--catalog",
        catalogPath,
        "--out",
        dossierDirectory,
        "--project-root",
        projectRoot,
      ]),
    /Migracao de dossies pendente/,
  );
});

test("write mode creates the expected dossier", async () => {
  const { catalogPath, dossierDirectory, projectRoot } =
    await writeCatalogFixture();

  await main([
    "--write",
    "--catalog",
    catalogPath,
    "--out",
    dossierDirectory,
    "--project-root",
    projectRoot,
  ]);

  const dossier = JSON.parse(
    await fs.readFile(path.join(dossierDirectory, "obra-asa-branca.json"), "utf8"),
  );
  assert.equal(dossier.work.preferredTitle, "Asa branca");
});

test("reports missing legacy MusicXML files before writing dossiers", async () => {
  const { catalogPath, dossierDirectory, projectRoot } =
    await writeProjectFixture();
  const plan = await migrationPlan({
    catalogPath,
    dossierDirectory,
    projectRoot,
  });

  assert.ok(plan.report[0].pending.includes("arquivo MusicXML legado ausente"));
});

test("reports divergent legacy source hashes before writing dossiers", async () => {
  const { catalogPath, dossierDirectory, projectRoot } =
    await writeProjectFixture({ sourceHash: "b".repeat(64) });
  const musicXmlDirectory = path.join(projectRoot, "public", "musicxml");
  await fs.mkdir(musicXmlDirectory, { recursive: true });
  await fs.writeFile(path.join(musicXmlDirectory, "asa-branca.musicxml"), "xml");

  const plan = await migrationPlan({
    catalogPath,
    dossierDirectory,
    projectRoot,
  });

  assert.ok(
    plan.report[0].pending.includes(
      "sourceHash legado diverge do arquivo MusicXML",
    ),
  );
});
