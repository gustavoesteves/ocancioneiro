import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicCatalogFromDossiers } from "../lib/dossier-catalog-projection.mjs";
import { decisionRecordHash } from "../lib/editorial-dossier.mjs";
import {
  promotePrivateCapture,
  rollbackPromotion,
} from "../lib/private-capture-promotion.mjs";
import {
  createPrivateCapture,
  verifyPrivateCapture,
} from "../lib/private-capture-store.mjs";
import { stagePublicAssets } from "./stage-public-assets.mjs";
import { verifyPublicPackage } from "./verify-public-package.mjs";

const captureId = "capture_fixture_livre_000001";

function fixtureMusicXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Estudo Livre para o Cancioneiro</work-title></work>
  <identification><creator type="composer">Fixture editorial</creator></identification>
  <part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes><harmony><root><root-step>C</root-step></root><kind>major</kind></harmony><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part>
</score-partwise>`;
}

function eligibleFixtureDossier() {
  const decision = {
    decidedAt: "2026-08-14",
    decidedBy: "ensaio-automatizado",
    id: "decisao-fixture-livre",
    justification: "Fixture sintetica criada para validar o fluxo operacional.",
    reviews: [
      {
        conflictOfInterest: false,
        reviewedAt: "2026-08-14",
        reviewedBy: "revisor-fixture",
        role: "revisao-editorial",
        summary: "Conteudo sintetico sem restricao de distribuicao.",
      },
    ],
    status: "aceita",
  };
  return {
    schemaVersion: 1,
    publicCatalogId: "estudo-livre-fixture",
    work: {
      creators: [{ name: "Fixture editorial", role: "composer" }],
      id: "obra-estudo-livre-fixture",
      preferredTitle: "Estudo Livre para o Cancioneiro",
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
        genre: "Estudo",
        id: "edicao-estudo-livre-fixture",
        instrumentation: "Melodia e acordes",
        level: "Iniciante",
        notes: "Fixture sintetica; nao representa arranjo editorial.",
        publicCatalogId: "estudo-livre-fixture",
        source: "Fixture gerada pelo proprio projeto",
        status: "valida",
        tags: ["fixture"],
        title: "Estudo Livre para o Cancioneiro",
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

async function exists(filePath) {
  return fs.access(filePath).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    },
  );
}

export async function runMuseScoreWorkflowCheck() {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cancioneiro-workflow-check-"),
  );
  try {
    const dossier = eligibleFixtureDossier();
    const dossierPath = path.join(
      projectRoot,
      "data",
      "dossiers",
      "estudo-livre-fixture.json",
    );
    const publicDirectory = path.join(projectRoot, "public");
    const packageDirectory = path.join(projectRoot, "package-check");
    await fs.mkdir(path.dirname(dossierPath), { recursive: true });
    await fs.mkdir(publicDirectory, { recursive: true });
    await Promise.all([
      fs.writeFile(dossierPath, `${JSON.stringify(dossier, null, 2)}\n`),
      fs.writeFile(
        path.join(publicDirectory, "catalog.json"),
        `${JSON.stringify(publicCatalogFromDossiers([dossier]), null, 2)}\n`,
      ),
      fs.writeFile(
        path.join(publicDirectory, "favicon.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>\n',
      ),
    ]);

    await createPrivateCapture({
      captureId,
      confirmedBy: "editor-fixture",
      editionId: "edicao-estudo-livre-fixture",
      projectRoot,
      provenance: "musescore_export",
      workId: "obra-estudo-livre-fixture",
      xml: fixtureMusicXml(),
    });
    await verifyPrivateCapture({ captureId, projectRoot });

    const promotion = await promotePrivateCapture({
      captureId,
      projectRoot,
      promotedAt: "2026-08-14T12:00:00.000Z",
      promotedBy: "promotor-fixture",
      publicId: "estudo-livre-fixture",
    });
    const staged = await stagePublicAssets({
      outputDirectory: packageDirectory,
      projectRoot,
    });
    const verifiedPackage = await verifyPublicPackage({
      outputDirectory: packageDirectory,
      projectRoot,
    });

    await rollbackPromotion({
      projectRoot,
      rolledBackBy: "operador-fixture",
      transactionId: promotion.transactionId,
    });
    const promotedAssetPath = path.join(
      publicDirectory,
      promotion.asset.path.replace(/^\/+/, ""),
    );
    const privateCaptureStillValid = (
      await verifyPrivateCapture({ captureId, projectRoot })
    ).verified;
    const publicAssetRemoved = !(await exists(promotedAssetPath));

    await fs.rm(packageDirectory, { recursive: true, force: true });
    const stagedAfterRollback = await stagePublicAssets({
      outputDirectory: packageDirectory,
      projectRoot,
    });
    await verifyPublicPackage({
      outputDirectory: packageDirectory,
      projectRoot,
    });

    if (
      staged.assetCount !== 1 ||
      verifiedPackage.assetCount !== 1 ||
      stagedAfterRollback.assetCount !== 0 ||
      !privateCaptureStillValid ||
      !publicAssetRemoved
    ) {
      throw new Error("O ensaio operacional nao preservou todas as invariantes.");
    }

    return {
      captureVerified: true,
      packageAssetCount: verifiedPackage.assetCount,
      privateCapturePreservedAfterRollback: privateCaptureStillValid,
      publicAssetRemovedAfterRollback: publicAssetRemoved,
      rollbackPackageAssetCount: stagedAfterRollback.assetCount,
    };
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMuseScoreWorkflowCheck()
    .then((result) => {
      console.log(
        `Fluxo local validado: captura=${result.captureVerified}, pacote=${result.packageAssetCount}, rollback=${result.publicAssetRemovedAfterRollback}.`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
