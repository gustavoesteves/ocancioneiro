import { parseEditorialDossier } from "./editorial-dossier.mjs";

function expectedWorkId(publicId) {
  return publicId.startsWith("obra-") ? publicId : `obra-${publicId}`;
}

export function findDossierImportConflict(dossierEntries, publicId) {
  const workId = expectedWorkId(publicId);

  for (const entry of dossierEntries) {
    const dossier = parseEditorialDossier(entry.dossier);
    if (dossier.publicCatalogId === publicId || dossier.work.id === workId) {
      return {
        filePath: entry.filePath,
        publicCatalogId: dossier.publicCatalogId ?? null,
        title: dossier.work.preferredTitle,
        workId: dossier.work.id,
      };
    }
  }

  return null;
}

export function dossierConflictMessage(conflict) {
  return `Ja existe dossie editorial para "${conflict.title}" (${conflict.workId}). Vinculacao de MusicXML a dossie existente ainda nao foi migrada.`;
}
