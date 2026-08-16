import path from "node:path";
import { summarizeEditorialDossiers } from "../../../../lib/editorial-dossier-summary.mjs";
import { listPrivateCaptures } from "../../../../lib/private-capture-store.mjs";
import { resolveLocalProjectRoot } from "../../../../lib/local-project-root.mjs";
import {
  dossierReviewReport,
  evidenceCoverageMatrix,
  loadEditorialDossiers,
} from "../../../../scripts/validate-dossiers.mjs";
import type { ManagedDossier } from "../../../import-types";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

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

export async function GET(request: Request) {
  const localError = requireLocalRequest(request);
  if (localError) return localError;

  try {
    const projectRoot = await resolveLocalProjectRoot();
    const dossierEntries = await loadEditorialDossiers(
      path.join(projectRoot, "data", "dossiers"),
    );
    const { captures, issues } = await listPrivateCaptures({ projectRoot });
    const dossiersByWorkId = new Map(
      dossierEntries.map((entry) => [entry.dossier.work.id, entry.dossier]),
    );

    return Response.json({
      captureIssues: issues,
      captures: captures.map((capture) => {
        const dossier = dossiersByWorkId.get(capture.workId);
        const promoted = (dossier?.assets ?? []).some(
          (asset: { checksum?: string; editionId?: string; type?: string }) =>
            asset.type === "musicxml" &&
            asset.editionId === capture.editionId &&
            asset.checksum === capture.canonicalSha256,
        );
        return { ...capture, promoted };
      }),
      dossiers: summarizeEditorialDossiers(dossierEntries).filter(
        (dossier: ManagedDossier) => !dossier.publicable,
      ),
      coverage: evidenceCoverageMatrix(dossierEntries),
      reviewReport: dossierReviewReport(dossierEntries),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar a revisao." },
      { status: 500 },
    );
  }
}
