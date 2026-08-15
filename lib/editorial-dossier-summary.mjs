import {
  currentCurationStatus,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";
import { legacyProjectionIssues } from "./dossier-catalog-projection.mjs";
import { promotionGateState } from "./promotion-policy.mjs";

export function summarizeEditorialDossier(entry) {
  const dossier = parseEditorialDossier(entry.dossier);
  const projectionIssues = legacyProjectionIssues(dossier);
  const currentDecision =
    (dossier.curation.decisions ?? []).find(
      (decision) => decision.id === dossier.curation.currentDecisionId,
    ) ?? null;
  const promotionGates = promotionGateState(
    dossier,
    dossier.editions?.[0]?.id ?? "",
  );

  return {
    assetCount: (dossier.assets ?? []).length,
    creators: dossier.work.creators.map((creator) => ({
      name: creator.name,
      role: creator.role,
    })),
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
    editions: (dossier.editions ?? []).map((edition) => ({
      id: edition.id,
      status: edition.status,
      title: edition.title,
    })),
    publicCatalogId: dossier.publicCatalogId ?? null,
    publicable: projectionIssues.length === 0,
    blockedPromotionRights: promotionGates.blockedRights,
    projectionIssues,
    rightsStatus: dossier.rights.status,
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
