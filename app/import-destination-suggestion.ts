import type { ManagedDossier } from "./import-types";

export type ImportDestinationSuggestion =
  | {
      editionId: null;
      mode: "new";
      workId: null;
    }
  | {
      editionId: string | null;
      mode: "existing";
      workId: string;
    };

export function suggestImportDestination(
  musicXmlId: string,
  dossiers: ManagedDossier[],
): ImportDestinationSuggestion {
  const expectedWorkId = `obra-${musicXmlId}`;
  const expectedEditionId = `edicao-importada-${musicXmlId}`;
  const matchingDossier = dossiers.find(
    (dossier) =>
      dossier.workId === expectedWorkId ||
      dossier.publicCatalogId === musicXmlId,
  );

  if (!matchingDossier) {
    return { editionId: null, mode: "new", workId: null };
  }

  const importedEdition = matchingDossier.editions.find(
    (edition) => edition.id === expectedEditionId,
  );
  const editionId =
    importedEdition?.id ??
    (matchingDossier.editions.length === 1
      ? matchingDossier.editions[0].id
      : matchingDossier.editions.length === 0
        ? expectedEditionId
        : null);

  return {
    editionId,
    mode: "existing",
    workId: matchingDossier.workId,
  };
}
