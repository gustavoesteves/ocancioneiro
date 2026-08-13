import {
  currentCurationStatus,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";
import { legacyProjectionIssues } from "./dossier-catalog-projection.mjs";

export function summarizeEditorialDossier(entry) {
  const dossier = parseEditorialDossier(entry.dossier);
  const projectionIssues = legacyProjectionIssues(dossier);
  const currentDecision =
    (dossier.curation.decisions ?? []).find(
      (decision) => decision.id === dossier.curation.currentDecisionId,
    ) ?? null;

  return {
    assetCount: (dossier.assets ?? []).length,
    currentDecision: currentDecision
      ? {
          decidedAt: currentDecision.decidedAt,
          decidedBy: currentDecision.decidedBy,
          id: currentDecision.id,
          justification: currentDecision.justification,
          status: currentDecision.status,
        }
      : null,
    editionCount: (dossier.editions ?? []).length,
    filePath: entry.filePath,
    publicCatalogId: dossier.publicCatalogId ?? null,
    publicable: projectionIssues.length === 0,
    projectionIssues,
    sources: (dossier.sources ?? []).map((source) => ({
      id: source.id,
      reference: source.reference ?? null,
      title: source.title,
      type: source.type,
    })),
    status: currentCurationStatus(dossier.curation),
    title: dossier.work.preferredTitle,
    workId: dossier.work.id,
  };
}

export function summarizeEditorialDossiers(entries) {
  return entries
    .map((entry) => summarizeEditorialDossier(entry))
    .sort((left, right) =>
      left.title.localeCompare(right.title, "pt-BR", { sensitivity: "base" }),
    );
}
