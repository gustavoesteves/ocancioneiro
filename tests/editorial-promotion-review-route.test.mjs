import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GET,
  PUT,
} from "../app/api/import/dossiers/[workId]/review/route.ts";

function candidateDossier() {
  return {
    schemaVersion: 1,
    work: {
      creators: [{ name: "Autora Fixture", role: "composer" }],
      id: "obra-fixture",
      preferredTitle: "Obra fixture",
    },
    curation: { status: "candidata" },
    sources: [],
    evidence: [],
    editions: [
      {
        genre: "Choro",
        id: "edicao-fixture",
        level: "Intermediario",
        notes: "Edicao capturada.",
        source: "Fonte fixture",
        status: "em_revisao",
        tags: [],
        title: "Obra fixture",
      },
    ],
    assets: [],
    rights: {
      status: "nao_verificado",
      actions: {
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "nao_avaliada",
        exibir_metadados: "permitida",
        exibir_partitura: "nao_avaliada",
        imprimir: "nao_avaliada",
        reproduzir_playback: "nao_avaliada",
      },
    },
  };
}

async function fixtureRoot() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-review-"));
  await fs.mkdir(path.join(projectRoot, "data", "dossiers"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "public", "musicxml"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "data", "dossiers", "obra-fixture.json"),
    `${JSON.stringify(candidateDossier(), null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(projectRoot, "public", "catalog.json"),
    `${JSON.stringify({ schemaVersion: 2, songs: [] }, null, 2)}\n`,
  );
  return projectRoot;
}

function context() {
  return { params: Promise.resolve({ workId: "obra-fixture" }) };
}

function putRequest(fingerprint) {
  return new Request(
    "http://localhost:3000/api/import/dossiers/obra-fixture/review",
    {
      body: JSON.stringify({
        curationAccepted: true,
        curationDecidedBy: "Editora Fixture",
        curationJustification: "A obra foi aceita depois da verificacao editorial documentada.",
        curationReviewedBy: "Revisora Independente",
        editionId: "edicao-fixture",
        editionReviewed: true,
        editionReviewedBy: "Revisor Musical",
        expectedFingerprint: fingerprint,
        rightsBasis: "Dominio publico e procedencia da edicao verificados documentalmente.",
        rightsConfirmed: true,
        rightsConfirmedBy: "Responsavel Juridica",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
  );
}

test("review endpoint rejects public hosts before filesystem access", async () => {
  const response = await GET(
    new Request("https://example.com/api/import/dossiers/obra-fixture/review"),
    context(),
  );
  assert.equal(response.status, 403);
});

test("conclui gates com concorrencia otimista e sem criar asset publico", async () => {
  const projectRoot = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = projectRoot;
  try {
    const initialResponse = await GET(
      new Request("http://localhost:3000/api/import/dossiers/obra-fixture/review?edition=edicao-fixture"),
      context(),
    );
    const initial = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.equal(initial.gates.ready, false);

    const updateResponse = await PUT(putRequest(initial.fingerprint), context());
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.updated, true);
    assert.equal(updated.gates.ready, true);

    const persisted = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, "data", "dossiers", "obra-fixture.json"),
        "utf8",
      ),
    );
    assert.equal(persisted.editions[0].status, "valida");
    assert.equal(persisted.curation.status, "aceita");
    assert.equal(persisted.rights.status, "liberado");
    assert.deepEqual(persisted.assets, []);
    assert.deepEqual(await fs.readdir(path.join(projectRoot, "public", "musicxml")), []);
    const catalog = JSON.parse(
      await fs.readFile(path.join(projectRoot, "public", "catalog.json"), "utf8"),
    );
    assert.equal(catalog.songs.length, 1);
    assert.equal(catalog.songs[0].availability.status, "bloqueada");
    assert.equal("musicxml" in catalog.songs[0], false);

    const staleResponse = await PUT(putRequest(initial.fingerprint), context());
    const stale = await staleResponse.json();
    assert.equal(staleResponse.status, 409);
    assert.equal(stale.code, "DOSSIER_CHANGED");
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
