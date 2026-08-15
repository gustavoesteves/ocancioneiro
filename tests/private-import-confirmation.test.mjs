import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { confirmPrivateImport } from "../lib/private-import-confirmation.mjs";
import { sha256 } from "../lib/private-capture-store.mjs";

const XML = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Carinhoso</work-title></work><identification><creator type="composer">Pixinguinha</creator></identification><part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list><part id="P1"><measure number="1"/></part></score-partwise>`;

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

async function projectFixture() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-confirm-"));
  const dossierPath = path.join(projectRoot, "data", "dossiers", "carinhoso.json");
  await fs.mkdir(path.dirname(dossierPath), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "public"));
  await fs.writeFile(dossierPath, `${JSON.stringify(dossier(), null, 2)}\n`);
  return { dossierPath, projectRoot };
}

function confirmation(dossierEntry, projectRoot, expectedRawSha256 = sha256(XML)) {
  return confirmPrivateImport({
    capture: {
      captureId: "capture_confirm_000000001",
      confirmedBy: "editor-fixture",
      expectedRawSha256,
      provenance: "musescore_export",
      requestId: "request_confirm_000000001",
    },
    dossierEntry,
    editionId: "edicao-importada-carinhoso",
    editorial: {
      genre: "Choro",
      level: "Nao classificado",
      notes: "",
      source: "Dossie editorial",
      tags: ["choro"],
    },
    metadata: {
      chords: [],
      composer: "Pixinguinha",
      instrumentation: "Melodia",
      key: "Nao informado",
      partCount: 1,
      title: "Carinhoso",
    },
    projectRoot,
    xml: XML,
  });
}

test("confirma captura privada e cria edicao em revisao sem asset publico", async () => {
  const { dossierPath, projectRoot } = await projectFixture();

  try {
    const initial = dossier();
    const first = await confirmation({ dossier: initial, filePath: dossierPath }, projectRoot);
    const persisted = JSON.parse(await fs.readFile(dossierPath, "utf8"));

    assert.equal(first.captureCreated, true);
    assert.equal(first.editionCreated, true);
    assert.equal(persisted.editions.length, 1);
    assert.equal(persisted.editions[0].status, "em_revisao");
    assert.equal(persisted.assets.length, 0);
    assert.equal(JSON.stringify(persisted).includes("/.local/"), false);
    assert.equal(JSON.stringify(persisted).includes("/musicxml/"), false);

    const second = await confirmation(
      { dossier: persisted, filePath: dossierPath },
      projectRoot,
    );
    assert.equal(second.captureCreated, false);
    assert.equal(second.editionCreated, false);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});

test("restaura o dossie quando a selagem privada falha", async () => {
  const { dossierPath, projectRoot } = await projectFixture();
  const before = await fs.readFile(dossierPath, "utf8");

  try {
    await assert.rejects(
      () =>
        confirmation(
          { dossier: dossier(), filePath: dossierPath },
          projectRoot,
          "0".repeat(64),
        ),
      (error) => error.code === "RAW_HASH_MISMATCH",
    );
    assert.equal(await fs.readFile(dossierPath, "utf8"), before);
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
