import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildCandidateEditorialDossier,
  reserveCandidateEditorialDossier,
} from "../lib/new-editorial-dossier.mjs";

test("constroi um dossie candidato sem asset ou permissao publica", () => {
  const dossier = buildCandidateEditorialDossier({
    composer: "Compositora Fixture",
    title: "Obra Fixture",
    workId: "obra-fixture",
  });

  assert.equal(dossier.curation.status, "candidata");
  assert.equal(dossier.work.creators[0].name, "Compositora Fixture");
  assert.deepEqual(dossier.editions, []);
  assert.deepEqual(dossier.assets, []);
  assert.equal(dossier.rights.actions.exibir_partitura, "nao_avaliada");
  assert.equal(dossier.rights.actions.distribuir_musicxml, "nao_avaliada");
});

test("reserva o arquivo sem sobrescrever um dossie concorrente", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-new-work-"));
  const dossier = buildCandidateEditorialDossier({
    composer: "Nao informado",
    title: "Obra Fixture",
    workId: "obra-fixture",
  });

  try {
    const reserved = await reserveCandidateEditorialDossier({
      dossier,
      dossierDirectory: directory,
    });
    assert.equal(
      JSON.parse(await fs.readFile(reserved.filePath, "utf8")).work.creators[0].role,
      "unknown",
    );
    await assert.rejects(
      () =>
        reserveCandidateEditorialDossier({ dossier, dossierDirectory: directory }),
      (error) => error.code === "EEXIST",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
