import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  applyPromotionReview,
  PromotionReviewError,
} from "../../../../../../lib/editorial-promotion-review.mjs";
import { editionFileFingerprint } from "../../../../../../lib/editorial-edition-metadata.mjs";
import { promotionGateState } from "../../../../../../lib/promotion-policy.mjs";
import { privateCapturePaths } from "../../../../../../lib/private-capture-store.mjs";
import { resolveLocalProjectRoot } from "../../../../../../lib/local-project-root.mjs";
import { main as generateCatalog } from "../../../../../../scripts/generate-catalog.mjs";
import { loadEditorialDossiers } from "../../../../../../scripts/validate-dossiers.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const workIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;

function requireLocalRequest(request: Request) {
  const url = new URL(request.url);
  if (!localHosts.has(url.hostname)) {
    return Response.json(
      { error: "Revisao editorial disponivel apenas em ambiente local." },
      { status: 403 },
    );
  }
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (!localHosts.has(new URL(origin).hostname)) {
        return Response.json({ error: "Origem nao autorizada." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Origem nao autorizada." }, { status: 403 });
    }
  }
  return null;
}

async function dossierEntry(projectRoot: string, workId: string) {
  if (!workIdPattern.test(workId)) {
    throw new PromotionReviewError("INVALID_PROMOTION_REVIEW", "workId invalido.");
  }
  const entry = (await loadEditorialDossiers(path.join(projectRoot, "data", "dossiers")))
    .find((candidate) => candidate.dossier.work.id === workId);
  if (!entry) {
    throw new PromotionReviewError("DOSSIER_NOT_FOUND", "Dossie nao encontrado.");
  }
  const stat = await fs.lstat(entry.filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new PromotionReviewError("UNSAFE_DOSSIER", "Arquivo de dossie inseguro.");
  }
  return entry;
}

function preferredEditionId(dossier: {
  assets?: { editionId?: string; status?: string; type?: string }[];
  editions?: { id: string; status: string }[];
}) {
  return (
    dossier.assets?.find(
      (asset) => asset.type === "musicxml" && asset.status === "valido",
    )?.editionId ??
    dossier.editions?.find((edition) => edition.status === "valida")?.id ??
    dossier.editions?.[0]?.id ??
    null
  );
}

function responseBody(
  dossier: {
    assets?: { editionId?: string; status?: string; type?: string }[];
    curation: { status: string };
    editions?: {
      id: string;
      notationProfile?: {
        instrument?: "piano" | "violao";
        justification?: string;
        kind: "lead_sheet" | "partitura_instrumental_original";
      };
      status: string;
      title?: string;
    }[];
    rights: {
      basis?: string;
      confirmedAt?: string;
      confirmedBy?: string;
      status: string;
    };
    work: {
      creators: { name: string; role: string }[];
      id: string;
      preferredTitle: string;
    };
  },
  editionId: string | null,
  fingerprint: string,
  updated = false,
) {
  const selectedEditionId = editionId ?? preferredEditionId(dossier);
  const gates = selectedEditionId
    ? promotionGateState(dossier, selectedEditionId)
    : {
        blockedRights: [],
        curationAccepted: false,
        editionValid: false,
        ready: false,
      };
  return {
    editions: (dossier.editions ?? []).map((edition) => ({
      id: edition.id,
      notationProfile: edition.notationProfile ?? { kind: "lead_sheet" },
      status: edition.status,
      title: edition.title ?? edition.id,
    })),
    fingerprint,
    gates: {
      blockedRights: gates.blockedRights,
      curationAccepted: gates.curationAccepted,
      editionValid: gates.editionValid,
      ready: gates.ready,
    },
    preferredEditionId: selectedEditionId,
    rights: {
      basis: dossier.rights.basis ?? "",
      confirmedAt: dossier.rights.confirmedAt ?? null,
      confirmedBy: dossier.rights.confirmedBy ?? "",
      status: dossier.rights.status,
    },
    updated,
    work: {
      creators: dossier.work.creators,
      id: dossier.work.id,
      title: dossier.work.preferredTitle,
    },
  };
}

async function writeTextAtomically(filePath: string, value: string) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, value, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function acquireCatalogLock(projectRoot: string) {
  const probe = await privateCapturePaths(projectRoot, "capture_review_lock_000001");
  const lockRoot = path.join(probe.root, "locks");
  const lockPath = path.join(lockRoot, "promotion-catalog.lock");
  await fs.mkdir(lockRoot, { recursive: true, mode: 0o700 });
  try {
    await fs.mkdir(lockPath, { mode: 0o700 });
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({
        operation: "promotion_review",
        pid: process.pid,
        startedAt: new Date().toISOString(),
      })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new PromotionReviewError(
        "EDITORIAL_WRITE_CONFLICT",
        "Outra alteracao editorial esta em andamento.",
      );
    }
    await fs.rm(lockPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return async () => fs.rm(lockPath, { recursive: true, force: true });
}

function errorResponse(error: unknown) {
  if (error instanceof PromotionReviewError) {
    const status = error.code === "DOSSIER_NOT_FOUND" || error.code === "EDITION_NOT_FOUND"
      ? 404
      : error.code === "EDITORIAL_WRITE_CONFLICT" || error.code === "DOSSIER_CHANGED"
        ? 409
        : 400;
    return Response.json({ code: error.code, error: error.message }, { status });
  }
  console.error(error);
  return Response.json(
    { error: "Falha inesperada ao concluir a revisao editorial." },
    { status: 500 },
  );
}

type RouteContext = { params: Promise<{ workId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;
  try {
    const projectRoot = await resolveLocalProjectRoot();
    const { workId } = await context.params;
    const entry = await dossierEntry(projectRoot, workId);
    const contents = await fs.readFile(entry.filePath, "utf8");
    const requestedEdition = new URL(request.url).searchParams.get("edition");
    return Response.json(
      responseBody(
        entry.dossier,
        requestedEdition,
        editionFileFingerprint(contents),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  let releaseLock: (() => Promise<void>) | null = null;
  try {
    const projectRoot = await resolveLocalProjectRoot();
    const { workId } = await context.params;
    const body = (await request.json()) as {
      curationAccepted?: boolean;
      curationDecidedBy?: string;
      curationJustification?: string;
      curationReviewedBy?: string;
      editionId?: string;
      editionReviewed?: boolean;
      editionReviewedBy?: string;
      expectedFingerprint?: string;
      notationInstrument?: "piano" | "violao";
      notationJustification?: string;
      notationKind?: "lead_sheet" | "partitura_instrumental_original";
      rightsBasis?: string;
      rightsConfirmed?: boolean;
      rightsConfirmedBy?: string;
    };
    if (!/^[a-f0-9]{64}$/.test(body.expectedFingerprint ?? "")) {
      throw new PromotionReviewError(
        "INVALID_PROMOTION_REVIEW",
        "Fingerprint do dossie invalido.",
      );
    }

    releaseLock = await acquireCatalogLock(projectRoot);
    const entry = await dossierEntry(projectRoot, workId);
    const catalogPath = path.join(projectRoot, "public", "catalog.json");
    const [originalDossier, originalCatalog] = await Promise.all([
      fs.readFile(entry.filePath, "utf8"),
      fs.readFile(catalogPath, "utf8"),
    ]);
    if (editionFileFingerprint(originalDossier) !== body.expectedFingerprint) {
      throw new PromotionReviewError(
        "DOSSIER_CHANGED",
        "O dossie mudou desde que a tela foi aberta. Atualize antes de salvar.",
      );
    }

    const reviewedAt = new Date().toISOString();
    const update = applyPromotionReview(JSON.parse(originalDossier), {
      curationAccepted: body.curationAccepted,
      curationDecidedBy: body.curationDecidedBy,
      curationJustification: body.curationJustification,
      curationReviewedBy: body.curationReviewedBy,
      decisionId: `decisao-promocao-${randomUUID()}`,
      editionId: body.editionId,
      editionReviewed: body.editionReviewed,
      editionReviewedBy: body.editionReviewedBy,
      notationInstrument: body.notationInstrument,
      notationJustification: body.notationJustification,
      notationKind: body.notationKind,
      reviewedAt,
      rightsBasis: body.rightsBasis,
      rightsConfirmed: body.rightsConfirmed,
      rightsConfirmedBy: body.rightsConfirmedBy,
    });
    const nextDossier = `${JSON.stringify(update.dossier, null, 2)}\n`;
    await writeTextAtomically(entry.filePath, nextDossier);
    try {
      await generateCatalog({ projectRoot });
    } catch (error) {
      await Promise.all([
        writeTextAtomically(entry.filePath, originalDossier),
        writeTextAtomically(catalogPath, originalCatalog),
      ]);
      throw error;
    }

    return Response.json(
      responseBody(
        update.dossier,
        body.editionId ?? null,
        editionFileFingerprint(nextDossier),
        true,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (releaseLock) await releaseLock();
  }
}
