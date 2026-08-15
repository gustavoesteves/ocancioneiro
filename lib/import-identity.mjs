export function normalizedImportIdentity(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function importIdentityDifferences(metadata, dossier) {
  const differences = [];
  const dossierTitle = dossier.title ?? dossier.work?.preferredTitle ?? "";
  if (
    normalizedImportIdentity(metadata.title) !== normalizedImportIdentity(dossierTitle)
  ) {
    differences.push(
      `Titulo capturado: "${metadata.title}"; dossie: "${dossierTitle}".`,
    );
  }
  const creators = dossier.creators ?? dossier.work?.creators ?? [];
  const composers = creators
    .filter((creator) => creator.role === "composer")
    .map((creator) => creator.name);
  if (
    composers.length > 0 &&
    !composers
      .map(normalizedImportIdentity)
      .includes(normalizedImportIdentity(metadata.composer))
  ) {
    differences.push(
      `Compositor capturado: "${metadata.composer}"; dossie: "${composers.join(", ")}".`,
    );
  }
  return differences;
}
