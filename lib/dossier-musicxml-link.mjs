import { createHash } from "node:crypto";
import { parseEditorialDossier } from "./editorial-dossier.mjs";
import {
  chordsFromMusicXml,
  instrumentationFromMusicXml,
  keyFromMusicXml,
  metadataFromMusicXml,
} from "./musicxml-metadata.mjs";

const defaultGeneratedBy = "importador-local";

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function importedEditionId(publicId) {
  return `edicao-importada-${publicId}`;
}

function importedAssetId(publicId) {
  return `asset-musicxml-${publicId}`;
}

function withoutId(items, id) {
  return (items ?? []).filter((item) => item.id !== id);
}

export function linkMusicXmlToDossier(
  dossier,
  {
    generatedAt = "2026-08-07",
    generatedBy = defaultGeneratedBy,
    publicId,
    publicPath,
    xml,
  },
) {
  const parsed = parseEditorialDossier(dossier);
  const metadata = metadataFromMusicXml(xml, `${publicId}.musicxml`);
  const editionId = importedEditionId(publicId);
  const assetId = importedAssetId(publicId);

  const nextDossier = {
    ...parsed,
    publicCatalogId: parsed.publicCatalogId ?? publicId,
    editions: [
      ...withoutId(parsed.editions, editionId),
      {
        chords: chordsFromMusicXml(xml),
        encodedKey: keyFromMusicXml(xml),
        genre: "Nao classificado",
        id: editionId,
        instrumentation: instrumentationFromMusicXml(xml),
        level: "Nao classificado",
        notes: "Edicao criada pelo importador local; revisar antes de publicar.",
        publicCatalogId: publicId,
        source: "Importador local",
        status: "valida",
        tags: [],
        title: metadata.title,
      },
    ],
    assets: [
      ...withoutId(parsed.assets, assetId),
      {
        checksum: sha256(xml),
        checksumAlgorithm: "sha256",
        editionId,
        generatedAt,
        generatedBy,
        id: assetId,
        path: publicPath,
        status: "valido",
        type: "musicxml",
      },
    ],
  };

  return parseEditorialDossier(nextDossier);
}

export function archiveImportedMusicXmlAsset(
  dossier,
  {
    archivedAt = "2026-08-07",
    archivedBy = defaultGeneratedBy,
    publicId = dossier.publicCatalogId,
    reason = "Asset arquivado pelo importador local.",
  } = {},
) {
  const parsed = parseEditorialDossier(dossier);
  const assetId = importedAssetId(publicId);
  const assets = parsed.assets ?? [];
  const target = assets.find((asset) => asset.id === assetId);

  if (!target) {
    throw new Error(`Asset importado nao encontrado: ${assetId}`);
  }

  const nextDossier = {
    ...parsed,
    assets: assets.map((asset) =>
      asset.id === assetId
        ? {
            ...asset,
            archivedAt,
            archivedBy,
            archiveReason: reason,
            status: "bloqueado",
          }
        : asset,
    ),
  };

  return parseEditorialDossier(nextDossier);
}
