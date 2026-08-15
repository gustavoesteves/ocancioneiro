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

  return {
    blockedRights,
    curationAccepted,
    edition,
    editionValid,
    ready: Boolean(edition && editionValid && curationAccepted && blockedRights.length === 0),
  };
}
