import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET, POST } from "../app/api/import/route.ts";

const XML = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Obra nova</work-title></work><identification><creator type="composer">Compositora Nova</creator></identification><part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list><part id="P1"><measure number="1"/></part></score-partwise>`;

async function fixtureRoot() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-new-route-"));
  await fs.mkdir(path.join(projectRoot, "data", "dossiers"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "public"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "public", "catalog.json"),
    `${JSON.stringify({ schemaVersion: 2, songs: [] }, null, 2)}\n`,
  );
  return projectRoot;
}

function request(rawSha256) {
  return new Request("http://localhost:3000/api/import", {
    body: JSON.stringify({
      confirmedBy: "Editora Fixture",
      createDossier: true,
      dossierWorkId: "obra-obra-nova",
      editionId: "edicao-importada-obra-nova",
      id: "obra-nova",
      provenance: "manual_file",
      rawSha256,
      xml: XML,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

test("cria dossie e captura privada juntos sem escrever em public", async () => {
  const projectRoot = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = projectRoot;

  try {
    const response = await POST(request());
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.dossierCreated, true);
    assert.equal(result.capture.workId, "obra-obra-nova");

    const dossier = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, "data", "dossiers", "obra-obra-nova.json"),
        "utf8",
      ),
    );
    assert.equal(dossier.curation.status, "candidata");
    assert.equal(dossier.editions[0].status, "em_revisao");
    assert.deepEqual(dossier.assets, []);
    await assert.rejects(
      () => fs.access(path.join(projectRoot, "public", "musicxml")),
      /ENOENT/,
    );

    const listed = await GET(new Request("http://localhost:3000/api/import"));
    const library = await listed.json();
    assert.equal(library.dossiers[0].workId, "obra-obra-nova");

    const duplicate = await POST(request());
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, "DOSSIER_ALREADY_EXISTS");
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("remove o dossie provisório quando a captura privada falha", async () => {
  const projectRoot = await fixtureRoot();
  const previousRoot = process.env.CANCIONEIRO_PROJECT_ROOT;
  process.env.CANCIONEIRO_PROJECT_ROOT = projectRoot;

  try {
    const response = await POST(request("0".repeat(64)));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "RAW_HASH_MISMATCH");
    await assert.rejects(
      () =>
        fs.access(
          path.join(projectRoot, "data", "dossiers", "obra-obra-nova.json"),
        ),
      /ENOENT/,
    );
  } finally {
    if (previousRoot === undefined) delete process.env.CANCIONEIRO_PROJECT_ROOT;
    else process.env.CANCIONEIRO_PROJECT_ROOT = previousRoot;
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
