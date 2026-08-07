import {
  currentCurationStatus,
  parseEditorialDossier,
} from "./editorial-dossier.mjs";
import { legacyProjectionIssues } from "./dossier-catalog-projection.mjs";

export function summarizeEditorialDossier(entry) {
  const dossier = parseEditorialDossier(entry.dossier);
  const projectionIssues = legacyProjectionIssues(dossier);

  return {
    assetCount: (dossier.assets ?? []).length,
    editionCount: (dossier.editions ?? []).length,
    filePath: entry.filePath,
    publicCatalogId: dossier.publicCatalogId ?? null,
    publicable: projectionIssues.length === 0,
    projectionIssues,
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
