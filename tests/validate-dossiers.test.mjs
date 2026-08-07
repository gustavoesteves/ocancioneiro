import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  dossierReviewReport,
  listDossierFiles,
  loadEditorialDossiers,
} from "../scripts/validate-dossiers.mjs";

function dossier(id, title) {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autor", role: "composer" }],
      id,
      preferredTitle: title,
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
  };
}

test("loads the repository editorial dossiers", async () => {
  const loaded = await loadEditorialDossiers();

  assert.ok(
    loaded.some(({ dossier }) => dossier.work.id === "obra-carinhoso"),
  );
});

test("reports editorial review gaps without rejecting the dossier", async () => {
  const report = dossierReviewReport([
    {
      dossier: dossier("obra-sem-decisao", "Obra sem decisao"),
      filePath: "data/dossiers/obra-sem-decisao.json",
    },
  ]);
  report[0].pending.sort();

  assert.deepEqual(report, [
    {
      filePath: "data/dossiers/obra-sem-decisao.json",
      label: "obra-sem-decisao (Obra sem decisao)",
      pending: [
        "sem decisao vigente",
        "sem evidencias estruturadas",
        "sem fontes estruturadas",
      ],
    },
  ]);
});

test("treats a missing dossier directory as empty", async () => {
  const missingDirectory = path.join(
    os.tmpdir(),
    `o-cancioneiro-missing-${Date.now()}`,
  );

  assert.deepEqual(await listDossierFiles(missingDirectory), []);
  assert.deepEqual(await loadEditorialDossiers(missingDirectory), []);
});

test("rejects duplicate work ids across dossier files", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "o-cancioneiro-dossiers-"),
  );

  await fs.writeFile(
    path.join(directory, "a.json"),
    JSON.stringify(dossier("obra-duplicada", "A"), null, 2),
  );
  await fs.writeFile(
    path.join(directory, "b.json"),
    JSON.stringify(dossier("obra-duplicada", "B"), null, 2),
  );

  await assert.rejects(
    () => loadEditorialDossiers(directory),
    /duplica work\.id obra-duplicada/,
  );
});
