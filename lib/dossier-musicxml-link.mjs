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

function importedAssetVersionId(publicId, checksum) {
  return `${importedAssetId(publicId)}-${checksum.slice(0, 12)}`;
}

function withoutId(items, id) {
  return (items ?? []).filter((item) => item.id !== id);
}

function currentImportedAsset(assets, publicId) {
  return (assets ?? []).find(
    (asset) =>
      asset.type === "musicxml" &&
      asset.status === "valido" &&
      asset.id.startsWith(importedAssetId(publicId)),
  );
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
  const checksum = sha256(xml);
  const assetId = importedAssetVersionId(publicId, checksum);
  const currentAsset = currentImportedAsset(parsed.assets, publicId);
  const unchanged = currentAsset?.checksum === checksum;
  const replacementReason = `Substituicao gerada pelo importador local em ${generatedAt}.`;
  const retainedAssets = unchanged
    ? (parsed.assets ?? [])
    : (parsed.assets ?? [])
        .filter((asset) => asset.id !== assetId)
        .map((asset) =>
          asset.id === currentAsset?.id
            ? {
                ...asset,
                replacedByAssetId: assetId,
                replacementReason,
                status: "substituido",
              }
            : asset,
        );

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
        notationProfile: { kind: "lead_sheet" },
        notes: "",
        publicCatalogId: publicId,
        source: "Importador local",
        status: "em_revisao",
        tags: [],
        title: metadata.title,
      },
    ],
    assets: unchanged
      ? retainedAssets
      : [
          ...retainedAssets,
          {
            checksum,
            checksumAlgorithm: "sha256",
            editionId,
            generatedAt,
            generatedBy,
            id: assetId,
            path: publicPath,
            replacesAssetId: currentAsset?.id,
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
  const assets = parsed.assets ?? [];
  const target = currentImportedAsset(assets, publicId);

  if (!target) {
    throw new Error(`Asset importado nao encontrado: ${importedAssetId(publicId)}`);
  }

  const nextDossier = {
    ...parsed,
    assets: assets.map((asset) =>
      asset.id === target.id
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
