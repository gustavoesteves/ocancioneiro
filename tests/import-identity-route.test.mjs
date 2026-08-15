import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const XML = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Rosa</work-title></work><identification><creator type="composer">Outro compositor</creator></identification><part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list><part id="P1"><measure number="1"/></part></score-partwise>`;

function dossier() {
  return {
    schemaVersion: 1,
    work: {
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
      creators: [{ name: "Pixinguinha", role: "composer" }],
    },
    curation: { status: "candidata" },
    sources: [],
    evidence: [],
    editions: [],
    assets: [],
    rights: {
      status: "nao_verificado",
      actions: {
        exibir_metadados: "permitida",
        exibir_partitura: "nao_avaliada",
        reproduzir_playback: "nao_avaliada",
        imprimir: "nao_avaliada",
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "nao_avaliada",
      },
    },
  };
}

function request(identityConfirmed) {
  return new Request("http://localhost:3000/api/import", {
    body: JSON.stringify({
      confirmedBy: "editor-fixture",
      dossierWorkId: "obra-carinhoso",
      editionId: "edicao-importada-rosa",
      id: "rosa",
      identityConfirmed,
      provenance: "manual_file",
      xml: XML,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

test("API exige confirmacao explicita para identidade divergente", async () => {
  const originalDirectory = process.cwd();
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-identity-"));
  const dossierDirectory = path.join(projectRoot, "data", "dossiers");
  await fs.mkdir(dossierDirectory, { recursive: true });
  await fs.mkdir(path.join(projectRoot, "public"));
  await fs.writeFile(
    path.join(projectRoot, "public", "catalog.json"),
    `${JSON.stringify({ schemaVersion: 2, songs: [] }, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(dossierDirectory, "carinhoso.json"),
    `${JSON.stringify(dossier(), null, 2)}\n`,
  );

  try {
    process.chdir(projectRoot);
    const { DELETE, GET, POST } = await import(
      `../app/api/import/route.ts?identity-test=${Date.now()}`
    );
    const listed = await GET(new Request("http://localhost:3000/api/import"));
    const listedText = await listed.text();
    const listedBody = JSON.parse(listedText);
    assert.equal(listed.status, 200);
    assert.equal(listedBody.dossiers[0].workId, "obra-carinhoso");
    assert.equal("filePath" in listedBody.dossiers[0], false);
    assert.doesNotMatch(listedText, new RegExp(projectRoot));

    const rejected = await POST(request(false));
    const rejectedBody = await rejected.json();
    assert.equal(rejected.status, 409);
    assert.equal(rejectedBody.differences.length, 2);
    await assert.rejects(() => fs.access(path.join(projectRoot, ".local")), /ENOENT/);

    const accepted = await POST(request(true));
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 201);
    assert.equal(acceptedBody.capture.workId, "obra-carinhoso");

    const discarded = await DELETE(
      new Request("http://localhost:3000/api/import", {
        body: JSON.stringify({ captureId: acceptedBody.capture.captureId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      }),
    );
    const discardedBody = await discarded.json();
    assert.equal(discarded.status, 200);
    assert.equal(discardedBody.captureId, acceptedBody.capture.captureId);
    assert.equal(discardedBody.recoverable, true);
  } finally {
    process.chdir(originalDirectory);
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
