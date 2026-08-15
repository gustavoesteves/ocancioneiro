import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { publicCatalogFromDossiers } from "../lib/dossier-catalog-projection.mjs";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";
import {
  promotePrivateCapture,
  recoverInterruptedPromotions,
  rollbackPromotion,
} from "../lib/private-capture-promotion.mjs";
import {
  createPrivateCapture,
  verifyPrivateCapture,
} from "../lib/private-capture-store.mjs";

function xml(note = "C") {
  return `<?xml version="1.0"?>
<score-partwise version="4.0">
  <work><work-title>Carinhoso</work-title></work>
  <identification><creator type="composer">Pixinguinha</creator></identification>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>${note}</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part>
</score-partwise>`;
}

function eligibleDossier() {
  const decision = {
    decidedAt: "2026-08-13",
    decidedBy: "bancada-editorial",
    id: "decisao-aceita",
    justification: "Fixture aceita para testar promocao.",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-13",
        reviewedBy: "revisor-independente",
        role: "revisao-editorial",
        summary: "Edicao e direitos revisados.",
      },
    ],
    status: "aceita",
  };
  return {
    schemaVersion: 1,
    publicCatalogId: "carinhoso",
    work: {
      creators: [{ name: "Pixinguinha", role: "composer" }],
      id: "obra-carinhoso",
      preferredTitle: "Carinhoso",
    },
    curation: {
      currentDecisionId: decision.id,
      decisions: [{ ...decision, recordHash: decisionRecordHash(decision) }],
      status: "em_revisao",
    },
    sources: [],
    evidence: [],
    editions: [
      {
        genre: "Choro",
        id: "edicao-carinhoso",
        instrumentation: "Melodia",
        level: "Intermediario",
        notes: "Fixture editorial.",
        publicCatalogId: "carinhoso",
        source: "Fonte editorial",
        status: "valida",
        tags: ["choro"],
        title: "Carinhoso",
      },
    ],
    assets: [],
    rights: {
      status: "liberado",
      actions: {
        exibir_metadados: "permitida",
        exibir_partitura: "permitida",
        reproduzir_playback: "permitida",
        imprimir: "permitida",
        baixar_pdf: "nao_avaliada",
        distribuir_musicxml: "permitida",
      },
    },
  };
}

async function fixture({ captureId = "capture_promotion_00000001", note = "C" } = {}) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cancioneiro-promote-"));
  const dossierPath = path.join(projectRoot, "data", "dossiers", "carinhoso.json");
  const publicDirectory = path.join(projectRoot, "public");
  const dossier = eligibleDossier();
  await fs.mkdir(path.dirname(dossierPath), { recursive: true });
  await fs.mkdir(path.join(publicDirectory, "musicxml"), { recursive: true });
  await fs.writeFile(dossierPath, `${JSON.stringify(dossier, null, 2)}\n`);
  await fs.writeFile(
    path.join(publicDirectory, "catalog.json"),
    `${JSON.stringify(publicCatalogFromDossiers([dossier]), null, 2)}\n`,
  );
  await createPrivateCapture({
    captureId,
    confirmedBy: "editor-fixture",
    editionId: "edicao-carinhoso",
    projectRoot,
    provenance: "manual_file",
    workId: "obra-carinhoso",
    xml: xml(note),
  });
  return { captureId, dossierPath, projectRoot };
}

async function promote(project, options = {}) {
  return promotePrivateCapture({
    captureId: project.captureId,
    projectRoot: project.projectRoot,
    promotedAt: "2026-08-13T22:00:00.000Z",
    promotedBy: "editor-fixture",
    publicId: "carinhoso",
    ...options,
  });
}

test("promove uma captura validada e repete a operacao sem nova versao", async () => {
  const project = await fixture();
  try {
    const first = await promote(project);
    const dossier = JSON.parse(await fs.readFile(project.dossierPath, "utf8"));
    const catalog = JSON.parse(
      await fs.readFile(path.join(project.projectRoot, "public", "catalog.json"), "utf8"),
    );
    const assetPath = path.join(
      project.projectRoot,
      "public",
      first.asset.path.replace(/^\/+/, ""),
    );

    assert.equal(first.promoted, true);
    assert.equal(first.idempotent, false);
    assert.equal(dossier.assets.length, 1);
    assert.equal(dossier.assets[0].generatedBy, "editor-fixture");
    assert.equal(catalog.songs[0].musicxml, first.asset.path);
    await fs.access(assetPath);

    const repeated = await promote(project);
    const repeatedDossier = JSON.parse(await fs.readFile(project.dossierPath, "utf8"));
    assert.equal(repeated.promoted, false);
    assert.equal(repeated.idempotent, true);
    assert.equal(repeatedDossier.assets.length, 1);
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

test("informa conflito de asset preexistente sem mascarar o erro", async () => {
  const project = await fixture();
  try {
    const record = (
      await verifyPrivateCapture({
        captureId: project.captureId,
        projectRoot: project.projectRoot,
      })
    ).record;
    const assetDirectory = path.join(
      project.projectRoot,
      "public",
      "musicxml",
      "carinhoso",
    );
    await fs.mkdir(assetDirectory, { recursive: true });
    await fs.writeFile(
      path.join(
        assetDirectory,
        `asset-musicxml-carinhoso-${record.canonicalSha256.slice(0, 12)}.musicxml`,
      ),
      "conteudo preexistente",
    );

    await assert.rejects(
      () => promote(project),
      (error) => error.code === "PROMOTION_ASSET_CONFLICT",
    );
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

test("substitui por caminho versionado e preserva o asset anterior", async () => {
  const project = await fixture();
  try {
    const first = await promote(project);
    const secondCaptureId = "capture_promotion_00000002";
    await createPrivateCapture({
      captureId: secondCaptureId,
      confirmedBy: "editor-fixture",
      editionId: "edicao-carinhoso",
      projectRoot: project.projectRoot,
      provenance: "manual_file",
      workId: "obra-carinhoso",
      xml: xml("D"),
    });
    const second = await promotePrivateCapture({
      captureId: secondCaptureId,
      projectRoot: project.projectRoot,
      promotedAt: "2026-08-14T10:00:00.000Z",
      promotedBy: "editor-fixture",
      publicId: "carinhoso",
    });
    const dossier = JSON.parse(await fs.readFile(project.dossierPath, "utf8"));
    const previous = dossier.assets.find((asset) => asset.id === first.asset.id);
    const current = dossier.assets.find((asset) => asset.id === second.asset.id);

    assert.notEqual(first.asset.path, second.asset.path);
    assert.equal(previous.status, "substituido");
    assert.equal(previous.replacedByAssetId, current.id);
    assert.equal(current.replacesAssetId, previous.id);
    await fs.access(
      path.join(project.projectRoot, "public", first.asset.path.replace(/^\/+/, "")),
    );
    await fs.access(
      path.join(project.projectRoot, "public", second.asset.path.replace(/^\/+/, "")),
    );

    const oldAgain = await promote(project);
    assert.equal(oldAgain.idempotent, true);
    assert.equal(oldAgain.historical, true);
    assert.equal(
      JSON.parse(await fs.readFile(project.dossierPath, "utf8")).assets.length,
      2,
    );
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

for (const phase of ["asset_written", "dossier_written", "catalog_written"]) {
  test(`reverte todos os artefatos quando falha depois de ${phase}`, async () => {
    const project = await fixture();
    const beforeDossier = await fs.readFile(project.dossierPath, "utf8");
    const catalogPath = path.join(project.projectRoot, "public", "catalog.json");
    const beforeCatalog = await fs.readFile(catalogPath, "utf8");
    try {
      await assert.rejects(
        () => promote(project, { failAfterPhase: phase }),
        (error) => error.code === "INJECTED_PROMOTION_FAILURE",
      );
      assert.equal(await fs.readFile(project.dossierPath, "utf8"), beforeDossier);
      assert.equal(await fs.readFile(catalogPath, "utf8"), beforeCatalog);
      const publicFiles = await fs.readdir(
        path.join(project.projectRoot, "public", "musicxml"),
        { recursive: true },
      );
      assert.equal(publicFiles.some((file) => file.endsWith(".musicxml")), false);
    } finally {
      await fs.rm(project.projectRoot, { recursive: true, force: true });
    }
  });
}

test("recupera uma transacao interrompida e restaura o estado anterior", async () => {
  const project = await fixture();
  const beforeDossier = await fs.readFile(project.dossierPath, "utf8");
  try {
    await assert.rejects(
      () => promote(project, { crashAfterPhase: "dossier_written" }),
      (error) => error.code === "SIMULATED_PROMOTION_CRASH",
    );
    assert.notEqual(await fs.readFile(project.dossierPath, "utf8"), beforeDossier);
    const recovered = await recoverInterruptedPromotions({
      force: true,
      projectRoot: project.projectRoot,
    });
    assert.equal(recovered.recovered.length, 1);
    assert.equal(await fs.readFile(project.dossierPath, "utf8"), beforeDossier);
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

test("uma segunda promocao concorrente perde com conflito seguro", async () => {
  const project = await fixture();
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  let prepared;
  const reachedPrepared = new Promise((resolve) => {
    prepared = resolve;
  });

  try {
    const first = promote(project, {
      onPhase: async (phase) => {
        if (phase === "prepared") {
          prepared();
          await barrier;
        }
      },
    });
    await reachedPrepared;
    await assert.rejects(
      () => recoverInterruptedPromotions({ projectRoot: project.projectRoot }),
      (error) => error.code === "PROMOTION_CONFLICT",
    );
    await assert.rejects(
      () => promote(project),
      (error) => error.code === "PROMOTION_CONFLICT",
    );
    release();
    assert.equal((await first).promoted, true);
  } finally {
    release?.();
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

test("retirada de direitos durante a operacao cancela sem desfazer a retirada", async () => {
  const project = await fixture();
  try {
    await assert.rejects(
      () =>
        promote(project, {
          onPhase: async (phase) => {
            if (phase !== "asset_written") return;
            const dossier = JSON.parse(await fs.readFile(project.dossierPath, "utf8"));
            dossier.rights.actions.distribuir_musicxml = "bloqueada";
            dossier.rights.status = "bloqueado";
            await fs.writeFile(project.dossierPath, `${JSON.stringify(dossier, null, 2)}\n`);
          },
        }),
      (error) => error.code === "PROMOTION_RIGHTS_BLOCKED",
    );
    const after = JSON.parse(await fs.readFile(project.dossierPath, "utf8"));
    assert.equal(after.rights.actions.distribuir_musicxml, "bloqueada");
    assert.equal(after.assets.length, 0);
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});

test("rollback explicito restaura catalogo e dossie anteriores", async () => {
  const project = await fixture();
  const beforeDossier = await fs.readFile(project.dossierPath, "utf8");
  const catalogPath = path.join(project.projectRoot, "public", "catalog.json");
  const beforeCatalog = await fs.readFile(catalogPath, "utf8");
  try {
    const promoted = await promote(project);
    const rolledBack = await rollbackPromotion({
      projectRoot: project.projectRoot,
      rolledBackBy: "editor-fixture",
      transactionId: promoted.transactionId,
    });
    assert.equal(rolledBack.rolledBack, true);
    assert.equal(await fs.readFile(project.dossierPath, "utf8"), beforeDossier);
    assert.equal(await fs.readFile(catalogPath, "utf8"), beforeCatalog);
    await assert.rejects(
      () =>
        fs.access(
          path.join(
            project.projectRoot,
            "public",
            promoted.asset.path.replace(/^\/+/, ""),
          ),
        ),
      /ENOENT/,
    );
  } finally {
    await fs.rm(project.projectRoot, { recursive: true, force: true });
  }
});
