import {
  currentCurationStatus,
  effectivePermission,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";

export const requiredPromotionActions = [
  "exibir_metadados",
  "exibir_partitura",
  "reproduzir_playback",
  "imprimir",
  "distribuir_musicxml",
];

export function minimumResearchState(dossier) {
  const parsed = parseEditorialDossier(dossier);
  const sourceIds = new Set((parsed.sources ?? []).map((source) => source.id));
  const evidenceIds = new Set((parsed.evidence ?? []).map((evidence) => evidence.id));
  const sourcedEvidence = (parsed.evidence ?? []).filter((evidence) =>
    (evidence.sources ?? []).some((sourceUse) => sourceIds.has(sourceUse.sourceId)),
  );
  const linkedClaims = (parsed.curation.canonicalClaims ?? []).filter((claim) =>
    (claim.evidenceIds ?? []).some((evidenceId) => evidenceIds.has(evidenceId)),
  );
  const pending = [];

  if ((parsed.sources ?? []).length === 0) pending.push("sem fontes estruturadas");
  if ((parsed.evidence ?? []).length === 0) pending.push("sem evidencias estruturadas");
  if (sourcedEvidence.length === 0) {
    pending.push("sem evidencia ligada a fonte");
  }
  if (linkedClaims.length === 0) {
    pending.push("sem afirmacao canonica ligada a evidencia");
  }

  return {
    complete: pending.length === 0,
    evidenceCount: parsed.evidence?.length ?? 0,
    linkedCanonicalClaimCount: linkedClaims.length,
    pending,
    sourceCount: parsed.sources?.length ?? 0,
    sourcedEvidenceCount: sourcedEvidence.length,
  };
}

export function promotionGateState(dossier, editionId) {
  const parsed = parseEditorialDossier(dossier);
  const edition = (parsed.editions ?? []).find(
    (candidate) => candidate.id === editionId,
  ) ?? null;
  const blockedRights = requiredPromotionActions.filter(
    (action) => effectivePermission(parsed.rights, action) !== "permitida",
  );
  const editionValid = edition?.status === "valida";
  const curationAccepted = currentCurationStatus(parsed.curation) === "aceita";
  const research = minimumResearchState(parsed);

  return {
    blockedRights,
    curationAccepted,
    edition,
    editionValid,
    researchComplete: research.complete,
    researchPending: research.pending,
    ready: Boolean(
      edition &&
        editionValid &&
        curationAccepted &&
        research.complete &&
        blockedRights.length === 0,
    ),
  };
}
